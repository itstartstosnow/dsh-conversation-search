/**
 * dsh-conversation-search — pure-Node search core (Host side prototype).
 *
 * Everything in this module is dependency-free (`node:` built-ins only) so it can be
 * unit-tested outside Cordis and reused verbatim by the Host plugin.
 *
 * Responsibilities:
 *  - decode a `session.vN.jsonl.zstd` artifact (concatenated zstd frames, optional
 *    torn tail after a crash) into header + events;
 *  - project v4 events into searchable conversation entries
 *    (`user` / `assistant` / `tool`, plus `thinking` sidecars for an assistant
 *    message's reasoning blocks) with `seq`, time, title and surface state;
 *  - normalize text and run literal substring matching (CJK 2-char words included);
 *  - maintain a per-session incremental index keyed by file mtime + size, written
 *    atomically and version-stamped, with corruption detection for rebuild.
 *
 * Facts behind the format handling (see `.recon/host.md` for file:line sources):
 *  - a log is one JSONL header line (`type: "session"`) followed by one JSON row per
 *    session event, contiguous and 0-based in `seq`; rows are stored in
 *    independently decodable, checksummed zstd frames appended per write batch;
 *  - `zlib.zstdDecompressSync(wholeFile)` decodes all complete concatenated frames,
 *    but throws `Z_BUF_ERROR` as soon as the last frame is torn. The persistent
 *    fallback here is the official recipe: scan frame boundaries structurally, decode
 *    complete frames one by one, and salvage the complete JSONL records of a torn
 *    final frame with `finishFlush: ZSTD_e_flush`;
 *  - the human transcript is the append-origin surface: `user/message`,
 *    `assistant/message`, `tool/result` nodes appended with `surfaceOp: "append"`.
 *    Compaction/pruning keeps the old rows in the log and shadows them from the
 *    model surface with replacement nodes (new `seq`, `surfaceOp` replace range), so
 *    old text is still searchable — it is marked `surface: "shadowed"`.
 *
 * @module dsh-conversation-search/search-core
 */

import fsSync from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import os from 'node:os';

// #region constants

/**
 * Index schema version; bump on any incompatible index shape change and on any
 * decoder/extractor fix whose stale caches would otherwise be trusted forever.
 * v2: multi-frame artifacts are always decoded frame by frame, because Node 24
 * (the Electron 44 Host runtime) silently stops after the first zstd frame and
 * v1 caches written by that runtime missed every later batch.
 * v3: `assistant/message` reasoning blocks are projected as separate
 * `kind: 'thinking'` entries (search-scope filtering), so every older cache
 * lacks them and must be rebuilt.
 */
export const INDEX_VERSION = 3;

/** Little-endian numeric value of the zstd magic `0xFD2FB528`. */
const ZSTD_MAGIC = 4247762216;

/** Canonical artifact basename: `session.jsonl`, `session.v4.jsonl`, optionally `.zstd`. */
const SESSION_ARTIFACT_RE = /^session(?:\.v(0|[1-9][0-9]*))?\.jsonl(?:\.zstd)?$/;

/**
 * Entry kinds the index can produce, and the allowed values of the `/search` and
 * `/session` `kinds` scope filter.
 *
 * - `user` / `assistant` — the human dialogue (the panel's default scope);
 * - `tool` — `tool/result` output and log-only `tool/call` rows;
 * - `thinking` — an assistant message's `reasoning` blocks, projected as their
 *   own entry so the UI can offer "思考" as a separate search scope.
 */
export const ENTRY_KINDS = Object.freeze(['user', 'assistant', 'tool', 'thinking']);

/** Event types whose rows reach the model-visible surface (see dsh-session surface). */
const SURFACE_TYPES = new Set(['system/message', 'developer/message', 'user/message', 'assistant/message', 'tool/result']);

// #endregion

// #region errors

/** Stable error codes produced by this module. */
export class SearchCoreError extends Error {
  /** @param {string} code @param {string} message @param {{cause?: unknown}} [options] */
  constructor(code, message, options) {
    super(message, options);
    this.name = 'SearchCoreError';
    this.code = code;
  }
}

// #endregion

// #region zstd frame handling

/**
 * Structural scan for concatenated zstd frames, faithful to the shipped
 * `scanZstdFrames` in `@deepseek-ai/dsh-session-persistence-jsonl` (which is not
 * importable from a third-party plugin). Locates complete frames without
 * decompressing blocks and reports the start of a structurally incomplete last
 * frame.
 *
 * @param {Buffer} buffer complete bytes currently present in a session artifact.
 * @returns {{frames: Array<{start: number, end: number}>, tornStart: number | undefined}}
 * @throws {SearchCoreError} `corrupt-frame` when a complete frame's structure is invalid.
 */
export function scanZstdFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset < buffer.length) {
    const start = offset;
    if (buffer.length - offset < 4) return { frames, tornStart: start };
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new SearchCoreError('corrupt-frame', `invalid zstd frame magic at byte ${offset}`);
    }
    offset += 4;
    if (offset === buffer.length) return { frames, tornStart: start };
    const descriptor = buffer.readUInt8(offset);
    offset += 1;
    if ((descriptor & 24) !== 0) {
      throw new SearchCoreError('corrupt-frame', `reserved zstd frame-header bit at byte ${offset - 1}`);
    }
    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 32) !== 0;
    const checksum = (descriptor & 4) !== 0;
    const dictionaryFlag = descriptor & 3;
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start };
    offset += remainingHeaderBytes;
    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start };
      const blockHeader = buffer.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = (blockHeader >>> 1) & 3;
      const blockSize = blockHeader >>> 3;
      if (blockType === 3) {
        throw new SearchCoreError('corrupt-frame', `reserved zstd block type at byte ${offset - 3}`);
      }
      const payloadBytes = blockType === 1 ? 1 : blockSize;
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start };
      offset += payloadBytes;
      if (lastBlock) break;
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start };
      offset += 4;
    }
    frames.push({ start, end: offset });
  }
  return { frames };
}

/** Whether `buffer` starts with the zstd magic bytes. */
export function looksLikeZstd(buffer) {
  return buffer.length >= 4 && buffer.readUInt32LE(0) === ZSTD_MAGIC;
}

/**
 * Decode an artifact's bytes into plaintext.
 *
 * Fast path: one-shot `zstdDecompressSync` over the whole file, valid only when
 * the file holds at most one complete frame. Node 26's decoder continues across
 * concatenated frames, but Node 24 (the Electron 44 Host runtime) **stops at
 * the first frame and reports success** — using the fast path unconditionally
 * silently dropped every event after a session's first write batch. The frame
 * table is therefore scanned first (a cheap header walk) and the fast path is
 * taken only for a single complete frame. Multi-frame artifacts and torn final
 * frames go through structural per-frame decoding, which salvages the completed
 * JSONL records of a torn tail with `finishFlush: ZSTD_e_flush`.
 *
 * Non-zstd bytes are treated as raw UTF-8 JSONL (the backend's
 * `compression: 'none'` mode).
 *
 * @param {Buffer} buffer artifact bytes.
 * @param {{strict?: boolean, allowTornTail?: boolean}} [options]
 *   - `strict` rethrows structural corruption instead of recording it as an issue.
 *   - `allowTornTail` (default true) salvages a structurally incomplete last frame.
 * @returns {{text: string, issues: Array<{code: string, message: string}>, frames: number,
 *   tornTailBytes: number, recoveredPartial: boolean}} `frames` is 0 on the
 *   single-frame fast path (frame boundaries were not needed).
 */
