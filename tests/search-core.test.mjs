import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import {
  ENTRY_KINDS,
  INDEX_VERSION,
  buildIndex,
  classifySurface,
  createIndex,
  decodeSessionArtifact,
  defaultSessionsRoot,
  discoverSessionFiles,
  extractEventText,
  extractEventTexts,
  extractIndexableEntries,
  extractSessionTitle,
  collapseText,
  foldForSearch,
  getEntry,
  loadOrBuildIndexCache,
  readIndexCache,
  writeIndexCache,
  inheritedEventCount,
  isSubagentSession,
  loadOrBuildIndex,
  makeSnippet,
  normalizeText,
  reasoningText,
  readIndexFile,
  readSessionLog,
  scanZstdFrames,
  searchIndex,
  substringMatches,
  updateIndex,
  writeIndexFile,
} from '../lib/search-core.js';

// #region fixture helpers

const TEST_DIR = fs.mkdtempSync(path.join(import.meta.dirname, '.tmp-search-core-'));

/** A synthetic v4 session header row. */
function header(sessionId, cwd = '/tmp/example-project') {
  return { type: 'session', version: 4, id: sessionId, createdAt: 1_790_000_000_000, cwd, isSeeded: false, delegationDepth: 0 };
}

/** `user/message` data for a human prompt. */
function userEvent(seq, text, time = 1_790_000_000_100 + seq, sourceKind = 'user') {
  return {
    type: 'user/message',
    seq,
    time,
    data: { content: [{ type: 'text', text }], source: { kind: sourceKind }, role: 'user', id: `m-${seq}` },
    surfaceOp: 'append',
  };
}

/** `assistant/message` data (text + reasoning + tool-call blocks). */
function assistantEvent(seq, text, time = 1_790_000_000_100 + seq, reasoning = '内部推理不应进索引') {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: reasoning },
          { type: 'text', text },
          { type: 'tool-call', id: `call-${seq}`, name: 'bash', arguments: '{"command":"ls"}' },
        ],
      },
    },
    surfaceOp: 'append',
  };
}

/** `tool/result` data. */
function toolResultEvent(seq, text, time = 1_790_000_000_100 + seq, extra = {}) {
  return {
    type: 'tool/result',
    seq,
    time,
    data: {
      turn: 1,
      step: 1,
      message: { role: 'tool', content: [{ type: 'text', text }], toolCallId: `call-${seq}`, id: `tr-${seq}` },
      ...extra,
    },
    surfaceOp: 'append',
  };
}

/** `tool/call` data (log-only, no surface node). */
function toolCallEvent(seq, name, args, time = 1_790_000_000_100 + seq) {
  return { type: 'tool/call', seq, time, data: { turn: 1, step: 1, callId: `call-${seq}`, name, arguments: args } };
}

/** Compress one durable write batch into one checksummed zstd frame. */
function frame(lines) {
  const payload = lines.map((line) => JSON.stringify(line)).join('\n') + '\n';
  return zlib.zstdCompressSync(Buffer.from(payload, 'utf8'), { params: { [zlib.constants.ZSTD_c_checksumFlag]: 1 } });
}

/** Write an artifact from batches (one frame per batch). */
function writeArtifact(filePath, batches) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.concat(batches.map((batch) => frame(batch))));
}

/** Create `<root>/--tmp-example-project--/<sessionId>/session.v4.jsonl.zstd`. */
function writeSession(root, projectName, sessionId, events, options = {}) {
  const dir = path.join(root, projectName, sessionId);
  const file = path.join(dir, 'session.v4.jsonl.zstd');
  const head = options.header ?? header(sessionId, options.cwd ?? `/tmp/${projectName}`);
  // One durable write batch per frame: header frame, then one frame per event.
  writeArtifact(file, [[head], ...events.map((event) => [event])]);
  return file;
}

const PROJECT = '--tmp-some-project--';

// #endregion

// #region zstd / artifact decoding

