/**
 * dsh-conversation-search — Host service + route tests.
 *
 * Runs entirely against a temporary `DSH_HOME` and synthetic multi-frame zstd
 * session logs; the real `~/.dsh` is never touched.
 *
 *   cd dsh-conversation-search && node --test tests/host-service.test.mjs
 *
 * Coverage (per task-3 acceptance):
 *  - multi-frame zstd decode; title fallback; CJK 2-character hits; case
 *    sensitivity; whole word; snippet/matchStart coordinates;
 *  - `limit`/`truncated`, `hitCount`/`hitsTruncated`, ordering;
 *  - incremental refresh re-parses only changed files; deleted sessions drop;
 *    corrupt logs are skipped without failing the index; rebuild; warm cache
 *    reuse; corrupt cache recovery;
 *  - `message` found/missing; `indexing` error before ready; empty query;
 *  - `thinking` extraction + `kinds` search scope (default dialogue scope,
 *    explicit tool/thinking scopes, `bad-kinds` validation);
 *  - loopback fence and the HTTP envelopes/error mapping of the routes.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { after, describe, it } from 'node:test';

import { createSearchService } from '../lib/host/service.js';
import { createRoutes } from '../lib/host/routes.js';
import { isLoopbackAddress, isLoopbackRequest } from '../lib/host/access.js';

/* ------------------------------------------------------------------------- */
/* synthetic session-log fixtures                                            */
/* ------------------------------------------------------------------------- */

/** Fixed epoch used by every fixture event (kept far from "now"). */
const BASE_TIME = 1_790_000_000_000;

/** One invariant across fixtures: a session's `project` directory name. */
const PROJECT_DIR = '--tmp-workspace--';

/** @param {number} seq @returns {number} deterministic event time. */
function eventTime(seq) {
  return BASE_TIME + seq * 1000;
}

/** @param {number} seq @param {string} type @param {object} data @param {string} [surfaceOp] */
function surfaceEvent(seq, type, data, surfaceOp = 'append') {
  return { type, seq, time: eventTime(seq), data, ...(surfaceOp === undefined ? {} : { surfaceOp }) };
}

/** Append-origin `user/message`. `sourceKind` other than `user` models injected context. */
function userMessage(seq, text, sourceKind = 'user') {
  return surfaceEvent(seq, 'user/message', { content: [{ type: 'text', text }], source: { kind: sourceKind }, role: 'user' });
}

/** Append-origin `assistant/message` with a reasoning block and a tool-call block. */
function assistantMessage(seq, text, { reasoning = 'HIDDEN-REASONING-TEXT', turn = 1 } = {}) {
  return surfaceEvent(seq, 'assistant/message', {
    turn,
    step: 1,
    message: {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: reasoning },
        { type: 'text', text },
        { type: 'tool-call', id: `call-${seq}`, name: 'bash', arguments: '{"command":"HIDDEN-TOOL-ARGS"}' },
      ],
    },
  });
}

/** Append-origin `tool/result`; `error` lands in `data.error` and joins the indexed text. */
function toolResult(seq, text, { error, turn = 1 } = {}) {
  const data = { turn, step: 1, message: { role: 'tool', content: [{ type: 'text', text }] } };
  if (error) data.error = error;
  return surfaceEvent(seq, 'tool/result', data);
}

/** A replacement `tool/result` row (model-only; must never be indexed). */
function replacementToolResult(seq, text, startSeq, endSeq) {
  const event = toolResult(seq, text);
  event.surfaceOp = { op: 'replace', startSeq, endSeq };
  return event;
}

/** Log-only `tool/call` row: no `surfaceOp`, indexed as `tool`/`log-only`. */
function toolCall(seq, name, argumentString, turn = 1) {
  return { type: 'tool/call', seq, time: eventTime(seq), data: { turn, step: 1, callId: `call-${seq}`, name, arguments: argumentString } };
}

/** `turn/start` boundary. */
function turnStart(seq, turn) {
  return { type: 'turn/start', seq, time: eventTime(seq), data: { turn } };
}

/** `session/title` row (latest one wins). */
function sessionTitle(seq, title) {
  return { type: 'session/title', seq, time: eventTime(seq), data: { title, messageSeqs: [], source: { kind: 'user' } } };
}

/** `system/message` row: must never be indexed. */
function systemMessage(seq, text) {
  return surfaceEvent(seq, 'system/message', { message: { role: 'system', content: [{ type: 'text', text }] } });
}

/** @param {number} count @returns {number[]} 0..count-1 */
function range(count) {
  return Array.from({ length: count }, (_, index) => index);
}

/** Split JSONL lines into independently-compressed zstd frames. */
function compressFrames(lines, frameCount = 2) {
  const frames = Math.max(1, Math.min(frameCount, lines.length));
  const perFrame = Math.max(1, Math.ceil(lines.length / frames));
  const encoded = [];
  for (let start = 0; start < lines.length; start += perFrame) {
    const chunk = lines.slice(start, start + perFrame);
    encoded.push(zlib.zstdCompressSync(Buffer.from(`${chunk.join('\n')}\n`, 'utf8')));
  }
  return Buffer.concat(encoded);
}

/**
 * Write one synthetic session log under `<sessionsRoot>/<project>/<sessionId>/`.
 * @param {string} sessionsRoot
 * @param {{id: string, project?: string, title?: string, events: object[], frames?: number,
 *   createdAt?: number, cwd?: string, headerExtra?: object}} session
 * @returns {{file: string, sessionDir: string}}
 */
function writeSessionLog(sessionsRoot, session) {
  const project = session.project ?? PROJECT_DIR;
  const sessionDir = path.join(sessionsRoot, project, session.id);
  fs.mkdirSync(sessionDir, { recursive: true });
  const header = {
    type: 'session',
    version: 4,
    id: session.id,
    createdAt: session.createdAt ?? BASE_TIME,
    cwd: session.cwd ?? '/tmp/dsh-conversation-search-workspace',
    isSeeded: false,
    delegationDepth: 0,
    agentPreset: 'standard',
    ...(session.headerExtra ?? {}),
  };
  const lines = [JSON.stringify(header), ...session.events.map((event) => JSON.stringify(event))];
  const file = path.join(sessionDir, 'session.v4.jsonl.zstd');
  fs.writeFileSync(file, compressFrames(lines, session.frames ?? 2));
  return { file, sessionDir };
}