export function decodeSessionArtifact(buffer, options = {}) {
  const { strict = false, allowTornTail = true } = options;
  /** @type {Array<{code: string, message: string}>} */
  const issues = [];
  if (buffer.length === 0) return { text: '', issues, frames: 0, tornTailBytes: 0, recoveredPartial: false };
  if (!looksLikeZstd(buffer)) {
    return { text: buffer.toString('utf8'), issues, frames: 0, tornTailBytes: 0, recoveredPartial: false };
  }
  if (!strict) {
    let fastScanned = null;
    try {
      fastScanned = scanZstdFrames(buffer);
    } catch (error) {
      // Corrupt or non-frame-aligned bytes: the structural decoder reports them.
      // Lenient mode still salvages the decodable prefix with one-shot decoding,
      // which tolerates a short garbage trailer and may yield the first frame.
      try {
        issues.push({
          code: (error && error.code) || 'unscannable-artifact',
          message: error instanceof Error ? error.message : String(error),
        });
        return { text: zlib.zstdDecompressSync(buffer).toString('utf8'), issues, frames: 0, tornTailBytes: 0, recoveredPartial: false };
      } catch {
        // Not decodable at all: the structural decoder below returns no text.
      }
    }
    if (fastScanned !== null && fastScanned.frames.length <= 1 && fastScanned.tornStart === undefined) {
      try {
        return { text: zlib.zstdDecompressSync(buffer).toString('utf8'), issues, frames: 0, tornTailBytes: 0, recoveredPartial: false };
      } catch {
        // Fall through to the structural decoder: the tail is either torn or corrupt.
      }
    }
  }
  /** @type {{frames: Array<{start: number, end: number}>, tornStart: number | undefined}} */
  let scanned;
  try {
    scanned = scanZstdFrames(buffer);
  } catch (error) {
    if (strict) throw error;
    issues.push({ code: error.code ?? 'corrupt-frame', message: error.message });
    return { text: '', issues, frames: 0, tornTailBytes: 0, recoveredPartial: false };
  }
  const chunks = [];
  let decodedText = '';
  for (const frame of scanned.frames) {
    try {
      decodedText += zlib.zstdDecompressSync(buffer.subarray(frame.start, frame.end)).toString('utf8');
    } catch (error) {
      if (strict) throw new SearchCoreError('corrupt-frame', `frame at byte ${frame.start} failed validation`, { cause: error });
      issues.push({ code: 'corrupt-frame', message: `frame at byte ${frame.start}: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
  chunks.push(decodedText);
  let tornTailBytes = 0;
  let recoveredPartial = false;
  if (scanned.tornStart !== undefined) {
    tornTailBytes = buffer.length - scanned.tornStart;
    if (allowTornTail) {
      try {
        const partial = zlib
          .zstdDecompressSync(buffer.subarray(scanned.tornStart), { finishFlush: zlib.constants.ZSTD_e_flush })
          .toString('utf8');
        if (partial.length > 0) {
          recoveredPartial = true;
          // Only complete lines are trustworthy; a fragment crossing the torn
          // write boundary may be a truncated JSON row.
          const cut = partial.lastIndexOf('\n');
          if (cut >= 0) chunks.push(partial.slice(0, cut + 1));
        }
      } catch {
        // Salvage is best-effort; the torn bytes are simply not decoded.
        issues.push({ code: 'torn-tail', message: `${tornTailBytes} trailing bytes form an incomplete zstd frame` });
      }
    }
  }
  return { text: chunks.join(''), issues, frames: scanned.frames.length, tornTailBytes, recoveredPartial };
}

// #endregion

// #region JSONL parsing

/**
 * Parse decoded JSONL text into the session header and its events.
 *
 * @param {string} text plaintext JSONL.
 * @param {{strict?: boolean, issues?: Array<{code: string, message: string}>}} [options]
 * @returns {{header: object | null, events: Array<object>, stats: {lines: number, badLines: number}}}
 */
export function parseSessionLogText(text, options = {}) {
  const issues = options.issues ?? [];
  /** @type {object | null} */
  let header = null;
  /** @type {Array<object>} */
  const events = [];
  let lines = 0;
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.length === 0) continue;
    lines += 1;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      badLines += 1;
      if (options.strict) throw new SearchCoreError('bad-jsonl', `invalid JSON row #${lines}`, { cause: error });
      issues.push({ code: 'bad-jsonl', message: `row #${lines} is not JSON` });
      continue;
    }
    if (header === null) {
      if (parsed && typeof parsed === 'object' && parsed.type === 'session') {
        header = parsed;
        continue;
      }
      // A headerless artifact is not a v4 log we can use.
      issues.push({ code: 'missing-header', message: 'first row is not a session header' });
      if (options.strict) throw new SearchCoreError('missing-header', 'first row is not a session header');
      return { header: null, events, stats: { lines, badLines } };
    }
    events.push(parsed);
  }
  return { header, events, stats: { lines, badLines } };
}

/**
 * Read and decode one session artifact from disk.
 *
 * Returns a best-effort result: recoverable damage is reported in `issues`
 * (corrupt frame, torn tail, bad JSON row) instead of failing the whole index.
 * Unreadable files still throw (caller decides whether to skip the session).
 *
 * @param {string} filePath absolute path of `session[.vN].jsonl[.zstd]`.
 * @param {{fs?: typeof fsSync, strict?: boolean, allowTornTail?: boolean}} [options]
 * @returns {{
 *   file: string, header: object | null, events: Array<object>,
 *   sessionId: string | null,
 *   issues: Array<{code: string, message: string}>,
 *   stats: {compressedBytes: number, decodedChars: number, frames: number, tornTailBytes: number, recoveredPartial: boolean, lines: number, badLines: number},
 * }}
 */
export function readSessionLog(filePath, options = {}) {
  const fs = options.fs ?? fsSync;
  const buffer = fs.readFileSync(filePath);
  const decoded = decodeSessionArtifact(buffer, {
    strict: options.strict === true,
    allowTornTail: options.allowTornTail !== false,
  });
  const parsed = parseSessionLogText(decoded.text, { strict: options.strict === true, issues: decoded.issues });
  return {
    file: filePath,
    header: parsed.header,
    events: parsed.events,
    sessionId: parsed.header && typeof parsed.header.id === 'string' ? parsed.header.id : null,
    issues: decoded.issues,
    stats: {
      compressedBytes: buffer.length,
      decodedChars: decoded.text.length,
      frames: decoded.frames,
      tornTailBytes: decoded.tornTailBytes,
      recoveredPartial: decoded.recoveredPartial,
      lines: parsed.stats.lines,
      badLines: parsed.stats.badLines,
    },
  };
}

// #endregion

// #region text normalization and folding

/**
 * Normalize stored/searchable text without changing its semantics: unify line
 * endings, fold horizontal whitespace runs into one space, trim spaces around
 * line breaks, collapse 3+ line breaks to 2, trim. Case and width (NFKC) are
 * deliberately **not** changed here — that is a query-time concern
 * ({@link foldForSearch}). Line breaks are kept so snippets stay readable; the
 * matching path uses {@link collapseText}.
 *
 * Must stay byte-identical to `dcsNormalizeText` in `client/src/10-shared.js`.
 *
 * @param {unknown} input raw text.
 * @returns {string} normalized text (empty string for non-strings).
 */
export function normalizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\r\n?/gu, '\n')
    .replace(/[ \t\f\v\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/**
 * Collapse every whitespace run (line breaks included) to one space. This is
 * the *matching* projection: normalized text keeps paragraph breaks for
 * snippets/display, while substring matching runs on the collapsed form so a
 * query never matches across a line break and both Host and browser match the
 * same string. Must stay byte-identical to `dcsCollapseText` in
 * `client/src/10-shared.js`.
 *
 * @param {unknown} input raw text.
 * @returns {string}
 */
export function collapseText(input) {
  if (typeof input !== 'string') return '';
  // Fast path: no line break and no whitespace run to fold -> same string.
  if (!/\s{2,}|[\n\r\t\f\v\u00a0]/u.test(input)) return input.trim();
  return input.replace(/\s+/gu, ' ').trim();
}

/**
 * WeakMap cache of each entry's collapsed matching text. Collapsing must run
 * once per entry, not once per query: without it a 2-character CJK query over
 * the current corpus costs ~100 ms instead of ~15 ms. `warmMatchText` fills it
 * during build/load so the first user query is already warm.
 */
const MATCH_TEXT_CACHE = new WeakMap();

/**
 * Collapsed matching text of one entry (cached).
 * @param {{text: string}} entry index entry.
 * @returns {string}
 */
export function matchTextOf(entry) {
  let cached = MATCH_TEXT_CACHE.get(entry);
  if (cached === undefined) {
    cached = collapseText(entry.text);
    MATCH_TEXT_CACHE.set(entry, cached);
  }
  return cached;
}

/**
 * Pre-populate the collapsed-text cache for an index (or one session slice).
 * Called automatically by {@link buildIndex}, {@link updateIndex} and
 * {@link readIndexCache}; Host code never needs to call it, but a long-lived
 * process can call it after attaching loose entries.
 *
 * @param {{sessions?: Record<string, any>}} index
 * @returns {number} number of entries warmed.
 */
export function warmMatchText(index) {
  let warmed = 0;
  for (const session of Object.values(index?.sessions ?? {})) {
    for (const entry of session.entries ?? []) {
      matchTextOf(entry);
      warmed += 1;
    }
  }
  return warmed;
}

/**
 * Query-side fold: NFKC (full-width → ASCII forms, compatibility forms) plus
 * optional lowercasing. Used on the needle and, when offsets do not matter, on
 * the haystack. `substringMatches` keeps offsets valid by folding with a map.
 *
 * @param {unknown} input text.
 * @param {{caseSensitive?: boolean, widthInsensitive?: boolean}} [options]
 * @returns {string}
 */
export function foldForSearch(input, options = {}) {
  const raw = typeof input === 'string' ? input : '';
  const widthFolded = options.widthInsensitive === false ? raw : raw.normalize('NFKC');
  return options.caseSensitive === true ? widthFolded : widthFolded.toLocaleLowerCase();
}

/**
 * Fold text while remembering, for every folded code unit, the index of the
 * source code point it came from. Native whole-string `toLowerCase()`/NFKC can
 * change length for a handful of code points (e.g. U+0130), so offsets must be
 * mapped explicitly when a match position is shown to a user.
 *
 * @param {string} input text.
 * @param {{caseSensitive?: boolean, widthInsensitive?: boolean}} [options]
 * @returns {{text: string, map: number[]}} `map[i]` is a UTF-16 index into `input`.
 */
export function foldTextWithMap(input, options = {}) {
  const caseSensitive = options.caseSensitive === true;
  const widthInsensitive = options.widthInsensitive !== false;
  const pieces = [];
  /** @type {number[]} */
  const map = [];
  let offset = 0;
  for (const char of input) {
    const folded = foldForSearch(char, { caseSensitive, widthInsensitive });
    for (let i = 0; i < folded.length; i += 1) map.push(offset);
    pieces.push(folded);
    offset += char.length;
  }
  return { text: pieces.join(''), map };
}

// #endregion

// #region substring matching

/** Unicode word-character class used by whole-word matching (letters, numbers, `_`; matches `dcsIsWordChar`). */
const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;

/** @param {string} char @returns {boolean} */
function isWordChar(char) {
  return typeof char === 'string' && char.length > 0 && WORD_CHAR_RE.test(char);
}

/**
 * Literal substring search with optional case/width folding and whole-word
 * matching. One code path serves Chinese, English, digits and emoji — no
 * tokenizer and no language branch.
 *
 * Positions are returned in the **input haystack's** UTF-16 coordinate space,
 * even when folding changed the length.
 *
 * @param {string} haystack text to search (already {@link normalizeText}ed by the caller if desired).
 * @param {string} needle literal query.
 * @param {{caseSensitive?: boolean, wholeWord?: boolean, widthInsensitive?: boolean, limit?: number}} [options]
 * @returns {Array<{start: number, end: number}>} non-overlapping matches in ascending order.
 */
export function substringMatches(haystack, needle, options = {}) {
  const { caseSensitive = false, wholeWord = false, widthInsensitive = false, limit = Infinity } = options;
  if (typeof haystack !== 'string' || typeof needle !== 'string') return [];
  if (needle.length === 0 || haystack.length === 0) return [];
  const foldedNeedle = foldForSearch(needle, { caseSensitive, widthInsensitive });
  if (foldedNeedle.length === 0) return [];
  let foldedHaystack;
  /** @type {number[] | null} */
  let map = null;
  const nativeFolded = caseSensitive ? haystack : haystack.toLocaleLowerCase();
  if (widthInsensitive) {
    const mapped = foldTextWithMap(haystack, { caseSensitive, widthInsensitive });
    foldedHaystack = mapped.text;
    map = mapped.map;
  } else if (nativeFolded.length === haystack.length) {
    foldedHaystack = nativeFolded;
  } else {
    // Lowercasing changed the UTF-16 length (rare: e.g. U+0130); map positions.
    const mapped = foldTextWithMap(haystack, { caseSensitive, widthInsensitive });
    foldedHaystack = mapped.text;
    map = mapped.map;
  }
  /** @type {Array<{start: number, end: number}>} */
  const matches = [];
  const needleChars = Array.from(needle);
  const wordStart = isWordChar(needleChars[0] ?? '');
  const wordEnd = isWordChar(needleChars.at(-1) ?? '');
  let from = 0;
  while (matches.length < limit) {
    const at = foldedHaystack.indexOf(foldedNeedle, from);
    if (at < 0) break;
    const foldedEnd = at + foldedNeedle.length;
    const start = map === null ? at : map[at];
    const end = map === null ? foldedEnd : foldedEnd < map.length ? map[foldedEnd] : haystack.length;
    const before = start > 0 ? haystack[start - 1] : '';
    const after = end < haystack.length ? haystack[end] : '';
    const leftOk = !wholeWord || !wordStart || !isWordChar(before);
    const rightOk = !wholeWord || !wordEnd || !isWordChar(after);
    if (leftOk && rightOk) matches.push({ start, end });
    from = at + foldedNeedle.length;
    if (from <= at) from = at + 1;
  }
  return matches;
}

/**
 * Build a display snippet around one match: up to `radius` characters on each
 * side with ellipses and the match offsets rebased onto the snippet. Mirrors
 * `dcsSnippet` in `client/src/10-shared.js` (UTF-16 offsets, same rounding) so
 * Host snippets and browser snippets agree.
 *
 * @param {string} text full entry text.
 * @param {{start: number, end: number}} match offsets inside `text`.
 * @param {{radius?: number}} [options]
 * @returns {{snippet: string, matchStart: number, matchLength: number}}
 */
export function makeSnippet(text, match, options = {}) {
  const radius = options.radius ?? 60;
  const from = Math.max(0, match.start - radius);
  const to = Math.min(text.length, match.end + radius);
  const prefix = from > 0 ? '…' : '';
  const suffix = to < text.length ? '…' : '';
  return {
    snippet: `${prefix}${text.slice(from, to)}${suffix}`,
    matchStart: prefix.length + (match.start - from),
    matchLength: match.end - match.start,
  };
}

// #endregion

// #region event text extraction

/**
 * Text of a content-block array. `reasoning` is excluded by default (the official
 * `extractSessionEventText` does the same: thinking is model-visible trace data,
 * not conversation text). `tool-call` blocks contribute name + raw arguments.
 *
 * @param {Array<any>} content content blocks.
 * @param {{includeReasoning?: boolean, includeToolCalls?: boolean, includeAttachments?: boolean}} [options]
 * @returns {string} newline-joined block text (empty when nothing searchable).
 */
export function contentText(content, options = {}) {
  if (!Array.isArray(content)) return '';
  const includeReasoning = options.includeReasoning === true;
  const includeToolCalls = options.includeToolCalls === true;
  const includeAttachments = options.includeAttachments === true;
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    switch (block.type) {
      case 'text':
        if (typeof block.text === 'string') parts.push(block.text);
        break;
      case 'reasoning':
        if (includeReasoning && typeof block.text === 'string') parts.push(block.text);
        break;
      case 'tool-call':
        if (includeToolCalls) parts.push([block.name, block.arguments].filter((v) => typeof v === 'string').join('\n'));
        break;
      case 'image':
      case 'file':
        if (includeAttachments && block.attachment && typeof block.attachment === 'object') {
          const name = block.attachment.name;
          if (typeof name === 'string') parts.push(name);
        }
        break;
      default:
        break;
    }
  }
  return joinText(parts);
}

/** Trim, drop empty, join with `\n`. @param {string[]} parts @returns {string} */
function joinText(parts) {
  return parts.map((part) => part.trim()).filter((part) => part.length > 0).join('\n');
}

/**
 * Text of the `reasoning` blocks of a content-block array, `\n`-joined and
 * trimmed — the source text of one `thinking` entry. Reasoning is model trace
 * (not rendered in the conversation DOM), so it stays out of the `assistant`
 * entry and only this separate projection carries it.
 *
 * @param {Array<any>} content content blocks.
 * @returns {string} reasoning-only text (empty when the message has no thinking).
 */
export function reasoningText(content) {
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'reasoning' && typeof block.text === 'string') parts.push(block.text);
  }
  return joinText(parts);
}