describe('session artifact decoding', () => {
  test('decodes concatenated zstd frames into header + events', () => {
    const file = path.join(TEST_DIR, 'basic', 'session.v4.jsonl.zstd');
    writeArtifact(file, [[header('s-basic')], [userEvent(0, '你好')], [assistantEvent(1, '你好，有什么可以帮你')]]);
    const log = readSessionLog(file);
    assert.equal(log.header.id, 's-basic');
    assert.equal(log.header.version, 4);
    assert.equal(log.events.length, 2);
    assert.deepEqual(log.events.map((event) => event.seq), [0, 1]);
    // Fast path decodes every complete frame without reporting frame boundaries.
    assert.ok(log.stats.frames === 0 || log.stats.frames === 3);
    assert.equal(log.stats.tornTailBytes, 0);
    assert.deepEqual(log.issues, []);
  });

  test('tolerates a torn final frame by keeping only complete JSONL rows', () => {
    const headBatch = frame([header('s-torn'), userEvent(0, '第一条完整消息')]);
    const partialBatch = frame([assistantEvent(1, '这条记录会被截断在中间')]);
    const file = path.join(TEST_DIR, 'torn', 'session.v4.jsonl.zstd');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.concat([headBatch, partialBatch.subarray(0, Math.floor(partialBatch.length / 2))]));

    // One-shot whole-file decompression fails on a torn tail; the fallback must not.
    assert.throws(() => zlib.zstdDecompressSync(fs.readFileSync(file)));
    const log = readSessionLog(file);
    assert.equal(log.header.id, 's-torn');
    assert.equal(log.events.length, 1);
    assert.equal(log.events[0].seq, 0);
    assert.ok(log.stats.tornTailBytes > 0);
    assert.ok(log.issues.length === 0 || log.issues.every((issue) => issue.code !== 'corrupt-frame'));
  });

  test('treats an empty artifact as a headerless log instead of throwing', () => {
    const file = path.join(TEST_DIR, 'empty', 'session.v4.jsonl.zstd');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.alloc(0));
    const log = readSessionLog(file);
    assert.equal(log.header, null);
    assert.deepEqual(log.events, []);
  });

  test('accepts raw JSONL artifacts (persistence compression: none)', () => {
    const file = path.join(TEST_DIR, 'raw', 'session.v4.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, [header('s-raw'), userEvent(0, '明文日志')].map((line) => JSON.stringify(line)).join('\n') + '\n');
    const log = readSessionLog(file);
    assert.equal(log.header.id, 's-raw');
    assert.equal(log.events.length, 1);
  });

  test('scanZstdFrames reports the start of a structural torn tail', () => {
    const complete = frame([header('s-scan')]);
    const frame2 = frame([userEvent(0, 'x')]);
    const buffer = Buffer.concat([complete, frame2.subarray(0, 6)]);
    const scanned = scanZstdFrames(buffer);
    assert.equal(scanned.frames.length, 1);
    assert.equal(scanned.frames[0].start, 0);
    assert.equal(scanned.frames[0].end, complete.length);
    assert.equal(scanned.tornStart, complete.length);
  });

  test('decodeSessionArtifact rejects invalid frame magic in strict mode', () => {
    const buffer = Buffer.concat([frame([header('s-bad')]), Buffer.from('this is not a zstd frame')]);
    assert.throws(() => decodeSessionArtifact(buffer, { strict: true }));
    const lenient = decodeSessionArtifact(buffer);
    // Lenient mode is best-effort: it keeps the decodable prefix and never throws.
    assert.equal(lenient.text.includes('s-bad'), true);
  });
});

// #endregion

// #region real session corpus

describe('real session corpus', () => {
  const root = defaultSessionsRoot();
  const files = discoverSessionFiles(root);

  test('discovers canonical v4 artifacts under $DSH_HOME/sessions', { skip: files.length === 0 }, () => {
    assert.ok(files.length > 0);
    assert.ok(files.every((artifact) => /session(?:\.v\d+)?\.jsonl(?:\.zstd)?$/u.test(artifact.file)));
    assert.ok(files.every((artifact) => artifact.version >= 4 || artifact.compression === 'zstd'));
  });

  test('parses a real log and projects conversation entries', { skip: files.length === 0 }, () => {
    const log = readSessionLog(files[files.length - 1].file);
    assert.ok(log.header && typeof log.header.id === 'string');
    assert.ok(log.events.length > 0);
    // Contiguous 0-based seq is a core invariant of the v4 log.
    log.events.forEach((event, index) => assert.equal(event.seq, index));
    const title = extractSessionTitle(log.events);
    assert.equal(typeof title, 'string');
    assert.ok(title.length > 0);
    const entries = extractIndexableEntries(log.header, log.events);
    assert.ok(entries.length > 0);
    assert.ok(entries.every((entry) => ENTRY_KINDS.includes(entry.kind)));
    assert.ok(entries.every((entry) => ['current', 'shadowed', 'log-only'].includes(entry.surface)));
    assert.ok(entries.every((entry) => typeof entry.text === 'string' && entry.text.length > 0));
    assert.ok(entries.every((entry) => entry.sessionId === log.header.id));
  });

  test('classifySurface marks append-origin transcript nodes current', () => {
    const events = [userEvent(0, 'q'), assistantEvent(1, 'a'), toolResultEvent(2, 'out'), toolCallEvent(3, 'bash', '{}')];
    const state = classifySurface(events);
    assert.equal(state.get(0), 'current');
    assert.equal(state.get(1), 'current');
    assert.equal(state.get(2), 'current');
    assert.equal(state.get(3), 'log-only');
  });
});

// #endregion

// #region extraction rules

