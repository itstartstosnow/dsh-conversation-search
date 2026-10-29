/**
 * dsh-conversation-search — Host index service.
 *
 * Owns the whole indexing lifecycle for the search panel:
 *  - loads the plugin-owned single-file index cache (fast warm start) or builds
 *    it from the read-only session logs (cold start, with per-file progress);
 *  - keeps the normalized conversation text in memory as a ready-to-scan index;
 *  - incrementally refreshes by file `mtimeMs + size` (only changed logs are
 *    re-decoded, deleted sessions drop out);
 *  - answers `search` / `sessionHits` / `message` with the shapes frozen in
 *    `docs/api-contract.md` §2;
 *  - exposes `status()` for the panel's indexing/progress/error UI.
 *
 * All decoding, event projection, normalization, matching and cache (de)serialization
 * is delegated to `lib/search-core.js` (recon-host's module). This service only
 * orchestrates lifecycle, freshness and the HTTP-facing envelopes.
 *
 * Cold start / rebuild deliberately walks the file list itself instead of
 * calling `buildIndex()`: a single synchronous pass would block the event loop
 * for the whole (~0.5 s now, more on a larger corpus) build, so `/status` could
 * never actually report `progress` and the rest of the Host would freeze. The
 * per-file step is still `search-core.indexOneSession` — no decoding or
 * projection logic is duplicated here.
 *
 * @module dsh-conversation-search/host/service
 */

import { performance } from 'node:perf_hooks';
import fsSync from 'node:fs';
import path from 'node:path';

import {
  ENTRY_KINDS,
  SearchCoreError,
  createIndex,
  discoverSessionFiles,
  extractIndexableEntries,
  getEntry,
  indexOneSession,
  readIndexFile,
  readSessionLog,
  searchIndex,
  summarizeSession,
  updateIndex,
  warmMatchText,
  writeIndexFile,
} from '../search-core.js';
import { ensureDir, pruneStaleCacheFiles, resolvePaths } from './paths.js';

/** Background incremental scan cadence (contract §3: default 15 s). */
export const DEFAULT_REFRESH_INTERVAL_MS = 15_000;

/** `/search` triggers a scan when the last one is older than this (contract §3). */
export const DEFAULT_STALE_MS = 5_000;

/** Default `/search` session cap (contract §2: `limit` defaults to 20). */
export const DEFAULT_SESSION_LIMIT = 20;

/** Hits returned per session by `/search` (contract §2: at most 50). */
export const DEFAULT_HITS_PER_SESSION = 50;

/** Hits returned by `/session` for one session (contract §2: at most 500). */
export const DEFAULT_SESSION_HITS_CAP = 500;

/** Hard ceiling for the `limit` query parameter (defensive; contract has no explicit max). */
const MAX_SESSION_LIMIT = 200;

/**
 * Default search scope for `/search` and `/session`: the human dialogue only.
 * The panel offers 工具 / 思考 as opt-in checkboxes, so tool output and
 * assistant reasoning stay out of the default result set.
 */
export const DEFAULT_KINDS = Object.freeze(['user', 'assistant']);

/** Every entry kind the index can produce, used to validate a requested scope. */
const ALLOWED_KINDS = new Set(ENTRY_KINDS);

/** Title used when a log has neither `session/title` nor any indexable text (contract §3). */
export const UNTITLED_SESSION_TITLE = '未命名会话';

/**
 * Issue codes that describe *recoverable* damage: a torn tail (the running
 * session's last write batch fell outside the file snapshot) or a bad JSONL
 * row inside a salvageable torn frame. Those are expected on live sessions and
 * are surfaced in `lastScan`, not as a user-visible `status.error`.
 */
const NON_FATAL_ISSUE_CODES = new Set(['torn-tail', 'bad-jsonl']);

/**
 * One service-level failure with a stable `code` that the route layer maps to
 * an HTTP status (`indexing` → 503, `empty-query` → 400, `unknown-session` →
 * 404, ...). Same convention as `DcsApiError` on the client.
 */
export class HostSearchError extends Error {
  /**
   * @param {string} code stable machine code.
   * @param {string} message human-readable message.
   * @param {{cause?: unknown}} [options]
   */
  constructor(code, message, options) {
    super(message, options);
    this.name = 'HostSearchError';
    this.code = code;
  }
}