/**
 * Project one raw event into every searchable entry it yields.
 *
 * Mapping (requirement: 用户提问 / 助手回复 / 工具输出, plus 思考 as its own
 * search scope):
 *  - `user/message`      → one `user` entry (text blocks; `source.kind === 'user'` by default)
 *  - `assistant/message` → one `assistant` entry (text blocks only, exactly like the
 *    official `extractSessionEventText`) **plus one `thinking` entry** for its
 *    `reasoning` blocks. `includeReasoning: false` restores the old
 *    reasoning-dropped projection.
 *  - `tool/result`       → one `tool` entry (content text + provider error name/code)
 *  - `tool/call`         → one `tool` entry (tool name + raw arguments; log-only, no
 *    surface node; indexed by default, `includeToolCalls: false` excludes it)
 *
 * Both entries of an `assistant/message` share the event's `seq`/`time`/`turn`:
 * the reasoning belongs to that message, so a hit there jumps to the same turn
 * row. The assistant entry is returned first, which is the entry `getEntry`
 * finds for `/message`.
 *
 * @param {any} event one session event.
 * @param {{includeReasoning?: boolean, includeToolCalls?: boolean, includeInjectedPrompts?: boolean, includeCompactionSummaries?: boolean}} [options]
 * @returns {Array<{kind: 'user' | 'assistant' | 'tool' | 'thinking', text: string, sourceKind?: string}>}
 */