describe('event text extraction', () => {
  test('maps user / assistant / thinking / tool entries and keeps reasoning out of the assistant text', () => {
    const events = [
      { type: 'turn/start', seq: 0, time: 1_790_000_000_099, data: { turn: 1 } },
      userEvent(1, '我准备卸载旧版本'),
      assistantEvent(2, '好的，我先看看当前版本', 1_790_000_000_102, '这句推理不该被搜到'),
      toolCallEvent(3, 'bash', '{"command":"uninstall --old"}'),
      toolResultEvent(4, '已卸载旧版本，剩余空间充足'),
    ];
    const entries = extractIndexableEntries(header('s-kinds'), events);
    assert.deepEqual([...new Set(entries.map((entry) => entry.kind))].sort(), ['assistant', 'thinking', 'tool', 'user']);
    assert.ok(entries.every((entry) => entry.turn === 1));
    assert.ok(entries.some((entry) => entry.text.includes('卸载旧版本')));
    // The assistant entry is "what the user saw": text blocks only.
    const assistant = entries.find((entry) => entry.kind === 'assistant');
    assert.ok(assistant.text.includes('好的，我先看看当前版本'));
    assert.ok(!assistant.text.includes('这句推理'));
    // Reasoning is projected as its own thinking entry, sharing the message's seq/turn/anchor.
    const thinking = entries.find((entry) => entry.kind === 'thinking');
    assert.equal(thinking.text, '这句推理不该被搜到');
    assert.equal(thinking.seq, 2);
    assert.equal(thinking.turn, 1);
    assert.equal(thinking.type, 'assistant/message');
    assert.equal(thinking.surface, 'current');
    assert.equal(thinking.anchorSeq, 2);
    // Opting out restores the old reasoning-dropped projection.
    const withoutReasoning = extractIndexableEntries(header('s-kinds'), events, { includeReasoning: false });
    assert.equal(withoutReasoning.some((entry) => entry.kind === 'thinking'), false);
    assert.equal(withoutReasoning.some((entry) => entry.text.includes('这句推理')), false);
    // tool/call is indexed by default and log-only anchors to its following surface node.
    assert.ok(entries.some((entry) => entry.text.includes('uninstall --old')));
    const toolCall = entries.find((entry) => entry.type === 'tool/call');
    assert.equal(toolCall.surface, 'log-only');
    assert.equal(toolCall.anchorSeq, 4);
    assert.equal(toolCall.turn, 1);
    const surfaceOnly = extractIndexableEntries(header('s-kinds'), events, { includeToolCalls: false });
    assert.equal(surfaceOnly.some((entry) => entry.type === 'tool/call'), false);
  });

  test('projects a reasoning-only assistant message as a thinking entry', () => {
    const events = [
      {
        type: 'assistant/message',
        seq: 0,
        time: 1_790_000_000_100,
        data: { turn: 2, message: { role: 'assistant', content: [{ type: 'reasoning', text: '只有思考没有正文' }] } },
        surfaceOp: 'append',
      },
    ];
    const entries = extractIndexableEntries(header('s-reasoning-only'), events);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, 'thinking');
    assert.equal(entries[0].text, '只有思考没有正文');
    assert.equal(entries[0].turn, 2);
    // `extractEventText` stays a primary-entry projection; for a reasoning-only
    // message that primary entry is the thinking sidecar.
    assert.equal(extractEventText(events[0]).kind, 'thinking');
    assert.deepEqual(
      extractEventTexts(events[0]).map((entry) => entry.kind),
      ['thinking'],
    );
    assert.equal(reasoningText([]), '');
  });

  test('extractEventText keeps returning the assistant primary entry, not thinking', () => {
    const event = assistantEvent(0, '助手正文', 1_790_000_000_100, '思考正文');
    assert.equal(extractEventText(event).kind, 'assistant');
    assert.equal(extractEventText(event).text, '助手正文');
    assert.deepEqual(
      extractEventTexts(event).map((entry) => entry.kind),
      ['assistant', 'thinking'],
    );
    assert.deepEqual(
      extractEventTexts(event, { includeReasoning: false }).map((entry) => entry.kind),
      ['assistant'],
    );
  });

  test('skips injected (non-user) prompts by default but can include them', () => {
    const events = [userEvent(0, '系统注入内容', 1_790_000_000_100, 'compact-checkpoint'), userEvent(1, '真实提问')];
    const defaults = extractIndexableEntries(header('s-inject'), events);
    assert.equal(defaults.length, 1);
    assert.equal(defaults[0].text, '真实提问');
    const all = extractIndexableEntries(header('s-inject'), events, { includeInjectedPrompts: true });
    assert.equal(all.length, 2);
  });

  test('latest session/title event wins and header carries no title', () => {
    const events = [userEvent(0, 'q'), { type: 'session/title', seq: 1, time: 5, data: { title: '旧标题', messageSeqs: [0], source: { kind: 'fallback' } } }, { type: 'session/title', seq: 2, time: 6, data: { title: '新标题', messageSeqs: [], source: { kind: 'user' } } }];
    const head = header('s-title');
    assert.equal(extractSessionTitle(events), '新标题');
    assert.equal('title' in head, false);
    const entries = extractIndexableEntries(head, events);
    assert.ok(entries.every((entry) => entry.title === '新标题'));
  });

  test('compaction replacement marks the old rows shadowed and keeps them searchable', () => {
    const events = [
      userEvent(0, '这是一段之后会被压缩掉的旧提问'),
      assistantEvent(1, '旧回复'),
      { type: 'compaction/start', seq: 2, time: 1_790_000_000_110, data: { compactionId: 'c1', turn: 1 } },
      {
        type: 'compaction/summary',
        seq: 3,
        time: 1_790_000_000_111,
        data: {
          compactionId: 'c1',
          summary: [{ type: 'text', text: '压缩摘要' }],
          shadowedRange: { start: 0, end: 1 },
          shadowedSeqs: [0, 1],
          shadowedTokenCount: 10,
          provider: 'p',
          model: 'm',
        },
      },
      // The replacement user/message carries the checkpoint on the surface and shadows seq 0..1.
      { ...userEvent(4, '压缩摘要', 1_790_000_000_112, 'compact-checkpoint'), surfaceOp: { op: 'replace', startSeq: 0, endSeq: 1 } },
    ];
    const entries = extractIndexableEntries(header('s-compact'), events);
    const shadowed = entries.find((entry) => entry.seq === 0);
    assert.equal(shadowed.surface, 'shadowed');
    assert.equal(shadowed.anchorSeq, null);
    // The replacement copy is model-only; the human transcript keeps the append row.
    assert.equal(entries.some((entry) => entry.seq === 4), false);
    // Old text stays in the log/index; requirement 4.2 needs to detect and report it.
    assert.ok(entries.some((entry) => entry.text.includes('之后会被压缩掉的旧提问')));
  });

  test('inherited seed prefix is flagged and can be excluded', () => {
    const seededHeader = { ...header('s-fork'), isSeeded: true };
    const events = [
      userEvent(0, '父会话的旧内容'),
      { type: 'session/end-seed', seq: 1, time: 1_790_000_000_101, data: { inherited: true } },
      userEvent(2, '子会话自己的问题'),
    ];
    assert.equal(inheritedEventCount(events), 2);
    const entries = extractIndexableEntries(seededHeader, events);
    assert.equal(entries.find((entry) => entry.seq === 0).inherited, true);
    const own = extractIndexableEntries(seededHeader, events, { includeInherited: false });
    assert.deepEqual(own.map((entry) => entry.seq), [2]);
  });
});

