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