export function extractEventTexts(event, options = {}) {
  if (!event || typeof event !== 'object') return [];
  const data = event.data ?? {};
  switch (event.type) {
    case 'user/message': {
      const sourceKind = data.source && typeof data.source.kind === 'string' ? data.source.kind : undefined;
      if (sourceKind !== 'user' && options.includeInjectedPrompts !== true) return [];
      const text = contentText(data.content, { includeReasoning: false, includeToolCalls: false });
      return text.length === 0 ? [] : [{ kind: 'user', text, ...(sourceKind === undefined ? {} : { sourceKind }) }];
    }
    case 'assistant/message': {
      const message = data.message;
      const content = message && message.content;
      const entries = [];
      // Contract: the assistant entry stays "what the user saw" — text blocks only.
      const text = contentText(content, { includeReasoning: false, includeToolCalls: false });
      if (text.length > 0) entries.push({ kind: 'assistant', text, sourceKind: undefined });
      // Reasoning is trace, not dialogue: it becomes its own scoped entry unless
      // the caller explicitly opts out (`includeReasoning: false`).
      if (options.includeReasoning !== false) {
        const thinking = reasoningText(content);
        if (thinking.length > 0) entries.push({ kind: 'thinking', text: thinking, sourceKind: undefined });
      }
      return entries;
    }
    case 'tool/result': {
      const message = data.message;
      const parts = [contentText(message && message.content)];
      if (data.error && typeof data.error === 'object') {
        if (typeof data.error.name === 'string') parts.push(data.error.name);
        if (typeof data.error.code === 'string') parts.push(data.error.code);
      }
      const text = joinText(parts);
      return text.length === 0 ? [] : [{ kind: 'tool', text }];
    }
    case 'tool/call': {
      // Log-only row (no surface node): indexed by default per project contract
      // (docs/api-contract.md §3) so tool names/arguments are searchable; the entry
      // is marked `log-only` and carries `anchorSeq` for locating. `includeToolCalls:
      // false` restricts the index to genuine surface rows.
      if (options.includeToolCalls === false) return [];
      const text = joinText([typeof data.name === 'string' ? data.name : '', typeof data.arguments === 'string' ? data.arguments : '']);
      return text.length === 0 ? [] : [{ kind: 'tool', text }];
    }
    case 'compaction/summary': {
      if (options.includeCompactionSummaries !== true) return [];
      const text = contentText(data.summary, { includeReasoning: false });
      return text.length === 0 ? [] : [{ kind: 'assistant', text }];
    }
    default:
      return [];
  }
}

/**
 * Project one raw event into its **primary** searchable entry (the first one
 * {@link extractEventTexts} yields), or null. Kept for callers that only need
 * the lead entry; the index projector uses {@link extractEventTexts} so the
 * `thinking` sidecar is not lost.
 *
 * @param {any} event one session event.
 * @param {{includeReasoning?: boolean, includeToolCalls?: boolean, includeInjectedPrompts?: boolean, includeCompactionSummaries?: boolean}} [options]
 * @returns {{kind: 'user' | 'assistant' | 'tool' | 'thinking', text: string, sourceKind?: string} | null}
 */
export function extractEventText(event, options = {}) {
  const entries = extractEventTexts(event, options);
  return entries.length > 0 ? entries[0] : null;
}

/**
 * Fold the log into surface state: which `seq`s are current model-visible
 * surface nodes, which were shadowed by a replacement/compaction, and which
 * never had a surface node (`log-only`).
 *
 * Mirrors `foldSurface` from `@deepseek-ai/dsh-session` for first-party events:
 * an append-origin surface event pushes its seq; a surface replacement
 * (`surfaceOp: {op:'replace', startSeq, endSeq}`) splices the shadowed range.
 * Message projections (`image/offload`) do not change seq placement.
 *
 * @param {Array<any>} events contiguous events.
 * @returns {Map<number, 'current' | 'shadowed' | 'log-only'>}
 */
export function classifySurface(events) {
  /** @type {number[]} */
  const nodes = [];
  /** @type {Map<number, 'current' | 'shadowed' | 'log-only'>} */
  const state = new Map();
  for (const event of events) {
    const seq = typeof event.seq === 'number' ? event.seq : null;
    if (seq === null) continue;
    if (!SURFACE_TYPES.has(event.type)) {
      state.set(seq, 'log-only');
      continue;
    }
    const op = event.surfaceOp;
    if (op === 'append') {
      nodes.push(seq);
      state.set(seq, 'current');
      continue;
    }
    if (op && typeof op === 'object' && op.op === 'replace') {
      const startIdx = nodes.indexOf(op.startSeq);
      const endIdx = nodes.indexOf(op.endSeq);
      if (startIdx >= 0 && endIdx >= startIdx) {
        for (const shadowed of nodes.slice(startIdx, endIdx + 1)) state.set(shadowed, 'shadowed');
        nodes.splice(startIdx, endIdx - startIdx + 1, seq);
      }
      state.set(seq, 'current');
      continue;
    }
    // Surface-eligible event with no marker: treat as current (older or plugin logs).
    nodes.push(seq);
    state.set(seq, 'current');
  }
  return state;
}

/**
 * Extract the session title the same way the shipped title service does: the
 * latest `session/title` event wins (fallback, provider and user renames all use
 * that one event type; the session header carries no title).
 *
 * @param {Array<any>} events contiguous events.
 * @returns {string | null}
 */
export function extractSessionTitle(events) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event && event.type === 'session/title' && event.data && typeof event.data.title === 'string') {
      return event.data.title;
    }
  }
  return null;
}

/**
 * Count of events inherited from a parent seed (forked session). The current V4
 * format stores `isSeeded` in the header and derives the cut from the last
 * tagged `session/end-seed` marker (`data.inherited === true`); events before
 * the cut belong to the parent conversation and are flagged `inherited` so a
 * caller can avoid duplicate hits across a fork.
 *
 * @param {Array<any>} events contiguous events.
 * @returns {number} exclusive upper bound of the inherited prefix (0 when none).
 */
export function inheritedEventCount(events) {
  let cut = 0;
  for (const event of events) {
    if (
      event &&
      event.type === 'session/end-seed' &&
      event.data &&
      event.data.inherited === true &&
      typeof event.seq === 'number'
    ) {
      cut = event.seq + 1;
    }
  }
  return cut;
}

/**
 * Project a parsed log into conversation index entries.
 *
 * @param {object | null} header session header (`type: "session"` row).
 * @param {Array<any>} events contiguous events.
 * @param {object} [options] extraction options; see {@link extractEventTexts}. Also:
 *   - `includeShadowed` (default true): keep entries shadowed from the model surface.
 *   - `includeInherited` (default true): keep a fork's inherited parent events.
 *   - `includeReasoning` (default true): project an assistant message's reasoning
 *     blocks as a separate `kind: 'thinking'` entry; `false` drops them.
 *   - `sessionId` fallback when the header is missing.
 * Only **append-origin** rows form the human transcript: a surface event is
 * indexed when `surfaceOp === 'append'`. Replacement copies (`surfaceOp` range
 * replace: compaction checkpoints, pruned tool results, edited messages) are
 * model-only and are deliberately skipped — a client jump must land on what the
 * user actually saw. Accepted replacement rows still shadow their originals, so
 * the original append row keeps `surface: 'shadowed'` (requirement 4.2: report
 * "该条已不在当前会话历史中" instead of silently losing the hit).
 *
 * An `assistant/message` can yield two entries (assistant text and thinking) that
 * share `seq`; they also share `time`, `turn`, `surface` and `anchorSeq`, so a
 * thinking hit jumps to the same turn row.
 *
 * Every entry also carries `turn` (the most recent `turn/start` number, falling
 * back to `event.data.turn`) so a client can map `seq → turn` onto the
 * conversation's `data-chat-turn` DOM anchor.
 *
 * @returns {Array<{sessionId: string, seq: number, kind: 'user' | 'assistant' | 'tool' | 'thinking',
 *   type: string, text: string, title: string | null, time: number, turn: number | null,
 *   surface: 'current' | 'shadowed' | 'log-only', sourceKind?: string, inherited?: true,
 *   anchorSeq: number | null}>}
 */
