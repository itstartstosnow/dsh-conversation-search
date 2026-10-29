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