/** @param {unknown} error @returns {string} */
function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Normalize one requested search scope (`kinds`).
 *
 * - `undefined`/`null` → {@link DEFAULT_KINDS} (the panel's default dialogue scope);
 * - an array of `user`/`assistant`/`tool`/`thinking` strings → de-duplicated scope;
 * - anything else (non-array, unknown kind, empty scope) → `bad-kinds`, which the
 *   route layer maps to HTTP 400. An explicit empty scope is rejected rather
 *   than silently matching nothing: it can only come from a client bug or a
 *   hand-crafted URL, and "no results" would hide it.
 *
 * @param {unknown} value `options.kinds`.
 * @returns {string[]}
 */
function normalizeKinds(value) {
  if (value === undefined || value === null) return [...DEFAULT_KINDS];
  if (!Array.isArray(value)) {
    throw new HostSearchError('bad-kinds', `kinds must be an array of ${ENTRY_KINDS.join(', ')}`);
  }
  /** @type {string[]} */
  const kinds = [];
  for (const raw of value) {
    const kind = typeof raw === 'string' ? raw.trim() : '';
    if (!ALLOWED_KINDS.has(kind)) {
      throw new HostSearchError(
        'bad-kinds',
        `unknown kind ${JSON.stringify(String(raw))} (expected ${ENTRY_KINDS.join(', ')})`,
      );
    }
    if (!kinds.includes(kind)) kinds.push(kind);
  }
  if (kinds.length === 0) {
    throw new HostSearchError('bad-kinds', `kinds must contain at least one of ${ENTRY_KINDS.join(', ')}`);
  }
  return kinds;
}

/** @param {number} value @returns {number} */
function roundMs(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;
}

/** @returns {Promise<void>} resolves on the next macrotask (lets HTTP requests run). */
function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

/** @param {unknown} value @returns {string} printable string (empty for nullish). */
function textOf(value) {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

/** @param {unknown} value @returns {number} coerced finite limit, or fallback. */
function clampLimit(value, fallback) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.min(Math.floor(numeric), MAX_SESSION_LIMIT);
}

/**
 * Smallest title fallback for a log without a `session/title` event: the first
 * user message text, whitespace collapsed, first 40 code points (contract §3).
 * @param {string} text normalized entry text.
 * @returns {string}
 */
function titleFromFirstMessage(text) {
  const collapsed = textOf(text).replace(/\s+/gu, ' ').trim();
  return Array.from(collapsed).slice(0, 40).join('');
}

/**
 * Project one search-core hit into the HTTP hit shape frozen in the contract.
 * `search-core.searchIndex` already computes `matchStart`/`matchLength` relative
 * to the snippet; extra internal fields are dropped here so the wire shape does
 * not drift.
 *
 * `anchorSeq` follows contract §3's surface tri-state rather than the raw entry
 * value: `current` anchors on its own `seq`, `log-only` (tool/call rows) anchors
 * on the nearest following surface node, and `shadowed` rows are not locatable
 * at all, so they answer `null` and the client reports "no longer in history".
 * @param {object} hit search-core hit.
 */
function toContractHit(hit) {
  const surface = hit.surface;
  const anchorSeq =
    surface === 'current'
      ? (hit.anchorSeq ?? hit.seq ?? null)
      : surface === 'log-only'
        ? (hit.anchorSeq ?? null)
        : null;
  return {
    seq: hit.seq,
    anchorSeq,
    turn: hit.turn ?? null,
    kind: hit.kind,
    surface,
    time: hit.time,
    snippet: hit.snippet,
    matchStart: hit.matchStart,
    matchLength: hit.matchLength,
  };
}

/**
 * The Host index service. One instance per plugin activation; `index.js` owns
 * the Cordis lifecycle (effect/timer), tests construct it directly with a
 * temporary `env`.
 */
export class SearchService {
  /**
   * @param {{
   *   env?: Record<string, string | undefined>,
   *   dshHome?: string, sessionsRoot?: string, cacheDir?: string, indexPath?: string,
   *   logger?: {info?: Function, warn?: Function, error?: Function, debug?: Function} | null,
   *   staleMs?: number, refreshIntervalMs?: number,
   *   sessionLimit?: number, hitsPerSession?: number, sessionHitsCap?: number,
   * }} [options]
   */
  constructor(options = {}) {
    this.paths = resolvePaths(options.env ?? process.env, options);
    this.logger = options.logger ?? null;
    this.staleMs = Number.isFinite(options.staleMs) ? Number(options.staleMs) : DEFAULT_STALE_MS;
    this.refreshIntervalMs = Number.isFinite(options.refreshIntervalMs)
      ? Number(options.refreshIntervalMs)
      : DEFAULT_REFRESH_INTERVAL_MS;
    this.limits = {
      sessionLimit: clampLimit(options.sessionLimit, DEFAULT_SESSION_LIMIT),
      hitsPerSession: clampLimit(options.hitsPerSession, DEFAULT_HITS_PER_SESSION),
      sessionHitsCap: clampLimit(options.sessionHitsCap, DEFAULT_SESSION_HITS_CAP),
    };

    /** @type {{version: number, builtAt: number, sessions: Record<string, any>} | null} */
    this.index = null;
    /** First index build finished (even with per-file failures). */
    this.ready = false;
    /** A full build/rebuild is in progress; `progress` is meaningful while true. */
    this.building = false;
    /** @type {{done: number, total: number} | null} */
    this.progress = null;
    /** @type {{code: string, message: string} | null} last build's partial/fatal failure. */
    this.error = null;
    /** Wall-clock of the last completed build/refresh. */
    this.updatedAt = 0;
    /** Diagnostics of the last scan (tests + debugging); not part of the HTTP contract. */
    this.lastScan = null;

    this._stopped = false;
    /** Serializes build/refresh so two scans never race on `this.index`. */
    this._chain = Promise.resolve();
    /** @type {Promise<any> | null} idempotent `start()`. */
    this._startPromise = null;
    /** @type {Promise<any> | null} in-flight full build (initial or rebuild). */
    this._buildRunning = null;
    /** @type {Promise<any> | null} coalesced incremental refresh. */
    this._refreshPromise = null;
    this._lastScanAt = 0;
    /** @type {AbortController | null} */
    this._abort = null;
  }

  /* ----------------------------------------------------------------------- */
  /* lifecycle                                                               */
  /* ----------------------------------------------------------------------- */

  /**
   * Load or build the index in the background. Returns a promise that settles
   * when the first build finished; `apply()` ignores it so plugin activation
   * never waits for the ~0.5 s cold build.
   * @returns {Promise<object | null>} the scan summary (or null after a stop).
   */
  start() {
    if (this._startPromise !== null) return this._startPromise;
    if (this.ready && this.index !== null) return Promise.resolve(this.lastScan);
    this._stopped = false;
    this.building = true;
    this.progress = { done: 0, total: 0 };
    const run = this._enqueue(() => this._runInitial());
    this._buildRunning = run;
    this._startPromise = run.then(
      () => {
        this._buildRunning = null;
        return this.lastScan;
      },
      () => {
        this._buildRunning = null;
        return this.lastScan;
      },
    );
    return this._startPromise;
  }

  /**
   * Stop the service and wait for any in-flight scan to settle. Safe to call
   * twice; a later `start()` rebuilds from scratch.
   * @returns {Promise<void>}
   */
  async stop() {
    this._stopped = true;
    try {
      this._abort?.abort();
    } catch {
      // AbortController.abort never throws for an unused signal; guard anyway.
    }
    try {
      await this._chain;
    } catch {
      // A scan was aborted; the chain itself settles after the finally blocks.
    }
    this._startPromise = null;
    this._buildRunning = null;
    this._refreshPromise = null;
    this.index = null;
    this.ready = false;
    this.building = false;
    this.progress = null;
    this.error = null;
    this.updatedAt = 0;
    this.lastScan = null;
    this._lastScanAt = 0;
  }

  /**
   * Start a full rebuild from the session logs (async; ignores the cache).
   * Idempotent while a full build is already running: the existing build is
   * returned instead of queueing a second one (contract: POST /rebuild is
   * idempotent during validation/build).
   * @returns {Promise<object | null>} the rebuild scan summary.
   */
  rebuild() {
    if (this._buildRunning !== null) {
      return this._buildRunning.then(
        () => this.lastScan,
        () => this.lastScan,
      );
    }
    const run = this._enqueue(() => this._runRebuild());
    this._buildRunning = run;
    const promise = run.then(
      () => {
        this._buildRunning = null;
        return this.lastScan;
      },
      () => {
        this._buildRunning = null;
        return this.lastScan;
      },
    );
    return promise;
  }

  /**
   * Incremental refresh: re-parse only logs whose `mtimeMs`/`size` changed,
   * drop deleted sessions and persist the cache when anything moved. Coalesced
   * so concurrent callers share one scan.
   * @returns {Promise<object | null>} the refresh scan summary.
   */
  refresh() {
    if (this._refreshPromise !== null) return this._refreshPromise;
    const run = this._enqueue(() => this._runRefresh());
    const promise = run.then(
      () => this.lastScan,
      () => this.lastScan,
    );
    this._refreshPromise = promise;
    const clear = () => {
      if (this._refreshPromise === promise) this._refreshPromise = null;
    };
    promise.then(clear, clear);
    return promise;
  }

  /**
   * Index status for `GET /status`.
   * @returns {{ready: boolean, building: boolean, sessions: number, entries: number,
   *   chars: number, updatedAt: number, progress: {done: number, total: number} | null,
   *   cacheDir: string, error: {code: string, message: string} | null}}
   */
  status() {
    const counts = this._counts();
    return {
      ready: this.ready,
      building: this.building,
      sessions: counts.sessions,
      entries: counts.entries,
      chars: counts.chars,
      updatedAt: this.updatedAt,
      progress: this.building && this.progress ? { done: this.progress.done, total: this.progress.total } : null,
      cacheDir: this.paths.cacheDir,
      error: this.error ? { code: this.error.code, message: this.error.message } : null,
    };
  }

  /* ----------------------------------------------------------------------- */
  /* queries                                                                 */
  /* ----------------------------------------------------------------------- */

  /**
   * Search every indexed session (contract §2 `GET /search`).
   *
   * Ordering, hit numbering and snippet coordinates come from
   * `search-core.searchIndex` unchanged. The query scope defaults to
   * {@link DEFAULT_KINDS} (human dialogue); `options.kinds` widens/narrows it.
   * Subagent child sessions are excluded by default (the GUI cannot open them as
   * the main view, so a hit there cannot be jumped to); `includeSubagents: true`
   * opts them back in for callers that can handle them.
   * The query is validated before the readiness check, so an empty `q` is
   * always a 400 `empty-query` and an invalid scope a 400 `bad-kinds`.
   *
   * @param {unknown} query literal query text (`q`).
   * @param {{caseSensitive?: boolean, wholeWord?: boolean, limit?: number, kinds?: string[],
   *   includeSubagents?: boolean}} [options]
   * @returns {Promise<{query: {text: string, caseSensitive: boolean, wholeWord: boolean,
   *   kinds: string[], includeSubagents: boolean},
   *   tookMs: number, totalSessions: number, truncated: boolean, results: Array<object>}>}
   */
  async search(query, options = {}) {
    const text = textOf(query);
    if (this._isEmptyQuery(text)) throw new HostSearchError('empty-query', 'q must not be empty');
    const kinds = normalizeKinds(options.kinds);
    this._requireReady();
    await this._ensureFresh();
    // The awaited scan may have raced a `stop()`; re-check before touching the index.
    this._requireReady();

    const caseSensitive = options.caseSensitive === true;
    const wholeWord = options.wholeWord === true;
    const includeSubagents = options.includeSubagents === true;
    const limit = clampLimit(options.limit, this.limits.sessionLimit);
    const started = performance.now();
    const result = searchIndex(this.index, text, {
      caseSensitive,
      wholeWord,
      kinds,
      includeSubagents,
      limitSessions: limit,
      limitHitsPerSession: this.limits.hitsPerSession,
      includeShadowed: true,
      includeInherited: true,
    });
    const tookMs = Math.max(0, Math.round(performance.now() - started));
    return {
      query: { text: text.trim(), caseSensitive, wholeWord, kinds, includeSubagents },
      tookMs,
      totalSessions: result.totalSessions,
      truncated: result.truncated,
      results: result.sessions.map((session) => ({
        sessionId: session.sessionId,
        title: session.title,
        cwd: session.cwd,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        hitCount: session.hitCount,
        hitsTruncated: session.hitsTruncated === true,
        hits: session.hits.map(toContractHit),
      })),
    };
  }

  /**
   * Every hit of one session (contract §2 `GET /session`, cap 500) — used by the
   * find bar to prefill `n/m` after a jump. The scope defaults to
   * {@link DEFAULT_KINDS}; pass `options.kinds` to include tool/thinking hits.
   *
   * Unlike `/search`, an explicit session id lookup **includes subagent child
   * sessions by default**: the caller already named the session (the find bar
   * prefetches a hit it was given), so the "cannot be opened as the main view"
   * argument does not apply to looking its snippets up. Pass
   * `includeSubagents: false` to opt out.
   *
   * @param {unknown} sessionId session id.
   * @param {unknown} query literal query text.
   * @param {{caseSensitive?: boolean, wholeWord?: boolean, kinds?: string[],
   *   includeSubagents?: boolean}} [options]
   * @returns {Promise<{sessionId: string, title: string | null, hitCount: number,
   *   hitsTruncated: boolean, hits: Array<object>}>}
   */
  async sessionHits(sessionId, query, options = {}) {
    const text = textOf(query);
    if (this._isEmptyQuery(text)) throw new HostSearchError('empty-query', 'q must not be empty');
    const kinds = normalizeKinds(options.kinds);
    const includeSubagents = options.includeSubagents !== false;
    const session = this._requireSession(sessionId);
    const slice = { version: this.index.version, builtAt: this.index.builtAt, sessions: { [session.meta.sessionId]: session } };
    const result = searchIndex(slice, text, {
      caseSensitive: options.caseSensitive === true,
      wholeWord: options.wholeWord === true,
      kinds,
      includeSubagents,
      limitSessions: 1,
      limitHitsPerSession: this.limits.sessionHitsCap,
      includeShadowed: true,
      includeInherited: true,
    });
    const found = result.sessions[0];
    const hits = found ? found.hits.map(toContractHit) : [];
    return {
      sessionId: session.meta.sessionId,
      title: session.meta.title ?? null,
      hitCount: found ? found.hitCount : 0,
      hitsTruncated: found ? found.hitsTruncated === true : false,
      hits,
    };
  }

  /**
   * Look up one indexed entry by `(sessionId, seq)` (contract §2 `GET /message`).
   * A missing `seq` is a normal negative answer, not an error; an unknown
   * session is an error (`unknown-session` → 404).
   *
   * @param {unknown} sessionId session id.
   * @param {unknown} seq event sequence number.
   * @returns {Promise<{found: boolean, sessionId: string, seq: number, turn?: number | null,
   *   kind?: string, time?: number, text?: string}>}
   */
  async message(sessionId, seq) {
    const session = this._requireSession(sessionId);
    const id = session.meta.sessionId;
    const numeric = typeof seq === 'number' ? seq : Number(seq);
    const entry = Number.isInteger(numeric) ? getEntry(this.index, id, numeric) : null;
    if (!entry) return { found: false, sessionId: id, seq: Number.isFinite(numeric) ? numeric : seq };
    return {
      found: true,
      sessionId: id,
      seq: entry.seq,
      turn: entry.turn ?? null,
      kind: entry.kind,
      time: entry.time,
      text: entry.text,
    };
  }

  /* ----------------------------------------------------------------------- */
  /* internals                                                               */
  /* ----------------------------------------------------------------------- */

  /** @param {() => Promise<any>} task @returns {Promise<any>} */
  _enqueue(task) {
    const run = this._chain.then(task, task);
    this._chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** @param {string} text @returns {boolean} whether the query is empty after normalization. */
  _isEmptyQuery(text) {
    return text.trim().length === 0;
  }

  /** Throw the contract's `indexing` error when no usable index is loaded yet. */
  _requireReady() {
    if (!this.ready || this.index === null) {
      throw new HostSearchError('indexing', 'the search index is still being built');
    }
  }

  /** @param {unknown} sessionId @returns {any} the session record, or throws `unknown-session`. */
  _requireSession(sessionId) {
    this._requireReady();
    const id = textOf(sessionId);
    const session = id === '' ? undefined : this.index.sessions?.[id];
    if (!session) throw new HostSearchError('unknown-session', `unknown session: ${id === '' ? '(empty)' : id}`);
    return session;
  }

  /** Trigger a scan when the last one is stale (contract: longer than 5 s). */
  async _ensureFresh() {
    if (this._stopped) return;
    // A full build/rebuild that is already running ends with a fresh index and
    // the old one is still fully searchable, so never queue another scan behind
    // it just to answer this request.
    if (this.building) return;
    if (this._lastScanAt !== 0 && Date.now() - this._lastScanAt < this.staleMs) return;
    try {
      await this.refresh();
    } catch (error) {
      // A failed refresh must not turn a working search into a 500: the previous
      // index is still resident. The failure is visible via `status.error`.
      this._log('warn', `stale refresh failed: ${messageOf(error)}`);
    }
  }

  /**
   * First index pass. Warm path: read the cache and apply an incremental
   * update. Cold path: decode every log with progress. Never rejects.
   */
  async _runInitial() {
    this.building = true;
    this.progress = this.progress ?? { done: 0, total: 0 };
    this.error = null;
    try {
      try {
        ensureDir(this.paths.cacheDir);
      } catch {
        // The cache is optional: indexing still works from the session logs.
      }
      const pruned = pruneStaleCacheFiles(this.paths.cacheDir, this.paths.indexPath);
      if (pruned.removed.length > 0) this._log('debug', `removed stale cache files: ${pruned.removed.join(', ')}`);
      const loaded = readIndexFile(this.paths.indexPath);
      let index;
      let stats;
      let kind;
      if (loaded.index !== null) {
        const updated = updateIndex(loaded.index, {
          root: this.paths.sessionsRoot,
          onProgress: (progress) => this._setProgress(progress),
        });
        index = updated.index;
        stats = updated.stats;
        kind = 'warm';
      } else {
        const built = await this._buildFresh();
        index = built.index;
        stats = built.stats;
        kind = 'cold';
      }
      const retitled = this._finalizeTitles(index);
      this.index = index;
      this.ready = true;
      this._recordScan(kind, stats);
      if (kind === 'cold' || stats.parsed > 0 || stats.removed > 0 || retitled) this._persist(index);
      this.updatedAt = Date.now();
      this._lastScanAt = Date.now();
      const counts = this._counts();
      this._log(
        'info',
        `index ${kind}: ${counts.sessions} sessions, ${counts.entries} entries, ${counts.chars} chars in ${this.lastScan.totalMs} ms`,
      );
      if (this.error) this._log('warn', `index partially failed: ${this.error.message}`);
    } catch (error) {
      this._handleBuildError(error, 'initial build');
    } finally {
      this.building = false;
      this.progress = null;
    }
  }

  /** Incremental refresh pass; never rejects. */
  async _runRefresh() {
    if (this._stopped) return;
    if (this.index === null) {
      // `refresh()` may race ahead of `start()` in embedded use; take the
      // initial path so the service still becomes ready.
      await this._runInitial();
      return;
    }
    try {
      const updated = updateIndex(this.index, {
        root: this.paths.sessionsRoot,
        onProgress: (progress) => this._setProgress(progress),
      });
      const retitled = this._finalizeTitles(updated.index);
      this.index = updated.index;
      this._recordScan('refresh', updated.stats);
      if (updated.stats.parsed > 0 || updated.stats.removed > 0 || retitled) this._persist(updated.index);
      this.updatedAt = Date.now();
      this._lastScanAt = Date.now();
    } catch (error) {
      this._handleBuildError(error, 'refresh');
    }
  }

  /** Full rebuild pass; never rejects (failure stays visible via `status.error`). */
  async _runRebuild() {
    if (this._stopped) return;
    this.building = true;
    this.progress = { done: 0, total: 0 };
    this.error = null;
    try {
      const built = await this._buildFresh();
      this._finalizeTitles(built.index);
      // Swap only after the build finished: a failed rebuild keeps the old index.
      this.index = built.index;
      this.ready = true;
      this._recordScan('rebuild', built.stats);
      this._persist(built.index);
      this.updatedAt = Date.now();
      this._lastScanAt = Date.now();
      const counts = this._counts();
      this._log(
        'info',
        `index rebuilt: ${counts.sessions} sessions, ${counts.entries} entries, ${counts.chars} chars in ${this.lastScan.totalMs} ms`,
      );
      if (this.error) this._log('warn', `rebuild partially failed: ${this.error.message}`);
    } catch (error) {
      this._handleBuildError(error, 'rebuild');
    } finally {
      this.building = false;
      this.progress = null;
    }
  }

  /**
   * Decode every session log from scratch, yielding to the event loop between
   * files so `/status` can observe `progress` and other requests are served.
   * Mirrors `search-core.buildIndex` semantics (same per-file projection, same
   * stats shape) without its synchronous for-loop.
   * @returns {Promise<{index: object, stats: object}>}
   */
  async _buildFresh() {
    const startedAt = performance.now();
    const artifacts = discoverSessionFiles(this.paths.sessionsRoot);
    const index = createIndex();
    const stats = {
      files: artifacts.length,
      indexed: 0,
      skipped: 0,
      entries: 0,
      chars: 0,
      parseMs: 0,
      totalMs: 0,
      issues: /** @type {Array<{file: string, code: string, message: string}>} */ ([]),
    };
    this._setProgress({ processed: 0, total: artifacts.length });
    for (let i = 0; i < artifacts.length; i += 1) {
      if (this._stopped) throw new SearchCoreError('aborted', 'index build aborted');
      const artifact = artifacts[i];
      const parseStarted = performance.now();
      try {
        const record = this._indexArtifact(artifact);
        index.sessions[record.meta.sessionId] = record;
        stats.indexed += 1;
        stats.entries += record.entries.length;
        stats.chars += record.chars;
        for (const issue of record.issues) stats.issues.push({ file: artifact.file, ...issue });
      } catch (error) {
        stats.skipped += 1;
        stats.issues.push({
          file: artifact.file,
          code: error && error.code ? error.code : 'read-failed',
          message: messageOf(error),
        });
      } finally {
        stats.parseMs += performance.now() - parseStarted;
      }
      this._setProgress({ processed: i + 1, total: artifacts.length });
      if (i + 1 < artifacts.length) await yieldToEventLoop();
    }
    index.builtAt = Date.now();
    warmMatchText(index);
    stats.totalMs = performance.now() - startedAt;
    return { index, stats };
  }

  /**
   * Parse one artifact into its index record. Uses `search-core.indexOneSession`
   * and only adds the contract's session-id fallback: a log whose header lacks
   * `id` is indexed under its directory name minus the `session-` prefix
   * (contract §3) instead of being skipped.
   * @param {{file: string, sessionDir: string}} artifact discovered artifact.
   */
  _indexArtifact(artifact) {
    try {
      return indexOneSession(artifact.file);
    } catch (error) {
      if (!(error instanceof SearchCoreError) || error.code !== 'no-session-id') throw error;
      const log = readSessionLog(artifact.file);
      if (log.header === null) throw error;
      const directory = path.basename(artifact.sessionDir ?? path.dirname(artifact.file));
      const fallbackId = directory.startsWith('session-') ? directory.slice('session-'.length) : directory;
      const sessionId = fallbackId === '' ? 'session' : fallbackId;
      const meta = summarizeSession(log.header, log.events, { sessionId });
      const entries = extractIndexableEntries(log.header, log.events, { sessionId });
      const stat = fsSync.statSync(artifact.file);
      return {
        file: artifact.file,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        meta,
        entries,
        chars: entries.reduce((sum, entry) => sum + entry.text.length, 0),
        issues: log.issues,
      };
    }
  }

  /**
   * Apply the contract's title fallback to every session that has no
   * `session/title` value: the first current user message (40 code points),
   * else 「未命名会话」.
   * @param {object} index index document (mutated in place).
   * @returns {boolean} whether any title was written (cache needs a rewrite).
   */
  _finalizeTitles(index) {
    let changed = false;
    for (const session of Object.values(index?.sessions ?? {})) {
      if (!session || typeof session !== 'object' || !session.meta) continue;
      const current = session.meta.title;
      if (typeof current === 'string' && current.length > 0) continue;
      const entries = Array.isArray(session.entries) ? session.entries : [];
      const firstUser =
        entries.find((entry) => entry.kind === 'user' && entry.surface !== 'shadowed' && textOf(entry.text).length > 0) ??
        entries.find((entry) => textOf(entry.text).length > 0);
      const fallback = firstUser ? titleFromFirstMessage(firstUser.text) : '';
      session.meta.title = fallback === '' ? UNTITLED_SESSION_TITLE : fallback;
      changed = true;
    }
    return changed;
  }

  /**
   * Persist the in-memory index atomically. A failed cache write never fails the
   * build: search keeps working from memory and a rebuild can repair the cache.
   * @param {object} index index document.
   */
  _persist(index) {
    try {
      writeIndexFile(this.paths.indexPath, index, { mode: 0o600, dirMode: 0o700 });
    } catch (error) {
      this._log('warn', `cache write failed (${this.paths.indexPath}): ${messageOf(error)}`);
    }
  }

  /**
   * Fold one build/refresh stats object into `lastScan` and `status.error`.
   * Recoverable damage (torn tail / salvaged rows) stays out of `status.error`;
   * logs that could not be indexed at all surface as `partial-index`.
   * @param {'warm' | 'cold' | 'refresh' | 'rebuild'} kind scan kind.
   * @param {object} stats search-core stats object.
   */
  _recordScan(kind, stats) {
    const issues = Array.isArray(stats?.issues) ? stats.issues : [];
    const fatal = issues.filter((issue) => !NON_FATAL_ISSUE_CODES.has(issue && issue.code));
    this.lastScan = {
      kind,
      at: Date.now(),
      files: stats?.files ?? 0,
      indexed: stats?.indexed ?? 0,
      parsed: stats?.parsed ?? 0,
      reused: stats?.reused ?? 0,
      removed: stats?.removed ?? 0,
      skipped: stats?.skipped ?? 0,
      entries: stats?.entries ?? 0,
      chars: stats?.chars ?? 0,
      parseMs: roundMs(stats?.parseMs),
      totalMs: roundMs(stats?.totalMs),
      issues: issues.length,
      fatalIssues: fatal.length,
      issueCodes: [...new Set(issues.map((issue) => String((issue && issue.code) || 'unknown')))].sort(),
    };
    this.error =
      fatal.length > 0
        ? {
            code: 'partial-index',
            message: `${fatal.length} session log${fatal.length === 1 ? '' : 's'} could not be indexed`,
          }
        : null;
    return this.lastScan;
  }

  /**
   * Store progress from `onProgress`-style callbacks in the status shape
   * (`{done,total}`) while a build is running.
   * @param {{processed?: number, done?: number, total?: number}} progress
   */
  _setProgress(progress) {
    if (!this.building) return;
    const done = Number(progress?.done ?? progress?.processed ?? 0);
    const total = Number(progress?.total ?? 0);
    this.progress = { done: Number.isFinite(done) ? done : 0, total: Number.isFinite(total) ? total : 0 };
  }

  /**
   * Record a build/refresh failure. Aborts caused by `stop()` are not errors.
   * @param {unknown} error thrown value.
   * @param {string} phase human phase label for the log line.
   */
  _handleBuildError(error, phase) {
    const code = error && typeof error.code === 'string' ? error.code : '';
    if (code === 'aborted' || this._stopped) {
      this._log('debug', `${phase} aborted`);
      return;
    }
    this.error = { code: 'build-failed', message: messageOf(error) };
    this._log('error', `${phase} failed: ${messageOf(error)}`);
  }

  /** @returns {{sessions: number, entries: number, chars: number}} */
  _counts() {
    let sessions = 0;
    let entries = 0;
    let chars = 0;
    for (const session of Object.values(this.index?.sessions ?? {})) {
      if (!session) continue;
      sessions += 1;
      entries += Array.isArray(session.entries) ? session.entries.length : 0;
      chars += Number.isFinite(session.chars) ? session.chars : 0;
    }
    return { sessions, entries, chars };
  }

  /**
   * Best-effort logger bridge. The service never throws because logging failed
   * and works without a logger at all (tests).
   * @param {'debug' | 'info' | 'warn' | 'error'} level
   * @param {string} message
   */
  _log(level, message) {
    const logger = this.logger;
    if (!logger) return;
    const method = typeof logger[level] === 'function' ? logger[level] : null;
    if (method === null) return;
    try {
      method.call(logger, `[conversation-search] ${message}`);
    } catch {
      // Logging must never break indexing.
    }
  }
}

/**
 * Create the Host search service.
 * @param {ConstructorParameters<typeof SearchService>[0]} [options]
 * @returns {SearchService}
 */
export function createSearchService(options = {}) {
  return new SearchService(options);
}