export function extractIndexableEntries(header, events, options = {}) {
  const sessionId =
    options.sessionId ?? (header && typeof header.id === 'string' ? header.id : null);
  if (sessionId === null) throw new SearchCoreError('no-session-id', 'cannot index a log without a session id');
  const title = extractSessionTitle(events);
  const surface = classifySurface(events);
  const inheritedCut = inheritedEventCount(events);
  const includeShadowed = options.includeShadowed !== false;
  const includeInherited = options.includeInherited !== false;
  /** @type {Array<any>} */
  const entries = [];
  const surfaceSeqs = [...surface.entries()].filter(([, state]) => state === 'current').map(([seq]) => seq).sort((a, b) => a - b);
  let currentTurn = null;
  for (const event of events) {
    if (event && event.type === 'turn/start' && event.data && typeof event.data.turn === 'number') currentTurn = event.data.turn;
    const seq = typeof event.seq === 'number' ? event.seq : null;
    if (seq === null) continue;
    // Human transcript = append-origin surface rows; replacement copies are model-only.
    if (SURFACE_TYPES.has(event.type) && event.surfaceOp !== 'append') continue;
    const extractions = extractEventTexts(event, options);
    if (extractions.length === 0) continue;
    const state = surface.get(seq) ?? 'log-only';
    if (!includeShadowed && state === 'shadowed') continue;
    const inherited = inheritedCut > 0 && seq < inheritedCut;
    if (inherited && !includeInherited) continue;
    const eventTurn = event.data && typeof event.data.turn === 'number' ? event.data.turn : currentTurn;
    const anchorSeq = state === 'current' ? seq : state === 'log-only' ? nextSurfaceSeq(seq, surfaceSeqs) ?? null : null;
    for (const extraction of extractions) {
      const text = normalizeText(extraction.text);
      if (text.length === 0) continue;
      entries.push({
        sessionId,
        seq,
        kind: extraction.kind,
        type: event.type,
        text,
        title,
        time: typeof event.time === 'number' ? event.time : 0,
        turn: eventTurn,
        surface: state,
        ...(extraction.sourceKind === undefined ? {} : { sourceKind: extraction.sourceKind }),
        ...(inherited ? { inherited: true } : {}),
        anchorSeq,
      });
    }
  }
  return entries;
}

/** Nearest current surface seq at or after `seq` (fallback: nearest before). */
function nextSurfaceSeq(seq, sortedSurfaceSeqs) {
  let low = 0;
  let high = sortedSurfaceSeqs.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (sortedSurfaceSeqs[mid] < seq) low = mid + 1;
    else high = mid - 1;
  }
  if (low < sortedSurfaceSeqs.length) return sortedSurfaceSeqs[low];
  return sortedSurfaceSeqs.length > 0 ? sortedSurfaceSeqs[sortedSurfaceSeqs.length - 1] : undefined;
}

/**
 * Session-level metadata for list rows.
 *
 * @param {object | null} header session header.
 * @param {Array<any>} events contiguous events.
 * @param {{sessionId?: string}} [options]
 * @returns {{sessionId: string, title: string | null, cwd: string | null, createdAt: number,
 *   updatedAt: number, parentSession: string | null, origin: string | null,
 *   agentPreset: string | null, isSeeded: boolean, inheritedEventCount: number}}
 */
export function summarizeSession(header, events, options = {}) {
  const sessionId = options.sessionId ?? (header && typeof header.id === 'string' ? header.id : null);
  if (sessionId === null) throw new SearchCoreError('no-session-id', 'cannot summarize a log without a session id');
  let updatedAt = header && typeof header.createdAt === 'number' ? header.createdAt : 0;
  for (const event of events) if (typeof event.time === 'number' && event.time > updatedAt) updatedAt = event.time;
  return {
    sessionId,
    title: extractSessionTitle(events),
    cwd: header && typeof header.cwd === 'string' ? header.cwd : null,
    createdAt: header && typeof header.createdAt === 'number' ? header.createdAt : 0,
    updatedAt,
    parentSession: header && typeof header.parentSession === 'string' ? header.parentSession : null,
    origin: header && typeof header.origin === 'string' ? header.origin : null,
    agentPreset: header && typeof header.agentPreset === 'string' ? header.agentPreset : null,
    isSeeded: header ? header.isSeeded === true : false,
    inheritedEventCount: inheritedEventCount(events),
  };
}

// #endregion

// #region session file discovery

/**
 * Resolve the DSH home directory (mirrors `resolveDshHome` used by shipped plugins).
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string} absolute DSH home path.
 */
export function resolveDshHome(env = process.env) {
  const raw = env.DSH_HOME;
  if (typeof raw === 'string' && raw.trim() !== '') {
    if (raw === '~') return os.homedir();
    if (raw.startsWith('~/')) return path.join(os.homedir(), raw.slice(2));
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }
  return path.join(os.homedir(), '.dsh');
}

/** Default session root: `<DSH_HOME>/sessions`. @param {Record<string, string | undefined>} [env] */
export function defaultSessionsRoot(env = process.env) {
  return path.join(resolveDshHome(env), 'sessions');
}

/**
 * List the canonical (highest-generation) log artifact of every session under a
 * persistence root. Layout (from `@deepseek-ai/dsh-session-persistence-jsonl`):
 *
 * ```text
 * <root>/--<normalized-cwd>--/<encoded-session-id>/session[.vN].jsonl[.zstd]
 * ```
 *
 * The project directory name is lossy; the authoritative workspace is
 * `header.cwd`, so callers should group by header, not by directory name.
 *
 * @param {string} root persistence root (usually `<DSH_HOME>/sessions`).
 * @param {{fs?: typeof fsSync}} [options]
 * @returns {Array<{file: string, sessionDir: string, projectDir: string, version: number, compression: 'zstd' | 'none'}>}
 */
export function discoverSessionFiles(root, options = {}) {
  const fs = options.fs ?? fsSync;
  /** @type {Array<{file: string, sessionDir: string, projectDir: string, version: number, compression: 'zstd' | 'none'}>} */
  const found = [];
  let projects;
  try {
    projects = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return found;
    throw error;
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const projectDir = path.join(root, project.name);
    let sessions;
    try {
      sessions = fs.readdirSync(projectDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const session of sessions) {
      if (!session.isDirectory()) continue;
      const sessionDir = path.join(projectDir, session.name);
      let files;
      try {
        files = fs.readdirSync(sessionDir, { withFileTypes: true });
      } catch {
        continue;
      }
      /** @type {Array<{file: string, version: number, compression: 'zstd' | 'none'}>} */
      const candidates = [];
      for (const file of files) {
        if (!file.isFile()) continue;
        const match = SESSION_ARTIFACT_RE.exec(file.name);
        if (match === null) continue;
        const version = match[1] === undefined ? 0 : Number(match[1]);
        const compression = file.name.endsWith('.zstd') ? 'zstd' : 'none';
        candidates.push({ file: path.join(sessionDir, file.name), version, compression });
      }
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => b.version - a.version || (a.compression === 'zstd' ? -1 : 1));
      const chosen = candidates[0];
      found.push({ file: chosen.file, sessionDir, projectDir, version: chosen.version, compression: chosen.compression });
    }
  }
  found.sort((a, b) => a.file.localeCompare(b.file));
  return found;
}

// #endregion

// #region index build / incremental update / persistence

/** Create an empty index document. @returns {{version: number, builtAt: number, sessions: Record<string, any>}} */
export function createIndex() {
  return { version: INDEX_VERSION, builtAt: 0, sessions: {} };
}

/**
 * Build the search index for every session under `root`.
 *
 * @param {{root?: string, fs?: typeof fsSync, extraction?: object, onProgress?: (progress: {processed: number, total: number, file: string, sessionId: string | null}) => void, signal?: AbortSignal}} [options]
 * @returns {{index: {version: number, builtAt: number, sessions: Record<string, any>}, stats: {files: number, indexed: number, skipped: number, entries: number, chars: number, parseMs: number, totalMs: number, issues: Array<{file: string, code: string, message: string}>}}}
 */
