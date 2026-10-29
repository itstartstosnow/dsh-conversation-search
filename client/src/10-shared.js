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