// #endregion

// #region matching semantics

describe('substring matching', () => {
  test('normalizes line endings and folds horizontal whitespace runs', () => {
    // Contract: line breaks survive (3+ collapse to 2); horizontal runs become one space.
    assert.equal(normalizeText('a\r\nb\t  c\n\nd'), 'a\nb c\n\nd');
    assert.equal(normalizeText('a\n\n\n\nb'), 'a\n\nb');
    assert.equal(normalizeText('  前后空白  '), '前后空白');
    assert.equal(collapseText('a\nb  c\n\nd'), 'a b c d');
  });

  test('finds two-character Chinese words', () => {
    assert.equal(substringMatches('我准备卸载旧版本', '卸载').length, 1);
    assert.equal(substringMatches('桌面宠物插件', '桌宠').length, 0);
  });

  test('does not match across an intervening space in CJK text', () => {
    assert.equal(substringMatches('全家 桶装水', '全家桶').length, 0);
    assert.equal(substringMatches('全家桶装水', '全家桶').length, 1);
  });

  test('case sensitivity and unicode range share one path', () => {
    assert.equal(substringMatches('DeepSeek Harness', 'deepseek').length, 1);
    assert.equal(substringMatches('DeepSeek Harness', 'deepseek', { caseSensitive: true }).length, 0);
    assert.equal(substringMatches('价格 ￥199 😀', '199').length, 1);
    assert.equal(substringMatches('价格 ￥199 😀', '😀').length, 1);
  });

  test('whole-word matching respects Latin and CJK word boundaries', () => {
    assert.equal(substringMatches('uninstall uninstaller', 'uninstall', { wholeWord: true }).length, 1);
    assert.equal(substringMatches('卸载程序', '卸载', { wholeWord: true }).length, 0);
    // CJK has no spaces: a term inside a longer run of CJK is not a whole word.
    assert.equal(substringMatches('请卸载。', '卸载', { wholeWord: true }).length, 0);
    assert.equal(substringMatches('你好 卸载 完成', '卸载', { wholeWord: true }).length, 1);
  });

  test('width-insensitive folding matches full-width text and keeps offsets', () => {
    const text = 'ＡＢＣ 全角';
    const matches = substringMatches(text, 'abc', { widthInsensitive: true });
    assert.equal(matches.length, 1);
    assert.equal(text.slice(matches[0].start, matches[0].end), 'ＡＢＣ');
    assert.equal(foldForSearch('ＡＢＣ　ｄｅｆ'), 'abc def');
  });

  test('makeSnippet bounds the excerpt and rebases match offsets', () => {
    const text = '前置内容'.repeat(20) + '关键词' + '后置内容'.repeat(20);
    const matches = substringMatches(text, '关键词');
    const snippet = makeSnippet(text, matches[0], { radius: 10 });
    assert.equal(snippet.snippet.slice(snippet.matchStart, snippet.matchStart + snippet.matchLength), '关键词');
    assert.equal(snippet.matchLength, 3);
    assert.ok(snippet.snippet.length <= 2 + 10 + 3 + 10);
    assert.ok(snippet.snippet.startsWith('…'));
  });
});