/** Append one zstd frame with extra JSONL rows (models a live session's next write batch). */
function appendSessionEvents(file, events) {
  const payload = `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
  fs.appendFileSync(file, zlib.zstdCompressSync(Buffer.from(payload, 'utf8')));
}

/** The next free seq of a synthetic session (fixtures always allocate contiguous seqs). */
function nextSeq(events) {
  return events.length === 0 ? 0 : Math.max(...events.map((event) => event.seq)) + 1;
}

/* ------------------------------------------------------------------------- */
/* harness                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Temporary DSH_HOME + service factory.
 * @param {{serviceOptions?: object}} [options]
 */
function createHarness(options = {}) {
  const dshHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dcs-host-test-'));
  const sessionsRoot = path.join(dshHome, 'sessions');
  fs.mkdirSync(sessionsRoot, { recursive: true });
  const env = { DSH_HOME: dshHome };
  /** @type {Set<import('../lib/host/service.js').SearchService>} */
  const services = new Set();
  return {
    dshHome,
    sessionsRoot,
    env,
    service(serviceOptions = {}) {
      const service = createSearchService({ env, ...(options.serviceOptions ?? {}), ...serviceOptions });
      services.add(service);
      return service;
    },
    write: (session) => writeSessionLog(sessionsRoot, session),
    async cleanup() {
      for (const service of services) await service.stop();
      fs.rmSync(dshHome, { recursive: true, force: true });
    },
  };
}

/** Minimal `ServerResponse` stand-in for driving route handlers directly. */
function fakeResponse() {
  return {
    statusCode: 0,
    headers: null,
    payload: null,
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(body) {
      this.payload = body;
    },
    json() {
      return JSON.parse(this.payload);
    },
  };
}

/** Minimal `IncomingMessage` stand-in. */
function fakeRequest({ url = '/', method = 'GET', remoteAddress = '127.0.0.1' } = {}) {
  return { url, method, headers: { host: '127.0.0.1:62504' }, socket: { remoteAddress } };
}

/** Invoke one route handler and return its fake response. */
async function callRoute(route, requestOptions) {
  const res = fakeResponse();
  await route.handler(fakeRequest(requestOptions), res);
  return res;
}

/** @param {object[]} routes @param {string} path */
function routeAt(routes, routePath) {
  const route = routes.find((candidate) => candidate.path === routePath);
  assert.ok(route, `route ${routePath} is registered`);
  return route;
}

/* ------------------------------------------------------------------------- */
/* fixtures shared by several tests                                          */
/* ------------------------------------------------------------------------- */

/** Two sessions, one of which is a title-less one, with a unique CJK marker each. */
function seedTwoSessions(harness) {
  const first = {
    id: 'session-aaaa-0001',
    title: '会话一',
    events: [turnStart(0, 1), sessionTitle(1, '会话一'), userMessage(2, '第一个会话写的是 卸载 流程'), assistantMessage(3, '收到，开始处理')],
  };
  const second = {
    id: 'session-bbbb-0002',
    title: '会话二',
    events: [turnStart(0, 1), sessionTitle(1, '会话二'), userMessage(2, '第二个会话谈论 全家桶 与 打包')],
  };
  return { first: harness.write(first), second: harness.write(second) };
}

/* ------------------------------------------------------------------------- */
/* index lifecycle                                                           */
/* ------------------------------------------------------------------------- */

describe('index lifecycle', () => {
  it('builds a multi-frame index in the background and exposes status/progress', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);
    const service = harness.service();

    const starting = service.start();
    const during = service.status();
    assert.equal(during.building, true, 'status reports building while the first pass runs');
    assert.equal(during.ready, false);

    /** @type {{done: number, total: number}[]} */
    const progressSeen = [];
    while (!service.ready) {
      const status = service.status();
      if (status.progress) progressSeen.push({ ...status.progress });
      await new Promise((resolve) => setImmediate(resolve));
    }
    await starting;

    const status = service.status();
    assert.equal(status.ready, true);
    assert.equal(status.building, false);
    assert.equal(status.progress, null);
    assert.equal(status.sessions, 2);
    assert.equal(status.entries, 4, 'two user messages + assistant text + assistant thinking');
    assert.ok(status.chars > 0);
    assert.ok(status.updatedAt > 0);
    assert.equal(status.cacheDir, path.join(harness.dshHome, 'cache', 'dsh-conversation-search'));
    assert.equal(status.error, null);
    assert.ok(fs.existsSync(service.paths.indexPath), 'index cache was written');
    assert.ok(
      progressSeen.some((progress) => progress.total === 2),
      `progress reached total=2 (saw ${JSON.stringify(progressSeen)})`,
    );
    assert.equal(service.lastScan.kind, 'cold');
    assert.equal(service.lastScan.indexed, 2);
    assert.equal(service.lastScan.issues, 0);
  });

  it('keeps multi-frame sessions fully searchable (decode spans frames)', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    // Three frames: the marker in the last frame proves every frame was decoded.
    harness.write({
      id: 'session-frames-0003',
      frames: 3,
      events: [turnStart(0, 1), userMessage(1, '第一帧内容'), assistantMessage(2, '第二帧内容'), userMessage(3, '第三帧独有词 分帧标记ZETA')],
    });
    const service = harness.service();
    await service.start();
    const result = await service.search('分帧标记ZETA');
    assert.equal(result.totalSessions, 1);
    assert.equal(result.results[0].hits[0].seq, 3);
  });

  it('applies the contract title fallback chain', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    const longFirstMessage = '这是一个没有标题事件的新会话第一条用户消息，它会被截取前四十个字符作为标题并且折叠掉多余的空白字符';
    harness.write({
      id: 'session-titled-0004',
      events: [sessionTitle(0, '显式标题'), userMessage(1, '包含标题关键字的正文')],
    });
    harness.write({
      id: 'session-untitled-0005',
      events: [userMessage(0, longFirstMessage)],
    });
    harness.write({
      id: 'session-empty-0006',
      events: [systemMessage(0, '只有系统消息没有人类正文')],
    });
    const service = harness.service();
    await service.start();

    const sessions = service.index.sessions;
    assert.equal(sessions['session-titled-0004'].meta.title, '显式标题');
    const expectedFallback = Array.from(longFirstMessage.replace(/\s+/gu, ' ').trim()).slice(0, 40).join('');
    assert.equal(sessions['session-untitled-0005'].meta.title, expectedFallback);
    assert.equal(sessions['session-empty-0006'].meta.title, '未命名会话');
  });

  it('reuses the cache on a warm start without re-parsing logs', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);

    const first = harness.service();
    await first.start();
    assert.equal(first.lastScan.kind, 'cold');
    await first.stop();

    const second = harness.service();
    await second.start();
    assert.equal(second.lastScan.kind, 'warm');
    assert.equal(second.lastScan.parsed, 0, 'no log re-parsed on warm start');
    assert.equal(second.lastScan.reused, 2);
    assert.equal(second.status().sessions, 2);
    const result = await second.search('全家桶');
    assert.equal(result.totalSessions, 1);
  });

  it('rebuilds a corrupt cache instead of serving an empty index', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);

    const first = harness.service();
    await first.start();
    await first.stop();
    fs.writeFileSync(first.paths.indexPath, '{"not":"an index"');

    const second = harness.service();
    await second.start();
    assert.equal(second.lastScan.kind, 'cold', 'corrupt cache forced a full rebuild');
    assert.equal(second.status().ready, true);
    assert.equal(second.status().sessions, 2);
    assert.equal((await second.search('卸载')).totalSessions, 1);
  });

  it('invalidates and prunes a cache written by an older index version', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);

    const first = harness.service();
    await first.start();
    await first.stop();
    const currentPath = first.paths.indexPath;
    const oldPath = path.join(path.dirname(currentPath), 'index.v2.json');
    // Model a cache from the previous index generation: version stamp 2, filename v2.
    const oldDocument = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    oldDocument.version = 2;
    fs.writeFileSync(oldPath, JSON.stringify(oldDocument));
    fs.rmSync(currentPath);

    const second = harness.service();
    await second.start();
    assert.equal(second.lastScan.kind, 'cold', 'an older index version must be rebuilt, not trusted');
    assert.equal(fs.existsSync(oldPath), false, 'the stale cache file is pruned on startup');
    assert.ok(fs.existsSync(currentPath), 'the new cache file was written');
    assert.equal(second.status().sessions, 2);
  });
  it('falls back to the directory name when the header carries no id', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    // `id: undefined` is dropped by JSON.stringify, modelling a header without id.
    harness.write({
      id: 'session-noid-0030',
      headerExtra: { id: undefined },
      events: [turnStart(0, 1), userMessage(1, '没有 header id 的日志 NOIDMARK')],
    });
    const service = harness.service();
    await service.start();
    assert.deepEqual(Object.keys(service.index.sessions), ['noid-0030'], 'directory name minus the session- prefix');
    assert.equal((await service.search('NOIDMARK')).totalSessions, 1);
  });
});

/* ------------------------------------------------------------------------- */
/* extraction semantics                                                      */
/* ------------------------------------------------------------------------- */

describe('extraction semantics', () => {
  it('separates assistant text, thinking and tool calls, and hides reasoning from the default scope', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({
      id: 'session-extract-0007',
      events: [
        turnStart(0, 1),
        userMessage(1, '正常的人类提问'),
        userMessage(2, '注入的上下文关键字INJECTEDCTX', 'runtime-context'),
        assistantMessage(3, '助手可见回复'),
      ],
    });
    const service = harness.service();
    await service.start();

    assert.equal((await service.search('正常的人类提问')).totalSessions, 1);
    assert.equal((await service.search('助手可见回复')).totalSessions, 1);
    assert.equal((await service.search('INJECTEDCTX')).totalSessions, 0, 'injected user messages are not transcript');
    assert.equal((await service.search('HIDDEN-TOOL-ARGS')).totalSessions, 0, 'tool-call blocks are not assistant text');
    // Thinking is indexed, but out of the default dialogue scope.
    assert.equal((await service.search('HIDDEN-REASONING-TEXT')).totalSessions, 0, 'default kinds exclude thinking');
    const thinking = await service.search('HIDDEN-REASONING-TEXT', { kinds: ['thinking'] });
    assert.equal(thinking.totalSessions, 1);
    const hit = thinking.results[0].hits[0];
    assert.equal(hit.kind, 'thinking');
    assert.equal(hit.seq, 3);
    assert.equal(hit.turn, 1);
    assert.equal(hit.surface, 'current');
    assert.equal(hit.anchorSeq, 3, 'thinking is locatable on its assistant message');
    // `/message` resolves the primary (assistant) entry for a shared seq.
    const primary = await service.message('session-extract-0007', 3);
    assert.equal(primary.found, true);
    assert.equal(primary.kind, 'assistant');
    assert.ok(!primary.text.includes('HIDDEN-REASONING-TEXT'));
  });

  it('indexes log-only tool/call rows with anchorSeq pointing at the next surface node', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({
      id: 'session-toolcall-0008',
      events: [
        turnStart(0, 1),
        userMessage(1, '跑个命令看看'),
        toolCall(2, 'bash', '{"command":"grep TOOLCALLMARKER"}'),
        toolResult(3, '命令输出'),
      ],
    });
    const service = harness.service();
    await service.start();
    // Tool content is outside the default scope; ask for it explicitly.
    assert.equal((await service.search('TOOLCALLMARKER')).totalSessions, 0, 'tool hits are not in the default scope');
    const result = await service.search('TOOLCALLMARKER', { kinds: ['tool'] });
    assert.equal(result.totalSessions, 1);
    const hit = result.results[0].hits[0];
    assert.equal(hit.seq, 2);
    assert.equal(hit.kind, 'tool');
    assert.equal(hit.surface, 'log-only');
    assert.equal(hit.anchorSeq, 3, 'log-only hit anchors on the following surface node');
  });

  it('keeps shadowed originals searchable and never indexes replacement copies', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({
      id: 'session-shadow-0009',
      events: [
        turnStart(0, 1),
        userMessage(1, '请处理工具输出'),
        toolResult(2, '原始完整输出字段 ORIGINALSHADOWED'),
        replacementToolResult(3, '裁剪后的新输出字段 REPLACEMENTNEW', 2, 2),
      ],
    });
    const service = harness.service();
    await service.start();

    const shadowed = await service.search('ORIGINALSHADOWED', { kinds: ['tool'] });
    assert.equal(shadowed.totalSessions, 1);
    const hit = shadowed.results[0].hits[0];
    assert.equal(hit.seq, 2);
    assert.equal(hit.surface, 'shadowed');
    assert.equal(hit.anchorSeq, null, 'shadowed hits are not locatable');
    assert.equal((await service.search('REPLACEMENTNEW', { kinds: ['thinking', 'tool'] })).totalSessions, 0);
  });

  it('keeps a thinking hit locatable on the assistant turn row', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({
      id: 'session-thinking-0032',
      events: [
        turnStart(0, 1),
        userMessage(1, '第一轮问题'),
        assistantMessage(2, '第一轮回复'),
        turnStart(3, 2),
        userMessage(4, '第二轮问题'),
        assistantMessage(5, '第二轮回复', { reasoning: '第二轮思考 THINKTURNMARK', turn: 2 }),
      ],
    });
    const service = harness.service();
    await service.start();
    const result = await service.search('THINKTURNMARK', { kinds: ['thinking'] });
    assert.equal(result.totalSessions, 1);
    const hit = result.results[0].hits[0];
    assert.equal(hit.kind, 'thinking');
    assert.equal(hit.seq, 5);
    assert.equal(hit.turn, 2);
    assert.equal(hit.anchorSeq, 5);
    assert.equal(result.query.kinds.length, 1);
  });

  it('maps turn numbers from turn/start boundaries', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({
      id: 'session-turn-0010',
      events: [
        turnStart(0, 1),
        userMessage(1, '第一轮问题 TURNCTX'),
        turnStart(2, 2),
        userMessage(3, '第二轮问题 TURNCTX'),
      ],
    });
    const service = harness.service();
    await service.start();
    const result = await service.search('TURNCTX');
    assert.deepEqual(
      result.results[0].hits.map((hit) => hit.turn),
      [1, 2],
    );
  });
});

/* ------------------------------------------------------------------------- */
/* matching                                                                  */
/* ------------------------------------------------------------------------- */

describe('matching', () => {
  it('matches two-character CJK words and does not match across collapsed whitespace', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({
      id: 'session-cjk-0011',
      events: [turnStart(0, 1), userMessage(1, '我需要卸载这个插件，全家 桶装水 已经准备好')],
    });
    harness.write({
      id: 'session-cjk-0012',
      events: [turnStart(0, 1), userMessage(1, '这里说的是全家桶套餐')],
    });
    const service = harness.service();
    await service.start();

    const uninstall = await service.search('卸载');
    assert.equal(uninstall.totalSessions, 1, 'two-character CJK word hits');
    assert.equal(uninstall.results[0].sessionId, 'session-cjk-0011');

    const combo = await service.search('全家桶');
    assert.equal(combo.totalSessions, 1, '“全家 桶装水” must not match “全家桶”');
    assert.equal(combo.results[0].sessionId, 'session-cjk-0012');
  });

  it('honors caseSensitive and wholeWord switches', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({
      id: 'session-case-0013',
      events: [turnStart(0, 1), userMessage(1, 'Cat catalog CAT concatenate')],
    });
    const service = harness.service();
    await service.start();

    const insensitive = await service.search('cat');
    assert.equal(insensitive.results[0].hitCount, 4);

    const sensitiveLower = await service.search('cat', { caseSensitive: true });
    assert.equal(sensitiveLower.results[0].hitCount, 2, 'lowercase “cat” inside catalog/concatenate');

    const sensitiveUpper = await service.search('Cat', { caseSensitive: true });
    assert.equal(sensitiveUpper.results[0].hitCount, 1);

    const whole = await service.search('cat', { wholeWord: true });
    assert.equal(whole.results[0].hitCount, 2, 'whole word keeps the two standalone occurrences only');
  });

  it('produces snippet coordinates relative to the snippet', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    const padded = `${'x'.repeat(70)}NeedleTarget${'y'.repeat(70)}`;
    harness.write({
      id: 'session-snippet-0014',
      events: [turnStart(0, 1), userMessage(1, padded), userMessage(2, 'short NeedleTarget tail')],
    });
    const service = harness.service();
    await service.start();
    const result = await service.search('NeedleTarget');
    const hits = result.results[0].hits;
    assert.equal(hits.length, 2);

    const longHit = hits.find((hit) => hit.seq === 1);
    assert.ok(longHit.snippet.startsWith('…'));
    assert.ok(longHit.snippet.endsWith('…'));
    assert.equal(longHit.snippet.slice(longHit.matchStart, longHit.matchStart + longHit.matchLength), 'NeedleTarget');

    const shortHit = hits.find((hit) => hit.seq === 2);
    assert.equal(shortHit.snippet, 'short NeedleTarget tail');
    assert.equal(shortHit.matchStart, 6);
    assert.equal(shortHit.matchLength, 'NeedleTarget'.length);
  });

  it('orders sessions by newest hit time, caps at limit and flags truncation', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    const marker = '共通检索词OMEGA';
    // Different event times: middle written last but its hit is oldest.
    const sessions = [
      { id: 'session-order-0015', seq: 1, shift: 0 },
      { id: 'session-order-0016', seq: 1, shift: 20_000 },
      { id: 'session-order-0017', seq: 1, shift: 10_000 },
    ];
    for (const item of sessions) harness.write({ id: item.id, events: [turnStart(0, 1), { ...userMessage(item.seq, `${marker} ${item.id}`), time: BASE_TIME + item.shift }] });
    const service = harness.service();
    await service.start();

    const limited = await service.search(marker, { limit: 2 });
    assert.equal(limited.results.length, 2);
    assert.equal(limited.truncated, true);
    assert.equal(limited.results[0].sessionId, 'session-order-0016', 'newest hit first');
    assert.equal(limited.results[1].sessionId, 'session-order-0017');

    const all = await service.search(marker);
    assert.equal(all.results.length, 3);
    assert.equal(all.truncated, false);
  });

  it('counts every occurrence (hitCount) while capping hit rows at 50', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    const events = [turnStart(0, 1)];
    for (const index of range(55)) events.push(userMessage(index + 1, `第 ${index} 条消息包含 ZCWORD 标记`));
    harness.write({ id: 'session-manyhits-0018', events });
    const service = harness.service();
    await service.start();

    const result = await service.search('ZCWORD');
    const session = result.results[0];
    assert.equal(session.hitCount, 55);
    assert.equal(session.hits.length, 50);
    assert.equal(session.hitsTruncated, true);
    const seqs = session.hits.map((hit) => hit.seq);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), 'hits ordered by seq ascending');
  });
});

/* ------------------------------------------------------------------------- */
/* subagent child sessions                                                   */
/* ------------------------------------------------------------------------- */

describe('subagent sessions', () => {
  /** Parent session + two subagent children (one keyed by parentSession, one by origin). */
  function seedSubagentCorpus(harness) {
    harness.write({
      id: 'session-parent-0040',
      events: [turnStart(0, 1), userMessage(1, '父会话内容 SUBAGENTMARK'), assistantMessage(2, '父会话回复')],
    });
    harness.write({
      id: 'session-child-parented-0041',
      headerExtra: { parentSession: 'session-parent-0040' },
      events: [turnStart(0, 1), userMessage(1, '子会话内容 SUBAGENTMARK')],
    });
    harness.write({
      id: 'session-child-origin-0042',
      headerExtra: { origin: 'subagent' },
      events: [turnStart(0, 1), userMessage(1, '子会话内容 SUBAGENTMARK')],
    });
  }

  it('excludes subagent children from search by default but keeps them queryable by id', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedSubagentCorpus(harness);
    const service = harness.service();
    await service.start();

    assert.equal(service.status().sessions, 3, 'subagent sessions stay in the index');

    const defaults = await service.search('SUBAGENTMARK');
    assert.deepEqual(
      defaults.results.map((session) => session.sessionId),
      ['session-parent-0040'],
      'subagent children cannot be opened as the main view, so they are not searched',
    );
    assert.equal(defaults.query.includeSubagents, false);

    const withSubagents = await service.search('SUBAGENTMARK', { includeSubagents: true });
    assert.equal(withSubagents.results.length, 3);
    assert.equal(withSubagents.query.includeSubagents, true);

    // Explicit id lookup (find bar prefill) works for a subagent session by default.
    const child = await service.sessionHits('session-child-origin-0042', 'SUBAGENTMARK');
    assert.equal(child.hitCount, 1);
    const childExcluded = await service.sessionHits('session-child-origin-0042', 'SUBAGENTMARK', {
      includeSubagents: false,
    });
    assert.equal(childExcluded.hitCount, 0);
    const message = await service.message('session-child-parented-0041', 1);
    assert.equal(message.found, true);
  });

  it('parses includeSubagents on the search/session routes', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedSubagentCorpus(harness);
    const service = harness.service();
    await service.start();
    const routes = createRoutes(service);
    const searchPath = '/api/dsh-conversation-search/search';
    const sessionPath = '/api/dsh-conversation-search/session';

    const defaults = await callRoute(routeAt(routes, searchPath), { url: `${searchPath}?q=SUBAGENTMARK` });
    assert.equal(defaults.json().results.length, 1);
    assert.equal(defaults.json().query.includeSubagents, false);

    const included = await callRoute(routeAt(routes, searchPath), {
      url: `${searchPath}?q=SUBAGENTMARK&includeSubagents=1`,
    });
    assert.equal(included.json().results.length, 3);
    assert.equal(included.json().query.includeSubagents, true);

    // Invalid values are ignored and fall back to the default (false).
    const invalid = await callRoute(routeAt(routes, searchPath), {
      url: `${searchPath}?q=SUBAGENTMARK&includeSubagents=maybe`,
    });
    assert.equal(invalid.json().results.length, 1);
    assert.equal(invalid.json().query.includeSubagents, false);

    // /session keeps working for a subagent id by default; can opt out explicitly.
    const sessionDefault = await callRoute(routeAt(routes, sessionPath), {
      url: `${sessionPath}?sessionId=session-child-origin-0042&q=SUBAGENTMARK`,
    });
    assert.equal(sessionDefault.json().hitCount, 1);
    const sessionExcluded = await callRoute(routeAt(routes, sessionPath), {
      url: `${sessionPath}?sessionId=session-child-origin-0042&q=SUBAGENTMARK&includeSubagents=0`,
    });
    assert.equal(sessionExcluded.json().hitCount, 0);
  });
});

/* ------------------------------------------------------------------------- */
/* incremental refresh                                                       */
/* ------------------------------------------------------------------------- */

describe('incremental refresh', () => {
  it('re-parses only the changed log and picks up appended events', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    const a = harness.write({ id: 'session-inc-a-0019', events: [turnStart(0, 1), userMessage(1, '会话 A 初始内容')] });
    harness.write({ id: 'session-inc-b-0020', events: [turnStart(0, 1), userMessage(1, '会话 B 初始内容')] });
    const service = harness.service();
    await service.start();
    assert.equal(service.lastScan.indexed, 2);

    appendSessionEvents(a.file, [userMessage(2, '会话 A 新增内容 INCREMENTALMARK')]);
    const scan = await service.refresh();
    assert.equal(scan.kind, 'refresh');
    assert.equal(scan.parsed, 1, 'exactly one file re-parsed');
    assert.equal(scan.reused, 1, 'the unchanged file was reused from the index');
    assert.equal(scan.removed, 0);
    assert.equal(scan.files, 2);

    const added = await service.search('INCREMENTALMARK');
    assert.equal(added.totalSessions, 1);
    assert.equal(added.results[0].sessionId, 'session-inc-a-0019');
    assert.equal(added.results[0].hits[0].seq, 2);
    assert.equal((await service.search('会话 B 初始内容')).totalSessions, 1, 'old content still indexed');
  });

  it('drops deleted sessions on refresh', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    const doomed = harness.write({ id: 'session-del-0021', events: [turnStart(0, 1), userMessage(1, '即将被删除会话 DELETEME')] });
    harness.write({ id: 'session-keep-0022', events: [turnStart(0, 1), userMessage(1, '保留的会话 KEEPME')] });
    const service = harness.service();
    await service.start();
    assert.equal(service.status().sessions, 2);

    fs.rmSync(doomed.sessionDir, { recursive: true, force: true });
    const scan = await service.refresh();
    assert.equal(scan.removed, 1);
    assert.equal(service.status().sessions, 1);
    assert.equal((await service.search('DELETEME')).totalSessions, 0);
    await assert.rejects(service.sessionHits('session-del-0021', 'DELETEME'), (error) => error.code === 'unknown-session');
  });

  it('skips a corrupt log without failing the rest of the index', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({ id: 'session-good-0023', events: [turnStart(0, 1), userMessage(1, '健康会话 GOODLOG')] });
    const corruptDir = path.join(harness.sessionsRoot, PROJECT_DIR, 'session-corrupt-0024');
    fs.mkdirSync(corruptDir, { recursive: true });
    fs.writeFileSync(path.join(corruptDir, 'session.v4.jsonl.zstd'), Buffer.from('not a jsonl session log'));

    const service = harness.service();
    await service.start();
    const status = service.status();
    assert.equal(status.ready, true, 'a broken file never breaks readiness');
    assert.equal(status.sessions, 1);
    assert.ok(status.error, 'partial failure is reported through status.error');
    assert.equal(status.error.code, 'partial-index');
    assert.equal((await service.search('GOODLOG')).totalSessions, 1);

    fs.rmSync(corruptDir, { recursive: true, force: true });
    await service.refresh();
    assert.equal(service.status().error, null, 'error clears once the bad log is gone');
  });

  it('refreshes before searching when the index is stale', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    const file = harness.write({ id: 'session-stale-0025', events: [turnStart(0, 1), userMessage(1, '初始内容')] });
    const service = harness.service({ staleMs: 0 });
    await service.start();
    appendSessionEvents(file.file, [userMessage(2, '刚写入的内容 STALEMARK')]);
    const result = await service.search('STALEMARK');
    assert.equal(result.totalSessions, 1, 'search scanned before answering');
    assert.equal(service.lastScan.kind, 'refresh');
  });

  it('rebuild re-reads every log and clears stale index state', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    const file = harness.write({ id: 'session-rebuild-0026', events: [turnStart(0, 1), userMessage(1, '重建前内容')] });
    const service = harness.service({ staleMs: 60_000 });
    await service.start();
    // The appended event is invisible until a rebuild (staleMs keeps /search from scanning).
    appendSessionEvents(file.file, [userMessage(2, '重建后可见 REBUILDMARK')]);
    assert.equal((await service.search('REBUILDMARK')).totalSessions, 0);

    const scan = await service.rebuild();
    assert.equal(scan.kind, 'rebuild');
    assert.equal(scan.files, 1);
    assert.equal((await service.search('REBUILDMARK')).totalSessions, 1);
    assert.equal(service.status().ready, true);
  });
});

/* ------------------------------------------------------------------------- */
/* query API details                                                         */
/* ------------------------------------------------------------------------- */

describe('query API details', () => {
  it('rejects search/sessionHits/message before the index is ready', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);
    const service = harness.service(); // never started

    await assert.rejects(service.search('x'), (error) => error.code === 'indexing');
    await assert.rejects(service.sessionHits('session-aaaa-0001', 'x'), (error) => error.code === 'indexing');
    await assert.rejects(service.message('session-aaaa-0001', 2), (error) => error.code === 'indexing');
    assert.equal(service.status().ready, false);
  });

  it('rejects empty queries on every query endpoint', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);
    const service = harness.service();
    await service.start();

    await assert.rejects(service.search('   '), (error) => error.code === 'empty-query');
    await assert.rejects(service.search('\n\t '), (error) => error.code === 'empty-query');
    await assert.rejects(service.sessionHits('session-aaaa-0001', ''), (error) => error.code === 'empty-query');
  });

  it('answers message found/missing and unknown sessions', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);
    const service = harness.service();
    await service.start();

    const found = await service.message('session-aaaa-0001', 2);
    assert.equal(found.found, true);
    assert.equal(found.seq, 2);
    assert.equal(found.kind, 'user');
    assert.equal(found.turn, 1);
    assert.equal(found.text, '第一个会话写的是 卸载 流程');
    assert.ok(found.time > 0);

    const missing = await service.message('session-aaaa-0001', 9999);
    assert.deepEqual(missing, { found: false, sessionId: 'session-aaaa-0001', seq: 9999 });

    await assert.rejects(service.message('session-nope', 1), (error) => error.code === 'unknown-session');
    await assert.rejects(service.message('', 1), (error) => error.code === 'unknown-session');
  });

  it('applies the default search scope and supports explicit kinds', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({
      id: 'session-scope-0033',
      events: [
        turnStart(0, 1),
        userMessage(1, '用户提问 SCOPEMARK'),
        assistantMessage(2, '助手回复 SCOPEMARK', { reasoning: '助手思考 SCOPEMARK' }),
        toolResult(3, '工具输出 SCOPEMARK'),
      ],
    });
    const service = harness.service();
    await service.start();

    // Default scope: user + assistant (tool/thinking are opt-in checkboxes).
    const defaults = await service.search('SCOPEMARK');
    assert.deepEqual(
      defaults.results[0].hits.map((hit) => hit.kind).sort(),
      ['assistant', 'user'],
    );
    assert.deepEqual(defaults.query.kinds, ['user', 'assistant']);
    assert.equal(defaults.results[0].hitCount, 2);

    // Widening the scope adds tool and thinking entries.
    const wide = await service.search('SCOPEMARK', { kinds: ['user', 'assistant', 'tool', 'thinking'] });
    assert.deepEqual(
      wide.results[0].hits.map((hit) => hit.kind).sort(),
      ['assistant', 'thinking', 'tool', 'user'],
    );
    assert.equal(wide.results[0].hitCount, 4);
    assert.deepEqual(wide.query.kinds, ['user', 'assistant', 'tool', 'thinking']);

    // Narrowing to one kind.
    const toolOnly = await service.search('SCOPEMARK', { kinds: ['tool'] });
    assert.deepEqual(
      toolOnly.results[0].hits.map((hit) => hit.kind),
      ['tool'],
    );

    // sessionHits follows the same scope + default.
    const sessionDefaults = await service.sessionHits('session-scope-0033', 'SCOPEMARK');
    assert.equal(sessionDefaults.hitCount, 2);
    const sessionAll = await service.sessionHits('session-scope-0033', 'SCOPEMARK', { kinds: ['tool', 'thinking'] });
    assert.deepEqual(
      sessionAll.hits.map((hit) => hit.kind).sort(),
      ['thinking', 'tool'],
    );
  });

  it('rejects invalid kinds scopes with bad-kinds', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({ id: 'session-badkinds-0034', events: [turnStart(0, 1), userMessage(1, '正文')] });
    const service = harness.service();
    await service.start();

    await assert.rejects(service.search('正文', { kinds: ['bogus'] }), (error) => error.code === 'bad-kinds');
    await assert.rejects(service.search('正文', { kinds: 'user' }), (error) => error.code === 'bad-kinds');
    await assert.rejects(service.search('正文', { kinds: [] }), (error) => error.code === 'bad-kinds');
    await assert.rejects(service.sessionHits('session-badkinds-0034', '正文', { kinds: ['USER', 'Assistant'] }), (error) => error.code === 'bad-kinds');
    // Unknown kinds are validation errors even before the index is ready.
    const cold = harness.service();
    await assert.rejects(cold.search('正文', { kinds: ['bogus'] }), (error) => error.code === 'bad-kinds');
  });

  it('sessionHits returns all hits of one session in seq order', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    harness.write({
      id: 'session-hits-0027',
      events: [turnStart(0, 1), userMessage(1, '一条 SESSWORD'), assistantMessage(2, '两条 SESSWORD'), userMessage(3, '三条 SESSWORD')],
    });
    harness.write({ id: 'session-hits-other-0028', events: [turnStart(0, 1), userMessage(1, '别的会话 SESSWORD')] });
    const service = harness.service();
    await service.start();

    const result = await service.sessionHits('session-hits-0027', 'SESSWORD');
    assert.equal(result.sessionId, 'session-hits-0027');
    assert.equal(result.hitCount, 3);
    assert.equal(result.hitsTruncated, false);
    assert.deepEqual(
      result.hits.map((hit) => hit.seq),
      [1, 2, 3],
    );
    assert.ok(result.hits.every((hit) => hit.snippet.includes('SESSWORD')));
    await assert.rejects(service.sessionHits('session-nope', 'SESSWORD'), (error) => error.code === 'unknown-session');
  });
});

/* ------------------------------------------------------------------------- */
/* access fence                                                              */
/* ------------------------------------------------------------------------- */

describe('loopback fence', () => {
  it('accepts only loopback socket addresses', () => {
    for (const address of ['127.0.0.1', '127.8.9.10', '::1', '::ffff:127.0.0.1', '::FFFF:127.0.0.1']) {
      assert.equal(isLoopbackAddress(address), true, address);
    }
    for (const address of ['10.0.0.1', '192.168.1.5', '::ffff:10.0.0.1', 'fe80::1', '0.0.0.0', '', undefined, null]) {
      assert.equal(isLoopbackAddress(address), false, String(address));
    }
    assert.equal(isLoopbackRequest({ socket: { remoteAddress: '127.0.0.1' } }), true);
    assert.equal(isLoopbackRequest({ socket: { remoteAddress: '10.0.0.1' } }), false);
    assert.equal(isLoopbackRequest({}), false);
  });
});

/* ------------------------------------------------------------------------- */
/* plugin entry lifecycle                                                    */
/* ------------------------------------------------------------------------- */

describe('plugin entry', () => {
  it('apply() mounts without blocking, then tears the service down on dispose', async (t) => {
    const harness = createHarness();
    const previousHome = process.env.DSH_HOME;
    process.env.DSH_HOME = harness.dshHome;
    t.after(async () => {
      if (previousHome === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = previousHome;
      await harness.cleanup();
    });
    harness.write({ id: 'session-apply-0031', events: [turnStart(0, 1), userMessage(1, '插件入口测试 APPLYMARK')] });

    const { apply, inject } = await import('../index.js');
    assert.deepEqual(inject, ['webServer']);

    /** @type {object[]} */
    const routes = [];
    /** @type {Array<() => unknown>} */
    const disposers = [];
    /** @type {{fn: Function, ms: number}[]} */
    const intervals = [];
    const ctx = {
      logger: null,
      webServer: {
        register(route) {
          routes.push(route);
          return () => undefined;
        },
      },
      effect(callback) {
        const disposer = callback();
        disposers.push(disposer);
        return disposer;
      },
      interval(fn, ms) {
        intervals.push({ fn, ms });
        return () => undefined;
      },
    };

    const started = performance.now();
    apply(ctx);
    const applyMs = performance.now() - started;
    assert.ok(applyMs < 250, `apply() returned in ${applyMs.toFixed(1)} ms without waiting for the index`);
    // The five contract routes must always be registered; the dev-only self-test
    // sink may add one more in development builds.
    for (const name of ['status', 'rebuild', 'search', 'session', 'message']) {
      assert.ok(
        routes.some((route) => route.path === `/api/dsh-conversation-search/${name}`),
        `route ${name} is registered on apply`,
      );
    }
    assert.ok(routes.length >= 5, `apply() registered ${routes.length} routes`);
    // Every long-lived resource (routes, service, refresh timer) is owned by a
    // ctx.effect disposer; the timer deliberately uses a plain setInterval inside
    // that effect instead of ctx.interval, because the timer service is optional
    // and requires an explicit `inject`.
    assert.ok(disposers.length >= 3, `apply() registered ${disposers.length} effect disposers`);
    assert.equal(intervals.length, 0, 'apply() must not touch the optional timer service');

    const statusRoute = routeAt(routes, '/api/dsh-conversation-search/status');
    // The first build runs in the background: keep asking /status until ready.
    const deadline = Date.now() + 5_000;
    let statusBody;
    for (;;) {
      statusBody = (await callRoute(statusRoute, { url: '/api/dsh-conversation-search/status' })).json();
      if (statusBody.ready || Date.now() > deadline) break;
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(statusBody.ready, true, 'index became ready in the background');
    assert.equal(statusBody.sessions, 1);

    const searchRoute = routeAt(routes, '/api/dsh-conversation-search/search');
    const searchBody = (await callRoute(searchRoute, { url: '/api/dsh-conversation-search/search?q=APPLYMARK' })).json();
    assert.equal(searchBody.results.length, 1);

    // Dispose in reverse registration order, like a plugin reload.
    for (const dispose of disposers.reverse()) await dispose();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const after = (await callRoute(statusRoute, { url: '/api/dsh-conversation-search/status' })).json();
    assert.equal(after.ready, false, 'dispose stopped the service');
    assert.equal(after.sessions, 0);
  });
});


describe('HTTP routes', () => {
  it('registers the five contract routes as exact paths', () => {
    const harness = createHarness();
    const service = harness.service();
    const routes = createRoutes(service);
    assert.deepEqual(
      routes.map((route) => `${route.kind} ${route.path}`).sort(),
      [
        'exact /api/dsh-conversation-search/message',
        'exact /api/dsh-conversation-search/rebuild',
        'exact /api/dsh-conversation-search/search',
        'exact /api/dsh-conversation-search/session',
        'exact /api/dsh-conversation-search/status',
      ].sort(),
    );
    harness.cleanup();
  });

  it('answers status, search, session and message envelopes', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);
    const service = harness.service();
    await service.start();
    const routes = createRoutes(service);

    const status = await callRoute(routeAt(routes, '/api/dsh-conversation-search/status'), { url: '/api/dsh-conversation-search/status' });
    assert.equal(status.statusCode, 200);
    const statusBody = status.json();
    assert.equal(statusBody.ok, true);
    assert.equal(statusBody.ready, true);
    assert.equal(statusBody.sessions, 2);
    assert.deepEqual(Object.keys(statusBody).sort(), [
      'building',
      'cacheDir',
      'chars',
      'entries',
      'error',
      'ok',
      'progress',
      'ready',
      'sessions',
      'updatedAt',
    ]);

    const search = await callRoute(routeAt(routes, '/api/dsh-conversation-search/search'), {
      url: '/api/dsh-conversation-search/search?q=%E5%8D%B8%E8%BD%BD&caseSensitive=0&wholeWord=0&limit=20',
    });
    assert.equal(search.statusCode, 200);
    const searchBody = search.json();
    assert.equal(searchBody.ok, true);
    assert.deepEqual(searchBody.query, {
      text: '卸载',
      caseSensitive: false,
      wholeWord: false,
      kinds: ['user', 'assistant'],
      includeSubagents: false,
    });
    assert.equal(searchBody.results.length, 1);
    const hit = searchBody.results[0].hits[0];
    assert.deepEqual(Object.keys(hit).sort(), [
      'anchorSeq',
      'kind',
      'matchLength',
      'matchStart',
      'seq',
      'snippet',
      'surface',
      'time',
      'turn',
    ]);

    const session = await callRoute(routeAt(routes, '/api/dsh-conversation-search/session'), {
      url: '/api/dsh-conversation-search/session?sessionId=session-aaaa-0001&q=%E5%8D%B8%E8%BD%BD',
    });
    assert.equal(session.statusCode, 200);
    assert.equal(session.json().hitCount, 1);

    const message = await callRoute(routeAt(routes, '/api/dsh-conversation-search/message'), {
      url: '/api/dsh-conversation-search/message?sessionId=session-aaaa-0001&seq=2',
    });
    assert.equal(message.statusCode, 200);
    assert.equal(message.json().found, true);

    const missing = await callRoute(routeAt(routes, '/api/dsh-conversation-search/message'), {
      url: '/api/dsh-conversation-search/message?sessionId=session-aaaa-0001&seq=9999',
    });
    assert.equal(missing.statusCode, 200);
    assert.deepEqual(missing.json(), { ok: true, found: false, sessionId: 'session-aaaa-0001', seq: 9999 });
  });

  it('returns 503 indexing before ready and 400 for empty queries', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);
    const service = harness.service();
    const routes = createRoutes(service);

    const indexing = await callRoute(routeAt(routes, '/api/dsh-conversation-search/search'), {
      url: '/api/dsh-conversation-search/search?q=x',
    });
    assert.equal(indexing.statusCode, 503);
    assert.equal(indexing.json().ok, false);
    assert.equal(indexing.json().error.code, 'indexing');

    await service.start();
    const empty = await callRoute(routeAt(routes, '/api/dsh-conversation-search/search'), {
      url: '/api/dsh-conversation-search/search?q=%20%20',
    });
    assert.equal(empty.statusCode, 400);
    assert.equal(empty.json().error.code, 'empty-query');
  });

  it('maps unknown sessions to 404 and bad seq to 400', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);
    const service = harness.service();
    await service.start();
    const routes = createRoutes(service);

    const unknown = await callRoute(routeAt(routes, '/api/dsh-conversation-search/session'), {
      url: '/api/dsh-conversation-search/session?sessionId=missing&q=x',
    });
    assert.equal(unknown.statusCode, 404);
    assert.equal(unknown.json().error.code, 'unknown-session');

    const badSeq = await callRoute(routeAt(routes, '/api/dsh-conversation-search/message'), {
      url: '/api/dsh-conversation-search/message?sessionId=session-aaaa-0001&seq=abc',
    });
    assert.equal(badSeq.statusCode, 400);
    assert.equal(badSeq.json().error.code, 'bad-request');
  });

  it('parses the kinds scope parameter and rejects invalid scopes with 400', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);
    const service = harness.service();
    await service.start();
    const routes = createRoutes(service);
    const searchPath = '/api/dsh-conversation-search/search';

    const defaults = await callRoute(routeAt(routes, searchPath), { url: `${searchPath}?q=HIDDEN-REASONING-TEXT` });
    assert.equal(defaults.statusCode, 200);
    assert.equal(defaults.json().results.length, 0, 'thinking is outside the default scope');
    assert.deepEqual(defaults.json().query.kinds, ['user', 'assistant']);

    const thinking = await callRoute(routeAt(routes, searchPath), {
      url: `${searchPath}?q=HIDDEN-REASONING-TEXT&kinds=thinking`,
    });
    assert.equal(thinking.statusCode, 200);
    assert.deepEqual(thinking.json().query.kinds, ['thinking']);
    assert.equal(thinking.json().results[0].hits[0].kind, 'thinking');

    const wide = await callRoute(routeAt(routes, searchPath), {
      url: `${searchPath}?q=HIDDEN-REASONING-TEXT&kinds=user%2Cassistant%2Cthinking`,
    });
    assert.equal(wide.statusCode, 200);
    assert.deepEqual(wide.json().query.kinds, ['user', 'assistant', 'thinking']);

    for (const url of [`${searchPath}?q=x&kinds=bogus`, `${searchPath}?q=x&kinds=`, `${searchPath}?q=x&kinds=user%2Cbogus`]) {
      const invalid = await callRoute(routeAt(routes, searchPath), { url });
      assert.equal(invalid.statusCode, 400, url);
      assert.equal(invalid.json().ok, false);
      assert.equal(invalid.json().error.code, 'bad-kinds');
    }

    const sessionPath = '/api/dsh-conversation-search/session';
    const sessionInvalid = await callRoute(routeAt(routes, sessionPath), {
      url: `${sessionPath}?sessionId=session-aaaa-0001&q=x&kinds=nope`,
    });
    assert.equal(sessionInvalid.statusCode, 400);
    assert.equal(sessionInvalid.json().error.code, 'bad-kinds');
    const sessionTool = await callRoute(routeAt(routes, sessionPath), {
      url: `${sessionPath}?sessionId=session-aaaa-0001&q=HIDDEN-REASONING-TEXT&kinds=thinking`,
    });
    assert.equal(sessionTool.statusCode, 200);
    assert.equal(sessionTool.json().hitCount, 1);
  });

  it('fences non-loopback callers with 403 and rejects wrong methods with 405', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);
    const service = harness.service();
    await service.start();
    const routes = createRoutes(service);

    const forbidden = await callRoute(routeAt(routes, '/api/dsh-conversation-search/status'), {
      url: '/api/dsh-conversation-search/status',
      remoteAddress: '192.168.1.20',
    });
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.json().error.code, 'forbidden');

    const wrongMethod = await callRoute(routeAt(routes, '/api/dsh-conversation-search/search'), {
      url: '/api/dsh-conversation-search/search?q=x',
      method: 'POST',
    });
    assert.equal(wrongMethod.statusCode, 405);
    assert.equal(wrongMethod.json().error.code, 'method-not-allowed');
  });

  it('starts a rebuild through POST /rebuild', async (t) => {
    const harness = createHarness();
    t.after(() => harness.cleanup());
    seedTwoSessions(harness);
    const service = harness.service();
    await service.start();
    const routes = createRoutes(service);

    const rebuild = await callRoute(routeAt(routes, '/api/dsh-conversation-search/rebuild'), {
      url: '/api/dsh-conversation-search/rebuild',
      method: 'POST',
    });
    assert.equal(rebuild.statusCode, 200);
    assert.deepEqual(rebuild.json(), { ok: true, started: true });
    // The route starts the rebuild without awaiting it; settle it for cleanup.
    await service.rebuild();
    assert.equal(service.lastScan.kind, 'rebuild');
  });
});