export function buildIndex(options = {}) {
  const root = options.root ?? defaultSessionsRoot();
  const started = performance.now();
  const index = createIndex();
  const stats = {
    files: 0,
    indexed: 0,
    skipped: 0,
    entries: 0,
    chars: 0,
    parseMs: 0,
    totalMs: 0,
    issues: /** @type {Array<{file: string, code: string, message: string}>} */ ([]),
  };
  const files = discoverSessionFiles(root, { fs: options.fs });
  stats.files = files.length;
  files.forEach((artifact, i) => {
    if (options.signal && options.signal.aborted) throw new SearchCoreError('aborted', 'index build aborted');
    const parseStart = performance.now();
    try {
      const record = indexOneSession(artifact.file, { fs: options.fs, extraction: options.extraction });
      index.sessions[record.meta.sessionId] = record;
      stats.indexed += 1;
      stats.entries += record.entries.length;
      stats.chars += record.entries.reduce((sum, entry) => sum + entry.text.length, 0);
      for (const issue of record.issues) stats.issues.push({ file: artifact.file, ...issue });
    } catch (error) {
      stats.skipped += 1;
      stats.issues.push({
        file: artifact.file,
        code: error && error.code ? error.code : 'read-failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      stats.parseMs += performance.now() - parseStart;
    }
    if (typeof options.onProgress === 'function') {
      const sessionId = Object.keys(index.sessions).at(-1) ?? null;
      options.onProgress({ processed: i + 1, total: files.length, file: artifact.file, sessionId });
    }
  });
  index.builtAt = Date.now();
  if (options.warm !== false) warmMatchText(index);
  stats.totalMs = performance.now() - started;
  return { index, stats };
}

/**
 * Update an existing index in place conceptually: only files whose `size` or
 * `mtimeMs` changed are re-parsed; deleted sessions are dropped. Returns a new
 * index object (the input is not mutated) plus stats.
 *
 * @param {{version: number, builtAt: number, sessions: Record<string, any>}} index previous index.
 * @param {{root?: string, fs?: typeof fsSync, extraction?: object, force?: boolean, onProgress?: Function, signal?: AbortSignal}} [options]
 * @returns {{index: {version: number, builtAt: number, sessions: Record<string, any>}, stats: {files: number, parsed: number, reused: number, removed: number, entries: number, chars: number, parseMs: number, totalMs: number, issues: Array<{file: string, code: string, message: string}>}}}
 */
export function updateIndex(index, options = {}) {
  const root = options.root ?? defaultSessionsRoot();
  const fs = options.fs ?? fsSync;
  const started = performance.now();
  const next = { version: INDEX_VERSION, builtAt: Date.now(), sessions: { ...(index && index.sessions ? index.sessions : {}) } };
  const stats = {
    files: 0,
    parsed: 0,
    reused: 0,
    removed: 0,
    entries: 0,
    chars: 0,
    parseMs: 0,
    totalMs: 0,
    issues: /** @type {Array<{file: string, code: string, message: string}>} */ ([]),
  };
  const artifacts = discoverSessionFiles(root, { fs });
  stats.files = artifacts.length;
  const seen = new Set();
  /** @type {Map<string, any>} */
  const byFile = new Map();
  for (const session of Object.values(next.sessions)) {
    if (session && typeof session.file === 'string') byFile.set(session.file, session);
  }
  artifacts.forEach((artifact, i) => {
    if (options.signal && options.signal.aborted) throw new SearchCoreError('aborted', 'index update aborted');
    let stat;
    try {
      stat = fs.statSync(artifact.file);
    } catch (error) {
      stats.issues.push({ file: artifact.file, code: 'stat-failed', message: String(error && error.message) });
      return;
    }
    const previous = byFile.get(artifact.file);
    if (previous) seen.add(previous.meta.sessionId);
    const unchanged = previous && !options.force && previous.size === stat.size && previous.mtimeMs === stat.mtimeMs;
    if (unchanged) {
      stats.reused += 1;
      stats.entries += previous.entries.length;
      stats.chars += previous.chars;
      if (typeof options.onProgress === 'function') options.onProgress({ processed: i + 1, total: artifacts.length, file: artifact.file, sessionId: previous.meta.sessionId });
      return;
    }
    const parseStart = performance.now();
    try {
      const record = indexOneSession(artifact.file, { fs, extraction: options.extraction });
      record.size = stat.size;
      record.mtimeMs = stat.mtimeMs;
      if (previous && previous.meta.sessionId !== record.meta.sessionId) delete next.sessions[previous.meta.sessionId];
      next.sessions[record.meta.sessionId] = record;
      stats.parsed += 1;
      stats.entries += record.entries.length;
      stats.chars += record.entries.reduce((sum, entry) => sum + entry.text.length, 0);
      for (const issue of record.issues) stats.issues.push({ file: artifact.file, ...issue });
    } catch (error) {
      stats.issues.push({
        file: artifact.file,
        code: error && error.code ? error.code : 'read-failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      stats.parseMs += performance.now() - parseStart;
    }
    if (typeof options.onProgress === 'function') options.onProgress({ processed: i + 1, total: artifacts.length, file: artifact.file, sessionId: null });
  });
  for (const [sessionId, session] of Object.entries(next.sessions)) {
    if (seen.has(sessionId)) continue;
    if (session && typeof session.file === 'string' && fs.existsSync(session.file)) continue;
    delete next.sessions[sessionId];
    stats.removed += 1;
  }
  if (options.warm !== false) warmMatchText(next);
  stats.totalMs = performance.now() - started;
  return { index: next, stats };
}

/**
 * Parse one artifact into its index record.
 *
 * @param {string} file absolute artifact path.
 * @param {{fs?: typeof fsSync, extraction?: object}} [options]
 * @returns {{meta: object, entries: Array<any>, chars: number, file: string, size: number, mtimeMs: number, issues: Array<{code: string, message: string}>}}
 */
export function indexOneSession(file, options = {}) {
  const fs = options.fs ?? fsSync;
  const stat = fs.statSync(file);
  const log = readSessionLog(file, { fs });
  if (log.header === null) throw new SearchCoreError('missing-header', `no session header in ${file}`);
  const meta = summarizeSession(log.header, log.events, { sessionId: log.sessionId ?? undefined });
  const entries = extractIndexableEntries(log.header, log.events, { ...(options.extraction ?? {}), sessionId: meta.sessionId });
  return {
    file,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    meta,
    entries,
    chars: entries.reduce((sum, entry) => sum + entry.text.length, 0),
    issues: log.issues,
  };
}

/**
 * Atomically write the index document: exclusive-create temp in the same
 * directory, fsync, rename over the target (POSIX atomic replacement; readers
 * see either the old or the new complete file).
 *
 * @param {string} filePath index file path (plugin-owned cache directory).
 * @param {{version: number, builtAt: number, sessions: Record<string, any>}} index index document.
 * @param {{fs?: typeof fsSync, mode?: number, dirMode?: number}} [options]
 * @returns {{bytes: number, file: string}}
 */
export function writeIndexFile(filePath, index, options = {}) {
  return writeJsonFileAtomic(filePath, index, options);
}

/**
 * Internal atomic JSON write: exclusive-create temp in the same directory,
 * fsync, rename over the target. Every persisted artifact in this module goes
 * through here.
 *
 * @param {string} filePath target path.
 * @param {unknown} value JSON-serializable value.
 * @param {{fs?: typeof fsSync, mode?: number, dirMode?: number}} [options]
 * @returns {{bytes: number, file: string}}
 */
export function writeJsonFileAtomic(filePath, value, options = {}) {
  const fs = options.fs ?? fsSync;
  const mode = options.mode ?? 0o600;
  const dirMode = options.dirMode ?? 0o700;
  const payload = Buffer.from(JSON.stringify(value), 'utf8');
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: dirMode });
  const temp = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}.tmp`;
  try {
    const fd = fs.openSync(temp, 'wx', mode);
    try {
      fs.writeSync(fd, payload);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temp, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(temp);
    } catch {
      // best effort cleanup
    }
    throw error;
  }
  return { bytes: payload.length, file: filePath };
}

/**
 * Load an index document, validating version and shape. Never throws for
 * damaged content — returns `corrupt: true` plus a reason so the caller can
 * rebuild from the session logs.
 *
 * @param {string} filePath index file path.
 * @param {{fs?: typeof fsSync}} [options]
 * @returns {{index: {version: number, builtAt: number, sessions: Record<string, any>} | null, corrupt: boolean, reason: string | null, bytes: number}}
 */
export function readIndexFile(filePath, options = {}) {
  const fs = options.fs ?? fsSync;
  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch (error) {
    return { index: null, corrupt: false, reason: error && error.code ? error.code : 'unreadable', bytes: 0 };
  }
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    return { index: null, corrupt: true, reason: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`, bytes: buffer.length };
  }
  if (!parsed || typeof parsed !== 'object' || parsed.version !== INDEX_VERSION || typeof parsed.sessions !== 'object' || parsed.sessions === null) {
    return {
      index: null,
      corrupt: true,
      reason: `unsupported index version/shape (expected ${INDEX_VERSION})`,
      bytes: buffer.length,
    };
  }
  return { index: parsed, corrupt: false, reason: null, bytes: buffer.length };
}

/**
 * Load the cached index, rebuilding it from scratch when missing or corrupt.
 *
 * @param {string} filePath index file path.
 * @param {{root?: string, fs?: typeof fsSync, extraction?: object, force?: boolean, onProgress?: Function, signal?: AbortSignal}} [options]
 * @returns {{index: object, rebuilt: boolean, load: {corrupt: boolean, reason: string | null}, stats?: object}}
 */
export function loadOrBuildIndex(filePath, options = {}) {
  const loaded = options.force === true
    ? { index: null, corrupt: false, reason: 'forced' }
    : readIndexFile(filePath, { fs: options.fs });
  if (loaded.index !== null) {
    const updated = updateIndex(loaded.index, { ...options });
    if (updated.stats.parsed > 0 || updated.stats.removed > 0) writeIndexFile(filePath, updated.index, { fs: options.fs });
    return { index: updated.index, rebuilt: false, load: loaded, stats: updated.stats };
  }
  const built = buildIndex({ ...options });
  writeIndexFile(filePath, built.index, { fs: options.fs });
  return { index: built.index, rebuilt: true, load: loaded, stats: built.stats };
}

// #endregion

// #region on-disk cache (project contract layout)

/**
 * Encode a session id as one filesystem-safe shard name. Session ids are
 * already URL/uuid-shaped in practice; this keeps the cache safe for any id a
 * future format accepts (mirrors `encodeSegment` semantics).
 *
 * @param {string} sessionId
 * @returns {string}
 */