// #endregion

// #region index build / update / persistence

describe('index build, incremental update and persistence', () => {
  const root = path.join(TEST_DIR, 'corpus');
  const indexPath = path.join(TEST_DIR, 'cache', 'index.json');

  before(() => {
    writeSession(root, PROJECT, 'session-a', [userEvent(0, '第一个会话的正文'), toolResultEvent(1, '工具输出：磁盘剩余 42 GB')]);
    writeSession(root, PROJECT, 'session-b', [userEvent(0, '第二个会话提到全家 桶装水')]);
  });

  test('buildIndex indexes every discovered session', () => {
    const { index, stats } = buildIndex({ root });
    assert.equal(INDEX_VERSION, 3, 'thinking entries changed the index shape');
    assert.equal(index.version, INDEX_VERSION);
    assert.equal(stats.files, 2);
    assert.equal(stats.indexed, 2);
    assert.equal(stats.skipped, 0);
    assert.ok(stats.entries >= 3);
    assert.ok(index.sessions['session-a']);
    assert.equal(index.sessions['session-a'].meta.title, null);
    assert.equal(index.sessions['session-a'].meta.cwd, `/tmp/${PROJECT}`);
  });

  test('buildIndex reports progress for a first full build', () => {
    const seen = [];
    buildIndex({ root, onProgress: (progress) => seen.push(progress.processed) });
    assert.deepEqual(seen, [1, 2]);
  });

  test('searchIndex aggregates hits per session with snippets', () => {
    const { index } = buildIndex({ root });
    const result = searchIndex(index, '全家桶');
    assert.equal(result.totalHits, 0); // "全家 桶装水" must not match the contiguous query
    const spaced = searchIndex(index, '桶装水');
    assert.equal(spaced.totalSessions, 1);
    assert.equal(spaced.sessions[0].sessionId, 'session-b');
    const hit = spaced.sessions[0].hits[0];
    assert.equal(typeof hit.snippet, 'string');
    assert.equal(hit.kind, 'user');
    // Contract hit fields: matchStart/matchLength are snippet-relative.
    assert.equal(hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength), '桶装水');
    assert.equal(hit.matchLength, 3);
    const disk = searchIndex(index, '42 GB');
    assert.equal(disk.sessions[0].hits[0].kind, 'tool');
    // getEntry backs the /message endpoint contract.
    const entry = getEntry(index, 'session-b', hit.seq);
    assert.equal(entry.kind, 'user');
    assert.equal(getEntry(index, 'session-b', 9999), null);
    assert.equal(getEntry(index, 'nope', 0), null);
  });

  test('search respects case-sensitive and whole-word switches', () => {
    writeSession(root, PROJECT, 'session-c', [userEvent(0, 'Run Uninstall Now')]);
    const { index } = buildIndex({ root });
    assert.equal(searchIndex(index, 'uninstall').totalHits, 1);
    assert.equal(searchIndex(index, 'uninstall', { caseSensitive: true }).totalHits, 0);
    assert.equal(searchIndex(index, 'Uninstall').totalHits, 1);
    assert.equal(searchIndex(index, 'install', { wholeWord: true }).totalHits, 0);
    assert.equal(searchIndex(index, 'Install', { wholeWord: true, caseSensitive: true }).totalHits, 0);
  });

  test('searchIndex filters entry kinds before counting hits and sessions', () => {
    const kindsRoot = path.join(TEST_DIR, 'kinds-corpus');
    writeSession(kindsRoot, PROJECT, 'session-kinds', [
      userEvent(0, '用户提问提到 KINDMARK'),
      assistantEvent(1, '助手回复提到 KINDMARK', 1_790_000_000_102, '思考内容是 KINDMARK'),
      toolResultEvent(2, '工具输出提到 KINDMARK'),
    ]);
    writeSession(kindsRoot, PROJECT, 'session-kinds-two', [toolResultEvent(0, '另一个会话的工具输出 KINDMARK')]);
    const { index } = buildIndex({ root: kindsRoot });
    const kindsOf = (result) => result.sessions.flatMap((session) => session.hits.map((hit) => hit.kind)).sort();

    // No `kinds` -> every kind (backward-compatible raw searchIndex behaviour).
    assert.deepEqual(kindsOf(searchIndex(index, 'KINDMARK')), ['assistant', 'thinking', 'tool', 'tool', 'user']);

    // Default panel scope: user + assistant only; the tool-only session drops out.
    const dialogue = searchIndex(index, 'KINDMARK', { kinds: ['user', 'assistant'] });
    assert.deepEqual(kindsOf(dialogue), ['assistant', 'user']);
    assert.equal(dialogue.totalHits, 2);
    assert.equal(dialogue.totalSessions, 1);

    const tools = searchIndex(index, 'KINDMARK', { kinds: ['tool'] });
    assert.deepEqual(kindsOf(tools), ['tool', 'tool']);
    assert.equal(tools.totalHits, 2);
    assert.equal(tools.totalSessions, 2);

    const thinking = searchIndex(index, 'KINDMARK', { kinds: ['thinking'] });
    assert.deepEqual(kindsOf(thinking), ['thinking']);
    assert.equal(thinking.totalHits, 1);

    // An empty scope matches nothing.
    assert.equal(searchIndex(index, 'KINDMARK', { kinds: [] }).totalSessions, 0);

    // The scope filter runs before truncation: the session limit applies afterwards.
    const limited = searchIndex(index, 'KINDMARK', { kinds: ['tool'], limitSessions: 1 });
    assert.equal(limited.totalSessions, 1);
    assert.equal(limited.truncated, true);
  });

  test('searchIndex excludes subagent child sessions unless includeSubagents is set', () => {
    const subRoot = path.join(TEST_DIR, 'subagent-corpus');
    const parent = header('session-parent', `/tmp/${PROJECT}`);
    writeSession(subRoot, PROJECT, 'session-parent', [userEvent(0, '父会话内容 SUBMARK')], { header: parent });
    // A subagent child carries header.parentSession; its directory is not special here.
    writeSession(subRoot, PROJECT, 'child-parented', [userEvent(0, '子会话内容 SUBMARK')], {
      header: { ...header('child-parented', `/tmp/${PROJECT}`), parentSession: 'session-parent' },
    });
    // origin alone is enough to identify a subagent child.
    writeSession(subRoot, PROJECT, 'child-origin', [userEvent(0, '子会话内容 SUBMARK')], {
      header: { ...header('child-origin', `/tmp/${PROJECT}`), origin: 'subagent' },
    });
    const { index } = buildIndex({ root: subRoot });

    assert.equal(isSubagentSession(index.sessions['child-parented'].meta), true);
    assert.equal(isSubagentSession(index.sessions['child-origin'].meta), true);
    assert.equal(isSubagentSession(index.sessions['session-parent'].meta), false);
    assert.equal(isSubagentSession({ parentSession: null, origin: null }), false);
    assert.equal(isSubagentSession(null), false);

    const defaults = searchIndex(index, 'SUBMARK');
    assert.deepEqual(defaults.sessions.map((session) => session.sessionId), ['session-parent']);
    assert.equal(defaults.totalSessions, 1);
    assert.equal(defaults.totalHits, 1);

    const all = searchIndex(index, 'SUBMARK', { includeSubagents: true });
    assert.equal(all.totalSessions, 3);
    assert.equal(all.totalHits, 3);
    assert.deepEqual(
      all.sessions.map((session) => session.sessionId).sort(),
      ['child-origin', 'child-parented', 'session-parent'],
    );

    // Subagent entries stay indexed and resolvable by id (find-bar path).
    assert.equal(getEntry(index, 'child-origin', 0).text, '子会话内容 SUBMARK');
  });

  test('updateIndex re-parses only files whose size or mtime changed', () => {
    const { index: first } = buildIndex({ root });
    const unchanged = updateIndex(first, { root });
    assert.equal(unchanged.stats.parsed, 0);
    assert.equal(unchanged.stats.reused, 3);

    const file = path.join(root, PROJECT, 'session-a', 'session.v4.jsonl.zstd');
    // Simulate one more durable write batch appended to the live artifact.
    fs.appendFileSync(file, frame([assistantEvent(2, '追加的新回复提到了水獭')]));
    const changed = updateIndex(unchanged.index, { root });
    assert.equal(changed.stats.parsed, 1);
    assert.equal(changed.stats.reused, 2);
    const found = searchIndex(changed.index, '水獭');
    assert.equal(found.totalHits, 1);
    assert.equal(found.sessions[0].sessionId, 'session-a');
  });


  test('中文两字词 + 大小写 + 全词 + 增量 组合用例', () => {
    const comboRoot = path.join(TEST_DIR, 'combo');
    writeSession(comboRoot, PROJECT, 'session-combo', [
      userEvent(0, '请帮我 Uninstall 旧驱动'),
      assistantEvent(1, '已经卸载完成，uninstaller 也已清理'),
    ]);
    const built = buildIndex({ root: comboRoot });
    // 两字中文词命中（助手回复）
    const cjk = searchIndex(built.index, '卸载');
    assert.equal(cjk.totalSessions, 1);
    assert.equal(cjk.sessions[0].hits[0].kind, 'assistant');
    assert.equal(cjk.sessions[0].hits[0].turn, 1);
    // 大小写敏感开关
    assert.equal(searchIndex(built.index, 'uninstall').totalHits, 2);
    assert.equal(searchIndex(built.index, 'Uninstall', { caseSensitive: true }).totalHits, 1);
    // 全词开关：uninstaller 不算 uninstall（大小写敏感下小写 uninstall 只出现在 uninstaller 中）
    assert.equal(searchIndex(built.index, 'uninstall', { wholeWord: true, caseSensitive: true }).totalHits, 0);
    assert.equal(searchIndex(built.index, 'Uninstall', { wholeWord: true, caseSensitive: true }).totalHits, 1);
    assert.equal(searchIndex(built.index, 'uninstaller', { wholeWord: true }).totalHits, 1);
    // 增量：追加一条新回复后只重解析该文件
    const file = path.join(comboRoot, PROJECT, 'session-combo', 'session.v4.jsonl.zstd');
    fs.appendFileSync(file, frame([toolResultEvent(2, '工具输出里又出现了卸载 残留')]));
    const updated = updateIndex(built.index, { root: comboRoot });
    assert.equal(updated.stats.parsed, 1);
    assert.equal(updated.stats.reused, 0);
    assert.equal(searchIndex(updated.index, '残留').totalHits, 1);
  });

  test('updateIndex drops sessions whose directory disappeared', () => {
    const { index } = buildIndex({ root });
    fs.rmSync(path.join(root, PROJECT, 'session-b'), { recursive: true, force: true });
    const updated = updateIndex(index, { root });
    assert.equal(updated.stats.removed, 1);
    assert.equal(updated.index.sessions['session-b'], undefined);
    // Restore the fixture for later tests.
    writeSession(root, PROJECT, 'session-b', [userEvent(0, '第二个会话提到全家 桶装水')]);
  });

  test('writeIndexFile / readIndexFile round-trip through an atomic replacement', () => {
    const { index } = buildIndex({ root });
    const written = writeIndexFile(indexPath, index);
    assert.ok(written.bytes > 0);
    assert.deepEqual(fs.readdirSync(path.dirname(indexPath)).filter((name) => name.endsWith('.tmp')), []);
    const loaded = readIndexFile(indexPath);
    assert.equal(loaded.corrupt, false);
    assert.equal(loaded.index.version, INDEX_VERSION);
    assert.deepEqual(Object.keys(loaded.index.sessions).sort(), Object.keys(index.sessions).sort());
  });

  test('readIndexFile flags a corrupt cache and loadOrBuildIndex rebuilds it', () => {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, '{"version":1,"sessions":{}} trailing garbage');
    const loaded = readIndexFile(indexPath);
    assert.equal(loaded.index, null);
    assert.equal(loaded.corrupt, true);
    assert.match(loaded.reason, /invalid JSON/u);

    const recovered = loadOrBuildIndex(indexPath, { root });
    assert.equal(recovered.rebuilt, true);
    assert.equal(recovered.load.corrupt, true);
    assert.ok(Object.keys(recovered.index.sessions).length >= 2);
    assert.equal(readIndexFile(indexPath).corrupt, false);
  });

  test('loadOrBuildIndex reuses a valid cache and refreshes changed sessions', () => {
    const first = loadOrBuildIndex(indexPath, { root });
    assert.equal(first.rebuilt, false);
    assert.equal(first.stats.parsed, 0);
    const file = path.join(root, PROJECT, 'session-c', 'session.v4.jsonl.zstd');
    fs.appendFileSync(file, frame([assistantEvent(1, '缓存刷新后能搜到海豹')]));
    const second = loadOrBuildIndex(indexPath, { root });
    assert.equal(second.stats.parsed, 1);
    assert.equal(searchIndex(second.index, '海豹').totalHits, 1);
  });

  test('readSessionLog is not confused by a stale temporary artifact', () => {
    const sessionDir = path.join(root, PROJECT, 'session-a');
    fs.writeFileSync(path.join(sessionDir, 'session.v4.jsonl.zstd.abc.tmp'), 'not a log');
    const found = discoverSessionFiles(root);
    assert.equal(found.filter((artifact) => artifact.file.includes('session-a')).length, 1);
    assert.ok(found.every((artifact) => !artifact.file.endsWith('.tmp')));
  });

  test('discoverSessionFiles picks the highest canonical generation', () => {
    const genDir = path.join(root, PROJECT, 'session-gen');
    fs.mkdirSync(genDir, { recursive: true });
    fs.writeFileSync(path.join(genDir, 'session.v3.jsonl.zstd'), 'stale');
    writeArtifact(path.join(genDir, 'session.v4.jsonl.zstd'), [[header('session-gen')]]);
    fs.writeFileSync(path.join(genDir, 'session.v5.jsonl.zstd'), 'newer');
    const found = discoverSessionFiles(root).find((artifact) => artifact.file.includes('session-gen'));
    assert.ok(found);
    assert.equal(found.version, 5);
  });
});


