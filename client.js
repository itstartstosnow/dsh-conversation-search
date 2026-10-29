/* dsh-conversation-search — generated browser bundle. Do not edit directly;
 * edit client/src/*.js and run `node build-client.mjs`. */
window.__ModuleLoader__.load({
  id: "@itstartstosnow/dsh-conversation-search",
  factory(require) {
    'use strict';
    const React = require('react');
    /* ===== client/src/10-shared.js ===== */
/* ------------------------------------------------------------------------- *
 * dsh-conversation-search — shared client runtime (part 10).
 *
 * Concatenated by build-client.mjs into the single browser bundle together
 * with the other client/src parts. Every part runs inside one factory scope,
 * so top-level declarations here are visible to the parts that follow.
 * ------------------------------------------------------------------------- */

/** Locale namespace owned by this plugin. */
const DCS_NS = 'conversation-search';

/** Default number of sessions a global search returns before asking to narrow. */
const DCS_RESULT_LIMIT = 20;

/** Characters of context kept on each side of a hit snippet (requirements §3). */
const DCS_SNIPPET_RADIUS = 60;

/** Mark class names carried on our own elements only. */
const DCS_CLASS = {
  root: 'dcs-root',
  panel: 'dcs-panel',
  findbar: 'dcs-findbar',
  toast: 'dcs-toast',
};

/* ------------------------------- dictionaries ------------------------------ */

const DCS_ZH = {
  'panel.title': '搜索会话',
  'panel.placeholder': '搜索所有会话内容…',
  'panel.empty': '输入关键词，搜索全部会话正文',
  'panel.emptyHint': '支持中文、英文、数字与 emoji；匹配不分大小写。',
  'panel.loading': '正在搜索…',
  'panel.indexing': '正在建立索引…',
  'panel.indexingProgress': '正在建立索引：{done}/{total} 个会话',
  'panel.error': '搜索失败：{message}',
  'panel.retry': '重试',
  'panel.more': '收起',
  'panel.expand': '展开 {count} 处命中',
  'panel.collapse': '收起命中',
  'panel.limit': '已达 {limit} 条会话上限，请缩小关键词',
  'panel.sessions': '{count} 个会话',
  'panel.hits': '{count} 处命中',
  'panel.hit.user': '用户提问',
  'panel.hit.assistant': '助手回复',
  'panel.hit.tool': '工具输出',
  'panel.hitAria': '第 {index} 处命中：{kind}',
  'panel.rebuilding': '正在重建索引…',
  'panel.rebuilt': '索引已重建',
  'panel.rebuild': '重建索引',
  'panel.noResults': '没有匹配的会话内容',
  'panel.noResultsHint': '换个关键词试试；中文两个字也能搜到。',
  'panel.moreResults': '还有更多命中未显示',
  'panel.searching': '搜索中…',

  'find.label': '在会话内查找',
  'find.placeholder': '在会话内查找…',
  'find.count': '{current}/{total}',
  'find.zero': '0/0',
  'find.prev': '上一个命中（Shift+Enter）',
  'find.next': '下一个命中（Enter）',
  'find.close': '关闭（Esc）',
  'find.emptyQuery': '输入关键词',
  'find.noResults': '无结果',
  'find.caseSensitive': '区分大小写',
  'find.wholeWord': '全词匹配',
  'find.loading': '正在回溯加载…',
  'find.loadingProgress': '正在回溯加载历史：已加载到第 {seq} 条',
  'find.cancel': '取消',
  'find.cancelled': '已取消定位',
  'find.notFound': '该条已不在当前会话历史中',
  'find.failed': '定位失败：{message}',
  'find.landed': '已定位到命中消息',
  'find.searchScope': '匹配范围为已加载的消息',
  'find.untitled': '未命名会话',

  'jump.opening': '正在打开会话…',
  'jump.loading': '正在回溯加载到命中消息…',
  'jump.loaded': '已加载到目标位置',
  'jump.missingSession': '找不到该会话',
  'jump.failed': '打开会话失败：{message}',

  'common.cancel': '取消',
  'common.close': '关闭',
};

const DCS_EN = {
  'panel.title': 'Search sessions',
  'panel.placeholder': 'Search the text of every session…',
  'panel.empty': 'Type a keyword to search every session transcript',
  'panel.emptyHint': 'Chinese, English, digits and emoji all match; case-insensitive by default.',
  'panel.loading': 'Searching…',
  'panel.indexing': 'Building the index…',
  'panel.indexingProgress': 'Building the index: {done}/{total} sessions',
  'panel.error': 'Search failed: {message}',
  'panel.retry': 'Retry',
  'panel.more': 'Show less',
  'panel.expand': 'Show {count} hits',
  'panel.collapse': 'Hide hits',
  'panel.limit': 'Stopped at {limit} sessions — narrow the keyword',
  'panel.sessions': '{count} sessions',
  'panel.hits': '{count} hits',
  'panel.hit.user': 'User prompt',
  'panel.hit.assistant': 'Assistant reply',
  'panel.hit.tool': 'Tool output',
  'panel.hitAria': 'Hit {index}: {kind}',
  'panel.rebuilding': 'Rebuilding the index…',
  'panel.rebuilt': 'Index rebuilt',
  'panel.rebuild': 'Rebuild index',
  'panel.noResults': 'No session content matched',
  'panel.noResultsHint': 'Try another keyword; two-character Chinese words match too.',
  'panel.moreResults': 'More hits are hidden',
  'panel.searching': 'Searching…',

  'find.label': 'Find in conversation',
  'find.placeholder': 'Find in conversation…',
  'find.count': '{current}/{total}',
  'find.zero': '0/0',
  'find.prev': 'Previous match (Shift+Enter)',
  'find.next': 'Next match (Enter)',
  'find.close': 'Close (Esc)',
  'find.emptyQuery': 'Type a keyword',
  'find.noResults': 'No results',
  'find.caseSensitive': 'Match case',
  'find.wholeWord': 'Whole word',
  'find.loading': 'Loading earlier history…',
  'find.loadingProgress': 'Loading earlier history: {seq} loaded',
  'find.cancel': 'Cancel',
  'find.cancelled': 'Jump cancelled',
  'find.notFound': 'That message is no longer in this session',
  'find.failed': 'Jump failed: {message}',
  'find.landed': 'Jumped to the matching message',
  'find.searchScope': 'Searches loaded messages',
  'find.untitled': 'Untitled session',

  'jump.opening': 'Opening the session…',
  'jump.loading': 'Loading history up to the hit…',
  'jump.loaded': 'Target history loaded',
  'jump.missingSession': 'That session was not found',
  'jump.failed': 'Could not open the session: {message}',

  'common.cancel': 'Cancel',
  'common.close': 'Close',
};

/* --------------------------------- helpers -------------------------------- */

/** Tiny external store with a stable snapshot reference. */
function dcsCreateStore(initial) {
  let snapshot = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      if (Object.is(next, snapshot)) return;
      snapshot = next;
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          dcsLog.error('store listener failed', error);
        }
      }
    },
    update(producer) {
      const next = producer(snapshot);
      if (next !== undefined) this.set(next);
    },
  };
}

/** Subscribe a React component to one store. */
function dcsUseStore(store, selector) {
  const read = React.useCallback(() => (selector ? selector(store.getSnapshot()) : store.getSnapshot()), [store, selector]);
  return React.useSyncExternalStore(store.subscribe, read, read);
}