export function cacheShardName(sessionId) {
  let out = '';
  for (const char of sessionId) {
    if (/^[A-Za-z0-9._-]$/u.test(char) && char !== '~') out += char;
    else for (let i = 0; i < char.length; i += 1) out += `~${char.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return out === '' ? '~0000' : out;
}

/** Compact tuple used by the project cache contract: `[seq, turn, kind, time, text]`. */
export function entryToTuple(entry) {
  return [entry.seq, entry.turn ?? null, entry.kind, entry.time, entry.text];
}

/** Rebuild an entry object from a cache tuple plus optional anchor metadata. */
export function tupleToEntry(sessionId, title, tuple, anchor) {
  const [seq, turn, kind, time, text] = tuple;
  const type = anchor?.[2] ?? kindToEventType(kind);
  return {
    sessionId,
    seq,
    kind,
    type,
    text,
    title: title ?? null,
    time,
    turn,
    surface: anchor?.[0] ?? 'current',
    anchorSeq: anchor?.[1] ?? seq,
    ...(kind === 'user' && anchor?.[3] !== undefined ? { sourceKind: anchor[3] } : {}),
  };
}

/** Default event type for one entry kind (used when a cache shard has no anchor metadata). */
function kindToEventType(kind) {
  if (kind === 'user') return 'user/message';
  if (kind === 'assistant' || kind === 'thinking') return 'assistant/message';
  return 'tool/result';
}

/** Build the contract shard document for one in-memory session record. */
export function toCacheShard(session) {
  const meta = session.meta ?? {};
  const anchors = {};
  for (const entry of session.entries ?? []) {
    const customType = kindToEventType(entry.kind) !== entry.type;
    if (entry.surface !== 'current' || entry.anchorSeq !== entry.seq || customType || entry.sourceKind !== undefined) {
      anchors[String(entry.seq)] = [entry.surface ?? 'current', entry.anchorSeq ?? entry.seq, entry.type, entry.sourceKind];
    }
  }
  const shard = {
    version: INDEX_VERSION,
    sessionId: meta.sessionId,
    title: meta.title ?? null,
    cwd: meta.cwd ?? null,
    createdAt: meta.createdAt ?? 0,
    updatedAt: meta.updatedAt ?? 0,
    entries: (session.entries ?? []).map(entryToTuple),
  };
  if (Object.keys(anchors).length > 0) shard.anchors = anchors;
  return shard;
}

/** Build the contract manifest document for an index (no entry bodies). */
export function toCacheManifest(index) {
  const sessions = {};
  for (const [sessionId, session] of Object.entries(index.sessions ?? {})) {
    const meta = session.meta ?? {};
    sessions[sessionId] = {
      file: session.file,
      mtimeMs: session.mtimeMs ?? 0,
      size: session.size ?? 0,
      title: meta.title ?? null,
      cwd: meta.cwd ?? null,
      createdAt: meta.createdAt ?? 0,
      updatedAt: meta.updatedAt ?? 0,
      entries: (session.entries ?? []).length,
      chars: session.chars ?? 0,
    };
  }
  return { version: INDEX_VERSION, builtAt: index.builtAt ?? Date.now(), sessions };
}

/**
 * Persist the index in the project cache layout (`docs/api-contract.md` §3):
 *
 * ```text
 * <cacheDir>/manifest.json          # { version, builtAt, sessions: { [id]: meta } }
 * <cacheDir>/sessions/<id>.json     # { version, sessionId, title, ..., entries: [[seq,turn,kind,time,text]] }
 * ```
 *
 * Shard bodies are rewritten only when the session's `mtimeMs` or `size`
 * changed (or the shard is missing); `manifest.json` is written last so it is
 * the commit point, then orphaned shard files are removed. Every write is
 * temp + fsync + rename.
 *
 * @param {string} cacheDir cache directory (e.g. `$DSH_HOME/cache/dsh-conversation-search`).
 * @param {{version: number, builtAt: number, sessions: Record<string, any>}} index in-memory index.
 * @param {{fs?: typeof fsSync, mode?: number, dirMode?: number}} [options]
 * @returns {{manifestBytes: number, shardsWritten: number, shardsReused: number, shardsRemoved: number}}
 */
export function writeIndexCache(cacheDir, index, options = {}) {
  const fs = options.fs ?? fsSync;
  const shardDir = path.join(cacheDir, 'sessions');
  fs.mkdirSync(shardDir, { recursive: true, mode: options.dirMode ?? 0o700 });
  const previous = readCacheManifestDocument(path.join(cacheDir, 'manifest.json'), fs);
  const active = new Set();
  let shardsWritten = 0;
  let shardsReused = 0;
  for (const [sessionId, session] of Object.entries(index.sessions ?? {})) {
    const name = `${cacheShardName(sessionId)}.json`;
    const shardFile = path.join(shardDir, name);
    active.add(name);
    const prior = previous?.sessions?.[sessionId];
    const unchanged =
      prior !== undefined &&
      prior.mtimeMs === (session.mtimeMs ?? 0) &&
      prior.size === (session.size ?? 0) &&
      prior.entries === (session.entries ?? []).length &&
      fs.existsSync(shardFile);
    if (unchanged) {
      shardsReused += 1;
      continue;
    }
    writeJsonFileAtomic(shardFile, toCacheShard(session), options);
    shardsWritten += 1;
  }
  let shardsRemoved = 0;
  let entries;
  try {
    entries = fs.readdirSync(shardDir);
  } catch {
    entries = [];
  }
  for (const name of entries) {
    if (!name.endsWith('.json') || active.has(name)) continue;
    try {
      fs.unlinkSync(path.join(shardDir, name));
      shardsRemoved += 1;
    } catch {
      // best effort
    }
  }
  const manifest = toCacheManifest(index);
  const written = writeJsonFileAtomic(path.join(cacheDir, 'manifest.json'), manifest, options);
  return { manifestBytes: written.bytes, shardsWritten, shardsReused, shardsRemoved };
}

/** Read and validate a manifest document, or return null when missing/corrupt. */
function readCacheManifestDocument(filePath, fs) {
  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(buffer.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || parsed.version !== INDEX_VERSION || typeof parsed.sessions !== 'object' || parsed.sessions === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Load the contract cache layout. A missing manifest is not corruption
 * (`corrupt:false` + reason `ENOENT`); a damaged manifest is; a damaged shard
 * is reported as a warning while the other sessions still load (partial index),
 * because one unreadable cache file must not blank the whole search.
 *
 * @param {string} cacheDir cache directory.
 * @param {{fs?: typeof fsSync}} [options]
 * @returns {{index: {version: number, builtAt: number, sessions: Record<string, any>} | null,
 *   corrupt: boolean, reason: string | null, warnings: Array<{code: string, message: string}>, bytes: number}}
 */
export function readIndexCache(cacheDir, options = {}) {
  const fs = options.fs ?? fsSync;
  const manifestPath = path.join(cacheDir, 'manifest.json');
  let buffer;
  try {
    buffer = fs.readFileSync(manifestPath);
  } catch (error) {
    return { index: null, corrupt: false, reason: error && error.code ? error.code : 'unreadable', warnings: [], bytes: 0 };
  }
  let manifest;
  try {
    manifest = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    return { index: null, corrupt: true, reason: `invalid manifest JSON: ${error instanceof Error ? error.message : String(error)}`, warnings: [], bytes: buffer.length };
  }
  if (!manifest || typeof manifest !== 'object' || manifest.version !== INDEX_VERSION || typeof manifest.sessions !== 'object' || manifest.sessions === null) {
    return { index: null, corrupt: true, reason: `unsupported cache version/shape (expected ${INDEX_VERSION})`, warnings: [], bytes: buffer.length };
  }
  const index = { version: INDEX_VERSION, builtAt: typeof manifest.builtAt === 'number' ? manifest.builtAt : 0, sessions: {} };
  const warnings = [];
  const shardDir = path.join(cacheDir, 'sessions');
  for (const [sessionId, meta] of Object.entries(manifest.sessions)) {
    const shardFile = path.join(shardDir, `${cacheShardName(sessionId)}.json`);
    try {
      const shard = JSON.parse(fs.readFileSync(shardFile, 'utf8'));
      if (!shard || shard.version !== INDEX_VERSION || !Array.isArray(shard.entries)) throw new Error('invalid shard shape');
      const title = shard.title ?? meta.title ?? null;
      const entries = shard.entries.map((tuple) => {
        if (!Array.isArray(tuple) || tuple.length < 5) throw new Error('invalid entry tuple');
        return tupleToEntry(sessionId, title, tuple, shard.anchors?.[String(tuple[0])]);
      });
      index.sessions[sessionId] = {
        file: meta.file,
        size: meta.size ?? 0,
        mtimeMs: meta.mtimeMs ?? 0,
        chars: entries.reduce((sum, entry) => sum + entry.text.length, 0),
        issues: [],
        meta: {
          sessionId,
          title,
          cwd: shard.cwd ?? meta.cwd ?? null,
          createdAt: shard.createdAt ?? meta.createdAt ?? 0,
          updatedAt: shard.updatedAt ?? meta.updatedAt ?? 0,
          parentSession: null,
          origin: null,
          agentPreset: null,
          isSeeded: false,
          inheritedEventCount: 0,
        },
        entries,
      };
    } catch (error) {
      warnings.push({ code: 'corrupt-shard', message: `${sessionId}: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
  if (options.warm !== false) warmMatchText(index);
  return { index, corrupt: false, reason: null, warnings, bytes: buffer.length };
}

/**
 * Load the contract cache, rebuild it when missing/corrupt, and incrementally
 * refresh changed session files. Mirrors {@link loadOrBuildIndex} but uses the
 * manifest + shard layout the Host service contract specifies.
 *
 * @param {string} cacheDir cache directory.
 * @param {{root?: string, fs?: typeof fsSync, extraction?: object, force?: boolean,
 *   onProgress?: Function, signal?: AbortSignal}} [options]
 * @returns {{index: object, rebuilt: boolean, load: object, stats?: object}}
 */
export function loadOrBuildIndexCache(cacheDir, options = {}) {
  const fs = options.fs ?? fsSync;
  const loaded = options.force === true
    ? { index: null, corrupt: false, reason: 'forced', warnings: [] }
    : readIndexCache(cacheDir, { fs });
  if (loaded.index !== null && loaded.index.version === INDEX_VERSION) {
    const updated = updateIndex(loaded.index, { ...options });
    if (updated.stats.parsed > 0 || updated.stats.removed > 0) writeIndexCache(cacheDir, updated.index, { fs });
    return { index: updated.index, rebuilt: false, load: loaded, stats: updated.stats };
  }
  const built = buildIndex({ ...options });
  writeIndexCache(cacheDir, built.index, { fs });
  return { index: built.index, rebuilt: true, load: loaded, stats: built.stats };
}

// #endregion

// #region index search

/**
 * Whether one session record is a subagent child conversation.
 *
 * Subagent sessions carry `header.parentSession` (the owning session id) and/or
 * `header.origin: 'subagent'`; their session directory is a bare uuid. The GUI
 * cannot open such a session as the main conversation view, so a hit pointing
 * into one cannot be jumped to and must not pollute the default search result
 * set. The entries stay indexed: `/session` and {@link getEntry} still resolve
 * them by id.
 *
 * @param {{parentSession?: string | null, origin?: string | null} | null} meta session meta.
 * @returns {boolean}
 */
export function isSubagentSession(meta) {
  if (!meta || typeof meta !== 'object') return false;
  if (typeof meta.parentSession === 'string' && meta.parentSession.length > 0) return true;
  return meta.origin === 'subagent';
}

/**
 * Search an index with one literal query and group hits by session.
 *
 * Sessions are ordered by their newest hit time (descending), then truncated to
 * `limitSessions`. A `signal` is checked between sessions and between entries
 * so a new keystroke can abort an in-flight query.
 *
 * `kinds` restricts matching to the given entry kinds (`user` / `assistant` /
 * `tool` / `thinking`). It is applied per entry **before** the counters are
 * computed, so `hitCount`, `hitsTruncated`, `totalHits`, session ordering and
 * `truncated` all describe the filtered scope. Omitting `kinds` keeps the
 * unfiltered behaviour (`null`/undefined = every kind).
 *
 * `includeSubagents` (default false) drops subagent child conversations
 * ({@link isSubagentSession}) from the result set. They remain indexed and
 * reachable through `/session`; this switch only keeps the global result list
 * limited to sessions the GUI can open as the main view. The exclusion runs
 * before counting, so `totalSessions`, `hits`, `totalHits` and `truncated` never
 * mention subagent sessions unless asked for.
 *
 * @param {{version: number, builtAt: number, sessions: Record<string, any>}} index index document.
 * @param {string} query literal query.
 * @param {{caseSensitive?: boolean, wholeWord?: boolean, widthInsensitive?: boolean,
 *   limitSessions?: number, limitHitsPerSession?: number, includeShadowed?: boolean,
 *   includeInherited?: boolean, includeSubagents?: boolean, kinds?: string[],
 *   snippetRadius?: number, signal?: AbortSignal}} [options]
 * @returns {{query: string, totalSessions: number, totalHits: number, truncated: boolean,
 *   sessions: Array<{sessionId: string, title: string | null, cwd: string | null, createdAt: number,
 *     updatedAt: number, hits: Array<{seq: number, anchorSeq: number | null, kind: string, type: string,
 *     time: number, turn: number | null, surface: string, text: string, match: {start: number, end: number},
 *     snippet: string, snippetMatch: {start: number, end: number}}>}>}}
 */
export function searchIndex(index, query, options = {}) {
  const started = performance.now();
  // Matching runs on the collapsed whitespace form (never across line breaks),
  // exactly like the browser find path; snippets are produced on that same form.
  const needle = collapseText(query);
  const limitSessions = options.limitSessions ?? 20;
  const limitHitsPerSession = options.limitHitsPerSession ?? Infinity;
  const includeShadowed = options.includeShadowed !== false;
  const includeInherited = options.includeInherited !== false;
  const includeSubagents = options.includeSubagents === true;
  const snippetRadius = options.snippetRadius ?? 60;
  const limitHits = options.limitHitsPerSession ?? 50;
  const kinds = Array.isArray(options.kinds) ? new Set(options.kinds) : null;
  /** @type {Array<any>} */
  const sessions = [];
  let totalHits = 0;
  let truncated = false;
  if (needle.length === 0) {
    return { query, totalSessions: 0, totalHits: 0, truncated: false, sessions: [], elapsedMs: 0 };
  }
  for (const session of Object.values(index.sessions ?? {})) {
    if (options.signal && options.signal.aborted) throw new SearchCoreError('aborted', 'search aborted');
    const meta = session.meta ?? {};
    if (!includeSubagents && isSubagentSession(meta)) continue;
    /** @type {Array<any>} */
    const hits = [];
    let sessionHitCount = 0;
    for (const entry of session.entries ?? []) {
      if (!includeShadowed && entry.surface === 'shadowed') continue;
      if (!includeInherited && entry.inherited === true) continue;
      if (kinds !== null && !kinds.has(entry.kind)) continue;
      const haystack = matchTextOf(entry);
      if (haystack.length === 0) continue;
      const matches = substringMatches(haystack, needle, {
        caseSensitive: options.caseSensitive === true,
        wholeWord: options.wholeWord === true,
        widthInsensitive: options.widthInsensitive === true,
      });
      if (matches.length === 0) continue;
      sessionHitCount += matches.length;
      if (hits.length >= limitHits) continue;
      const match = matches[0];
      const snippet = makeSnippet(haystack, match, { radius: snippetRadius });
      hits.push({
        // dsh-conversation-search HTTP contract (docs/api-contract.md §2) fields:
        seq: entry.seq,
        turn: entry.turn,
        kind: entry.kind,
        time: entry.time,
        snippet: snippet.snippet,
        matchStart: snippet.matchStart,
        matchLength: snippet.matchLength,
        // Extra fields for jump/anchor and richer UI:
        anchorSeq: entry.anchorSeq ?? entry.seq,
        type: entry.type,
        surface: entry.surface,
        match,
        snippetMatch: { start: snippet.matchStart, end: snippet.matchStart + snippet.matchLength },
      });
    }
    if (sessionHitCount === 0) continue;
    totalHits += sessionHitCount;
    sessions.push({
      sessionId: meta.sessionId,
      title: meta.title,
      cwd: meta.cwd,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      hitCount: sessionHitCount,
      hits,
      hitsTruncated: sessionHitCount > hits.length,
    });
  }
  sessions.sort((a, b) => newestHitTime(b) - newestHitTime(a));
  if (sessions.length > limitSessions) {
    sessions.length = limitSessions;
    truncated = true;
  }
  return { query, totalSessions: sessions.length, totalHits, truncated, sessions, elapsedMs: performance.now() - started };
}

/** Newest hit time of one session result (contract orders sessions by that). */
function newestHitTime(session) {
  let newest = 0;
  for (const hit of session.hits) if (typeof hit.time === 'number' && hit.time > newest) newest = hit.time;
  return newest || session.updatedAt || 0;
}

/**
 * Look up one indexed entry by session + seq (backs the `/message` endpoint that
 * validates a hit still exists). O(entries) per call; the Host can keep a
 * per-session Map if this ever shows up in profiles.
 *
 * @param {{sessions: Record<string, any>}} index index document.
 * @param {string} sessionId
 * @param {number} seq
 * @returns {object | null} the entry, or null when the session/seq is unknown.
 */
export function getEntry(index, sessionId, seq) {
  const session = index.sessions?.[sessionId];
  if (!session) return null;
  for (const entry of session.entries ?? []) if (entry.seq === seq) return entry;
  return null;
}

// #endregion