// #endregion

// #region contract cache layout (manifest + shards)

describe('contract cache layout (manifest + per-session shards)', () => {
  const root = path.join(TEST_DIR, 'cache-corpus');
  const cacheDir = path.join(TEST_DIR, 'cache-layout');

  before(() => {
    writeSession(root, PROJECT, 'session-a', [
      userEvent(0, '第一个会话的正文'),
      assistantEvent(1, '助手回复正文'),
      toolResultEvent(2, '工具输出正文'),
    ]);
    writeSession(root, PROJECT, 'session-b', [userEvent(0, '第二个会话')]);
  });

  test('writeIndexCache writes manifest + one shard per session', () => {
    const { index } = buildIndex({ root });
    const stats = writeIndexCache(cacheDir, index);
    assert.ok(stats.manifestBytes > 0);
    assert.equal(stats.shardsWritten, 2);
    const manifest = JSON.parse(fs.readFileSync(path.join(cacheDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.version, INDEX_VERSION);
    assert.deepEqual(Object.keys(manifest.sessions).sort(), ['session-a', 'session-b']);
    // user + assistant + thinking + tool
    assert.equal(manifest.sessions['session-a'].entries, 4);
    const shard = JSON.parse(fs.readFileSync(path.join(cacheDir, 'sessions', 'session-a.json'), 'utf8'));
    assert.equal(shard.version, INDEX_VERSION);
    assert.equal(shard.title, null);
    assert.deepEqual(shard.entries[0], [0, null, 'user', 1_790_000_000_100, '第一个会话的正文']);
    // The thinking tuple shares the assistant message's seq and kind survives the round trip.
    const thinkingTuple = shard.entries.find((tuple) => tuple[2] === 'thinking');
    assert.ok(thinkingTuple);
    assert.equal(thinkingTuple[0], 1);
    assert.equal(thinkingTuple[4], '内部推理不应进索引');
  });

  test('readIndexCache restores the thinking entry kind and type', () => {
    const loaded = readIndexCache(cacheDir);
    assert.equal(loaded.corrupt, false);
    assert.deepEqual(loaded.warnings, []);
    assert.deepEqual(Object.keys(loaded.index.sessions).sort(), ['session-a', 'session-b']);
    const found = searchIndex(loaded.index, '工具输出');
    assert.equal(found.totalHits, 1);
    assert.equal(found.sessions[0].hits[0].kind, 'tool');
    assert.equal(found.sessions[0].hits[0].turn, 1);
    const thinking = searchIndex(loaded.index, '内部推理不应进索引', { kinds: ['thinking'] });
    assert.equal(thinking.totalHits, 1);
    const entry = loaded.index.sessions['session-a'].entries.find((candidate) => candidate.kind === 'thinking');
    assert.equal(entry.type, 'assistant/message');
    assert.equal(entry.seq, 1);
    assert.equal(entry.surface, 'current');
    assert.equal(entry.anchorSeq, 1);
  });

  test('writeIndexCache reuses unchanged shards and removes orphans', () => {
    const { index } = buildIndex({ root });
    const again = writeIndexCache(cacheDir, index);
    assert.equal(again.shardsWritten, 0);
    assert.equal(again.shardsReused, 2);
    // Drop one session from the index: its shard must be removed.
    const without = { ...index, sessions: { 'session-a': index.sessions['session-a'] } };
    const pruned = writeIndexCache(cacheDir, without);
    assert.equal(pruned.shardsRemoved, 1);
    assert.deepEqual(fs.readdirSync(path.join(cacheDir, 'sessions')).sort(), ['session-a.json']);
  });

  test('loadOrBuildIndexCache rebuilds a corrupt manifest and refreshes changed sessions', () => {
    fs.writeFileSync(path.join(cacheDir, 'manifest.json'), '{not json');
    const loaded = readIndexCache(cacheDir);
    assert.equal(loaded.corrupt, true);
    const rebuilt = loadOrBuildIndexCache(cacheDir, { root });
    assert.equal(rebuilt.rebuilt, true);
    assert.equal(rebuilt.load.corrupt, true);
    assert.equal(Object.keys(rebuilt.index.sessions).length, 2);

    const file = path.join(root, PROJECT, 'session-a', 'session.v4.jsonl.zstd');
    fs.appendFileSync(file, frame([userEvent(3, '缓存刷新后能搜到海豹')]));
    const refreshed = loadOrBuildIndexCache(cacheDir, { root });
    assert.equal(refreshed.rebuilt, false);
    assert.equal(refreshed.stats.parsed, 1);
    assert.equal(searchIndex(refreshed.index, '海豹').totalHits, 1);
  });

  test('a corrupt shard is a warning, not a blank index', () => {
    fs.writeFileSync(path.join(cacheDir, 'sessions', 'session-b.json'), 'garbage');
    const loaded = readIndexCache(cacheDir);
    assert.equal(loaded.corrupt, false);
    assert.equal(loaded.warnings.length, 1);
    assert.equal(loaded.warnings[0].code, 'corrupt-shard');
    assert.ok(loaded.index.sessions['session-a']);
    assert.equal(loaded.index.sessions['session-b'], undefined);
  });
});

// #endregion

// #region cleanup

after(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

// #endregion