/** Interpolate `{name}` placeholders. */
function dcsFormat(template, params) {
  if (!params) return template;
  return String(template).replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/** Minimal namespaced logger so failures are visible without flooding the console. */
const dcsLog = {
  debug(...args) {
    if (globalThis.__DCS_DEBUG__ === true) console.debug('[conversation-search]', ...args);
  },
  info(...args) {
    console.info('[conversation-search]', ...args);
  },
  warn(...args) {
    console.warn('[conversation-search]', ...args);
  },
  error(...args) {
    console.error('[conversation-search]', ...args);
  },
};

/**
 * Normalize text the same way the Host index does: unify line endings, fold
 * runs of horizontal whitespace, keep line breaks meaningful, trim ends.
 * The Host keeps a copy of this exact function; keep them in sync.
 */
function dcsNormalizeText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Collapse every whitespace run (line breaks included) to one space, for matching. */
function dcsCollapseText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** Build a snippet around a hit inside normalized text. */
function dcsSnippet(text, start, length, radius) {
  const r = radius ?? DCS_SNIPPET_RADIUS;
  const from = Math.max(0, start - r);
  const to = Math.min(text.length, start + length + r);
  const prefix = from > 0 ? '…' : '';
  const suffix = to < text.length ? '…' : '';
  return {
    text: prefix + text.slice(from, to) + suffix,
    matchStart: prefix.length + (start - from),
    matchLength: length,
  };
}

/** Case folding used by the browser-side matching paths. */
function dcsFoldCase(text) {
  return text.toLocaleLowerCase();
}

/** Whether the character at `index` is a word character for whole-word matching. */
function dcsIsWordChar(char) {
  return char !== undefined && /[\p{L}\p{N}_]/u.test(char);
}

/**
 * Find every match of `needle` in `haystack` following the conversation find
 * rules: case folding is applied by the caller when requested, whole-word
 * requires non-word characters (or string ends) on both sides.
 * @returns array of `{ start, length }` in `haystack` coordinates.
 */
function dcsFindMatches(haystack, needle, options) {
  const { caseSensitive = false, wholeWord = false } = options ?? {};
  if (!needle) return [];
  const hay = caseSensitive ? haystack : dcsFoldCase(haystack);
  const pin = caseSensitive ? needle : dcsFoldCase(needle);
  const matches = [];
  let from = 0;
  for (;;) {
    const at = hay.indexOf(pin, from);
    if (at < 0) break;
    const end = at + pin.length;
    if (!wholeWord || (!dcsIsWordChar(hay[at - 1]) && !dcsIsWordChar(hay[end]))) {
      matches.push({ start: at, length: pin.length });
    }
    from = at + Math.max(1, pin.length);
    if (matches.length > 5000) break;
  }
  return matches;
}

/* ---------------------------------- API ----------------------------------- */

/** Document-relative API base: the GUI is served with `<base href="./">`. */
const DCS_API_BASE = 'api/dsh-conversation-search';

/**
 * One Host API failure with a stable code so the UI can distinguish
 * "indexing", "not found" and transport errors instead of collapsing them
 * into an empty result list (requirements §3: failures must not look empty).
 */
class DcsApiError extends Error {
  constructor(code, message, status) {
    super(message || code);
    this.name = 'DcsApiError';
    this.code = code;
    this.status = status;
  }
}

/** Encode a flat query object; booleans become 1/0, nullish entries are dropped. */
function dcsQueryString(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  const text = search.toString();
  return text === '' ? '' : '?' + text;
}

/**
 * Call one plugin API route and unwrap its envelope.
 * @returns the `data` object of `{ ok: true, ... }` responses.
 */
async function dcsApiRequest(path, options) {
  const { method = 'GET', params, signal } = options ?? {};
  let response;
  try {
    response = await fetch(DCS_API_BASE + path + dcsQueryString(params), {
      method,
      signal,
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    });
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    throw new DcsApiError('transport', error && error.message ? error.message : 'network request failed', 0);
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    throw new DcsApiError('bad-response', 'the search service returned invalid JSON', response.status);
  }
  if (!response.ok || !payload || payload.ok !== true) {
    const failure = payload && payload.error ? payload.error : {};
    throw new DcsApiError(failure.code || 'http-' + response.status, failure.message || 'search request failed', response.status);
  }
  return payload;
}

/**
 * Serialize an entry-kind selection into the wire form (`user,assistant`).
 * `undefined` means "the Host default" and is dropped from the query string.
 */
function dcsKindsParam(kinds) {
  if (kinds === undefined || kinds === null) return undefined;
  const list = Array.isArray(kinds) ? kinds : [kinds];
  const unique = [];
  for (const kind of list) {
    if (typeof kind !== 'string' || kind === '') continue;
    if (!unique.includes(kind)) unique.push(kind);
  }
  return unique.length > 0 ? unique.join(',') : '';
}

const dcsApi = {
  /** Index readiness, progress and counts. */
  status: (signal) => dcsApiRequest('/status', { signal }),
  /** Search every indexed session; returns sessions aggregated with their hits. */
  search: (query, options, signal) =>
    dcsApiRequest('/search', {
      signal,
      params: {
        q: query,
        caseSensitive: options?.caseSensitive ?? false,
        wholeWord: options?.wholeWord ?? false,
        limit: options?.limit ?? DCS_RESULT_LIMIT,
        kinds: dcsKindsParam(options?.kinds),
      },
    }),
  /** All hits of one session, used to prefill the find bar after a jump. */
  sessionHits: (sessionId, query, options, signal) =>
    dcsApiRequest('/session', {
      signal,
      params: {
        sessionId,
        q: query,
        caseSensitive: options?.caseSensitive ?? false,
        wholeWord: options?.wholeWord ?? false,
        kinds: dcsKindsParam(options?.kinds),
      },
    }),
  /** Fetch one indexed message to verify a jump target still exists. */
  message: (sessionId, seq, signal) => dcsApiRequest('/message', { signal, params: { sessionId, seq } }),
  /** Ask the Host to rebuild the whole index from the session logs. */
  rebuild: (signal) => dcsApiRequest('/rebuild', { method: 'POST', signal }),
};

/* ------------------------------- DOM helpers ------------------------------ */

const dcsDom = {
  /** All candidate transcript roots, in DOM order. */
  flowCandidates() {
    return Array.from(document.querySelectorAll('[data-slot="conversation.chat.flow"], [data-chat-flow]'));
  },

  /**
   * The transcript root of the session view that is actually on screen.
   *
   * The GUI keeps other retained session views mounted but hidden (zero-sized
   * or `display: none`), and the first `[data-chat-flow]` in document order is
   * not necessarily the visible one — after `openSession` the previously shown
   * session can still come first. Picking by painted area keeps row lookups,
   * needle matching and the jump engine on the transcript the user sees.
   */
  flowRoot() {
    const candidates = dcsDom.flowCandidates();
    if (candidates.length === 0) return null;
    let best = null;
    let bestArea = 0;
    for (const element of candidates) {
      if (!element.isConnected) continue;
      const rect = element.getBoundingClientRect();
      const area = Math.max(0, rect.width) * Math.max(0, rect.height);
      if (area > bestArea) {
        best = element;
        bestArea = area;
      }
    }
    if (best !== null) return best;
    return candidates.find((element) => element.getClientRects().length > 0) || candidates[0] || null;
  },

  /** The scrollable conversation viewport that carries the transcript. */
  scrollRoot() {
    const marked = document.querySelector('[data-conversation-scroll]');
    if (marked) return marked;
    const flow = dcsDom.flowRoot();
    if (!flow) return null;
    let node = flow;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') return node;
      node = node.parentElement;
    }
    return null;
  },

  /** Every transcript row in DOM order. */
  rows() {
    const flow = dcsDom.flowRoot();
    if (!flow) return [];
    return Array.from(flow.querySelectorAll('[data-chat-anchor-key][data-chat-turn]'));
  },

  /** Rows belonging to one turn number. */
  rowsForTurn(turn) {
    return dcsDom.rows().filter((row) => Number(row.dataset.chatTurn) === Number(turn));
  },

  /** Whether a row is actually rendered (not inside a hidden fold or virtual gap). */
  isRendered(element) {
    if (!element || !element.isConnected) return false;
    if (element.closest('[hidden]')) return false;
    return element.getClientRects().length > 0;
  },

  /** Text nodes under `root` that belong to rendered content. */
  textNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || node.nodeValue.trim() === '') return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        if (parent.closest('[hidden]')) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.' + DCS_CLASS.root)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    return nodes;
  },

  /** The nearest transcript row that contains `node`. */
  rowOf(node) {
    const element = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return element ? element.closest('[data-chat-anchor-key][data-chat-turn]') : null;
  },

  /**
   * Normalize text for DOM-to-index comparison: rendered markdown drops most
   * structural characters, so both sides strip whitespace and markdown noise.
   * Kept separate from `normalizeText`, which defines indexed plain text.
   */
  normalizeForMatch(value) {
    return String(value ?? '').replace(/[\s`*_~#>|[\]()!，。：；、"'\u005c{}-]+/gu, '');
  },

  /** Official message-track anchors, in DOM order. */
  anchors() {
    const flow = dcsDom.flowRoot();
    if (!flow) return [];
    return Array.from(flow.querySelectorAll('[data-chat-anchor-key]'));
  },

  /**
   * Deepest rendered anchor whose text contains the normalized needle. The
   * official `[data-chat-anchor-key]` attribute is a stable host contract; our
   * own panel subtree never renders inside the flow, so no exclusion needed.
   */
  findAnchorByNeedle(needle) {
    const target = dcsDom.normalizeForMatch(needle);
    if (target === '') return null;
    let best = null;
    let bestDepth = -1;
    for (const element of dcsDom.anchors()) {
      if (!dcsDom.isRendered(element)) continue;
      const text = element.textContent;
      if (!text || !dcsDom.normalizeForMatch(text).includes(target)) continue;
      let depth = 0;
      for (let node = element.parentElement; node !== null; node = node.parentElement) depth += 1;
      if (depth > bestDepth) {
        best = element;
        bestDepth = depth;
      }
    }
    return best;
  },

  /** The element that scrolls a transcript row (official conversation scrollport). */
  rowScrollPort(row) {
    if (!row) return null;
    const marked = row.closest('[data-conversation-scroll]');
    if (marked) return marked;
    let node = row.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') return node;
      node = node.parentElement;
    }
    return document.scrollingElement || null;
  },

  /**
   * Land one row in its scrollport by writing scrollTop, never by
   * scrollIntoView: the latter walks ancestor scrollers and can move sticky
   * host chrome, which the host then fights by snapping back to the tail.
   * `align: 'top'` leaves the official reading-line offset; `'center'`
   * centers the row.
   */
  landRow(row, options) {
    if (!row || !row.isConnected) return false;
    const align = options && options.align === 'center' ? 'center' : 'top';
    const behavior = options && options.behavior ? options.behavior : 'auto';
    const port = dcsDom.rowScrollPort(row);
    if (!port) return false;
    const rowRect = row.getBoundingClientRect();
    const portRect = port === document.scrollingElement ? { top: 0, height: window.innerHeight } : port.getBoundingClientRect();
    const current = port === document.scrollingElement ? window.scrollY : port.scrollTop;
    const desired =
      align === 'center'
        ? current + (rowRect.top - portRect.top) - Math.max(0, (portRect.height - rowRect.height) / 2)
        : current + (rowRect.top - portRect.top) - 24;
    try {
      if (port === document.scrollingElement) window.scrollTo({ top: Math.max(0, desired), behavior });
      else port.scrollTo({ top: Math.max(0, desired), behavior });
      return true;
    } catch (error) {
      dcsLog.debug('landRow failed', error);
      return false;
    }
  },

  /** Whether a row currently sits inside its scrollport (with a small slack). */
  rowInPort(row) {
    if (!row || !row.isConnected) return false;
    if (!row.offsetHeight && !row.offsetWidth) return false;
    const port = dcsDom.rowScrollPort(row);
    const rowRect = row.getBoundingClientRect();
    if (!port) return rowRect.height > 0;
    if (port === document.scrollingElement) return rowRect.top >= -40 && rowRect.bottom <= window.innerHeight + 40;
    const portRect = port.getBoundingClientRect();
    const relative = rowRect.top - portRect.top;
    return relative >= -40 && relative <= port.clientHeight + 40;
  },

  /** Scroll one row into the center of the conversation viewport. */
  scrollRowIntoView(row) {
    return dcsDom.landRow(row, { align: 'center', behavior: 'smooth' });
  },

  /**
   * Bring one matched text Range into view.
   *
   * Scrolling by the enclosing row is not enough: transcript rows can be taller
   * than the viewport (a whole assistant step or a collapsed process group is
   * one row), so centering the row can leave the matched line off screen. This
   * measures the Range itself and follows the browser's find behaviour:
   *
   * - `align: 'auto'` (default): a match above the viewport lands on the first
   *   visible line, a match below lands on the last visible line, and a match
   *   already fully visible does not move the transcript at all.
   * - `align: 'top'` / `'bottom'`: force that edge (used by jump landing).
   *
   * The scroll is written through `scrollTop` and corrected once after layout
   * settles (the host re-anchors content when it prepends history or finishes a
   * fold animation); any wheel/key/pointer intent from the reader aborts the
   * correction so the plugin never fights manual scrolling.
   *
   * @param {Range|null} range matched text range; may be detached or hidden.
   * @param {Element|null} row enclosing row, used as a fallback target.
   * @param {{align?: 'auto'|'top'|'bottom', margin?: number, bottomMargin?: number,
   *   behavior?: 'auto'|'smooth', recorrect?: boolean}} [options]
   * @returns {boolean} whether a scroll was issued.
   */
  revealRange(range, row, options) {
    const opts = options || {};
    const align = opts.align === 'top' || opts.align === 'bottom' ? opts.align : 'auto';
    const margin = typeof opts.margin === 'number' ? opts.margin : 16;
    const bottomMargin = typeof opts.bottomMargin === 'number' ? opts.bottomMargin : 16;
    // The composer floats over the lower part of the transcript and grows while
    // the reader types, so "last visible line" is not the viewport bottom: park
    // downward matches on the upper two-thirds line instead, which stays clear
    // no matter how tall the composer gets.
    const bottomRatio = typeof opts.bottomRatio === 'number' && opts.bottomRatio > 0 && opts.bottomRatio < 1 ? opts.bottomRatio : 2 / 3;
    const behavior = opts.behavior === 'smooth' ? 'smooth' : 'auto';
    const recorrect = opts.recorrect !== false;

    const measure = () => {
      let rect = null;
      if (range && typeof range.getBoundingClientRect === 'function') {
        try {
          rect = range.getBoundingClientRect();
        } catch (error) {
          dcsLog.debug('range measuring failed', error);
        }
      }
      if ((rect === null || (rect.width === 0 && rect.height === 0)) && row && row.isConnected) {
        rect = row.getBoundingClientRect();
      }
      if (rect === null || (rect.width === 0 && rect.height === 0)) return null;
      const port = row ? dcsDom.rowScrollPort(row) : dcsDom.scrollRoot();
      if (!port) return null;
      const portRect =
        port === document.scrollingElement
          ? { top: 0, bottom: window.innerHeight, height: window.innerHeight }
          : port.getBoundingClientRect();
      return { rect, port, portRect };
    };

    const current = measure();
    if (!current) return false;
    const { rect, port, portRect } = current;

    /**
     * The find bar floats over the conversation's top-right corner, so "the
     * first visible line" starts below it when the bar overlaps the scroll
     * port horizontally. Without this a match aligned to the very top would be
     * hidden behind the bar itself.
     */
    const topInsetFor = (viewPort) => {
      let inset = margin;
      if (typeof opts.topInset === 'number') {
        return Math.max(inset, opts.topInset);
      }
      try {
        const bar = document.querySelector('.dcs-findbar');
        if (!bar) return inset;
        const barRect = bar.getBoundingClientRect();
        if (barRect.width === 0 || barRect.height === 0) return inset;
        const overlapsX = barRect.left < viewPort.right && barRect.right > viewPort.left;
        if (overlapsX && barRect.bottom > viewPort.top) {
          inset = Math.max(inset, barRect.bottom - viewPort.top + 8);
        }
      } catch (error) {
        dcsLog.debug('find bar measuring failed', error);
      }
      return inset;
    };

    const bottomAnchorFor = (viewPort) => viewPort.top + viewPort.height * bottomRatio;

    let mode = align;
    if (mode === 'auto') {
      const above = rect.top < portRect.top + topInsetFor(portRect);
      const below = rect.bottom > bottomAnchorFor(portRect);
      if (!above && !below) return false; // fully visible: never move the reader
      mode = above ? 'top' : 'bottom';
    }

    const scroller = port === document.scrollingElement ? null : port;
    const readTop = () => (scroller ? scroller.scrollTop : window.scrollY);
    const writeTop = (top) => {
      const target = Math.max(0, Math.round(top));
      try {
        if (scroller) scroller.scrollTo({ top: target, behavior });
        else window.scrollTo({ top: target, behavior });
        return true;
      } catch (error) {
        dcsLog.debug('revealRange scroll failed', error);
        return false;
      }
    };

    const desiredTop = () => {
      const latest = measure();
      if (!latest) return null;
      const top =
        mode === 'top'
          ? latest.rect.top - latest.portRect.top - topInsetFor(latest.portRect)
          : latest.rect.bottom - (bottomAnchorFor(latest.portRect) - bottomMargin);
      return readTop() + top;
    };

    const first = desiredTop();
    if (first === null) return false;
    const moved = writeTop(first);

    if (recorrect) {
      let cancelled = false;
      const stop = () => {
        cancelled = true;
        removeIntentListeners();
      };
      const onIntent = () => stop();
      const intentEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
      const addIntentListeners = () => {
        for (const type of intentEvents) window.addEventListener(type, onIntent, { capture: true, passive: true, once: true });
      };
      const removeIntentListeners = () => {
        for (const type of intentEvents) window.removeEventListener(type, onIntent, true);
      };
      addIntentListeners();
      const correct = () => {
        if (cancelled) return;
        const latest = measure();
        if (!latest) {
          stop();
          return;
        }
        const off =
          mode === 'top'
            ? latest.rect.top - (latest.portRect.top + topInsetFor(latest.portRect))
            : latest.rect.bottom - (bottomAnchorFor(latest.portRect) - bottomMargin);
        if (Math.abs(off) <= 2) {
          stop();
          return;
        }
        writeTop(readTop() + off);
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(correct));
      }
      const timer = setTimeout(() => {
        correct();
        stop();
      }, 180);
      if (timer && typeof timer.unref === 'function') timer.unref();
    }
    return moved;
  },

  /**
   * Mark one row as the landed jump target for a moment. A class switch (not
   * inline styles) survives React reusing the row node; the stylesheet lives
   * in our own style tag, so unloading the plugin removes the look.
   */
  flashRow(row, durationMs) {
    if (!row || !row.isConnected) return () => {};
    const className = 'dcs-flash-row';
    row.classList.add(className);
    row.dataset.dcsFlash = '';
    let timer = setTimeout(() => {
      timer = null;
      dcsDom.clearRowFlash(row);
    }, durationMs ?? 6000);
    return () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      dcsDom.clearRowFlash(row);
    };
  },

  /** Remove the jump-target look from one row. */
  clearRowFlash(row) {
    if (!row) return;
    try {
      row.classList.remove('dcs-flash-row');
      delete row.dataset.dcsFlash;
    } catch (error) {
      dcsLog.debug('clearRowFlash failed', error);
    }
  },

  /**
   * The rectangle the floating find bar should be positioned against.
   *
   * The real transcript scrollport is `[data-conversation-scroll]` (an official
   * conversation-owned marker whose box matches the conversation area exactly).
   * The `conversation.view` slot wrapper and the chat flow element can both be
   * zero-sized (`display: contents` wrappers), so they are only fallbacks.
   */
  conversationBox() {
    const candidates = [
      document.querySelector('[data-conversation-scroll]'),
      document.querySelector('[data-slot="conversation.view"]'),
      dcsDom.flowRoot(),
    ];
    for (const target of candidates) {
      if (!target) continue;
      const rect = target.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) continue;
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    }
    return null;
  },

  /** Whether an event target would swallow typing (so Cmd+F should not hijack it). */
  isEditable(target) {
    if (!target || !(target instanceof Element)) return false;
    const element = target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]');
    return element !== null;
  },

  /** Focus helper that ignores focus failures from detached nodes. */
  focus(element) {
    if (!element) return;
    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      dcsLog.debug('focus failed', error);
    }
  },
};

/* ---------------------------- session utilities ---------------------------- */

const dcsSessions = {
  /** Session state snapshot store from the sessions client service. */
  store(ctx) {
    return ctx.sessions.list;
  },

  /** The session currently shown in the main conversation panel. */
  currentSessionId(ctx) {
    const snapshot = ctx.sessions.list.getSnapshot();
    for (const session of Object.values(snapshot.byId ?? {})) {
      if ((session.retainedBy?.mainView ?? 0) > 0) return session.id;
    }
    return null;
  },

  /** Resolve one session's live binding (created once the view retains it). */
  binding(ctx, sessionId) {
    try {
      return ctx.sessions.binding(sessionId);
    } catch (error) {
      dcsLog.debug('sessions.binding failed', error);
      return undefined;
    }
  },

  /** Wait until `sessionId` becomes the main view session. */
  waitForMainView(ctx, sessionId, options) {
    const timeoutMs = options?.timeoutMs ?? 15000;
    const signal = options?.signal;
    return new Promise((resolve, reject) => {
      if (dcsSessions.currentSessionId(ctx) === sessionId) {
        resolve(true);
        return;
      }
      let settled = false;
      let timer = null;
      const finish = (value, error) => {
        if (settled) return;
        settled = true;
        unsubscribe();
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(value);
      };
      const check = () => {
        if (dcsSessions.currentSessionId(ctx) === sessionId) finish(true);
      };
      const unsubscribe = ctx.sessions.list.subscribe(check);
      timer = setTimeout(() => finish(false, new Error('timed out waiting for the session view')), timeoutMs);
      if (signal) {
        if (signal.aborted) finish(false, new DOMException('aborted', 'AbortError'));
        else signal.addEventListener('abort', () => finish(false, new DOMException('aborted', 'AbortError')), { once: true });
      }
      check();
    });
  },

  /** The loaded history window of one session: `{ baseSeq, hasMore, loadingOlder }`. */
  loadedWindow(ctx, sessionId) {
    const binding = dcsSessions.binding(ctx, sessionId);
    const session = binding?.session;
    if (!session) return null;
    return {
      baseSeq: typeof session.baseSeq === 'number' ? session.baseSeq : 0,
      hasMore: session.hasMore === true,
      loadingOlder: session.loadingOlder === true,
    };
  },

  /**
   * Jump loader: page earlier history until the loaded window covers `seq`.
   * Mirrors the official turn navigation, which is not exposed to plugins.
   * Resolves when the Host finished paging; the promise has no abort hook, so
   * callers cancel by ignoring the result and clearing their UI.
   */
  async loadThrough(ctx, sessionId, seq) {
    const binding = dcsSessions.binding(ctx, sessionId);
    const session = binding?.session;
    if (!session || typeof session.loadThrough !== 'function') {
      throw new Error('session binding is not available');
    }
    await session.loadThrough(seq);
    return dcsSessions.loadedWindow(ctx, sessionId);
  },

  /** Open a session in the main panel. */
  open(ctx, sessionId) {
    ctx.uiWorkspace.openSession(sessionId);
  },
};

/* ------------------------------- transitions ------------------------------ */

/** Small finite-state helper for tone + text of a transient notice. */
const dcsToast = {
  show(text, tone) {
    const handler = DCS.handlers.toast;
    if (typeof handler === 'function') handler({ text, tone: tone || 'info' });
    else dcsLog.debug('toast', tone || 'info', text);
  },
};

/* ---------------------------------- DCS ---------------------------------- */

const DCS = {
  NS: DCS_NS,
  LIMIT: DCS_RESULT_LIMIT,
  SNIPPET_RADIUS: DCS_SNIPPET_RADIUS,
  CLASS: DCS_CLASS,
  zh: DCS_ZH,
  en: DCS_EN,
  log: dcsLog,
  api: dcsApi,
  dom: dcsDom,
  sessions: dcsSessions,
  toast: dcsToast,
  createStore: dcsCreateStore,
  useStore: dcsUseStore,
  format: dcsFormat,
  normalizeText: dcsNormalizeText,
  collapseText: dcsCollapseText,
  findMatches: dcsFindMatches,
  foldCase: dcsFoldCase,
  snippet: dcsSnippet,
  normalizeForMatch: (value) => dcsDom.normalizeForMatch(value),
  ApiError: DcsApiError,
  /** Filled by apply(): the client context. */
  ctx: null,
  /** Bound translator installed by apply(). */
  t: (key) => key,
  /** Callbacks published by the find-bar part for the sidebar part. */
  handlers: {},
  /** Shared stylesheet injection state. */
  styleTag: null,
};

/**
 * Inject this plugin's stylesheet once per page. Styles live in one tag owned
 * by the plugin so a reload replaces them cleanly.
 */
DCS.injectStyles = function injectStyles() {
  if (DCS.styleTag && DCS.styleTag.isConnected) return DCS.styleTag;
  const existing = document.querySelector('style[data-dcs-styles]');
  if (existing) {
    DCS.styleTag = existing;
    return existing;
  }
  const tag = document.createElement('style');
  tag.dataset.dcsStyles = '';
  tag.textContent = DCS_STYLES;
  document.head.appendChild(tag);
  DCS.styleTag = tag;
  return tag;
};

/** Build our CSS once; the string is plain CSS with theme tokens only. */
const DCS_STYLES = `
.dcs-root { color: var(--dsw-alias-label-primary); font-size: 14px; }

.dcs-panel { display: flex; flex-direction: column; min-height: 0; height: 100%; overflow: hidden; }
.dcs-panel__scroll { flex: 1; min-height: 0; overflow: auto; scrollbar-gutter: stable; }
.dcs-panel__content { max-width: 860px; margin: 0 auto; padding: 20px clamp(16px, 4vw, 32px) 40px; }
.dcs-panel__heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.dcs-panel__heading h1 { margin: 0; font-size: 20px; font-weight: 500; line-height: 28px; }
.dcs-panel__action { border: 0.5px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-button-elevated-fill); color: var(--dsw-alias-label-primary); border-radius: var(--dsw-radius-md, 8px); height: 30px; padding: 0 12px; font: inherit; font-size: 13px; cursor: pointer; }
.dcs-panel__action:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dcs-panel__action:disabled { opacity: 0.5; cursor: default; }
.dcs-panel__field { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); margin-bottom: 12px; }
.dcs-panel__field:focus-within { border-color: var(--dsw-alias-state-business-primary); }
.dcs-panel__field svg { flex: none; color: var(--dsw-alias-label-tertiary); }
.dcs-panel__input { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; }
.dcs-panel__input::placeholder { color: var(--dsw-alias-label-caption, var(--dsw-alias-label-tertiary)); }
.dcs-panel__status { color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 20px; margin: 0 0 10px; }
.dcs-panel__status--error { color: var(--dsw-alias-state-error-primary, #d9534f); }
.dcs-panel__list { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.dcs-panel__row { border-radius: 12px; }
.dcs-panel__row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dcs-panel__summary { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px 10px; border-radius: 12px; background: none; border: 0; text-align: left; color: inherit; font: inherit; cursor: pointer; }
.dcs-panel__summary:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px; }
.dcs-panel__title { display: block; font-weight: 500; line-height: 22px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dcs-panel__meta { display: block; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; margin-top: 2px; }
.dcs-panel__snippet { display: block; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; margin-top: 4px; overflow-wrap: anywhere; }
.dcs-panel__snippet mark, .dcs-panel__snippet .dcs-hit { background: var(--dcs-find-match-bg); color: inherit; border-radius: 3px; padding: 0 1px; }
.dcs-panel__chevron { flex: none; color: var(--dsw-alias-label-tertiary); margin-top: 3px; transition: transform 0.12s ease; }
.dcs-panel__row[data-open="true"] .dcs-panel__chevron { transform: rotate(90deg); }
.dcs-panel__hits { display: flex; flex-direction: column; gap: 2px; list-style: none; margin: 2px 0 8px; padding: 0 10px 6px 34px; }
.dcs-panel__hit { display: flex; gap: 8px; width: 100%; padding: 6px 8px; border: 0; border-radius: 8px; background: none; color: inherit; font: inherit; font-size: 13px; line-height: 19px; text-align: left; cursor: pointer; }
.dcs-panel__hit:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dcs-panel__hitIndex { flex: none; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.dcs-panel__hitKind { flex: none; color: var(--dsw-alias-state-business-primary, #7a9bf0); font-size: 12px; }
.dcs-panel__hitText { min-width: 0; overflow-wrap: anywhere; color: var(--dsw-alias-label-secondary); }
.dcs-panel__scopeWrap { position: relative; margin-bottom: 12px; }
.dcs-panel__field { margin-bottom: 0; }
.dcs-panel__scopeButton { display: inline-flex; align-items: center; gap: 4px; flex: none; height: 26px; padding: 0 8px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-tertiary); font: inherit; font-size: 12px; cursor: pointer; }
.dcs-panel__scopeButton:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
.dcs-panel__scopeButton[aria-expanded="true"] { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dcs-panel__scopeCount { font-variant-numeric: tabular-nums; color: var(--dsw-alias-state-business-primary, #7a9bf0); }
.dcs-panel__scopePopover { position: absolute; z-index: 12; top: calc(100% + 6px); right: 0; width: 236px; padding: 10px 12px; border-radius: 12px; background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1)); border: 0.5px solid var(--dsw-alias-border-l3); box-shadow: var(--dsw-elevation-panel); }
.dcs-panel__scopeRow { display: flex; align-items: center; gap: 8px; padding: 4px 2px; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); cursor: pointer; border-radius: 6px; }
.dcs-panel__scopeRow:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dcs-panel__scopeRow input { accent-color: var(--dsw-alias-state-business-primary, #7a9bf0); margin: 0; }
.dcs-panel__scopeRow input:disabled + span { color: var(--dsw-alias-label-tertiary); }
.dcs-panel__scopeHint { margin: 6px 2px 0; color: var(--dsw-alias-label-caption, var(--dsw-alias-label-tertiary)); font-size: 11px; line-height: 16px; }
.dcs-panel__empty { padding: 40px 8px; text-align: center; color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 21px; }
.dcs-panel__emptyTitle { font-size: 14px; color: var(--dsw-alias-label-secondary); margin: 0 0 6px; }
.dcs-panel__empty p { margin: 0; }
.dcs-panel__spinner { display: inline-block; width: 14px; height: 14px; margin-right: 6px; vertical-align: -2px; border-radius: 50%; border: 1.5px solid var(--dsw-alias-border-l3); border-top-color: var(--dsw-alias-state-business-primary, #7a9bf0); animation: dcs-spin 0.9s linear infinite; }
@keyframes dcs-spin { to { transform: rotate(360deg); } }

.dcs-findbar { position: fixed; z-index: 30; display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 14px; background: color-mix(in srgb, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1)) 72%, transparent); backdrop-filter: blur(10px) saturate(1.4); -webkit-backdrop-filter: blur(10px) saturate(1.4); box-shadow: var(--dsw-elevation-panel); border: 0.5px solid var(--dsw-alias-border-l3); color: var(--dsw-alias-label-primary); font-size: 13px; }
.dcs-findbar__input { width: 180px; min-width: 120px; height: 26px; border: 0; outline: none; background: transparent; color: inherit; font: inherit; font-size: 13px; }
.dcs-findbar__input::placeholder { color: var(--dsw-alias-label-tertiary); }
.dcs-findbar__count { color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; min-width: 38px; text-align: center; font-size: 12px; }
.dcs-findbar__button { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dcs-findbar__button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dcs-findbar__button:disabled { opacity: 0.35; cursor: default; }
.dcs-findbar__button[data-active="true"] { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dcs-findbar__button:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 1px; }
.dcs-findbar__divider { width: 0.5px; height: 18px; background: var(--dsw-alias-border-l3); margin: 0 2px; }
.dcs-findbar__state { color: var(--dsw-alias-label-tertiary); font-size: 12px; white-space: nowrap; }
.dcs-findbar__progress { display: flex; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary); font-size: 12px; white-space: nowrap; }
.dcs-findbar__cancel { border: 0; background: none; color: var(--dsw-alias-state-business-primary, #7a9bf0); cursor: pointer; font: inherit; font-size: 12px; padding: 0 2px; }

.dcs-toast { position: fixed; z-index: 31; max-width: 360px; padding: 8px 12px; border-radius: 12px; background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1)); box-shadow: var(--dsw-elevation-panel); border: 0.5px solid var(--dsw-alias-border-l3); color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 19px; }
.dcs-toast[data-tone="error"] { color: var(--dsw-alias-state-error-primary, #d9534f); }

:root {
  /* Highlighter palette: yellow marker on purpose — search hits must not be
     confused with clickable links (which use the theme's business blue). */
  --dcs-find-match-bg: rgba(255, 212, 32, 0.45);
  --dcs-find-current-bg: #ffd43b;
  --dcs-find-current-fg: #241d00;
  --dcs-jump-flash: #f5a623;
}
::highlight(dcs-find-match) { background-color: var(--dcs-find-match-bg); color: inherit; }
::highlight(dcs-find-current) { background-color: var(--dcs-find-current-bg); color: var(--dcs-find-current-fg); }

.dcs-flash-row { outline: 2px solid var(--dcs-jump-flash) !important; outline-offset: 6px !important; border-radius: 12px; transition: outline-color 160ms ease-in-out; }

@media (prefers-reduced-motion: reduce) {
  .dcs-panel__chevron, .dcs-panel__spinner { animation: none; transition: none; }
}
`;

    /* ===== client/src/20-search-panel.js ===== */
/* ------------------------------------------------------------------------- *
 * dsh-conversation-search — left sidebar global search panel (part 20).
 *
 * Registers the plugin's sidebar row (`sidebar.panellist`) and the page it
 * opens (`main`), then owns the whole search interaction: search-as-you-type
 * with abortable requests, session-aggregated results with expandable hits,
 * index-status / rebuild handling, and the hand-off to the find-bar part via
 * `DCS.handlers.jumpToHit`.
 *
 * Everything lives inside `DCS.startSearchPanel` so the concatenated bundle
 * has exactly one new top-level binding (the function assignment itself) and
 * cannot collide with the other client parts.
 * ------------------------------------------------------------------------- */

DCS.startSearchPanel = function startSearchPanel(ctx) {
  /** Main panel id and sidebar row id for this feature. */
  const PANEL_ID = 'conversation-search';
  /** Idle time before a typed query is sent (requirements §3: search-as-you-type). */
  const SEARCH_DEBOUNCE_MS = 250;
  /** Entry kinds a search can include, in menu order. */
  const KIND_ORDER = ['user', 'assistant', 'tool', 'thinking'];
  /** Default scope: what a reader sees as "the conversation" right away. */
  const DEFAULT_KINDS = ['user', 'assistant'];

  /** Status polling cadence while the index is being (re)built. */
  const STATUS_POLL_MS = 500;
  /** Give up polling after this many consecutive status failures (shows retry). */
  const STATUS_MAX_FAILURES = 12;
  /** Ignore an immediately "settled" status right after a rebuild request, so a
   * race between the POST response and the indexing flags cannot end the poll
   * before the Host actually started building. */
  const REBUILD_SETTLE_FLOOR_MS = 700;

  /* --------------------------- extra translations -------------------------- */

  Object.assign(DCS.zh, {
    'panel.extra.errorCode': '错误码：{code}',
    'panel.extra.statusFailed': '无法获取索引状态：{message}',
    'panel.extra.indexWarning': '索引有部分内容未能读取：{message}',
    'panel.extra.jumpUnavailable': '定位功能尚未就绪，请稍后再试',
    'panel.extra.stale': '历史已压缩',
  });
  Object.assign(DCS.en, {
    'panel.extra.errorCode': 'Error code: {code}',
    'panel.extra.statusFailed': 'Could not read the index status: {message}',
    'panel.extra.indexWarning': 'Parts of the index could not be read: {message}',
    'panel.extra.jumpUnavailable': 'Jumping is not ready yet — try again in a moment',
    'panel.extra.stale': 'Compacted away',
  });
  Object.assign(DCS.zh, {
    'panel.scope.label': '范围',
    'panel.scope.summary': '范围：{summary}',
    'panel.scope.user': '用户提问',
    'panel.scope.assistant': '助手回复',
    'panel.scope.tool': '工具输出',
    'panel.scope.thinking': '思考过程',
    'panel.scope.hint': '默认只搜用户提问与助手回复；工具与思考需在此勾选。',
    'panel.scope.keepOne': '至少保留一个搜索范围',
    'panel.hit.thinking': '思考过程',
  });
  Object.assign(DCS.en, {
    'panel.scope.label': 'Scope',
    'panel.scope.summary': 'Scope: {summary}',
    'panel.scope.user': 'User prompts',
    'panel.scope.assistant': 'Assistant replies',
    'panel.scope.tool': 'Tool output',
    'panel.scope.thinking': 'Thinking',
    'panel.scope.hint': 'Defaults to user prompts and assistant replies; tick tools or thinking to include them.',
    'panel.scope.keepOne': 'Keep at least one search scope',
    'panel.hit.thinking': 'Thinking',
  });

  /* -------------------------------- helpers -------------------------------- */

  /** Normalize `status.error` / thrown failures into `{ code, message }`. */
  function normalizeIndexError(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return { code: 'index', message: value };
    if (typeof value === 'object') {
      return {
        code: value.code ? String(value.code) : 'index',
        message: value.message ? String(value.message) : '',
      };
    }
    return null;
  }

  /** Normalize `status.progress` into `{ done, total }` or null. */
  function normalizeProgress(value) {
    if (!value || typeof value !== 'object') return null;
    const done = Number(value.done);
    const total = Number(value.total);
    if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return null;
    return { done: Math.max(0, Math.floor(done)), total: Math.max(1, Math.floor(total)) };
  }

  /** Failure object carried by the error state; `action` tells Retry what to do. */
  function failureOf(error, action) {
    const code = error && error.code ? String(error.code) : 'unknown';
    const message = error && error.message ? String(error.message) : '';
    return { code, message, action };
  }

  /* ----------------------------- state & flows ----------------------------- */

  const store = DCS.createStore({
    /** Raw text in the input, kept untrimmed for editing. */
    query: '',
    /** 'idle' | 'loading' | 'results' | 'error' */
    phase: 'idle',
    /** Last successful `/search` payload. */
    response: null,
    /** `{ code, message, action }` of the failure currently shown. */
    error: null,
    /** sessionId -> true for expanded result rows. */
    expanded: {},
    /** Entry kinds included in the query (`user`/`assistant`/`tool`/`thinking`). */
    kinds: DEFAULT_KINDS.slice(),
    /** Last known index readiness, from `/status` or a successful search. */
    index: { known: false, ready: false, building: false, progress: null, error: null },
    /** True between a rebuild request and the rebuilt index becoming ready. */
    rebuilding: false,
  });

  /** The page component is mounted only while this panel is selected. */
  let mounted = false;
  /** Monotonic token invalidating stale search responses after abort/retype. */
  let requestSeq = 0;
  let searchAbort = null;
  let debounceTimer = null;
  let statusTimer = null;
  let statusAbort = null;
  let statusGeneration = 0;
  let statusFailures = 0;
  let rebuildAbort = null;

  function snapshot() {
    return store.getSnapshot();
  }

  /** Abort the in-flight search (if any) and invalidate its completion handlers. */
  function abortSearch() {
    requestSeq += 1;
    if (searchAbort) {
      const controller = searchAbort;
      searchAbort = null;
      try {
        controller.abort();
      } catch (error) {
        DCS.log.debug('abort search failed', error);
      }
    }
  }

  function clearDebounce() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  /* ------------------------------- searching ------------------------------- */

  /** Fire the debounced search for whatever the input currently holds. */
  function scheduleSearch() {
    clearDebounce();
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!mounted) return;
      const query = snapshot().query.trim();
      if (query !== '') runSearch(query);
    }, SEARCH_DEBOUNCE_MS);
  }

  /** Input handler: update the text, cancel the previous request, restart the debounce. */
  function setQuery(value) {
    const query = typeof value === 'string' ? value : '';
    const trimmed = query.trim();
    abortSearch();
    if (trimmed === '') {
      clearDebounce();
      store.update((state) => ({ ...state, query, phase: 'idle', response: null, error: null }));
      return;
    }
    store.update((state) => ({ ...state, query, phase: 'idle', error: null }));
    scheduleSearch();
  }

  /** Enter: skip the debounce and search the current text immediately. */
  function searchNow() {
    clearDebounce();
    const query = snapshot().query.trim();
    if (query !== '') runSearch(query);
  }

  /** Send one search request; new input / unmount aborts it. */
  function runSearch(rawQuery) {
    const query = String(rawQuery == null ? '' : rawQuery).trim();
    clearDebounce();
    abortSearch();
    if (query === '') {
      store.update((state) => ({ ...state, phase: 'idle', response: null, error: null }));
      return;
    }
    const seq = ++requestSeq;
    const controller = new AbortController();
    searchAbort = controller;
    store.update((state) => ({ ...state, phase: 'loading', error: null }));
    DCS.api.search(
      query,
      { caseSensitive: false, wholeWord: false, limit: DCS.LIMIT, kinds: snapshot().kinds },
      controller.signal,
    ).then(
      (payload) => {
        if (!mounted || seq !== requestSeq) return;
        searchAbort = null;
        store.update((state) => ({
          ...state,
          phase: 'results',
          response: payload,
          error: null,
          // A successful search proves the index is usable.
          index: {
            known: true,
            ready: true,
            building: false,
            progress: null,
            error: state.index.error,
          },
        }));
      },
      (error) => {
        if (!mounted || seq !== requestSeq) return;
        searchAbort = null;
        if (error && error.name === 'AbortError') return;
        handleSearchFailure(error);
      },
    );
  }

  /** Route a failed search into either the indexing state or the error state. */
  function handleSearchFailure(error) {
    const code = error && error.code ? String(error.code) : 'unknown';
    const status = error && typeof error.status === 'number' ? error.status : 0;
    if (code === 'indexing' || status === 503) {
      store.update((state) => ({
        ...state,
        phase: 'idle',
        response: null,
        error: null,
        index: { known: true, ready: false, building: true, progress: state.index.progress, error: null },
      }));
      startStatusPolling();
      return;
    }
    store.update((state) => ({ ...state, phase: 'error', response: null, error: failureOf(error, 'search') }));
  }

  /* ---------------------------- index status poll --------------------------- */

  function stopStatusPolling() {
    statusGeneration += 1;
    if (statusTimer !== null) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    if (statusAbort) {
      const controller = statusAbort;
      statusAbort = null;
      try {
        controller.abort();
      } catch (error) {
        DCS.log.debug('abort status request failed', error);
      }
    }
  }

  /**
   * Poll `/status` until the index settles (ready, or failed). Used for the
   * first build (search answers 503 `indexing`) and after a rebuild request.
   */
  function startStatusPolling() {
    stopStatusPolling();
    const generation = statusGeneration;
    const startedAt = Date.now();
    let sawBuilding = false;
    statusFailures = 0;

    function schedule(delay) {
      if (generation !== statusGeneration) return;
      statusTimer = setTimeout(tick, delay);
    }

    function tick() {
      statusTimer = null;
      if (generation !== statusGeneration || !mounted) return;
      const controller = new AbortController();
      statusAbort = controller;
      DCS.api.status(controller.signal).then(
        (status) => {
          if (generation !== statusGeneration || !mounted) return;
          statusAbort = null;
          statusFailures = 0;
          const index = {
            known: true,
            ready: status.ready === true,
            building: status.building === true,
            progress: normalizeProgress(status.progress),
            error: normalizeIndexError(status.error),
          };
          if (index.building) sawBuilding = true;
          store.update((state) => ({ ...state, index }));
          const settled = index.building !== true && (index.ready === true || index.error !== null);
          if (!settled) {
            schedule(STATUS_POLL_MS);
            return;
          }
          const justRebuilt = snapshot().rebuilding === true;
          if (justRebuilt && !sawBuilding && Date.now() - startedAt < REBUILD_SETTLE_FLOOR_MS) {
            schedule(STATUS_POLL_MS);
            return;
          }
          finishStatusPolling(status);
        },
        (error) => {
          if (generation !== statusGeneration || !mounted) return;
          statusAbort = null;
          if (error && error.name === 'AbortError') return;
          statusFailures += 1;
          if (statusFailures < STATUS_MAX_FAILURES) {
            schedule(STATUS_POLL_MS);
            return;
          }
          const failure = failureOf(error, 'status');
          if (!failure.message) failure.message = failure.code;
          store.update((state) => ({
            ...state,
            rebuilding: false,
            index: { ...state.index, known: true, building: false, error: failure },
            // Keep results visible; only a page with nothing to show flips to error.
            ...(state.phase === 'results' ? {} : { phase: 'error', response: null, error: failure }),
          }));
        },
      );
    }

    schedule(0);
  }

  /** The index stopped building: resume the user's query or report failure. */
  function finishStatusPolling(status) {
    const state = snapshot();
    const wasRebuilding = state.rebuilding === true;
    const indexError = normalizeIndexError(status.error);
    if (status.ready !== true && indexError !== null) {
      const failure = { ...indexError, action: 'rebuild' };
      if (!failure.message) failure.message = failure.code;
      store.update((current) => ({ ...current, rebuilding: false, phase: 'error', response: null, error: failure }));
      return;
    }
    store.update((current) => ({ ...current, rebuilding: false }));
    const latest = snapshot();
    const query = latest.query.trim();
    const phase = latest.phase;
    if (query !== '' && (wasRebuilding || phase === 'loading' || phase === 'idle' || phase === 'error')) {
      runSearch(query);
      return;
    }
    if (query === '' && phase !== 'results') {
      store.update((current) => ({ ...current, phase: 'idle', response: null, error: null }));
    }
  }

  /* ----------------------------- rebuild & retry ---------------------------- */

  /** POST /rebuild, then poll /status until the index is ready again. */
  function rebuild() {
    const state = snapshot();
    if (state.rebuilding === true) return;
    abortSearch();
    store.update((current) => ({
      ...current,
      rebuilding: true,
      error: null,
      index: { ...current.index, known: true, building: true, progress: null, error: null },
    }));
    const controller = new AbortController();
    rebuildAbort = controller;
    DCS.api.rebuild(controller.signal).then(
      () => {
        rebuildAbort = null;
        if (!mounted) return;
        startStatusPolling();
      },
      (error) => {
        rebuildAbort = null;
        if (!mounted) return;
        if (error && error.name === 'AbortError') return;
        const failure = failureOf(error, 'rebuild');
        store.update((current) => ({
          ...current,
          rebuilding: false,
          index: { ...current.index, building: false },
          phase: 'error',
          response: null,
          error: failure,
        }));
      },
    );
  }

  /** Retry button: replay whatever failed (search / status / rebuild). */
  function retry() {
    const state = snapshot();
    if (state.rebuilding === true) return;
    const action = state.error && state.error.action;
    if (action === 'rebuild') {
      rebuild();
      return;
    }
    if (action === 'status') {
      startStatusPolling();
      return;
    }
    if (state.index.known === true && state.index.ready !== true) {
      if (state.index.building === true) startStatusPolling();
      else rebuild();
      return;
    }
    const query = state.query.trim();
    if (query !== '') runSearch(query);
    else startStatusPolling();
  }

  /* ------------------------------ row actions ------------------------------ */

  function toggleExpanded(sessionId) {
    store.update((state) => {
      const expanded = { ...state.expanded };
      if (expanded[sessionId]) delete expanded[sessionId];
      else expanded[sessionId] = true;
      return { ...state, expanded };
    });
  }

  /** Ordered, de-duplicated selection of entry kinds. */
  function normalizeKinds(next) {
    const wanted = Array.isArray(next) ? next : [];
    return KIND_ORDER.filter((kind) => wanted.includes(kind));
  }

  /**
   * Replace the search scope and re-run the current query. At least one kind
   * must stay selected: an empty scope would silently return nothing.
   */
  function setKinds(next) {
    const kinds = normalizeKinds(next);
    if (kinds.length === 0) {
      DCS.toast.show(DCS.t('panel.scope.keepOne'), 'error');
      return;
    }
    const current = snapshot().kinds;
    if (current.length === kinds.length && current.every((kind, index) => kind === kinds[index])) return;
    store.update((state) => ({ ...state, kinds, expanded: {} }));
    const query = snapshot().query.trim();
    if (query !== '') {
      runSearch(query);
      return;
    }
    store.update((state) => ({ ...state, phase: 'idle', response: null, error: null }));
  }

  /** Tick or untick one kind in the scope menu. */
  function toggleKind(kind) {
    const current = snapshot().kinds;
    if (current.includes(kind)) {
      if (current.length <= 1) {
        DCS.toast.show(DCS.t('panel.scope.keepOne'), 'error');
        return;
      }
      setKinds(current.filter((entry) => entry !== kind));
      return;
    }
    setKinds(KIND_ORDER.filter((entry) => entry === kind || current.includes(entry)));
  }

  /** Hand a hit to the find-bar part; it owns opening/focusing/landing. */
  function jumpToHit(session, hit) {
    const handler = DCS.handlers && DCS.handlers.jumpToHit;
    if (typeof handler !== 'function') {
      DCS.toast.show(DCS.t('panel.extra.jumpUnavailable'), 'error');
      return;
    }
    const state = snapshot();
    const response = state.response;
    const echo = response && response.query ? response.query : {};
    const payload = {
      sessionId: session.sessionId,
      seq: hit.seq,
      // `anchorSeq` / `surface` are newer Host fields: the find bar scrolls to
      // the surface message for log-only rows and refuses shadowed hits. Keep
      // them undefined for older Hosts (the find bar then falls back to `seq`).
      anchorSeq: hit.anchorSeq,
      surface: hit.surface,
      turn: hit.turn,
      kind: hit.kind,
      title: typeof session.title === 'string' ? session.title : '',
      // Carrying the index snippet saves the find bar a `/session` round-trip
      // and gives it a text needle from text the GUI actually renders.
      snippet: typeof hit.snippet === 'string' ? hit.snippet : undefined,
      matchStart: typeof hit.matchStart === 'number' ? hit.matchStart : undefined,
      matchLength: typeof hit.matchLength === 'number' ? hit.matchLength : undefined,
      query: typeof echo.text === 'string' && echo.text !== '' ? echo.text : state.query.trim(),
      caseSensitive: echo.caseSensitive === true,
      wholeWord: echo.wholeWord === true,
    };
    try {
      const result = handler(payload);
      if (result && typeof result.then === 'function') {
        result.catch((error) => DCS.log.warn('jumpToHit failed', error));
      }
    } catch (error) {
      DCS.log.warn('jumpToHit threw', error);
    }
  }

  /* ------------------------------ mount lifecycle --------------------------- */

  /** The page mounted: resume whatever was pending before it was hidden. */
  function attach() {
    if (mounted) return;
    mounted = true;
    const state = snapshot();
    const index = state.index;
    if (state.rebuilding === true || index.known !== true || index.ready !== true || index.building === true) {
      startStatusPolling();
      return;
    }
    if (state.query.trim() !== '' && (state.phase === 'loading' || state.phase === 'idle')) {
      runSearch(state.query.trim());
    }
  }

  /** The page unmounted: stop every timer and request, keep the results. */
  function detach() {
    if (!mounted) return;
    mounted = false;
    clearDebounce();
    abortSearch();
    stopStatusPolling();
    if (rebuildAbort) {
      const controller = rebuildAbort;
      rebuildAbort = null;
      try {
        controller.abort();
      } catch (error) {
        DCS.log.debug('abort rebuild failed', error);
      }
    }
  }

  /* --------------------------------- render -------------------------------- */

  /** Locale-aware short date/time formatter for "last updated". */
  function buildDateFormatter() {
    let locale;
    try {
      if (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) {
        locale = document.documentElement.lang;
      }
    } catch (error) {
      locale = undefined;
    }
    try {
      return new Intl.DateTimeFormat(locale || undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch (error) {
      try {
        return new Intl.DateTimeFormat(locale || undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (inner) {
        return null;
      }
    }
  }

  /**
   * Resolve the six exclusive page states (requirements §3). Index problems
   * outrank query states; a failure never renders as "no results".
   */
  function resolveView(state) {
    const index = state.index;
    if (index.known === true) {
      if (index.building === true) return { kind: 'indexing' };
      if (index.ready !== true) {
        if (index.error) return { kind: 'error', error: index.error };
        return { kind: 'indexing' };
      }
    }
    if (state.query.trim() === '') return { kind: 'empty' };
    if (state.phase === 'error') return { kind: 'error', error: state.error };
    if (state.phase === 'results' && state.response) {
      const total = Number(state.response.totalSessions);
      const results = Array.isArray(state.response.results) ? state.response.results : [];
      const count = Number.isFinite(total) ? total : results.length;
      return count > 0 ? { kind: 'results', response: state.response } : { kind: 'noResults' };
    }
    return { kind: 'loading' };
  }

  /** The search page component (slot `main`, rendered while the row is active). */
  function SearchPanelPage(props) {
    const t = typeof props.t === 'function' ? props.t : DCS.t;
    const state = DCS.useStore(store);
    const inputRef = React.useRef(null);
    const scopeRef = React.useRef(null);
    const [scopeOpen, setScopeOpen] = React.useState(false);
    const dateFormatter = React.useMemo(() => buildDateFormatter(), [t]);

    React.useEffect(() => {
      attach();
      DCS.dom.focus(inputRef.current);
      return () => detach();
    }, []);

    // Dismiss the scope menu on outside click / Escape, like a native popover.
    React.useEffect(() => {
      if (!scopeOpen) return undefined;
      const onPointerDown = (event) => {
        const root = scopeRef.current;
        if (root && event.target instanceof Node && root.contains(event.target)) return;
        setScopeOpen(false);
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') setScopeOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('keydown', onKeyDown, true);
      return () => {
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
      };
    }, [scopeOpen]);

    const index = state.index;
    const view = resolveView(state);
    const busy =
      state.rebuilding === true || (index.known === true && (index.building === true || index.ready !== true));

    function formatTimestamp(value) {
      const ms = Number(value);
      if (!Number.isFinite(ms) || ms <= 0) return '';
      const date = new Date(ms);
      if (Number.isNaN(date.getTime())) return '';
      if (dateFormatter) {
        try {
          return dateFormatter.format(date);
        } catch (error) {
          DCS.log.debug('date format failed', error);
        }
      }
      try {
        return date.toLocaleString();
      } catch (error) {
        return '';
      }
    }

    function kindLabel(kind) {
      if (kind === 'user' || kind === 'assistant' || kind === 'tool' || kind === 'thinking') return t('panel.hit.' + kind);
      return String(kind || '');
    }

    /** Snippet text with the keyword wrapped in `<mark>` (snippet-relative coords). */
    function highlighted(text, hit) {
      const raw = typeof text === 'string' ? text : '';
      if (!hit) return [raw];
      const start = Number(hit.matchStart);
      const length = Number(hit.matchLength);
      if (!Number.isFinite(start) || !Number.isFinite(length) || length <= 0) return [raw];
      if (start < 0 || start + length > raw.length) return [raw];
      return [
        raw.slice(0, start),
        React.createElement('mark', { key: 'dcs-hit' }, raw.slice(start, start + length)),
        raw.slice(start + length),
      ];
    }

    function renderChevron(open) {
      return React.createElement(
        'svg',
        {
          className: 'dcs-panel__chevron',
          width: 14,
          height: 14,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
        },
        React.createElement('path', {
          d: open ? 'M3.5 6 8 10.5 12.5 6' : 'M6 3.5 10.5 8 6 12.5',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    function renderSpinner() {
      return React.createElement('span', { className: 'dcs-panel__spinner', 'aria-hidden': 'true' });
    }

    function renderEmptyBlock(titleText, hintText) {
      return React.createElement(
        'div',
        { className: 'dcs-panel__empty' },
        React.createElement('p', { className: 'dcs-panel__emptyTitle' }, titleText),
        hintText ? React.createElement('p', null, hintText) : null,
      );
    }

    function renderIndexingBlock() {
      const progress = index.progress;
      const text = progress
        ? t('panel.indexingProgress', { done: progress.done, total: progress.total })
        : t('panel.indexing');
      const children = [
        React.createElement('p', { key: 'text', className: 'dcs-panel__emptyTitle' }, renderSpinner(), text),
      ];
      if (progress) {
        const percent = Math.max(0, Math.min(100, Math.round((progress.done / progress.total) * 100)));
        children.push(
          React.createElement(
            'div',
            {
              key: 'bar',
              style: {
                maxWidth: '280px',
                height: '4px',
                margin: '10px auto 0',
                borderRadius: '2px',
                background: 'var(--dsw-alias-border-l3)',
                overflow: 'hidden',
              },
            },
            React.createElement('div', {
              style: {
                width: percent + '%',
                minWidth: percent > 0 ? '4px' : '0',
                height: '100%',
                borderRadius: '2px',
                background: 'var(--dsw-alias-state-business-primary, #7a9bf0)',
                transition: 'width 200ms ease',
              },
            }),
          ),
        );
      }
      return React.createElement('div', { className: 'dcs-panel__empty' }, children);
    }

    function renderErrorBlock(failure) {
      const info = failure || {};
      const message = typeof info.message === 'string' && info.message !== '' ? info.message : '';
      const code = typeof info.code === 'string' && info.code !== '' ? info.code : 'unknown';
      return React.createElement(
        'div',
        { className: 'dcs-panel__empty' },
        React.createElement(
          'p',
          { className: 'dcs-panel__status dcs-panel__status--error', style: { margin: '0 0 6px' } },
          t('panel.error', { message: message || code }),
        ),
        React.createElement('p', { style: { margin: '0 0 12px' } }, t('panel.extra.errorCode', { code })),
        React.createElement(
          'p',
          { style: { margin: 0 } },
          React.createElement(
            'button',
            { type: 'button', className: 'dcs-panel__action', onClick: retry },
            t('panel.retry'),
          ),
        ),
      );
    }

    function renderSessionRow(session, sessionIndex) {
      const sessionId = String(session.sessionId || '');
      const hits = Array.isArray(session.hits) ? session.hits : [];
      const numericHitCount = Number(session.hitCount);
      const hitCount = Number.isFinite(numericHitCount) ? numericHitCount : hits.length;
      const expanded = state.expanded[sessionId] === true;
      const first = hits[0];
      const title = typeof session.title === 'string' && session.title !== '' ? session.title : t('find.untitled');
      const meta = [];
      const timeText = formatTimestamp(session.updatedAt);
      if (timeText !== '') meta.push(timeText);
      meta.push(t('panel.hits', { count: hitCount }));
      if (first) meta.push(kindLabel(first.kind));
      // Shadowed hits stay clickable (the find bar owns the "not in history"
      // message); this tag only warns before the click.
      if (first && first.surface === 'shadowed') meta.push(t('panel.extra.stale'));

      const summary = React.createElement(
        'button',
        {
          key: 'summary',
          type: 'button',
          className: 'dcs-panel__summary',
          'aria-expanded': expanded ? 'true' : 'false',
          title: expanded ? t('panel.collapse') : t('panel.expand', { count: hitCount }),
          onClick: () => toggleExpanded(sessionId),
        },
        renderChevron(expanded),
        React.createElement(
          'span',
          { style: { flex: '1', minWidth: 0 } },
          React.createElement('span', { className: 'dcs-panel__title' }, title),
          React.createElement('span', { className: 'dcs-panel__meta' }, meta.join(' · ')),
          first
            ? React.createElement('span', { className: 'dcs-panel__snippet' }, highlighted(first.snippet, first))
            : null,
        ),
      );

      const rowChildren = [summary];
      if (expanded) {
        const hitRows = hits.map((hit, hitIndex) =>
          React.createElement(
            'li',
            { key: 'hit-' + String(hit.seq) + '-' + String(hitIndex) },
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'dcs-panel__hit',
                'aria-label': t('panel.hitAria', { index: hitIndex + 1, kind: kindLabel(hit.kind) }),
                onClick: () => jumpToHit(session, hit),
              },
              React.createElement('span', { className: 'dcs-panel__hitIndex' }, String(hitIndex + 1)),
              React.createElement('span', { className: 'dcs-panel__hitKind' }, kindLabel(hit.kind)),
              hit.surface === 'shadowed'
                ? React.createElement(
                    'span',
                    {
                      className: 'dcs-panel__hitKind',
                      style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: '11px' },
                      title: t('panel.extra.stale'),
                    },
                    t('panel.extra.stale'),
                  )
                : null,
              React.createElement('span', { className: 'dcs-panel__hitText' }, highlighted(hit.snippet, hit)),
            ),
          ),
        );
        if (hitCount > hits.length || session.hitsTruncated === true) {
          hitRows.push(
            React.createElement(
              'li',
              { key: 'more', className: 'dcs-panel__status', style: { margin: 0, padding: '4px 8px' } },
              t('panel.moreResults'),
            ),
          );
        }
        rowChildren.push(React.createElement('ul', { key: 'hits', className: 'dcs-panel__hits' }, hitRows));
      }

      return React.createElement(
        'li',
        {
          key: sessionId !== '' ? sessionId : 'session-' + String(sessionIndex),
          className: 'dcs-panel__row',
          'data-open': expanded ? 'true' : 'false',
        },
        rowChildren,
      );
    }

    function renderResultsBlock(response) {
      const results = Array.isArray(response.results) ? response.results : [];
      const total = Number(response.totalSessions);
      const count = Number.isFinite(total) ? total : results.length;
      const children = [
        React.createElement('p', { key: 'count', className: 'dcs-panel__status' }, t('panel.sessions', { count })),
      ];
      if (response.truncated === true) {
        children.push(
          React.createElement('p', { key: 'limit', className: 'dcs-panel__status' }, t('panel.limit', { limit: DCS.LIMIT })),
        );
      }
      children.push(React.createElement('ul', { key: 'list', className: 'dcs-panel__list' }, results.map(renderSessionRow)));
      return React.createElement('div', null, children);
    }

    function renderBody() {
      switch (view.kind) {
        case 'indexing':
          return renderIndexingBlock();
        case 'loading':
          return React.createElement(
            'div',
            { className: 'dcs-panel__empty' },
            React.createElement('p', { className: 'dcs-panel__emptyTitle' }, renderSpinner(), t('panel.loading')),
          );
        case 'error':
          return renderErrorBlock(view.error);
        case 'noResults':
          return renderEmptyBlock(t('panel.noResults'), t('panel.noResultsHint'));
        case 'results':
          return renderResultsBlock(view.response);
        case 'empty':
        default:
          return renderEmptyBlock(t('panel.empty'), t('panel.emptyHint'));
      }
    }

    function onInputKeyDown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchNow();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setQuery('');
        const input = event.currentTarget;
        if (input && typeof input.blur === 'function') input.blur();
      }
    }

    const heading = React.createElement(
      'div',
      { className: 'dcs-panel__heading' },
      React.createElement('h1', null, t('panel.title')),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'dcs-panel__action',
          disabled: busy,
          title: busy ? t('panel.rebuilding') : t('panel.rebuild'),
          onClick: rebuild,
        },
        busy ? t('panel.rebuilding') : t('panel.rebuild'),
      ),
    );

    const scopeSummary = state.kinds.map((kind) => t('panel.scope.' + kind)).join(' + ');
    const scopeRows = KIND_ORDER.map((kind) => {
      const checked = state.kinds.includes(kind);
      return React.createElement(
        'label',
        { key: kind, className: 'dcs-panel__scopeRow' },
        React.createElement('input', {
          type: 'checkbox',
          checked,
          disabled: checked && state.kinds.length <= 1,
          onChange: () => toggleKind(kind),
        }),
        React.createElement('span', null, t('panel.scope.' + kind)),
      );
    });

    const field = React.createElement(
      'div',
      { className: 'dcs-panel__scopeWrap', ref: scopeRef },
      React.createElement(
        'div',
        { className: 'dcs-panel__field' },
        React.createElement(
          'svg',
          { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
          React.createElement('circle', { cx: 7, cy: 7, r: 4.75, stroke: 'currentColor', strokeWidth: 1.5 }),
          React.createElement('path', {
            d: 'M10.4 10.4 14 14',
            stroke: 'currentColor',
            strokeWidth: 1.5,
            strokeLinecap: 'round',
          }),
        ),
        React.createElement('input', {
          ref: inputRef,
          className: 'dcs-panel__input',
          type: 'text',
          value: state.query,
          placeholder: t('panel.placeholder'),
          'aria-label': t('panel.placeholder'),
          autoComplete: 'off',
          spellCheck: false,
          onChange: (event) => setQuery(event.target.value),
          onKeyDown: onInputKeyDown,
        }),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dcs-panel__scopeButton',
            'aria-expanded': scopeOpen ? 'true' : 'false',
            'aria-haspopup': 'dialog',
            title: t('panel.scope.summary', { summary: scopeSummary }),
            onClick: () => setScopeOpen((open) => !open),
          },
          t('panel.scope.label'),
          React.createElement('span', { className: 'dcs-panel__scopeCount' }, String(state.kinds.length)),
        ),
      ),
      scopeOpen
        ? React.createElement(
            'div',
            { className: 'dcs-panel__scopePopover', role: 'dialog', 'aria-label': t('panel.scope.label') },
            scopeRows,
            React.createElement('p', { className: 'dcs-panel__scopeHint' }, t('panel.scope.hint')),
          )
        : null,
    );

    const strips = [];
    if (state.rebuilding === true && index.building !== true) {
      strips.push(
        React.createElement(
          'p',
          { key: 'rebuilding', className: 'dcs-panel__status' },
          renderSpinner(),
          t('panel.rebuilding'),
        ),
      );
    }
    if (index.error && view.kind !== 'error') {
      const failure = index.error;
      const message = failure.message || failure.code;
      const text =
        failure.code === 'status'
          ? t('panel.extra.statusFailed', { message })
          : t('panel.extra.indexWarning', { message });
      strips.push(React.createElement('p', { key: 'index-warning', className: 'dcs-panel__status' }, text));
    }

    return React.createElement(
      'section',
      {
        className: DCS.CLASS.root + ' ' + DCS.CLASS.panel,
        'data-dcs-panel': PANEL_ID,
        'aria-label': t('panel.title'),
        'aria-busy': view.kind === 'loading' || view.kind === 'indexing' ? 'true' : undefined,
      },
      React.createElement(
        'div',
        { className: 'dcs-panel__scroll' },
        React.createElement(
          'div',
          { className: 'dcs-panel__content' },
          heading,
          field,
          strips.length > 0 ? strips : null,
          renderBody(),
        ),
      ),
    );
  }

  /** The sidebar row glyph: an 16/18px magnifier drawn with `currentColor`. */
  function SearchGlyph(props) {
    const rawSize = props && props.size;
    const size = Number.isFinite(Number(rawSize)) && Number(rawSize) > 0 ? Number(rawSize) : 18;
    const active = Boolean(props && props.active === true);
    return React.createElement(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block' },
      },
      React.createElement('circle', {
        cx: 6.75,
        cy: 6.75,
        r: active ? 4.9 : 4.6,
        stroke: 'currentColor',
        strokeWidth: active ? 1.6 : 1.4,
      }),
      React.createElement('path', {
        d: active ? 'M10.5 10.5 14.2 14.2' : 'M10.3 10.3 14 14',
        stroke: 'currentColor',
        strokeWidth: active ? 1.6 : 1.4,
        strokeLinecap: 'round',
      }),
    );
  }

  /* ------------------------------- registers ------------------------------- */

  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      {
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 5,
        locale: DCS.NS,
        label: () => DCS.t('panel.title'),
      },
      SearchGlyph,
    ),
  );

  ctx.slots.inject('main', () =>
    ctx.slots.register(
      {
        name: 'main',
        key: PANEL_ID,
        locale: DCS.NS,
      },
      SearchPanelPage,
    ),
  );

  /** Exposed for assembly/debug tests; the app itself does not use the return value. */
  return {
    PANEL_ID,
    store,
    attach,
    detach,
    setQuery,
    searchNow,
    runSearch,
    retry,
    rebuild,
    toggleExpanded,
    setKinds,
    toggleKind,
    jumpToHit,
    getSnapshot: snapshot,
  };
};

    /* ===== client/src/30-find-bar.js ===== */
/* ------------------------------------------------------------------------- *
 * dsh-conversation-search — client part 30: in-conversation find bar + jump.
 *
 * Owns three pieces of the browser half:
 *  1. a floating find bar pinned to the conversation's top-right corner
 *     (registered into `shell.overlay`, so it floats above the transcript
 *     without taking layout space);
 *  2. a match engine over the *currently loaded* transcript rows, painted
 *     through the CSS Custom Highlight API (`::highlight(dcs-find-match)` /
 *     `::highlight(dcs-find-current)`), with `n/m` always equal to the number
 *     of painted ranges;
 *  3. the cross-part jump engine published as `DCS.handlers.jumpToHit`: open
 *     the session, page older history until the target message is loaded,
 *     then patrol-land the row (scrollTop math only — never scrollIntoView)
 *     until it sticks, flash it, and make it the find bar's current match.
 *
 * Coordinates with the shared runtime (10-shared.js, read-only): no imports,
 * no own DOM outside the slot's React subtree, no writes to document.body,
 * theme-token colours only. Every listener, observer, timer and highlight
 * created here is released from this part's `ctx.effect` cleanup or a matching
 * React effect.
 *
 * Known constraints / assumptions (also reported to the Lead):
 *  - Match navigation reveals the matched text Range (`DCS.dom.revealRange`,
 *    align 'auto') instead of centering the enclosing row: rows can be taller
 *    than the viewport, and an already visible match must not move the reader.
 *  - Search scope is the *loaded* transcript, as the contract states. Text in
 *    collapsed folds (`hidden="until-found"`) is not scanned; row matching also
 *    uses only painted text so a collapsed child cannot fake a hit.
 *  - Jump targeting uses two needle tiers: a *context needle* (the hit snippet's
 *    ~16 chars on each side of the match) first, then the loose snippet/query
 *    needles. The context needle decides row preference, visibility and the
 *    current occurrence, so a common word that also appears in visible body
 *    text cannot masquerade as a collapsed thinking/tool hit. For those kinds an
 *    invisible context needle always triggers expansion: the target turn's
 *    `[aria-expanded="false"]` switches are clicked (div or button; max 8,
 *    ~120ms settle, 4s budget), then the context Range is revealed with
 *    align 'top' and made the current match. When the text still cannot be
 *    shown the jump falls back to loose snippet fragments (6–60 char pieces
 *    split on whitespace/punctuation, target turn first then the whole flow,
 *    ≤1.5s): tool output usually survives only as a compact preview row, so
 *    the row carrying `git status --short`/the tool name is landed and flashed
 *    with `find.toolFallback` ("open 查看 for the full output"); folded
 *    reasoning/other hits keep `find.expandedFallback`. No fallback ever
 *    claims the message disappeared or leaves the bar stuck in jumping.
 *  - Opening the bar pages the session window back to seq 0 in the background
 *    (`DCS.sessions.loadThrough(id, 0)`, 250ms poll, 15s timeout), so `n/m`
 *    covers the whole conversation instead of only the tail window; the status
 *    line shows `find.loadingHistory` meanwhile and the count grows with the
 *    throttled rescans. Prepend rescans remap the current match by row anchor
 *    key + raw offset (never by bare index), so history loading never moves the
 *    reader; closing the bar stops the polling (the official loader has no
 *    abort signal and may finish quietly). After a jump the top-up starts 300ms
 *    once `status !== 'jumping'`, and a session that already completed the
 *    prefetch is not loaded again.
 *  - At most FIND_MAX_MATCHES (2000) ranges are painted; `n/m` and the status
 *    line always agree with the painted range count.
 *  - Landing never calls scrollIntoView (it would drag sticky host chrome and
 *    the host then snaps back): it is scrollTop math via DCS.dom.landRow, in a
 *    350ms patrol / 900ms stick loop, because the host re-renders and
 *    re-scrolls after opening and paging.
 *  - `session.loadThrough` bails out while a plain `loadOlder` owns the busy
 *    flag (verified against dsh-api-session-controller), so the background
 *    pager retries; it is bounded by the 12s landing budget and exposes a
 *    cancel button.
 *  - Jump payloads carry `seq/anchorSeq/turn/kind/surface/query` and may carry
 *    `snippet/matchStart/matchLength`; snippets are also fetched from
 *    `/session` (then `/message`) when the payload is old/short, and the search
 *    query is always kept as a last-resort needle.
 * ------------------------------------------------------------------------- */

/* ----------------------------- locale extras ------------------------------ */

Object.assign(DCS.zh, {
  'find.extra.caseShort': 'Aa',
  'find.extra.wholeShort': '全词',
  'find.extra.noMatchInRow': '已定位到目标行，但该行内没有可高亮的匹配',
  'find.extra.matchLimit': '命中过多，仅显示前 {total} 处',
  'find.expanding': '正在展开折叠内容…',
  'find.expandedFallback': '命中位于折叠内容中，已定位到所在步骤，展开后可见',
  'find.toolFallback': '命中位于工具输出中，已定位到相关工具调用；完整输出可在「查看」中打开',
  'find.loadingHistory': '正在加载完整历史…',
  'find.loadingHistorySeq': '正在加载完整历史…（已到第 {seq} 条）',
});

Object.assign(DCS.en, {
  'find.extra.caseShort': 'Aa',
  'find.extra.wholeShort': 'Word',
  'find.extra.noMatchInRow': 'Landed on the target row, but no highlightable match is in it',
  'find.extra.matchLimit': 'Too many matches; showing the first {total}',
  'find.expanding': 'Expanding collapsed content…',
  'find.expandedFallback': 'The match is inside collapsed content; landed on its step — expand it to see the text',
  'find.toolFallback': 'The hit is inside tool output; landed on the related tool call — open “View” for the full output',
  'find.loadingHistory': 'Loading the full conversation history…',
  'find.loadingHistorySeq': 'Loading the full conversation history… ({seq} loaded)',
});

/* ------------------------------- constants -------------------------------- */

/**
 * Flow roots that carry the transcript rows. The slot wrapper
 * (`[data-slot="conversation.chat.flow"]`) is a zero-sized seat in 0.2.1-rc.3
 * (the chat renders its own `[data-chat-flow]` element inside it), so both are
 * candidates and the visible one is chosen by painted area.
 */
const FIND_FLOW_SELECTOR = '[data-slot="conversation.chat.flow"], [data-chat-flow]';

/** One transcript row (official stable anchors, verified against ui-chat). */
const FIND_ROW_SELECTOR = '[data-chat-anchor-key][data-chat-turn]';

/** Highlight registry names shared with the stylesheet in 10-shared.js. */
const FIND_HIGHLIGHT_MATCH = 'dcs-find-match';
const FIND_HIGHLIGHT_CURRENT = 'dcs-find-current';

/** Patrol cadence: re-find + re-land while the host snaps its scroll position. */
const FIND_TICK_MS = 350;

/** The row must stay inside its scrollport this long before we call it landed. */
const FIND_STICK_MS = 900;

/** Total landing budget after the find bar opens (contract §5.8: 8–15s). */
const FIND_LAND_TIMEOUT_MS = 12000;

/** Waiting for the clicked session to become the main view. */
const FIND_OPEN_TIMEOUT_MS = 15000;

/** Waiting for the chat flow (and its first rows) to mount. */
const FIND_FLOW_READY_TIMEOUT_MS = 4000;

/** Debounce for typing and for DOM mutations. */
const FIND_TYPE_DEBOUNCE_MS = 90;
const FIND_MUTATION_DEBOUNCE_MS = 150;

/** How often we check for a session switch / remounted flow while open. */
const FIND_POLL_MS = 1200;

/** Hard cap on painted ranges; keeps `n/m`, highlights and navigation cheap. */
const FIND_MAX_MATCHES = 2000;

/** Toast auto-hide delay. */
const FIND_TOAST_MS = 3200;

/** How long the landed row keeps its outline. */
const FIND_FLASH_MS = 4500;

/** Needle bounds for DOM-to-index row matching. */
const FIND_NEEDLE_MIN_CHARS = 6;
const FIND_NEEDLE_MAX_CHARS = 120;

/** Row cache for `/session` hit enrichment (snippets) used to build needles. */
const FIND_NEEDLE_CACHE_LIMIT = 8;

/** Collapsed-content expansion: hard budget, click cap, settle delay. */
const FIND_EXPAND_BUDGET_MS = 4000;
const FIND_EXPAND_CLICK_LIMIT = 8;
const FIND_EXPAND_SETTLE_MS = 120;

/** Official chat marks foldable process groups / tool cards with this state. */
const FIND_COLLAPSED_TOGGLE_SELECTOR = '[aria-expanded="false"]';

/** Indexed kinds whose text normally sits inside a collapsed fold. */
const FIND_COLLAPSED_KINDS = new Set(['thinking', 'tool']);

/** Full-history prefetch when the find bar opens (requirements §5 coverage). */
const FIND_HISTORY_TIMEOUT_MS = 15000;
const FIND_HISTORY_POLL_MS = 250;
const FIND_HISTORY_KICK_MS = 700;
const FIND_HISTORY_OPEN_DELAY_MS = 120;
const FIND_HISTORY_JUMP_DELAY_MS = 300;
const FIND_HISTORY_BINDING_RETRY_MS = 350;
const FIND_HISTORY_BINDING_RETRIES = 8;
const FIND_HISTORY_SESSION_CACHE_LIMIT = 200;

/**
 * Loose-needle fallback for content the transcript never renders in full (tool
 * output/arguments often survive only as a compact preview line).
 */
const FIND_LOOSE_NEEDLE_MIN_CHARS = 6;
const FIND_LOOSE_NEEDLE_MAX_CHARS = 60;
const FIND_LOOSE_NEEDLE_LIMIT = 8;
const FIND_LOOSE_BUDGET_MS = 1500;
const FIND_LOOSE_ROW_SCAN_LIMIT = 600;

/**
 * Context needle window: this many characters on each side of the match inside
 * the hit snippet. Longer than the bare query on purpose — a common phrase
 * ("Let me") also appears in visible body text, and only the surrounding
 * context identifies the collapsed reasoning/tool occurrence.
 */
const FIND_CONTEXT_RADIUS_CHARS = 16;
const FIND_CONTEXT_NEEDLE_MIN_CHARS = 8;

/** One character class mirroring the shared `normalizeForMatch` stripping. */
const FIND_NORMALIZE_NOISE_CHAR_RE = /[\s`*_~#>|[\]()!，。：；、"'\u005c{}-]/u;

/**
 * Block-level tags used to insert a hard separator between text runs of
 * different blocks: a query never contains NUL, so it can never match across
 * a paragraph/list-item/cell boundary by accident.
 */
const FIND_BLOCK_SELECTOR =
  'p,li,pre,blockquote,h1,h2,h3,h4,h5,h6,td,th,tr,table,ul,ol,dl,dt,dd,figure,figcaption,section,article,header,footer,aside,main,nav,div,hr';

/** Extra local CSS (shared sheet already owns `.dcs-findbar*` base styles). */
const FIND_BAR_STYLE_TEXT = `
.dcs-findbar { flex-wrap: nowrap; max-width: min(560px, calc(100vw - 32px)); }
.dcs-findbar__input { width: clamp(140px, 22vw, 240px); flex: 1 1 auto; min-width: 120px; }
.dcs-findbar__button.dcs-findbar__toggle { width: auto; min-width: 28px; padding: 0 6px; font-size: 11px; font-weight: 500; letter-spacing: 0.02em; }
/* The hint/progress line lives OUTSIDE the bar's layout: absolutely positioned
   below it, so showing "输入关键词" / "无结果" never changes the bar width or
   height (it used to widen the bar and shift the close button). */
.dcs-findbar__status { position: absolute; top: calc(100% + 6px); right: 0; display: flex; align-items: center; gap: 8px; min-width: 0; max-width: min(420px, calc(100vw - 48px)); padding: 3px 8px; border-radius: 8px; background: color-mix(in srgb, var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1)) 82%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 0.5px solid var(--dsw-alias-border-l3); box-shadow: var(--dsw-elevation-panel); }
.dcs-findbar__statusText { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 16px; }
.dcs-findbar__statusText[data-tone="error"] { color: var(--dsw-alias-state-error-primary, #d9534f); }
.dcs-findbar__spinner { flex: none; width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--dsw-alias-border-l3); border-top-color: var(--dsw-alias-state-business-primary, #7a9bf0); animation: dcs-spin 0.9s linear infinite; }
@media (prefers-reduced-motion: reduce) { .dcs-findbar__spinner { animation: none; } }
`;

/* ---------------------------------- store --------------------------------- */

/**
 * Find-bar state. `matches` holds the live match records (row + Range); React
 * only reads `length` and `currentIndex`, so `n/m` and the painted range count
 * always come from the same array.
 */
const findBarStore = DCS.createStore({
  open: false,
  query: '',
  caseSensitive: false,
  wholeWord: false,
  status: 'idle', // idle | jumping | landed | not-found | failed
  matches: [],
  currentIndex: -1,
  message: '',
  messageParams: null,
  jumpProgress: null, // { phase: 'opening' | 'loading', seq: number | null, targetSeq: number | null }
  historyLoading: false, // full-history prefetch in progress
  historyBaseSeq: null, // oldest loaded seq while prefetching (progress hint)
  focusToken: 0,
});

/** One transient toast rendered from the same overlay slot. */
const findBarToastStore = DCS.createStore({ id: 0, text: '', tone: 'info' });

/** Stable selectors keep `useStore` subscriptions unchanged across renders. */
const findBarSelectState = (state) => state;
const findBarSelectToast = (toast) => toast;

/** Set by `startFindBar`, cleared on plugin unload; read by the overlay. */
let findBarRuntime = null;

/* ------------------------------ overlay view ------------------------------ */

/**
 * The overlay entry: the find bar when open, the toast when one is showing.
 * Positioning is measured against `DCS.dom.conversationBox()` so the bar sits
 * in the conversation's top-right corner and never takes layout space.
 */
function FindBarOverlay(props) {
  const state = DCS.useStore(findBarStore, findBarSelectState);
  const toast = DCS.useStore(findBarToastStore, findBarSelectToast);
  const runtime = findBarRuntime;
  const t = props && typeof props.t === 'function' ? props.t : DCS.t;

  const [position, setPosition] = React.useState({ right: 16, top: 16 });

  /** Recompute the fixed offsets from the live conversation rectangle. */
  const measure = () => {
    const box = DCS.dom.conversationBox();
    const viewportWidth = window.innerWidth || 0;
    const next = box
      ? {
          right: Math.max(12, Math.round(viewportWidth - box.right + 16)),
          top: Math.max(12, Math.round(box.top + 12)),
        }
      : { right: 16, top: 16 };
    setPosition((previous) =>
      previous.right === next.right && previous.top === next.top ? previous : next,
    );
  };

  // Mount: measure once, again after the first layout frames, on window resize
  // and whenever the conversation view resizes (sidebar/rightbar changes).
  React.useEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    let observer = null;
    const observeView = () => {
      const view = document.querySelector('[data-slot="conversation.view"]') || DCS.dom.flowRoot();
      if (!view || typeof ResizeObserver !== 'function') return;
      if (observer) observer.disconnect();
      observer = new ResizeObserver(() => measure());
      observer.observe(view);
    };
    observeView();
    const timers = [
      setTimeout(() => {
        observeView();
        measure();
      }, 120),
      setTimeout(measure, 500),
    ];
    return () => {
      window.removeEventListener('resize', onResize);
      if (observer) observer.disconnect();
      for (const timer of timers) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opening (or pressing Cmd+F while open) re-measures and focuses the input.
  React.useEffect(() => {
    if (!state.open) return;
    measure();
    if (!findBarRuntime) return;
    const input = findBarRuntime.getInputElement();
    if (!input) return;
    DCS.dom.focus(input);
    try {
      input.select();
    } catch (error) {
      DCS.log.debug('select find input failed', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.focusToken]);

  if (!runtime) return null;

  const h = React.createElement;
  const children = [];

  if (state.open) {
    const query = String(state.query || '');
    const hasQuery = query.trim() !== '';
    const total = state.matches.length;
    const current = state.currentIndex >= 0 ? state.currentIndex + 1 : 0;
    const countText = !hasQuery || total === 0 ? t('find.zero') : t('find.count', { current, total });
    const jumping = state.status === 'jumping';
    const canNavigate = !jumping && total > 1;

    let statusText = '';
    let statusTone = '';
    let showCancel = false;
    if (jumping) {
      const progress = state.jumpProgress;
      if (!progress) statusText = t('jump.loading');
      else if (progress.phase === 'opening') statusText = t('jump.opening');
      else if (progress.phase === 'expanding') statusText = t('find.expanding');
      else if (typeof progress.seq === 'number') statusText = t('find.loadingProgress', { seq: progress.seq });
      else statusText = t('jump.loading');
      showCancel = true;
    } else if (state.historyLoading === true) {
      statusText =
        typeof state.historyBaseSeq === 'number'
          ? t('find.loadingHistorySeq', { seq: state.historyBaseSeq })
          : t('find.loadingHistory');
    } else if (state.message) {
      statusText = t(state.message, state.messageParams || undefined);
      if (state.message === 'find.notFound' || state.message === 'find.failed') statusTone = 'error';
    }

    const icon = (path) =>
      h(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 16 16',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('path', {
          d: path,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );

    const button = (options) =>
      h(
        'button',
        {
          type: 'button',
          className: 'dcs-findbar__button' + (options.extraClass ? ' ' + options.extraClass : ''),
          title: options.title,
          'aria-label': options.title,
          'data-active': options.active === true ? 'true' : undefined,
          'aria-pressed': options.pressed,
          disabled: options.disabled === true,
          onClick: options.onClick,
        },
        options.children,
      );

    children.push(
      h('style', { key: 'findbar-style' }, FIND_BAR_STYLE_TEXT),
      h(
        'div',
        {
          key: 'findbar',
          ref: (node) => runtime.setBarElement(node),
          className: 'dcs-findbar dcs-root',
          role: 'search',
          'aria-label': t('find.label'),
          'data-jumping': jumping ? 'true' : undefined,
          style: { right: position.right + 'px', top: position.top + 'px' },
        },
        h('input', {
          ref: (node) => runtime.setInputElement(node),
          className: 'dcs-findbar__input',
          type: 'text',
          value: query,
          placeholder: t('find.placeholder'),
          'aria-label': t('find.label'),
          autoComplete: 'off',
          autoCorrect: 'off',
          spellCheck: false,
          onChange: (event) => runtime.setQuery(event.target.value),
          onCompositionStart: () => runtime.setComposing(true),
          onCompositionEnd: () => runtime.setComposing(false),
        }),
        h(
          'span',
          {
            className: 'dcs-findbar__count',
            title: t('find.searchScope'),
            'aria-live': 'polite',
          },
          countText,
        ),
        button({
          title: t('find.prev'),
          disabled: !canNavigate,
          onClick: () => runtime.navigate(-1),
          children: icon('M4 10.5 8 6l4 4.5'),
        }),
        button({
          title: t('find.next'),
          disabled: !canNavigate,
          onClick: () => runtime.navigate(1),
          children: icon('M4 5.5 8 10l4-4.5'),
        }),
        h('span', { className: 'dcs-findbar__divider', 'aria-hidden': 'true' }),
        button({
          title: t('find.caseSensitive'),
          extraClass: 'dcs-findbar__toggle',
          active: state.caseSensitive,
          pressed: state.caseSensitive,
          disabled: jumping,
          onClick: () => runtime.toggleOption('caseSensitive'),
          children: t('find.extra.caseShort'),
        }),
        button({
          title: t('find.wholeWord'),
          extraClass: 'dcs-findbar__toggle',
          active: state.wholeWord,
          pressed: state.wholeWord,
          disabled: jumping,
          onClick: () => runtime.toggleOption('wholeWord'),
          children: t('find.extra.wholeShort'),
        }),
        h('span', { className: 'dcs-findbar__divider', 'aria-hidden': 'true' }),
        button({
          title: t('find.close'),
          onClick: () => runtime.close(),
          children: icon('M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5'),
        }),
        statusText
          ? h(
              'div',
              { key: 'status', className: 'dcs-findbar__status', role: 'status', 'aria-live': 'polite' },
              jumping || state.historyLoading === true
                ? h('span', { className: 'dcs-findbar__spinner', 'aria-hidden': 'true' })
                : null,
              h(
                'span',
                {
                  className: 'dcs-findbar__statusText',
                  'data-tone': statusTone || undefined,
                },
                statusText,
              ),
              showCancel
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dcs-findbar__cancel',
                      onClick: () => runtime.cancelJump(),
                    },
                    t('find.cancel'),
                  )
                : null,
            )
          : null,
      ),
    );
  }

  if (toast && toast.text) {
    children.push(
      h(
        'div',
        {
          key: 'toast',
          className: 'dcs-toast dcs-root',
          'data-tone': toast.tone || 'info',
          role: 'status',
          'aria-live': 'polite',
          style: {
            right: position.right + 'px',
            top: position.top + (state.open ? 84 : 0) + 'px',
          },
        },
        toast.text,
      ),
    );
  }

  return children.length ? h(React.Fragment, null, children) : null;
}

/* ----------------------------- find bar runtime --------------------------- */

/**
 * Start the find bar and the jump engine; called once from apply().
 * @param ctx - client root context.
 */
DCS.startFindBar = function startFindBar(ctx) {
  if (findBarRuntime !== null) {
    DCS.log.warn('find bar already started; ignoring duplicate start');
    return null;
  }

  /* ------------------------------ local state ----------------------------- */

  let previousFocus = null;
  let inputElement = null;
  let barElement = null;
  let currentRecords = [];
  let composing = false;

  let observer = null;
  let observedFlow = null;
  let observedSessionId = null;
  let pollTimer = null;
  let scanTimer = null;
  let toastTimer = null;
  let toastSerial = 0;

  let activeJump = null;
  let jumpSerial = 0;
  let flashElement = null;
  let flashDispose = null;

  const needleCache = new Map();
  let highlightSupport = null;

  // Full-history prefetch: started when the bar opens outside a jump, stopped
  // by closing the bar (the official loadThrough has no abort signal and may
  // finish in the background).
  let historyAutoLoad = null;
  let historyLoadTimer = null;
  let historyRescanTimer = null;
  let historyBindingRetries = 0;
  const historyLoadedSessions = new Set();

  /* ------------------------------- utilities ------------------------------ */

  function t(key, params) {
    try {
      return typeof DCS.t === 'function' ? DCS.t(key, params) : key;
    } catch (error) {
      return key;
    }
  }

  function getState() {
    return findBarStore.getSnapshot();
  }

  function patchState(patch) {
    findBarStore.update((state) => ({ ...state, ...patch }));
  }

  function currentSessionId() {
    try {
      return DCS.sessions.currentSessionId(ctx);
    } catch (error) {
      return null;
    }
  }

  function errorText(error) {
    if (!error) return 'unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message || error.name;
    return String(error);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function numberOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function normalizeForMatch(value) {
    if (typeof DCS.normalizeForMatch === 'function') return DCS.normalizeForMatch(value);
    return String(value == null ? '' : value).replace(/[\s`*_~#>|[\]()!，。：；、"'{}\\-]+/gu, '');
  }

  /** A needle for DOM-to-index matching: no markdown/whitespace noise, bounded. */
  function normalizeNeedle(value) {
    const cleaned = String(value == null ? '' : value)
      .replace(/\u2026/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned === '') return '';
    return normalizeForMatch(cleaned).slice(0, FIND_NEEDLE_MAX_CHARS);
  }

  /** Collapse every whitespace run in the query, matching how rows are folded. */
  function normalizeQueryText(value) {
    return String(value == null ? '' : value)
      .replace(/\u0000/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cssEscapeAttributeValue(value) {
    try {
      if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') return CSS.escape(value);
    } catch (error) {
      /* fall through to manual escaping */
    }
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function queryRowByAnchor(flow, key) {
    if (!flow || typeof key !== 'string' || key === '') return null;
    try {
      return flow.querySelector('[data-chat-anchor-key="' + cssEscapeAttributeValue(key) + '"]');
    } catch (error) {
      DCS.log.debug('anchor lookup failed', error);
      return null;
    }
  }

  /* ----------------------------- toast handling --------------------------- */

  function showToast(payload) {
    const source = typeof payload === 'string' ? { text: payload } : payload || {};
    const text = typeof source.text === 'string' ? source.text : '';
    if (text === '') return;
    const tone = source.tone === 'error' ? 'error' : source.tone === 'warn' ? 'warn' : 'info';
    toastSerial += 1;
    const id = toastSerial;
    findBarToastStore.set({ id, text, tone });
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastTimer = null;
      findBarToastStore.set({ id, text: '', tone: 'info' });
    }, FIND_TOAST_MS);
  }

  function clearToast() {
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    findBarToastStore.set({ id: ++toastSerial, text: '', tone: 'info' });
  }

  /* ------------------------------- highlight ------------------------------ */

  function highlightApi() {
    if (highlightSupport === null) {
      highlightSupport =
        typeof CSS !== 'undefined' &&
        CSS !== null &&
        typeof CSS.highlights === 'object' &&
        CSS.highlights !== null &&
        typeof Highlight === 'function';
      if (!highlightSupport) {
        DCS.log.info(
          'CSS Custom Highlight API is unavailable; the find bar will scroll to matches without painting them',
        );
      }
    }
    return highlightSupport;
  }

  function clearHighlights() {
    if (!highlightApi()) return;
    try {
      CSS.highlights.delete(FIND_HIGHLIGHT_MATCH);
      CSS.highlights.delete(FIND_HIGHLIGHT_CURRENT);
    } catch (error) {
      DCS.log.debug('clear find highlights failed', error);
    }
  }

  function paintHighlights(records, current) {
    if (!highlightApi()) return;
    try {
      if (records.length > 0) {
        CSS.highlights.set(FIND_HIGHLIGHT_MATCH, new Highlight(...records.map((record) => record.range)));
      } else {
        CSS.highlights.delete(FIND_HIGHLIGHT_MATCH);
      }
      if (current && current.range) {
        CSS.highlights.set(FIND_HIGHLIGHT_CURRENT, new Highlight(current.range));
      } else {
        CSS.highlights.delete(FIND_HIGHLIGHT_CURRENT);
      }
    } catch (error) {
      DCS.log.warn('paint find highlights failed', error);
    }
  }

  /* ------------------------------- row flash ------------------------------ */

  function clearFlash() {
    if (flashDispose !== null) {
      try {
        flashDispose();
      } catch (error) {
        DCS.log.debug('flash dispose failed', error);
      }
      flashDispose = null;
    }
    if (flashElement !== null) {
      DCS.dom.clearRowFlash(flashElement);
      flashElement = null;
    }
  }

  function flashRow(row) {
    clearFlash();
    flashElement = row;
    flashDispose = DCS.dom.flashRow(row, FIND_FLASH_MS);
  }

  /* ---------------------------- transcript DOM ---------------------------- */

  /**
   * The mounted transcript of the session view that is actually visible.
   *
   * Retained sessions stay mounted but hidden, and the slot wrapper itself can
   * be zero-sized, so pick by painted area instead of DOM order. A candidate
   * that owns rendered rows wins when no candidate paints (mid-transition), and
   * `DCS.dom.flowRoot()` is the last resort.
   */
  function activeFlow() {
    const candidates = Array.from(document.querySelectorAll(FIND_FLOW_SELECTOR));
    let best = null;
    let bestArea = 0;
    for (const element of candidates) {
      if (!element.isConnected) continue;
      const rect = element.getBoundingClientRect();
      const area = Math.max(0, rect.width) * Math.max(0, rect.height);
      if (area > bestArea) {
        best = element;
        bestArea = area;
      }
    }
    if (best !== null) return best;
    for (const element of candidates) {
      if (element.isConnected && Array.from(element.querySelectorAll(FIND_ROW_SELECTOR)).some((row) => DCS.dom.isRendered(row))) return element;
    }
    if (candidates.length > 0) return candidates[0];
    return DCS.dom.flowRoot();
  }

  function renderedRowsForTurn(flow, turn) {
    const rows = [];
    if (!flow || !Number.isFinite(turn)) return rows;
    const all = flow.querySelectorAll(FIND_ROW_SELECTOR);
    for (const row of all) {
      const value = Number(row.dataset.chatTurn);
      if (!Number.isFinite(value) || value !== turn) continue;
      if (!DCS.dom.isRendered(row)) continue;
      rows.push(row);
    }
    return rows;
  }

  function pickDeepest(elements) {
    let best = null;
    let bestDepth = -1;
    for (const element of elements) {
      let depth = 0;
      for (let node = element.parentElement; node !== null; node = node.parentElement) depth += 1;
      if (depth > bestDepth) {
        best = element;
        bestDepth = depth;
      }
    }
    return best;
  }

  /** How well one row's flow kind matches the indexed hit kind (0 = unknown). */
  function rowKindScore(row, kind) {
    const flowKind = row && row.dataset ? row.dataset.chatFlowKind || '' : '';
    if (flowKind === '') return 0;
    if (kind === 'user') return flowKind === 'user' || flowKind === 'steering' ? 2 : 0;
    if (kind === 'assistant') return flowKind === 'assistant-step' ? 2 : flowKind === 'turn-process' ? 1 : 0;
    if (kind === 'tool') {
      if (flowKind === 'tool-call' || flowKind === 'tool-result' || flowKind === 'tool') return 2;
      return flowKind === 'assistant-step' ? 1 : 0;
    }
    return 0;
  }

  /** Prefer rows of the hit kind, then the deepest (leaf) row in DOM order. */
  function pickBestRow(rows, kind) {
    if (!rows || rows.length === 0) return null;
    const preferred = kind ? rows.filter((row) => rowKindScore(row, kind) > 0) : [];
    return pickDeepest(preferred.length > 0 ? preferred : rows);
  }

  /** Fallback: the best-shaped row of the hit's turn when no text matched. */
  function pickFallbackRow(turnRows, kind) {
    if (!turnRows || turnRows.length === 0) return null;
    const preferred = kind ? turnRows.filter((row) => rowKindScore(row, kind) > 0) : [];
    return pickDeepest(preferred.length > 0 ? preferred : turnRows);
  }

  /**
   * Text that is actually painted in a row: `textContent` would also see text
   * inside collapsed (`hidden="until-found"`) folds, which the reader cannot
   * see and the find bar does not scan. Uses the same visible-node walk as the
   * match engine.
   */
  function rowVisibleText(row) {
    if (!row) return '';
    try {
      return normalizeForMatch(collapsePreview(collectRowRaw(row)));
    } catch (error) {
      return normalizeForMatch(row.textContent || '');
    }
  }

  function rowTextIncludes(row, needle, caseSensitive) {
    if (!row || !needle) return false;
    const text = rowVisibleText(row);
    if (text === '') return false;
    if (caseSensitive) return text.includes(needle);
    return text.toLowerCase().includes(needle.toLowerCase());
  }

  /** Find any deepest rendered anchor whose text contains the query. */
  function findAnchorByQuery(query, caseSensitive) {
    const wanted = normalizeForMatch(normalizeQueryText(query));
    if (wanted === '') return null;
    const flow = activeFlow();
    if (!flow) return null;
    const anchors = flow.querySelectorAll('[data-chat-anchor-key]');
    let best = null;
    let bestDepth = -1;
    for (const element of anchors) {
      if (!DCS.dom.isRendered(element)) continue;
      if (!rowTextIncludes(element, wanted, caseSensitive)) continue;
      let depth = 0;
      for (let node = element.parentElement; node !== null; node = node.parentElement) depth += 1;
      if (depth > bestDepth) {
        best = element;
        bestDepth = depth;
      }
    }
    return best;
  }

  /**
   * Resolve the jump target row inside the loaded transcript.
   * Priority (contract §5.5): needles inside the hit's turn, query inside the
   * hit's turn, needles anywhere, query anywhere, then the best turn row.
   * @returns `{ row, matched }` or null; `matched === false` means only the
   *   turn was found (the exact message text is not rendered).
   */
  function resolveTargetRow(hit, needleSet) {
    const flow = activeFlow();
    if (!flow) return null;
    const turn = numberOrNull(hit.turn);
    const caseSensitive = hit.caseSensitive === true;
    const queryText = normalizeQueryText(getState().query);
    const queryNeedle = normalizeForMatch(queryText);
    const targetAnchorSeq = numberOrNull(hit.anchorSeq);
    const targetSeq = targetAnchorSeq !== null ? targetAnchorSeq : numberOrNull(hit.seq);
    const ordered = orderedNeedles(needleSet);

    const turnRows = turn === null ? [] : renderedRowsForTurn(flow, turn);
    if (turnRows.length > 0) {
      for (const needle of ordered) {
        const candidates = turnRows.filter((row) => rowTextIncludes(row, needle, caseSensitive));
        const row = pickBestRow(candidates, hit.kind);
        if (row) return { row, matched: true };
      }
      if (queryNeedle !== '') {
        const candidates = turnRows.filter((row) => rowTextIncludes(row, queryNeedle, caseSensitive));
        const row = pickBestRow(candidates, hit.kind);
        if (row) return { row, matched: true };
      }
      const fallback = pickFallbackRow(turnRows, hit.kind);
      if (fallback) return { row: fallback, matched: false };
      return null;
    }

    // The indexed turn is absent. If the loaded window already covers the
    // target seq, the turn number is stale/mismatched (seeded or migrated
    // logs) — fall back to needle/query search instead of waiting forever.
    if (turn !== null && !windowCoversSeq(hit, targetSeq)) return null;
    for (const needle of ordered) {
      const row = DCS.dom.findAnchorByNeedle(needle);
      if (row) return { row, matched: true };
    }
    if (queryNeedle !== '' && queryNeedle.length >= 2) {
      const row = findAnchorByQuery(queryText, caseSensitive);
      if (row) return { row, matched: true };
    }
    return null;
  }

  /**
   * Locate the row that contains the *context* needle (the tighter needle built
   * from the hit snippet). Unlike `resolveTargetRow` it never falls back to the
   * search query or to an arbitrary row of the turn: collapse expansion needs
   * to know whether the precise target text is visible yet.
   */
  function locateNeedleRows(hit, needles, excludeRow) {
    if (!Array.isArray(needles) || needles.length === 0) return null;
    const flow = activeFlow();
    if (!flow) return null;
    const turn = numberOrNull(hit.turn);
    const caseSensitive = hit.caseSensitive === true;
    const targetAnchorSeq = numberOrNull(hit.anchorSeq);
    const targetSeq = targetAnchorSeq !== null ? targetAnchorSeq : numberOrNull(hit.seq);
    const excluded = (row) => row === excludeRow;

    const turnRows = turn === null ? [] : renderedRowsForTurn(flow, turn);
    if (turnRows.length > 0) {
      for (const needle of needles) {
        const candidates = turnRows.filter((row) => !excluded(row) && rowTextIncludes(row, needle, caseSensitive));
        const row = pickBestRow(candidates, hit.kind);
        if (row) return { row, matched: true };
      }
      return null;
    }
    if (turn !== null && !windowCoversSeq(hit, targetSeq)) return null;
    for (const needle of needles) {
      const row = DCS.dom.findAnchorByNeedle(needle);
      if (row && !excluded(row)) return { row, matched: true };
    }
    return null;
  }

  function locateContextRow(hit, needleSet) {
    const context = needleSet && Array.isArray(needleSet.context) ? needleSet.context : [];
    if (context.length === 0) return null;
    return locateNeedleRows(hit, context, null);
  }

  /** Needle set for one jump: tight context needles first, loose ones as fallback. */
  function emptyNeedleSet() {
    return { context: [], fallback: [] };
  }

  function orderedNeedles(needleSet) {
    if (!needleSet) return [];
    const context = Array.isArray(needleSet.context) ? needleSet.context : [];
    const fallback = Array.isArray(needleSet.fallback) ? needleSet.fallback : [];
    return context.concat(fallback);
  }

  /** Whether the loaded history window already covers the target seq. */
  function windowCoversSeq(hit, targetSeq) {
    if (targetSeq === null || !hit || typeof hit.sessionId !== 'string') return false;
    const window = DCS.sessions.loadedWindow(ctx, hit.sessionId);
    if (!window) return false;
    return window.baseSeq <= targetSeq;
  }

  function rowLandedInPort(row) {
    if (!row || !row.isConnected || !DCS.dom.isRendered(row)) return false;
    const rect = row.getBoundingClientRect();
    const port = DCS.dom.rowScrollPort(row);
    if (!port || port === document.scrollingElement) {
      const viewport = window.innerHeight || 0;
      return rect.top >= -40 && rect.top <= Math.max(0, viewport - 40);
    }
    const portRect = port.getBoundingClientRect();
    const relative = rect.top - portRect.top;
    return relative >= -40 && relative <= Math.max(40, port.clientHeight - 40);
  }

  /**
   * Reveal one match record by its text Range (not just its row: transcript
   * rows can be taller than the viewport). `align: 'auto'` leaves an already
   * visible match untouched and aligns from whichever edge it overflows;
   * `align: 'top'` is used for jump landings so the first visible line is the
   * matched text.
   */
  function revealRecord(record, align) {
    if (!record) return false;
    try {
      return DCS.dom.revealRange(record.range, record.row, { align: align === 'top' ? 'top' : 'auto' });
    } catch (error) {
      DCS.log.debug('revealRange failed', error);
      return false;
    }
  }

  /* --------------------------- match scan engine -------------------------- */

  const FIND_SPACE_CODES = new Set([
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
  ]);

  function isSpaceCode(code) {
    if (FIND_SPACE_CODES.has(code)) return true;
    return code >= 0x2000 && code <= 0x200a;
  }

  /** Walker over the text nodes of one row, keeping whitespace-only nodes. */
  function createRowWalker(row) {
    return document.createTreeWalker(row, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest('[hidden]')) return NodeFilter.FILTER_REJECT;
        const rootClass = DCS.CLASS && DCS.CLASS.root ? DCS.CLASS.root : 'dcs-root';
        if (parent.closest('.' + rootClass)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
  }

  function blockElementOf(node) {
    const parent = node.parentElement;
    if (!parent) return null;
    return parent.closest(FIND_BLOCK_SELECTOR);
  }

  /**
   * Flatten one row into a raw string; a NUL marks a block boundary so a
   * query can never match across paragraphs (the query never contains NUL).
   */
  function collectRowRaw(row) {
    const walker = createRowWalker(row);
    let raw = '';
    let block = null;
    let hasBlock = false;
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue;
      if (value) {
        const nextBlock = blockElementOf(node);
        if (hasBlock && nextBlock !== block) raw += '\u0000';
        raw += value;
        block = nextBlock;
        hasBlock = true;
      }
      node = walker.nextNode();
    }
    return raw;
  }

  /**
   * Collapse whitespace runs to one space, keeping NUL block separators.
   * With `withMap`, also return a per-character map back to raw offsets.
   */
  function collapseRowRaw(raw, withMap) {
    const parts = [];
    const map = withMap ? [] : null;
    let index = 0;
    let inRun = false;
    while (index < raw.length) {
      const code = raw.charCodeAt(index);
      if (code === 0) {
        parts.push('\u0000');
        if (map) map.push(index);
        inRun = false;
        index += 1;
        continue;
      }
      if (isSpaceCode(code)) {
        if (!inRun) {
          parts.push(' ');
          if (map) map.push(index);
          inRun = true;
        }
        index += 1;
        continue;
      }
      inRun = false;
      parts.push(raw.charAt(index));
      if (map) map.push(index);
      index += 1;
    }
    return { text: parts.join(''), map };
  }

  /** Second walk of a row: text nodes plus raw offset bookkeeping. */
  function collectRowSegments(row) {
    const walker = createRowWalker(row);
    const nodes = [];
    const starts = [];
    const ends = [];
    let raw = '';
    let block = null;
    let hasBlock = false;
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue;
      if (value) {
        const nextBlock = blockElementOf(node);
        if (hasBlock && nextBlock !== block) raw += '\u0000';
        block = nextBlock;
        hasBlock = true;
        starts.push(raw.length);
        raw += value;
        ends.push(raw.length);
        nodes.push(node);
      }
      node = walker.nextNode();
    }
    if (nodes.length === 0) return null;
    return { nodes, starts, ends, raw };
  }

  function locateStartSegment(segments, rawIndex) {
    let low = 0;
    let high = segments.starts.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const start = segments.starts[middle];
      const end = segments.ends[middle];
      if (rawIndex < start) high = middle - 1;
      else if (rawIndex >= end) low = middle + 1;
      else return middle;
    }
    return -1;
  }

  function createMatchRange(segmentInfo, rawStart, rawEndExclusive) {
    const startSegment = locateStartSegment(segmentInfo, rawStart);
    if (startSegment < 0) return null;
    const endProbe = Math.max(rawStart, rawEndExclusive - 1);
    const endSegment = locateStartSegment(segmentInfo, endProbe);
    if (endSegment < 0) return null;
    const startNode = segmentInfo.nodes[startSegment];
    const endNode = segmentInfo.nodes[endSegment];
    const startOffset = rawStart - segmentInfo.starts[startSegment];
    const endOffset = rawEndExclusive - segmentInfo.starts[endSegment];
    if (startOffset < 0 || endOffset < 0) return null;
    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    } catch (error) {
      return null;
    }
  }

  /** Leaf rows only: rows nesting another anchored turn row are containers. */
  function leafFlowRows(flow) {
    if (!flow) return [];
    const rows = [];
    const all = flow.querySelectorAll(FIND_ROW_SELECTOR);
    for (const row of all) {
      if (row.querySelector(FIND_ROW_SELECTOR) !== null) continue;
      rows.push(row);
    }
    return rows;
  }

  /**
   * Fast prefilter collapse: fold whitespace runs to one space but keep the NUL
   * block separators. Native regex, no offset map.
   */
  function collapsePreview(raw) {
    return raw.replace(/[^\S\u0000]+/gu, ' ');
  }

  /**
   * Scan every loaded leaf row and return match records `{row, range}`.
   * `n/m` in the UI is exactly `records.length`.
   */
  function collectMatches(queryText, options) {
    const flow = activeFlow();
    if (!flow) return { records: [], truncated: false };
    const needle = normalizeQueryText(queryText);
    if (needle === '') return { records: [], truncated: false };
    const records = [];
    const rows = leafFlowRows(flow);
    let truncated = false;
    const matchOptions = {
      caseSensitive: options.caseSensitive === true,
      wholeWord: options.wholeWord === true,
    };
    const previewNeedle = matchOptions.caseSensitive ? needle : DCS.foldCase(needle);
    for (const row of rows) {
      if (records.length >= FIND_MAX_MATCHES) {
        truncated = true;
        break;
      }
      if (!DCS.dom.isRendered(row)) continue;
      let raw;
      try {
        raw = collectRowRaw(row);
      } catch (error) {
        DCS.log.debug('row text walk failed', error);
        continue;
      }
      if (raw.length < needle.length) continue;
      const preview = collapsePreview(raw);
      if (preview.length < needle.length) continue;
      const previewHaystack = matchOptions.caseSensitive ? preview : DCS.foldCase(preview);
      if (previewHaystack.indexOf(previewNeedle) < 0) continue;

      let segments;
      try {
        segments = collectRowSegments(row);
      } catch (error) {
        DCS.log.debug('row segment walk failed', error);
        continue;
      }
      if (!segments) continue;
      const collapsed = collapseRowRaw(segments.raw, true);
      const found = DCS.findMatches(collapsed.text, needle, matchOptions);
      if (found.length === 0) continue;
      for (const match of found) {
        if (records.length >= FIND_MAX_MATCHES) {
          truncated = true;
          break;
        }
        const rawStart = collapsed.map[match.start];
        const rawLast = collapsed.map[match.start + match.length - 1];
        if (typeof rawStart !== 'number' || typeof rawLast !== 'number') continue;
        const range = createMatchRange(segments, rawStart, rawLast + 1);
        if (!range) continue;
        records.push({
          row,
          range,
          rawStart,
          rowKey: row && row.dataset ? row.dataset.chatAnchorKey || '' : '',
        });
      }
      if (truncated) break;
    }
    return { records, truncated };
  }

  function currentRecord() {
    const state = getState();
    return state.currentIndex >= 0 ? currentRecords[state.currentIndex] || null : null;
  }

  function recordLivesInRow(record, row) {
    if (!record || !row) return false;
    const candidate = record.row;
    if (!candidate) return false;
    if (candidate === row) return true;
    if (typeof row.contains === 'function' && row.contains(candidate)) return true;
    return typeof candidate.contains === 'function' && candidate.contains(row);
  }

  function chooseIndexForRow(records, row) {
    for (let index = 0; index < records.length; index += 1) {
      if (recordLivesInRow(records[index], row)) return index;
    }
    return -1;
  }

  /**
   * Re-scan the loaded transcript, publish `matches/currentIndex`, repaint
   * highlights and optionally scroll the current match into view.
   * @param options - `{ preferRow, previousRecord, previousIndex, scroll }`.
   * @returns the live match records.
   */
  function rescan(options) {
    const opts = options || {};
    if (getState().status === 'jumping') return currentRecords;
    const state = getState();
    const queryText = normalizeQueryText(state.query);
    if (queryText === '') {
      currentRecords = [];
      clearHighlights();
      findBarStore.update((snapshot) => ({
        ...snapshot,
        matches: [],
        currentIndex: -1,
        message: 'find.emptyQuery',
        messageParams: null,
      }));
      return currentRecords;
    }

    let result;
    try {
      result = collectMatches(state.query, {
        caseSensitive: state.caseSensitive,
        wholeWord: state.wholeWord,
      });
    } catch (error) {
      DCS.log.warn('find scan failed', error);
      result = { records: [], truncated: false };
    }
    const records = result.records;
    currentRecords = records;

    let index = -1;
    if (records.length > 0) {
      index = 0;
      if (opts.preferRow) {
        const matched = chooseIndexForRow(records, opts.preferRow);
        index = matched >= 0 ? matched : opts.strictPreferRow === true ? -1 : 0;
      } else if (opts.previousRecord) {
        const previous = opts.previousRecord;
        const identity =
          previous.range && previous.range.startContainer
            ? records.findIndex(
                (record) =>
                  record.row === previous.row &&
                  record.range.startContainer === previous.range.startContainer &&
                  record.range.startOffset === previous.range.startOffset,
              )
            : -1;
        if (identity >= 0) index = identity;
        else {
          // Prepending history re-numbers the match array while the current
          // row/text stays untouched: re-anchor by the row's stable anchor key
          // and the match's raw offset inside that row before giving up.
          const previousRowKey =
            previous.rowKey ||
            (previous.row && previous.row.dataset ? previous.row.dataset.chatAnchorKey || '' : '');
          let remapped = -1;
          if (previousRowKey !== '' && typeof previous.rawStart === 'number') {
            remapped = records.findIndex(
              (record) => record.rowKey === previousRowKey && record.rawStart === previous.rawStart,
            );
          }
          if (remapped < 0 && previousRowKey !== '') {
            remapped = records.findIndex((record) => record.rowKey === previousRowKey);
          }
          if (remapped >= 0) index = remapped;
          else {
            const sameRow = records.findIndex((record) => record.row === previous.row);
            if (sameRow >= 0) index = sameRow;
            else index = Math.min(Math.max(opts.previousIndex || 0, 0), records.length - 1);
          }
        }
      } else if (typeof opts.previousIndex === 'number' && opts.previousIndex >= 0) {
        index = Math.min(opts.previousIndex, records.length - 1);
      }
    }

    let message = records.length > 0 ? '' : 'find.noResults';
    let messageParams = null;
    if (result.truncated) {
      message = 'find.extra.matchLimit';
      messageParams = { total: records.length };
    }

    findBarStore.update((snapshot) => ({
      ...snapshot,
      matches: records,
      currentIndex: index,
      message,
      messageParams,
    }));
    paintHighlights(records, index >= 0 ? records[index] : null);
    if (index >= 0 && opts.scroll === true) {
      revealRecord(records[index], 'auto');
    }
    return records;
  }

  /** Schedule a debounced re-scan that keeps the current match when possible. */
  function scheduleRescan(delay) {
    if (getState().status === 'jumping') return;
    const wait = typeof delay === 'number' ? delay : FIND_TYPE_DEBOUNCE_MS;
    if (scanTimer !== null) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanTimer = null;
      if (!getState().open) return;
      rescan({
        previousRecord: currentRecord(),
        previousIndex: getState().currentIndex,
        scroll: false,
      });
    }, wait);
  }

  function setCurrentIndex(index, scroll) {
    if (index < 0 || index >= currentRecords.length) return;
    findBarStore.update((snapshot) => ({
      ...snapshot,
      currentIndex: index,
      message: '',
      messageParams: null,
      status: snapshot.status === 'jumping' ? snapshot.status : 'idle',
    }));
    paintHighlights(currentRecords, currentRecords[index]);
    if (scroll) revealRecord(currentRecords[index], 'auto');
  }

  function navigate(delta) {
    if (getState().status === 'jumping') return;
    if (currentRecords.length === 0) {
      rescan({ previousIndex: getState().currentIndex, scroll: false });
      if (currentRecords.length === 0) return;
    }
    const stale = currentRecords.some((record) => !record.row.isConnected);
    if (stale) {
      rescan({ previousIndex: getState().currentIndex, scroll: false });
      if (currentRecords.length === 0) return;
    }
    const total = currentRecords.length;
    const state = getState();
    let index = state.currentIndex;
    if (index < 0 || index >= total) index = delta > 0 ? 0 : total - 1;
    else index = (index + delta + total) % total;
    setCurrentIndex(index, true);
  }

  /* --------------------------- full history load -------------------------- */

  function rememberHistorySession(sessionId) {
    if (!sessionId) return;
    historyLoadedSessions.add(sessionId);
    if (historyLoadedSessions.size > FIND_HISTORY_SESSION_CACHE_LIMIT) {
      const first = historyLoadedSessions.values().next();
      if (!first.done) historyLoadedSessions.delete(first.value);
    }
  }

  /** Clear the throttled growth rescan used while history is prefetching. */
  function clearHistoryRescanTimer() {
    if (historyRescanTimer !== null) {
      clearTimeout(historyRescanTimer);
      historyRescanTimer = null;
    }
  }

  /** One slow rescan per mutation burst while prepends stream in (n/m grows). */
  function scheduleHistoryRescan() {
    if (historyRescanTimer !== null) return;
    historyRescanTimer = setTimeout(() => {
      historyRescanTimer = null;
      if (!getState().open || getState().historyLoading !== true) return;
      rescan({
        previousRecord: currentRecord(),
        previousIndex: getState().currentIndex,
        scroll: false,
      });
    }, 600);
  }

  /** Stop polling for the full history (the official loader may finish on its own). */
  function cancelFullHistoryLoad(options) {
    const opts = options || {};
    clearHistoryRescanTimer();
    if (historyLoadTimer !== null) {
      clearTimeout(historyLoadTimer);
      historyLoadTimer = null;
    }
    const run = historyAutoLoad;
    if (run !== null) {
      run.cancelled = true;
      if (run.pollTimer !== null) clearInterval(run.pollTimer);
      if (run.deadlineTimer !== null) clearTimeout(run.deadlineTimer);
      historyAutoLoad = null;
    }
    if (opts.keepUi !== true && getState().historyLoading === true) {
      findBarStore.update((snapshot) => ({ ...snapshot, historyLoading: false, historyBaseSeq: null }));
    }
    return run !== null;
  }

  /** Debounced trigger: the bar may still be opening/jumping when scheduled. */
  function scheduleFullHistoryLoad(delay) {
    if (historyLoadTimer !== null) return;
    const wait = typeof delay === 'number' ? delay : FIND_HISTORY_OPEN_DELAY_MS;
    historyLoadTimer = setTimeout(() => {
      historyLoadTimer = null;
      ensureFullHistory();
    }, wait);
  }

  /** Page the session window back to seq 0 once per session, in the background. */
  function ensureFullHistory() {
    if (!getState().open) return;
    if (historyAutoLoad !== null) return;
    if (getState().status === 'jumping') return; // jump owns history; retried after it
    const sessionId = currentSessionId();
    if (!sessionId) return;
    if (historyLoadedSessions.has(sessionId)) return;
    const window = DCS.sessions.loadedWindow(ctx, sessionId);
    if (!window) {
      // Binding not materialized yet (view still opening): retry a few times.
      historyBindingRetries += 1;
      if (historyBindingRetries <= FIND_HISTORY_BINDING_RETRIES) {
        scheduleFullHistoryLoad(FIND_HISTORY_BINDING_RETRY_MS);
      }
      return;
    }
    historyBindingRetries = 0;
    if (window.baseSeq <= 0 || window.hasMore !== true) {
      rememberHistorySession(sessionId);
      return;
    }
    startFullHistoryLoad(sessionId, window.baseSeq);
  }

  function kickFullHistoryLoad(run, sessionId) {
    if (run.cancelled || run.finished) return;
    run.lastKickAt = Date.now();
    try {
      const pending = DCS.sessions.loadThrough(ctx, sessionId, 0);
      if (pending && typeof pending.catch === 'function') {
        pending.catch((error) => {
          if (!run.cancelled && error && error.name !== 'AbortError') {
            run.lastError = errorText(error);
            DCS.log.debug('full history load failed', error);
          }
        });
      }
    } catch (error) {
      run.lastError = errorText(error);
      DCS.log.debug('full history load could not start', error);
    }
  }

  function startFullHistoryLoad(sessionId, startBaseSeq) {
    const run = {
      sessionId,
      cancelled: false,
      finished: false,
      pollTimer: null,
      deadlineTimer: null,
      lastKickAt: 0,
      startedAt: Date.now(),
      lastError: null,
    };
    historyAutoLoad = run;
    findBarStore.update((snapshot) => ({
      ...snapshot,
      historyLoading: true,
      historyBaseSeq: typeof startBaseSeq === 'number' ? startBaseSeq : null,
    }));
    run.pollTimer = setInterval(() => pollFullHistoryLoad(run, sessionId), FIND_HISTORY_POLL_MS);
    run.deadlineTimer = setTimeout(() => finishFullHistoryLoad(run, 'timeout'), FIND_HISTORY_TIMEOUT_MS);
    kickFullHistoryLoad(run, sessionId);
    pollFullHistoryLoad(run, sessionId);
  }

  function pollFullHistoryLoad(run, sessionId) {
    if (run.cancelled || run.finished || historyAutoLoad !== run) return;
    if (!getState().open) {
      cancelFullHistoryLoad({ keepUi: true });
      return;
    }
    if (currentSessionId() !== sessionId) {
      cancelFullHistoryLoad({ keepUi: true });
      scheduleFullHistoryLoad(0);
      return;
    }
    const window = DCS.sessions.loadedWindow(ctx, sessionId);
    if (window) {
      if (typeof window.baseSeq === 'number' && window.baseSeq !== getState().historyBaseSeq) {
        findBarStore.update((snapshot) => ({ ...snapshot, historyBaseSeq: window.baseSeq }));
      }
      if (window.baseSeq <= 0 || window.hasMore !== true) {
        finishFullHistoryLoad(run, 'done');
        return;
      }
      if (window.loadingOlder !== true && Date.now() - run.lastKickAt >= FIND_HISTORY_KICK_MS) {
        kickFullHistoryLoad(run, sessionId);
      }
    } else if (Date.now() - run.lastKickAt >= FIND_HISTORY_KICK_MS) {
      kickFullHistoryLoad(run, sessionId);
    }
    if (Date.now() - run.startedAt >= FIND_HISTORY_TIMEOUT_MS) finishFullHistoryLoad(run, 'timeout');
  }

  function finishFullHistoryLoad(run, reason) {
    if (!run || run.finished) return;
    run.finished = true;
    if (run.pollTimer !== null) clearInterval(run.pollTimer);
    if (run.deadlineTimer !== null) clearTimeout(run.deadlineTimer);
    run.pollTimer = null;
    run.deadlineTimer = null;
    if (historyAutoLoad === run) historyAutoLoad = null;
    clearHistoryRescanTimer();
    rememberHistorySession(run.sessionId);
    DCS.log.debug('full history prefetch finished', reason, run.sessionId, run.lastError || '');
    if (!getState().open || currentSessionId() !== run.sessionId) return;
    findBarStore.update((snapshot) => ({ ...snapshot, historyLoading: false, historyBaseSeq: null }));
    // The window grew: rescan without scrolling, remapping the current match by
    // record identity so prepended rows do not move the reader to another hit.
    rescan({
      previousRecord: currentRecord(),
      previousIndex: getState().currentIndex,
      scroll: false,
    });
  }

  /* ------------------------------ observation ----------------------------- */

  function teardownObserver() {
    if (observer !== null) {
      try {
        observer.disconnect();
      } catch (error) {
        DCS.log.debug('find observer disconnect failed', error);
      }
      observer = null;
    }
    observedFlow = null;
  }

  function ensureObserver() {
    const flow = activeFlow();
    if (flow === observedFlow && observer !== null) return;
    teardownObserver();
    observedFlow = flow;
    if (!flow || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(() => {
      if (!getState().open || getState().status === 'jumping') return;
      // Prepend storms during the full-history prefetch: let n/m grow, but on
      // a slow cadence instead of rescanning the growing window per mutation.
      if (getState().historyLoading === true) {
        scheduleHistoryRescan();
        return;
      }
      if (scanTimer !== null) clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        scanTimer = null;
        if (!getState().open || getState().status === 'jumping') return;
        rescan({
          previousRecord: currentRecord(),
          previousIndex: getState().currentIndex,
          scroll: false,
        });
      }, FIND_MUTATION_DEBOUNCE_MS);
    });
    try {
      observer.observe(flow, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['hidden'],
      });
    } catch (error) {
      DCS.log.warn('find observer attach failed', error);
      teardownObserver();
    }
  }

  function startObservation() {
    if (pollTimer === null) pollTimer = setInterval(onPoll, FIND_POLL_MS);
    observedSessionId = currentSessionId();
    ensureObserver();
  }

  function stopObservation() {
    clearHistoryRescanTimer();
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (scanTimer !== null) {
      clearTimeout(scanTimer);
      scanTimer = null;
    }
    teardownObserver();
    observedSessionId = null;
  }

  function onPoll() {
    if (!getState().open) return;
    const flow = activeFlow();
    const sessionId = currentSessionId();
    const flowChanged = flow !== observedFlow;
    if (flowChanged) {
      teardownObserver();
      ensureObserver();
    }
    if (sessionId !== observedSessionId) {
      observedSessionId = sessionId;
      cancelFullHistoryLoad();
      historyBindingRetries = 0;
      if (getState().status !== 'jumping') {
        clearFlash();
        scheduleRescan(0);
        scheduleFullHistoryLoad(0);
      }
      return;
    }
    if (flowChanged && getState().status !== 'jumping' && scanTimer === null) scheduleRescan(0);
  }

  /* -------------------------------- jumping -------------------------------- */

  function createJumpToken() {
    const token = {
      id: ++jumpSerial,
      cancelled: false,
      controller: typeof AbortController === 'function' ? new AbortController() : null,
      timers: new Set(),
      sessionId: null,
      targetSeq: null,
      loadError: null,
      loadStalled: false,
      historyLoadStarted: false,
      retryCount: 0,
      lastRetryAt: 0,
      cancelHooks: new Set(),
      clear() {
        for (const timer of this.timers) {
          clearTimeout(timer);
          clearInterval(timer);
        }
        this.timers.clear();
      },
      onCancel(callback) {
        this.cancelHooks.add(callback);
        return () => {
          this.cancelHooks.delete(callback);
        };
      },
      notifyCancel() {
        const hooks = [...this.cancelHooks];
        this.cancelHooks.clear();
        for (const hook of hooks) {
          try {
            hook();
          } catch (error) {
            DCS.log.debug('jump cancel hook failed', error);
          }
        }
      },
      later(callback, delay) {
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          callback();
        }, delay);
        this.timers.add(timer);
        return timer;
      },
      every(callback, delay) {
        const timer = setInterval(callback, delay);
        this.timers.add(timer);
        return timer;
      },
    };
    return token;
  }

  function tokenActive(token) {
    return token !== null && activeJump === token && token.cancelled !== true;
  }

  function abortJumpController(token) {
    if (!token || !token.controller) return;
    try {
      token.controller.abort();
    } catch (error) {
      DCS.log.debug('jump abort failed', error);
    }
  }

  /** Start one jump, superseding any jump still in flight. */
  function beginJumpToken() {
    cancelActiveJump({ silent: true, keepUi: true });
    const token = createJumpToken();
    activeJump = token;
    return token;
  }

  /**
   * Stop the active jump. `keepUi` leaves the store untouched (the caller is
   * about to overwrite it); `silent` suppresses the "cancelled" toast.
   */
  function cancelActiveJump(options) {
    const opts = options || {};
    const token = activeJump;
    if (token !== null) {
      token.cancelled = true;
      abortJumpController(token);
      token.clear();
      activeJump = null;
      // Resolve any promise parked on this token (the patrol loop would
      // otherwise wait for a timer that was just cleared).
      token.notifyCancel();
    }
    if (opts.keepUi === true) return token !== null;
    clearFlash();
    const state = getState();
    if (state.status === 'jumping') {
      findBarStore.update((snapshot) => ({
        ...snapshot,
        status: 'idle',
        jumpProgress: null,
        message: '',
        messageParams: null,
      }));
    }
    if (opts.silent !== true) {
      showToast({ text: t('find.cancelled'), tone: 'info' });
      if (getState().open) scheduleRescan(0);
    }
    return token !== null;
  }

  function setJumpProgress(progress) {
    findBarStore.update((snapshot) =>
      snapshot.status === 'jumping' ? { ...snapshot, jumpProgress: progress } : snapshot,
    );
  }

  function loadedBaseSeq(sessionId) {
    const window = DCS.sessions.loadedWindow(ctx, sessionId);
    return window ? window.baseSeq : null;
  }

  /** Page older history in the background until the window covers the target. */
  async function runHistoryLoad(token) {
    const targetSeq = token.targetSeq;
    if (targetSeq === null) return;
    let stalls = 0;
    for (let round = 0; round < 60; round += 1) {
      if (!tokenActive(token)) return;
      const window = DCS.sessions.loadedWindow(ctx, token.sessionId);
      if (!window) {
        await sleep(200);
        continue;
      }
      if (!(window.baseSeq > targetSeq && window.hasMore === true)) return;
      const before = window.baseSeq;
      try {
        await DCS.sessions.loadThrough(ctx, token.sessionId, targetSeq);
      } catch (error) {
        if (!token.cancelled) token.loadError = errorText(error);
        return;
      }
      if (!tokenActive(token)) return;
      const after = DCS.sessions.loadedWindow(ctx, token.sessionId);
      if (!after) return;
      if (!(after.baseSeq > targetSeq && after.hasMore === true)) return;
      if (after.baseSeq >= before) {
        // `loadThrough` bails out while a plain `loadOlder` owns the busy flag:
        // wait for it and retry instead of treating that as "no progress".
        if (after.loadingOlder === true) {
          await sleep(250);
          continue;
        }
        stalls += 1;
        if (stalls > 6) {
          token.loadStalled = true;
          return;
        }
        await sleep(300);
      }
    }
  }

  /**
   * Start (once per jump) the background history pager. It is retried from the
   * patrol loop because the first tail page may still be loading when the jump
   * begins, so `baseSeq/hasMore` only become meaningful a moment later.
   */
  function startHistoryLoad(token) {
    if (token.historyLoadStarted === true) return;
    if (token.targetSeq === null) return;
    const window = DCS.sessions.loadedWindow(ctx, token.sessionId);
    if (!window) return;
    if (!(window.baseSeq > token.targetSeq && window.hasMore === true)) return;
    token.historyLoadStarted = true;
    setJumpProgress({ phase: 'loading', seq: window.baseSeq, targetSeq: token.targetSeq });
    token.every(() => {
      if (!tokenActive(token) || getState().status !== 'jumping') return;
      const current = DCS.sessions.loadedWindow(ctx, token.sessionId);
      if (!current) return;
      const progress = getState().jumpProgress;
      if (progress && progress.seq === current.baseSeq) return;
      setJumpProgress({ phase: 'loading', seq: current.baseSeq, targetSeq: token.targetSeq });
    }, 200);
    void runHistoryLoad(token);
  }

  /** Wait until the chat flow and at least its first rows are mounted. */
  async function waitForFlow(token, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (!tokenActive(token)) return false;
      const flow = activeFlow();
      if (flow && flow.isConnected) {
        // The flow root itself may be a zero-sized seat; the rendered rows it
        // owns are the real readiness signal.
        const rows = Array.from(flow.querySelectorAll(FIND_ROW_SELECTOR));
        if (rows.some((row) => DCS.dom.isRendered(row))) return true;
        if (flow.getClientRects().length > 0 && rows.length > 0) return true;
      }
      if (Date.now() >= deadline) return false;
      await sleep(80);
    }
  }

  function trackTargetRow(hit, needleSet, previous) {
    if (previous && previous.row) {
      if (previous.row.isConnected && DCS.dom.isRendered(previous.row)) return previous;
      const key = previous.row.dataset ? previous.row.dataset.chatAnchorKey : undefined;
      if (key) {
        const flow = activeFlow();
        const replacement = queryRowByAnchor(flow, key);
        if (replacement && DCS.dom.isRendered(replacement)) {
          return { row: replacement, matched: previous.matched };
        }
      }
    }
    const resolved = resolveTargetRow(hit, needleSet);
    if (resolved && resolved.row && DCS.dom.isRendered(resolved.row)) return resolved;
    return null;
  }

  /**
   * Patrol-and-stick landing: the host snaps its scroll position back to the
   * tail after opening/paging, and React replaces row nodes on re-render, so a
   * single scroll does not survive. Re-find + re-land every tick until the row
   * stays inside its scrollport for FIND_STICK_MS.
   */
  function patrolTarget(hit, token, needleSet) {
    return new Promise((resolve) => {
      const deadline = Date.now() + FIND_LAND_TIMEOUT_MS;
      const userEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
      let tracked = null;
      let lastLandAt = 0;
      let landedAt = 0;
      let yieldReason = '';
      let finished = false;

      const finish = (result) => {
        if (finished) return;
        finished = true;
        for (const type of userEvents) window.removeEventListener(type, onUserIntent, true);
        token.cancelHooks.delete(cancelHook);
        token.clear();
        resolve(result);
      };

      const onUserIntent = (event) => {
        if (finished || yieldReason !== '') return;
        const target = event ? event.target : null;
        const insideBar =
          barElement !== null && target instanceof Node && typeof barElement.contains === 'function'
            ? barElement.contains(target)
            : false;
        if (event && event.type === 'keydown') {
          const key = event.key || '';
          if (key === 'Shift' || key === 'Control' || key === 'Meta' || key === 'Alt' || key === 'CapsLock') return;
          if (insideBar) {
            yieldReason = 'typing';
            return;
          }
          yieldReason = 'user';
          return;
        }
        if (insideBar) return;
        yieldReason = 'user';
      };

      for (const type of userEvents) {
        window.addEventListener(type, onUserIntent, { capture: true, passive: true });
      }

      // Cancelling a jump clears the scheduled tick timer, which would leave
      // this promise pending forever; resolve it from the cancel hook instead.
      const cancelHook = () => finish({ ok: false, reason: 'cancelled' });
      token.onCancel(cancelHook);

      const tick = () => {
        if (finished) return;
        if (!tokenActive(token)) {
          finish({ ok: false, reason: token.cancelled ? 'cancelled' : 'superseded' });
          return;
        }
        if (yieldReason !== '') {
          finish({ ok: false, reason: yieldReason });
          return;
        }
        if (Date.now() > deadline) {
          finish({ ok: false, reason: 'timeout' });
          return;
        }
        tracked = trackTargetRow(hit, needleSet, tracked);
        if (!tracked) {
          landedAt = 0;
          startHistoryLoad(token);
        } else if (rowLandedInPort(tracked.row)) {
          if (landedAt === 0) {
            landedAt = Date.now();
            // Re-align once more so the row sits at the reading line, not just
            // somewhere inside the viewport.
            DCS.dom.revealRange(null, tracked.row, { align: 'top' });
            lastLandAt = Date.now();
          } else if (Date.now() - landedAt >= FIND_STICK_MS) {
            finish({ ok: true, row: tracked.row, matched: tracked.matched !== false });
            return;
          }
        } else {
          landedAt = 0;
          if (Date.now() - lastLandAt >= FIND_TICK_MS) {
            DCS.dom.revealRange(null, tracked.row, { align: 'top' });
            lastLandAt = Date.now();
          }
        }
        token.later(tick, FIND_TICK_MS);
      };

      tick();
    });
  }

  /**
   * Build DOM needles from the click payload, `/session` hits, or `/message`.
   *
   * Two tiers: `context` needles carry the ~16 characters on each side of the
   * match (in snippet coordinates, clipped at the snippet edges) so the engine
   * can tell the indexed occurrence apart from the same word in visible body
   * text; `fallback` needles keep the previous looser snippet/message needles
   * for payloads without snippet coordinates and for markdown-heavy rows.
   *
   * @returns `{ context: string[], fallback: string[] }` (context first).
   */
  async function buildNeedles(hit, token) {
    const context = [];
    const fallback = [];
    const pushContext = (raw) => {
      const needle = normalizeNeedle(raw);
      if (needle.length < FIND_CONTEXT_NEEDLE_MIN_CHARS) return;
      if (!context.includes(needle) && !fallback.includes(needle)) context.push(needle);
    };
    const pushFallback = (raw) => {
      const needle = normalizeNeedle(raw);
      if (needle.length < FIND_NEEDLE_MIN_CHARS) return;
      if (!fallback.includes(needle) && !context.includes(needle)) fallback.push(needle);
    };
    const pushSnippet = (source) => {
      if (!source || typeof source.snippet !== 'string') return;
      const snippet = source.snippet;
      const matchStart = numberOrNull(source.matchStart);
      const matchLength = numberOrNull(source.matchLength) || 1;
      if (matchStart === null) {
        pushFallback(snippet.replace(/\u2026/g, ' '));
        return;
      }
      // Context window around the hit, clipped at the snippet's own edges.
      const from = Math.max(0, matchStart - FIND_CONTEXT_RADIUS_CHARS);
      const to = Math.min(snippet.length, matchStart + matchLength + FIND_CONTEXT_RADIUS_CHARS);
      if (to > from) pushContext(snippet.slice(from, to).replace(/\u2026/g, ' '));
      // Legacy loose needles stay as the compatibility fallback.
      pushFallback(snippet.replace(/\u2026/g, ' '));
      let offset = matchStart;
      if (snippet.charAt(0) === '\u2026') offset -= 1;
      const looseFrom = Math.max(0, offset - 24);
      const looseTo = Math.min(snippet.length, offset + matchLength + 40);
      if (looseTo > looseFrom) pushFallback(snippet.slice(looseFrom, looseTo).replace(/\u2026/g, ' '));
    };

    pushSnippet(hit);
    const state = getState();
    const query = state.query;
    if (query === '' || !hit || typeof hit.sessionId !== 'string') {
      return { context, fallback };
    }
    const options = {
      caseSensitive: hit.caseSensitive === true,
      wholeWord: hit.wholeWord === true,
    };
    const cacheKey = [hit.sessionId, query, options.caseSensitive ? '1' : '0', options.wholeWord ? '1' : '0'].join('\u0000');
    const richEnough = context.length > 0 || fallback.length > 0;
    let hits = richEnough ? [] : needleCache.get(cacheKey) || null;
    if (hits === null) {
      try {
        const payload = await DCS.api.sessionHits(
          hit.sessionId,
          query,
          options,
          token.controller ? token.controller.signal : undefined,
        );
        hits = Array.isArray(payload.hits) ? payload.hits : [];
        if (needleCache.size >= FIND_NEEDLE_CACHE_LIMIT) {
          const firstKey = needleCache.keys().next();
          if (!firstKey.done) needleCache.delete(firstKey.value);
        }
        needleCache.set(cacheKey, hits);
      } catch (error) {
        if (!token.cancelled && !(error && error.name === 'AbortError')) {
          DCS.log.debug('session hit enrichment failed; falling back to the query needle', error);
        }
        hits = null;
      }
    }
    if (hits !== null) {
      const wantedSeq = numberOrNull(hit.seq);
      const wantedAnchor = numberOrNull(hit.anchorSeq);
      const match = hits.find((candidate) => {
        if (!candidate) return false;
        if (wantedSeq !== null && numberOrNull(candidate.seq) === wantedSeq) return true;
        return wantedAnchor !== null && numberOrNull(candidate.anchorSeq) === wantedAnchor;
      });
      if (match) pushSnippet(match);
    }
    if (context.length === 0 && fallback.length === 0) {
      const seq = numberOrNull(hit.seq);
      if (seq !== null) {
        try {
          const message = await DCS.api.message(
            hit.sessionId,
            seq,
            token.controller ? token.controller.signal : undefined,
          );
          if (message && message.found === true && typeof message.text === 'string') {
            const firstLine = message.text.split('\n').find((line) => line.trim() !== '') || message.text;
            pushFallback(firstLine);
          }
        } catch (error) {
          if (!token.cancelled && !(error && error.name === 'AbortError')) {
            DCS.log.debug('message enrichment failed; falling back to the query needle', error);
          }
        }
      }
    }
    return { context, fallback };
  }

  /** Open the bar in "jumping" state before the async pipeline starts. */
  function openForJump(payload) {
    const state = getState();
    if (!state.open) previousFocus = document.activeElement;
    cancelFullHistoryLoad();
    historyBindingRetries = 0;
    currentRecords = [];
    clearHighlights();
    clearFlash();
    findBarStore.update((snapshot) => ({
      ...snapshot,
      open: true,
      query: payload.query,
      caseSensitive: payload.caseSensitive === true,
      wholeWord: payload.wholeWord === true,
      focusToken: snapshot.focusToken + 1,
      status: 'jumping',
      matches: [],
      currentIndex: -1,
      message: '',
      messageParams: null,
      jumpProgress: { phase: 'opening', seq: null, targetSeq: payload.targetSeq },
      historyLoading: false,
      historyBaseSeq: null,
    }));
    startObservation();
  }

  /* ------------------------- collapsed-fold expansion --------------------- */

  /** Rows of the hit's turn, including rows currently inside collapsed folds. */
  function turnRowsIncludingHidden(hit) {
    const flow = activeFlow();
    const turn = numberOrNull(hit.turn);
    if (!flow || turn === null) return [];
    const rows = [];
    for (const row of flow.querySelectorAll(FIND_ROW_SELECTOR)) {
      if (row.isConnected && Number(row.dataset.chatTurn) === turn) rows.push(row);
    }
    return rows;
  }

  /** Whether a rendered row already exposes one of the given needles. */
  function rowContainsAnyNeedle(row, needles) {
    if (!row || !needles || needles.length === 0) return false;
    const text = rowVisibleText(row);
    if (text === '') return false;
    for (const needle of needles) {
      if (needle.length >= 4 && text.includes(needle)) return true;
    }
    return false;
  }

  /** Score how strongly one switch's visible card text matches the needles. */
  function toggleNeedleScore(button, cardRow, needleSet) {
    const scoreFor = (text, needle, weight) => {
      if (!text || !needle || needle.length < 4) return 0;
      if (text.includes(needle)) return weight * 10;
      const windows = [needle.slice(0, 32), needle.slice(0, 24), needle.slice(0, 16), needle.slice(0, 12)];
      for (const window of windows) {
        if (window.length >= 6 && text.includes(window)) return weight * 6;
      }
      if (needle.length > 20) {
        const middle = needle.slice(Math.max(0, Math.floor(needle.length / 2) - 6), Math.floor(needle.length / 2) + 6);
        if (middle.length >= 8 && text.includes(middle)) return weight * 4;
      }
      return 0;
    };
    const visibleText = rowVisibleText(cardRow);
    let score = 0;
    for (const needle of (needleSet && needleSet.context) || []) score = Math.max(score, scoreFor(visibleText, needle, 3));
    for (const needle of (needleSet && needleSet.fallback) || []) score = Math.max(score, scoreFor(visibleText, needle, 2));
    // Collapsed card bodies are still in the DOM (`hidden="until-found"`): use
    // the nearest small wrapper that contains the context text as a targeting
    // hint, so a tool card holding the indexed call wins over earlier cards
    // even when its header alone does not show the arguments.
    if (score < 30) {
      let node = button.parentElement;
      let depth = 0;
      while (node && depth < 6) {
        const hiddenText = normalizeForMatch(node.textContent || '');
        let hiddenScore = 0;
        for (const needle of (needleSet && needleSet.context) || []) hiddenScore = Math.max(hiddenScore, scoreFor(hiddenText, needle, 1));
        if (hiddenScore === 0) {
          for (const needle of (needleSet && needleSet.fallback) || []) hiddenScore = Math.max(hiddenScore, scoreFor(hiddenText, needle, 1));
        }
        if (hiddenScore > 0) {
          // Closer wrappers are the card itself; larger ancestors are weaker.
          score = Math.max(score, Math.max(1, 18 - depth * 2));
          break;
        }
        node = node.parentElement;
        depth += 1;
      }
    }
    return score;
  }

  /**
   * Collapsible switches of the hit's turn, in click order: rendered (outer)
   * switches first, then switches whose visible card text matches the context
   * needle (tool names/arguments often show in the collapsed header), then DOM
   * order. The official chat renders these as `div[aria-expanded]` or
   * `button[aria-expanded]` inside header rows, so the element tag is not
   * constrained; the owning turn is read from any `[data-chat-turn]` ancestor
   * (assistant-step rows included).
   */
  function collectExpandToggles(hit, needleSet, clicked) {
    const flow = activeFlow();
    if (!flow) return [];
    const turn = numberOrNull(hit.turn);
    const candidates = [];
    let index = 0;
    for (const button of flow.querySelectorAll(FIND_COLLAPSED_TOGGLE_SELECTOR)) {
      index += 1;
      if (!button || typeof button.getAttribute !== 'function' || typeof button.click !== 'function') continue;
      if (button.getAttribute('aria-expanded') !== 'false') continue;
      if (typeof button.hasAttribute === 'function' && button.hasAttribute('disabled')) continue;
      const turnRow = button.closest('[data-chat-turn]');
      if (!turnRow) continue;
      if (turn !== null && Number(turnRow.dataset.chatTurn) !== turn) continue;
      if (clicked.has(button)) continue;
      const cardRow = button.closest('[data-chat-anchor-key]') || turnRow;
      candidates.push({
        button,
        index,
        visible: DCS.dom.isRendered(button) ? 1 : 0,
        score: toggleNeedleScore(button, cardRow, needleSet),
      });
    }
    candidates.sort(
      (left, right) =>
        right.visible - left.visible || right.score - left.score || left.index - right.index,
    );
    return candidates;
  }

  /** The rendered step row a failed expand should fall back to. */
  function visibleTurnFallbackRow(hit) {
    const flow = activeFlow();
    const turn = numberOrNull(hit.turn);
    if (!flow || turn === null) return null;
    return pickFallbackRow(renderedRowsForTurn(flow, turn), hit.kind);
  }

  /**
   * Re-locate the precise target after a fold opened. The context needle wins;
   * when the rendered text only exposes the looser needles (markdown/tool-card
   * rendering differences), accept a loose match on a row other than the
   * look-alike row the patrol landed on before expanding.
   */
  function locateExpandedTarget(hit, needleSet, lookAlikeRow) {
    const contextFound = locateContextRow(hit, needleSet);
    if (contextFound) return contextFound;
    const fallbackNeedles = needleSet && Array.isArray(needleSet.fallback) ? needleSet.fallback : [];
    const looseFound = locateNeedleRows(hit, fallbackNeedles, lookAlikeRow || null);
    if (looseFound) return looseFound;
    // Without any needle the engine cannot disambiguate; keep the legacy
    // behaviour for payloads that only carry the bare query.
    if (needleSet && Array.isArray(needleSet.context) && needleSet.context.length > 0) return null;
    const legacy = resolveTargetRow(hit, needleSet);
    return legacy && legacy.matched ? legacy : null;
  }

  /** Fallback toast/message key by hit kind (tool output vs folded reasoning). */
  function fallbackMessageKey(hit) {
    return hit && hit.kind === 'tool' ? 'find.toolFallback' : 'find.expandedFallback';
  }

  /** Whether a row is a tool-call/tool-result row (the anchor a tool hit wants). */
  function isToolFlowRow(row) {
    const kind = row && row.dataset ? row.dataset.chatFlowKind || '' : '';
    return kind === 'tool-call' || kind === 'tool-result' || kind === 'tool';
  }

  /**
   * Fragment needles for content the transcript never renders in full: tool
   * output/arguments often survive only as a compact preview (command, tool
   * name) inside a tool row. Split the snippet on whitespace/punctuation, keep
   * 6–60 char fragments — 2/3-token merges first so `git status --short`
   * becomes matchable without its spaces — cap at 8, and prefer fragments that
   * carry the original query characters.
   */
  function buildLooseNeedles(hit) {
    const snippet = hit && typeof hit.snippet === 'string' ? hit.snippet.replace(/\u2026/g, ' ').trim() : '';
    if (snippet === '') return [];
    const tokens = snippet
      .split(/[\s`*_~#>|[\]()!，。：；、"'{}\-]+/u)
      .map((token) => normalizeForMatch(token))
      .filter((token) => token.length > 0);
    if (tokens.length === 0) return [];
    const queryNeedle = normalizeForMatch(normalizeQueryText(getState().query));
    const queryHead = queryNeedle.slice(0, Math.min(4, queryNeedle.length));
    const rank = (value) => {
      if (queryNeedle.length >= 2 && value.includes(queryNeedle)) return 2;
      if (queryHead.length >= 2 && value.includes(queryHead)) return 1;
      return 0;
    };
    const collected = [];
    const push = (value) => {
      if (!value) return;
      if (value.length < FIND_LOOSE_NEEDLE_MIN_CHARS) return;
      const trimmed =
        value.length > FIND_LOOSE_NEEDLE_MAX_CHARS ? value.slice(0, FIND_LOOSE_NEEDLE_MAX_CHARS) : value;
      if (!collected.includes(trimmed)) collected.push(trimmed);
    };
    for (let size = 3; size >= 2; size -= 1) {
      for (let index = 0; index + size <= tokens.length; index += 1) {
        push(tokens.slice(index, index + size).join(''));
      }
    }
    for (const token of tokens) push(token);
    collected.sort((left, right) => rank(right) - rank(left));
    return collected.slice(0, FIND_LOOSE_NEEDLE_LIMIT);
  }

  function getLooseNeedles(hit, needleSet) {
    if (needleSet && Array.isArray(needleSet.loose)) return needleSet.loose;
    const loose = buildLooseNeedles(hit);
    if (needleSet && typeof needleSet === 'object') needleSet.loose = loose;
    return loose;
  }

  /**
   * Last-resort row locator for hits whose text never reaches the transcript:
   * search the target turn's visible rows first, then every visible leaf row of
   * the active flow, for a loose snippet fragment. Kind-preferred (tool hits
   * favour tool-call/tool-result rows) and bounded by
   * FIND_LOOSE_ROW_SCAN_LIMIT so the probe stays inside its 1.5s budget.
   * @returns `{ ok: true, row, matched: true, looseFallback: true, fallbackKey }`.
   */
  function locateLooseRow(hit, needleSet) {
    const loose = getLooseNeedles(hit, needleSet);
    if (loose.length === 0) return null;
    const flow = activeFlow();
    if (!flow) return null;
    const caseSensitive = hit.caseSensitive === true;
    const fallbackKey = fallbackMessageKey(hit);
    const prepare = (rows) => {
      const prepared = [];
      for (const row of rows) {
        if (prepared.length >= FIND_LOOSE_ROW_SCAN_LIMIT) break;
        const text = rowVisibleText(row);
        if (text === '') continue;
        prepared.push({ row, text: caseSensitive ? text : text.toLowerCase() });
      }
      return prepared;
    };
    const pick = (prepared) => {
      for (const needle of loose) {
        const target = caseSensitive ? needle : needle.toLowerCase();
        const candidates = [];
        for (const item of prepared) {
          if (item.text.includes(target)) candidates.push(item.row);
        }
        const row = pickBestRow(candidates, hit.kind);
        if (row) return row;
      }
      return null;
    };
    const turn = numberOrNull(hit.turn);
    const turnRows = turn === null ? [] : renderedRowsForTurn(flow, turn);
    const turnFound = pick(prepare(turnRows));
    if (turnFound) return { ok: true, row: turnFound, matched: true, looseFallback: true, fallbackKey };
    const scanRows = [];
    for (const row of flow.querySelectorAll(FIND_ROW_SELECTOR)) {
      if (scanRows.length >= FIND_LOOSE_ROW_SCAN_LIMIT) break;
      if (!DCS.dom.isRendered(row)) continue;
      if (row.querySelector(FIND_ROW_SELECTOR) !== null) continue;
      scanRows.push(row);
    }
    const flowFound = pick(prepare(scanRows));
    if (flowFound) return { ok: true, row: flowFound, matched: true, looseFallback: true, fallbackKey };
    return null;
  }

  /**
   * Expand collapsed folds of the hit's turn until the *context* needle becomes
   * findable in a rendered row. Bounded by FIND_EXPAND_CLICK_LIMIT clicks,
   * FIND_EXPAND_SETTLE_MS per click and FIND_EXPAND_BUDGET_MS in total; the jump
   * token is checked before every step so cancel/close stops it immediately.
   * @returns `{ row, matched: true }` or null.
   */
  async function expandCollapsedTarget(hit, token, needleSet, lookAlikeRow) {
    if (turnRowsIncludingHidden(hit).length === 0) return null;
    const deadline = Date.now() + FIND_EXPAND_BUDGET_MS;
    const clicked = new WeakSet();
    for (let attempt = 0; attempt < FIND_EXPAND_CLICK_LIMIT; attempt += 1) {
      if (!tokenActive(token) || Date.now() >= deadline) return null;
      const candidates = collectExpandToggles(hit, needleSet, clicked);
      if (candidates.length === 0) {
        // No untouched switch left. The fold may still be animating/settling
        // (or a click already revealed the text): give it one grace window
        // before declaring the expand step a failure.
        const immediate = locateExpandedTarget(hit, needleSet, lookAlikeRow);
        if (immediate) return immediate;
        await sleep(FIND_EXPAND_SETTLE_MS);
        if (!tokenActive(token) || Date.now() >= deadline) return null;
        return locateExpandedTarget(hit, needleSet, lookAlikeRow);
      }
      const candidate = candidates[0];
      clicked.add(candidate.button);
      setJumpProgress({
        phase: 'expanding',
        seq: loadedBaseSeq(token.sessionId),
        targetSeq: token.targetSeq,
      });
      try {
        candidate.button.click();
      } catch (error) {
        DCS.log.debug('expand toggle click failed', error);
      }
      await sleep(FIND_EXPAND_SETTLE_MS);
      if (!tokenActive(token) || Date.now() >= deadline) return null;
      const resolved = locateExpandedTarget(hit, needleSet, lookAlikeRow);
      if (resolved) return resolved;
    }
    return null;
  }

  /**
   * Jump post-step for folded content. The trigger is the *context* needle's
   * visibility, not the bare query: a thinking/tool hit whose word also occurs
   * in visible body text must still expand, otherwise the jump lands on the
   * look-alike line. On failure the patrol result is kept (flagged
   * `expandFailed` when it was only a look-alike) so the caller can land on the
   * step and explain.
   */
  async function maybeExpandJumpTarget(hit, token, needleSet, baseResult) {
    if (!tokenActive(token)) return baseResult;
    const baseMatched = Boolean(baseResult && baseResult.ok && baseResult.matched);
    const baseRow = baseResult && baseResult.ok ? baseResult.row : null;
    const contextNeedles = (needleSet && needleSet.context) || [];
    const contextVisible = baseRow ? rowContainsAnyNeedle(baseRow, contextNeedles) : false;
    const collapsedKind = FIND_COLLAPSED_KINDS.has(hit.kind);
    // Only a collapsed kind may veto an already-matched visible row: for
    // ordinary kinds the context needle is a preference, not a requirement.
    const contextAmbiguous = collapsedKind && contextNeedles.length > 0 && baseMatched && !contextVisible;
    const needsExpansion = !baseMatched || contextAmbiguous;

    let result = baseResult;
    if (needsExpansion && turnRowsIncludingHidden(hit).length > 0) {
      const expanded = await expandCollapsedTarget(hit, token, needleSet, baseRow);
      if (!tokenActive(token)) return result;
      if (expanded) {
        result = { ok: true, row: expanded.row, matched: true, expanded: true };
      } else if (baseResult && baseResult.ok && baseResult.matched !== true) {
        result = { ...baseResult, expandFailed: true, fallbackKey: fallbackMessageKey(hit) };
      } else if (baseResult && baseResult.ok && contextAmbiguous) {
        // The visible look-alike is not the indexed hit: land on the step row.
        const stepRow = visibleTurnFallbackRow(hit) || baseRow;
        result = {
          ...baseResult,
          matched: false,
          row: stepRow,
          expandFailed: true,
          fallbackKey: fallbackMessageKey(hit),
        };
      }
    }
    if (!tokenActive(token)) return result;

    // Loose-needle fallback: tool output/arguments may never be rendered in
    // full, but a compact row keeps a recognisable preview (the command, the
    // tool name). Land that row instead of an unrelated step.
    const landedRow = result && result.ok ? result.row : null;
    const landedKindOk = landedRow
      ? hit.kind === 'tool'
        ? isToolFlowRow(landedRow)
        : rowKindScore(landedRow, hit.kind) > 0
      : false;
    const needsLoose =
      !result ||
      !result.ok ||
      result.matched !== true ||
      result.expandFailed === true ||
      (hit.kind === 'tool' && !landedKindOk);
    if (needsLoose) {
      const deadline = Date.now() + FIND_LOOSE_BUDGET_MS;
      const loose = locateLooseRow(hit, needleSet);
      if (!tokenActive(token)) return result;
      const looseKindOk = loose
        ? hit.kind === 'tool'
          ? isToolFlowRow(loose.row)
          : rowKindScore(loose.row, hit.kind) > 0
        : false;
      const betterThanCurrent =
        loose !== null &&
        Date.now() <= deadline &&
        (!result || !result.ok || result.matched !== true || result.expandFailed === true || looseKindOk);
      if (betterThanCurrent) return loose;
    }
    return result;
  }

  /** Mirrors `normalizeForMatch` while keeping normalized-index → raw-offset map. */
  function normalizeRowWithMap(raw) {
    const collapsed = collapseRowRaw(raw, true);
    let text = '';
    const map = [];
    for (let index = 0; index < collapsed.text.length; index += 1) {
      const char = collapsed.text.charAt(index);
      if (FIND_NORMALIZE_NOISE_CHAR_RE.test(char)) continue;
      text += char;
      map.push(collapsed.map[index]);
    }
    return { text, map };
  }

  /** First normalized-text index whose raw offset is >= `rawIndex` (map ascending). */
  function normalizedIndexForRaw(map, rawIndex) {
    let low = 0;
    let high = map.length - 1;
    let result = map.length;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (map[middle] >= rawIndex) {
        result = middle;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }
    return result;
  }

  /**
   * Choose the query match that belongs to the context needle (the target
   * occurrence), not just the first match in the row. Used after expanding a
   * fold so `currentIndex`/the revealed Range point at the indexed hit.
   */
  function findContextMatchIndex(records, row, contextNeedles) {
    if (!row || !Array.isArray(records) || records.length === 0) return -1;
    if (!contextNeedles || contextNeedles.length === 0) return -1;
    const rowIndices = [];
    for (let index = 0; index < records.length; index += 1) {
      if (records[index].row === row) rowIndices.push(index);
    }
    if (rowIndices.length === 0) return -1;
    if (rowIndices.length === 1) return rowIndices[0];
    let segments = null;
    try {
      segments = collectRowSegments(row);
    } catch (error) {
      segments = null;
    }
    if (!segments) return rowIndices[0];
    const normalized = normalizeRowWithMap(segments.raw);
    if (!normalized.text) return rowIndices[0];
    let best = -1;
    let bestDistance = Infinity;
    for (const needle of contextNeedles) {
      let from = 0;
      for (;;) {
        const at = normalized.text.indexOf(needle, from);
        if (at < 0) break;
        const middle = at + Math.floor(needle.length / 2);
        for (const index of rowIndices) {
          const record = records[index];
          const rawStart = typeof record.rawStart === 'number' ? record.rawStart : -1;
          const position = rawStart >= 0 ? normalizedIndexForRaw(normalized.map, rawStart) : -1;
          const distance = position < 0 ? Infinity : Math.abs(position - middle);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
          }
        }
        from = at + Math.max(1, needle.length);
      }
    }
    return best;
  }

  /** Apply the final outcome of one jump to the bar. */
  function applyJumpResult(token, result, hit, needleSet) {
    if (!result || !result.ok) {
      const reason = result ? result.reason : 'timeout';
      if (reason === 'cancelled' || reason === 'superseded') return;
      const yielded = reason === 'user' || reason === 'typing';
      findBarStore.update((snapshot) => ({
        ...snapshot,
        status: yielded ? 'idle' : 'not-found',
        jumpProgress: null,
        message: '',
        messageParams: null,
      }));
      rescan({ scroll: false });
      if (yielded) return; // the user scrolled or started typing: just yield
      if (token.loadError) {
        showToast({ text: t('find.failed', { message: token.loadError }), tone: 'error' });
      } else {
        showToast({ text: t('find.notFound'), tone: 'error' });
      }
      return;
    }

    findBarStore.update((snapshot) => ({
      ...snapshot,
      status: result.expandFailed ? 'landed' : result.matched ? 'landed' : 'not-found',
      jumpProgress: null,
      message: '',
      messageParams: null,
    }));
    flashRow(result.row);
    rescan({ preferRow: result.row, strictPreferRow: true, scroll: false });
    const snapshot = getState();
    const fallbackKey = result.fallbackKey || fallbackMessageKey(hit);
    const usedFallback = result.expandFailed === true || result.looseFallback === true;
    let landingIndex = snapshot.currentIndex;
    // The query alone is ambiguous ("Let me" in both reasoning and body): pick
    // the match whose neighbourhood carries the context needle instead of the
    // first match of the row.
    if (
      result.matched &&
      !result.looseFallback &&
      landingIndex >= 0 &&
      needleSet &&
      Array.isArray(needleSet.context) &&
      needleSet.context.length > 0
    ) {
      const contextIndex = findContextMatchIndex(currentRecords, result.row, needleSet.context);
      if (contextIndex >= 0 && contextIndex !== landingIndex) {
        landingIndex = contextIndex;
        findBarStore.update((current) => ({ ...current, currentIndex: contextIndex }));
        paintHighlights(currentRecords, currentRecords[contextIndex]);
      }
    }
    let message = snapshot.message;
    let messageParams = snapshot.messageParams;
    if (usedFallback) {
      // Collapsed content / tool output we cannot render: explain where the
      // hit actually is instead of pretending the message disappeared.
      message = fallbackKey;
      messageParams = null;
    } else if (!result.matched) {
      message = 'find.notFound';
      messageParams = null;
    } else if (landingIndex < 0 && snapshot.matches.length > 0) {
      message = 'find.extra.noMatchInRow';
      messageParams = null;
    }
    findBarStore.update((current) => ({ ...current, message, messageParams }));
    paintHighlights(currentRecords, landingIndex >= 0 ? currentRecords[landingIndex] : null);
    if (usedFallback) {
      // Land the row itself; when the row still exposes the original query,
      // reveal that occurrence at the top so the reader sees the preview text.
      if (landingIndex >= 0) revealRecord(currentRecords[landingIndex], 'top');
      else if (result.row) DCS.dom.revealRange(null, result.row, { align: 'top' });
      showToast({ text: t(fallbackKey), tone: 'info' });
    } else if (!result.matched) {
      showToast({ text: t('find.notFound'), tone: 'error' });
    } else if (landingIndex >= 0) {
      // Jump landing: the first visible line should be the matched text.
      revealRecord(currentRecords[landingIndex], 'top');
    } else if (result.row) {
      DCS.dom.revealRange(null, result.row, { align: 'top' });
    }
    if (hit && typeof hit.title === 'string' && hit.title !== '') {
      DCS.log.debug('landed hit in session', hit.title);
    }
  }

  /**
   * Jump to one indexed hit: open the session, page history, patrol-land the
   * row, then adopt it as the find bar's current match.
   * Published as `DCS.handlers.jumpToHit`.
   */
  async function jumpToHit(hit) {
    if (!hit || typeof hit.sessionId !== 'string' || hit.sessionId === '') return;
    if (hit.surface === 'shadowed') {
      cancelActiveJump({ silent: true });
      showToast({ text: t('find.notFound'), tone: 'error' });
      return;
    }
    // A jump may start from the sidebar panel page, which covers the
    // conversation. Even when the target session is already the main view no
    // `openSession` runs, so the transcript would never become visible and the
    // landing patrol would time out. Return to the Conversation first.
    try {
      if (ctx.layout.panelInfo.getSnapshot().activePanelId !== null) ctx.layout.selectPanel(null);
    } catch (error) {
      DCS.log.debug('could not leave the panel page before jumping', error);
    }
    const sessionId = hit.sessionId;
    const targetSeq = numberOrNull(hit.anchorSeq) !== null ? numberOrNull(hit.anchorSeq) : numberOrNull(hit.seq);
    const query =
      typeof hit.query === 'string' && hit.query !== ''
        ? hit.query
        : typeof hit.text === 'string'
          ? hit.text
          : '';
    cancelFullHistoryLoad();
    historyBindingRetries = 0;
    const token = beginJumpToken();
    token.sessionId = sessionId;
    token.targetSeq = targetSeq;
    openForJump({
      query,
      caseSensitive: hit.caseSensitive === true,
      wholeWord: hit.wholeWord === true,
      targetSeq,
    });
    const needleSetPromise = buildNeedles(hit, token).catch(() => emptyNeedleSet());
    try {
      if (currentSessionId() !== sessionId) {
        DCS.sessions.open(ctx, sessionId);
        await DCS.sessions.waitForMainView(ctx, sessionId, {
          timeoutMs: FIND_OPEN_TIMEOUT_MS,
          signal: token.controller ? token.controller.signal : undefined,
        });
        // Give React one commit to swap the conversation view's DOM before the
        // probe walks rows: a stale previous-session flow would otherwise answer
        // with a same-numbered turn from the wrong transcript.
        if (tokenActive(token)) await sleep(120);
      }
      if (!tokenActive(token)) return;
      const flowReady = await waitForFlow(token, FIND_FLOW_READY_TIMEOUT_MS);
      if (!tokenActive(token)) return;
      if (!flowReady) {
        applyJumpResult(token, { ok: false, reason: 'timeout' }, hit);
        return;
      }
      const needleSet = await needleSetPromise;
      if (!tokenActive(token)) return;
      setJumpProgress({ phase: 'loading', seq: loadedBaseSeq(sessionId), targetSeq });
      // Probe before paging: if the user already loaded this part of the
      // transcript, the row is in the DOM and loadThrough must not run.
      const probe = resolveTargetRow(hit, needleSet);
      if (!(probe && probe.row)) startHistoryLoad(token);
      const result = await patrolTarget(hit, token, needleSet);
      if (!tokenActive(token)) return;
      // Collapsed thinking/tool content: after the history load settled, try
      // expanding the hit's turn before giving up on the exact text. The
      // trigger is the context needle's visibility (a same word in body text
      // must not satisfy a reasoning/tool hit).
      const settled = await maybeExpandJumpTarget(hit, token, needleSet, result);
      if (!tokenActive(token)) return;
      applyJumpResult(token, settled, hit, needleSet);
    } catch (error) {
      if (token.cancelled || !tokenActive(token)) return;
      if (error && error.name === 'AbortError') return;
      DCS.log.warn('jump to hit failed', error);
      clearFlash();
      findBarStore.update((snapshot) => ({ ...snapshot, status: 'failed', jumpProgress: null }));
      showToast({ text: t('find.failed', { message: errorText(error) }), tone: 'error' });
    } finally {
      token.clear();
      if (activeJump === token) activeJump = null;
      // The jump paged exactly up to its target; top up the rest of history
      // once the bar is settled and no longer jumping.
      if (getState().open) scheduleFullHistoryLoad(FIND_HISTORY_JUMP_DELAY_MS);
    }
  }

  /* ------------------------------ open / close ---------------------------- */

  function focusInputSoon() {
    const attempt = () => {
      if (!inputElement) return;
      if (document.activeElement === inputElement) return;
      DCS.dom.focus(inputElement);
      try {
        inputElement.select();
      } catch (error) {
        DCS.log.debug('select find input failed', error);
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(attempt));
    } else {
      setTimeout(attempt, 0);
    }
    // Safety net for a slow first slot render: retry once after the commit.
    setTimeout(attempt, 120);
  }

  /** Open (or refocus) the find bar. Published as `DCS.handlers.openFindBar`. */
  function openFindBar(query, options) {
    const opts = options || {};
    if (activeJump !== null) cancelActiveJump({ silent: true, keepUi: true });
    cancelFullHistoryLoad();
    historyBindingRetries = 0;
    const state = getState();
    if (!state.open) previousFocus = document.activeElement;
    const nextQuery = typeof query === 'string' ? query : state.query;
    findBarStore.update((snapshot) => ({
      ...snapshot,
      open: true,
      query: nextQuery,
      caseSensitive: typeof opts.caseSensitive === 'boolean' ? opts.caseSensitive : snapshot.caseSensitive,
      wholeWord: typeof opts.wholeWord === 'boolean' ? opts.wholeWord : snapshot.wholeWord,
      focusToken: snapshot.focusToken + 1,
      status: 'idle',
      message: '',
      messageParams: null,
      jumpProgress: null,
    }));
    startObservation();
    rescan({ scroll: nextQuery.trim() !== '' });
    focusInputSoon();
    // Search the whole conversation, not just the initial tail window.
    scheduleFullHistoryLoad(FIND_HISTORY_OPEN_DELAY_MS);
    return true;
  }

  /** Close the bar: stop jumping, drop highlights/flash, restore focus. */
  function closeFindBar() {
    cancelActiveJump({ silent: true, keepUi: true });
    cancelFullHistoryLoad();
    historyBindingRetries = 0;
    const state = getState();
    const focusWasInside =
      barElement !== null &&
      document.activeElement instanceof Node &&
      typeof barElement.contains === 'function' &&
      barElement.contains(document.activeElement);
    const restoreTarget = previousFocus && previousFocus.isConnected ? previousFocus : null;
    previousFocus = null;
    clearFlash();
    clearHighlights();
    stopObservation();
    currentRecords = [];
    clearToast();
    findBarStore.update((snapshot) => ({
      ...snapshot,
      open: false,
      status: 'idle',
      matches: [],
      currentIndex: -1,
      message: '',
      messageParams: null,
      jumpProgress: null,
      historyLoading: false,
      historyBaseSeq: null,
    }));
    if (focusWasInside) {
      if (restoreTarget) DCS.dom.focus(restoreTarget);
      else if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    }
    return true;
  }

  function setQuery(value) {
    const next = String(value == null ? '' : value);
    if (getState().query === next) return;
    if (getState().status === 'jumping') cancelActiveJump({ silent: true, keepUi: true });
    clearFlash();
    findBarStore.update((snapshot) => ({
      ...snapshot,
      query: next,
      status: 'idle',
      message: '',
      messageParams: null,
      jumpProgress: null,
    }));
    if (composing) return;
    scheduleRescan(FIND_TYPE_DEBOUNCE_MS);
  }

  function setComposing(value) {
    composing = value === true;
    if (!composing) scheduleRescan(0);
  }

  function toggleOption(name) {
    if (name !== 'caseSensitive' && name !== 'wholeWord') return;
    if (getState().status === 'jumping') cancelActiveJump({ silent: true, keepUi: true });
    clearFlash();
    const previousRecord = currentRecord();
    const previousIndex = getState().currentIndex;
    findBarStore.update((snapshot) => ({
      ...snapshot,
      [name]: !snapshot[name],
      status: 'idle',
      message: '',
      messageParams: null,
      jumpProgress: null,
    }));
    rescan({ previousRecord, previousIndex, scroll: true });
  }

  /* -------------------------------- keyboard ------------------------------ */

  function hasBlockingDialog() {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"], [aria-modal="true"][role="dialog"]');
    if (!dialog) return false;
    if (barElement !== null && typeof barElement.contains === 'function' && barElement.contains(dialog)) return false;
    return !dialog.contains(barElement);
  }

  function onKeydown(event) {
    if (!event || event.defaultPrevented === true) return;
    if (event.isComposing === true || event.keyCode === 229) return;

    const mod = event.metaKey || event.ctrlKey;
    if (mod && !event.altKey && !event.shiftKey && (event.key === 'f' || event.key === 'F')) {
      if (hasBlockingDialog()) return;
      event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      if (!getState().open) {
        const state = getState();
        openFindBar(state.query, { caseSensitive: state.caseSensitive, wholeWord: state.wholeWord });
      } else {
        findBarStore.update((snapshot) => ({ ...snapshot, focusToken: snapshot.focusToken + 1 }));
        startObservation();
      }
      return;
    }

    if (!getState().open) return;

    if (event.key === 'Escape') {
      if (hasBlockingDialog()) return;
      event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      closeFindBar();
      return;
    }

    if (event.key === 'Enter') {
      const isInputTarget =
        inputElement !== null && event.target === inputElement
          ? true
          : inputElement !== null && event.target instanceof Node && inputElement.contains(event.target);
      if (!isInputTarget) return;
      event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      navigate(event.shiftKey ? -1 : 1);
    }
  }

  /* ------------------------------- runtime API ---------------------------- */

  const runtime = {
    store: findBarStore,
    cancelJump: () => {
      // User cancel (requirements §4.1): stop paging feedback, stay exactly
      // where the reader is, and leave no highlight behind — closing the bar
      // clears the CSS highlight ranges and the row flash. A toast confirms it.
      const wasJumping = cancelActiveJump({ silent: true });
      closeFindBar();
      if (wasJumping) showToast({ text: t('find.cancelled'), tone: 'info' });
    },
    close: () => {
      closeFindBar();
    },
    navigate: (delta) => {
      navigate(delta > 0 ? 1 : -1);
    },
    open: openFindBar,
    jumpToHit,
    setQuery,
    setComposing,
    toggleOption,
    getInputElement: () => inputElement,
    getBarElement: () => barElement,
    setInputElement: (node) => {
      inputElement = node;
    },
    setBarElement: (node) => {
      barElement = node;
    },
    showToast,
    clearToast,
  };
  findBarRuntime = runtime;

  /* ------------------------------- lifecycle ------------------------------ */

  // The slot registration is owned by `slots.inject`; the callback returns the
  // disposer of `slots.register` for the declaration's lifetime.
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'conversation-search-findbar',
        locale: DCS.NS,
      },
      FindBarOverlay,
    ),
  );

  DCS.handlers.jumpToHit = jumpToHit;
  DCS.handlers.openFindBar = openFindBar;
  DCS.handlers.toast = showToast;

  function dispose() {
    stopObservation();
    cancelFullHistoryLoad({ keepUi: true });
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    cancelActiveJump({ silent: true, keepUi: true });
    clearFlash();
    clearHighlights();
    currentRecords = [];
    needleCache.clear();
    findBarToastStore.set({ id: ++toastSerial, text: '', tone: 'info' });
    if (DCS.handlers.jumpToHit === jumpToHit) delete DCS.handlers.jumpToHit;
    if (DCS.handlers.openFindBar === openFindBar) delete DCS.handlers.openFindBar;
    if (DCS.handlers.toast === showToast) delete DCS.handlers.toast;
    findBarRuntime = null;
    inputElement = null;
    barElement = null;
  }

  ctx.effect(() => {
    window.addEventListener('keydown', onKeydown, true);
    return () => {
      window.removeEventListener('keydown', onKeydown, true);
      dispose();
    };
  }, 'conversation-search: find bar runtime');

  return {
    store: findBarStore,
    toastStore: findBarToastStore,
    jumpToHit,
    openFindBar,
    closeFindBar,
    showToast,
    getState: () => getState(),
  };
};

    /* ===== client/src/90-apply.js ===== */
/* ------------------------------------------------------------------------- *
 * dsh-conversation-search — client entry (part 90).
 *
 * Wires the shared runtime to the Host GUI: registers dictionaries, injects
 * the stylesheet, then starts the sidebar search panel and the floating
 * in-conversation find bar. The bundle factory is created by build-client.mjs;
 * this file only defines the apply() the factory returns.
 * ------------------------------------------------------------------------- */

/** Client services this plugin needs before it may activate. */
const inject = ['slots', 'locale', 'layout', 'sessions', 'uiWorkspace'];

/**
 * Mount both halves of the browser UI.
 * @param ctx - client root context.
 */
function apply(ctx) {
  DCS.ctx = ctx;

  ctx.effect(
    () => ctx.locale.register(DCS.NS, { zh: DCS.zh, en: DCS.en }),
    'conversation-search: dictionaries',
  );
  try {
    DCS.t = ctx.locale.bind(DCS.NS);
  } catch (error) {
    DCS.log.warn('locale binding failed, falling back to keys', error);
  }

  ctx.effect(() => {
    DCS.injectStyles();
    return () => {
      const tag = DCS.styleTag;
      DCS.styleTag = null;
      if (tag && tag.isConnected) tag.remove();
    };
  }, 'conversation-search: styles');

  // Optional highlighter overrides: a reader can set the CSS variables from
  // devtools/localStorage and keep their own marker colour after a reload.
  //   localStorage.setItem('dsh-conversation-search.highlight',
  //     JSON.stringify({ matchBg: '#fff59d', currentBg: '#ffd54f', currentFg: '#241d00', flash: '#ffb300' }))
  const HIGHLIGHT_VARS = {
    matchBg: '--dcs-find-match-bg',
    currentBg: '--dcs-find-current-bg',
    currentFg: '--dcs-find-current-fg',
    flash: '--dcs-jump-flash',
  };
  ctx.effect(() => {
    let overrides = null;
    try {
      const raw = window.localStorage ? window.localStorage.getItem('dsh-conversation-search.highlight') : null;
      overrides = raw ? JSON.parse(raw) : null;
    } catch (error) {
      overrides = null;
    }
    const root = document.documentElement;
    const applied = [];
    if (overrides && typeof overrides === 'object') {
      for (const [key, variable] of Object.entries(HIGHLIGHT_VARS)) {
        const value = overrides[key];
        if (typeof value !== 'string' || value.trim() === '') continue;
        root.style.setProperty(variable, value.trim());
        applied.push(variable);
      }
    }
    return () => {
      for (const variable of applied) root.style.removeProperty(variable);
    };
  }, 'conversation-search: highlight overrides');

  // Keep both part controllers on the runtime namespace: debugging aids and the
  // handles the browser-side smoke test and manual probes use.
  DCS.panelApi = DCS.startSearchPanel(ctx);
  DCS.findBarApi = DCS.startFindBar(ctx);

  DCS.log.info('client mounted');
}

    return { inject, apply };
  },
});
