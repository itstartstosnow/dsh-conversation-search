/**
 * Client bundle smoke test.
 *
 * The browser half only exists as one generated bundle executed by the Web
 * Client module loader, so this test reproduces just enough of that
 * environment (module-loader capture, React, DOM, Client services) to prove:
 *
 * - the bundle parses and registers exactly one factory under the package id;
 * - `apply(ctx)` runs end to end without touching missing APIs;
 * - every slot registration the two UI parts own is installed with the
 *   documented options (sidebar row, main page, frame overlay);
 * - the published cross-part handlers exist after apply;
 * - both locale dictionaries carry the same keys and the stylesheet is
 *   installed once;
 * - disposing every effect leaves no handler behind.
 *
 * It does not render React components; visual verification belongs to the
 * live GUI.
 *
 * Run with: node --test tests/client-smoke.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const bundlePath = join(root, 'client.js')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/* ------------------------------- fake DOM -------------------------------- */

function createElement(tagName) {
  const element = {
    tagName: String(tagName).toUpperCase(),
    nodeType: 1,
    style: {},
    dataset: {},
    childNodes: [],
    children: [],
    attributes: {},
    isConnected: true,
    classList: {
      set: new Set(),
      add(...names) {
        for (const name of names) this.set.add(name)
      },
      remove(...names) {
        for (const name of names) this.set.delete(name)
      },
      contains(name) {
        return this.set.has(name)
      },
    },
    textContent: '',
    parentElement: null,
    appendChild(child) {
      this.childNodes.push(child)
      this.children.push(child)
      child.parentElement = this
      return child
    },
    append(...nodes) {
      for (const node of nodes) this.appendChild(node)
    },
    remove() {
      this.isConnected = false
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value)
    },
    getAttribute(name) {
      return this.attributes[name] ?? null
    },
    removeAttribute(name) {
      delete this.attributes[name]
    },
    hasAttribute(name) {
      return Object.hasOwn(this.attributes, name)
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() {
      return null
    },
    querySelectorAll() {
      return []
    },
    closest() {
      return null
    },
    getBoundingClientRect() {
      return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
    },
    getClientRects() {
      return []
    },
    focus() {},
    scrollTo() {},
    get offsetHeight() {
      return 0
    },
    get offsetWidth() {
      return 0
    },
    get clientHeight() {
      return 0
    },
    get scrollTop() {
      return 0
    },
    set scrollTop(_value) {},
  }
  return element
}

function createFakeDom() {
  const head = createElement('head')
  const body = createElement('body')
  const documentElement = createElement('html')
  const listeners = new Map()
  const document = {
    head,
    body,
    documentElement,
    scrollingElement: documentElement,
    title: 'test',
    activeElement: null,
    createElement,
    createTextNode: (text) => ({ nodeType: 3, nodeValue: String(text), parentElement: null }),
    createTreeWalker() {
      return { nextNode: () => null }
    },
    querySelector() {
      return null
    },
    querySelectorAll() {
      return []
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(handler)
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler)
    },
    getElementById() {
      return null
    },
  }
  return { document, head, body, documentElement, listeners }
}

/* ------------------------------ fake React ------------------------------- */

function createFakeReact() {
  const noopHook = (value) => (typeof value === 'function' ? value() : value)
  return {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children }
    },
    Fragment: Symbol('Fragment'),
    useState: (initial) => [noopHook(initial), () => {}],
    useReducer: (reducer, initial) => [noopHook(initial), () => {}],
    useEffect() {},
    useLayoutEffect() {},
    useInsertionEffect() {},
    useMemo: (factory) => factory(),
    useCallback: (callback) => callback,
    useRef: (initial) => ({ current: initial ?? null }),
    useContext: (context) => context,
    useId: () => 'test-id',
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
    useTransition: () => [false, (fn) => fn()],
    useDeferredValue: (value) => value,
    memo: (component) => component,
    forwardRef: (render) => render,
    startTransition: (fn) => fn(),
    children: { toArray: (value) => [value] },
  }
}

/* ------------------------------ fake client ------------------------------ */

function createFakeContext() {
  /** @type {{name: string, options: any, component: any}[]} */
  const registrations = []
  /** @type {string[]} */
  const injectedSlotKeys = []
  /** @type {Map<string, Map<string, Record<string, string>>>} */
  const dictionaries = new Map()
  const disposers = []
  const panelInfo = {
    getSnapshot: () => ({ activePanelId: null }),
    subscribe: () => () => {},
  }
  const sessionsList = {
    getSnapshot: () => ({ phase: 'ready', ids: [], byId: {} }),
    subscribe: () => () => {},
  }
  const slots = {
    inject(key, callback) {
      injectedSlotKeys.push(key)
      const dispose = callback()
      const cleanup = typeof dispose === 'function' ? dispose : () => {}
      disposers.push(cleanup)
      return cleanup
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
    entriesOfSlot: () => [],
    entries: () => [],
    subscribe: () => () => {},
    declare: () => () => {},
  }
  const locale = {
    register(namespace, dicts) {
      dictionaries.set(namespace, dicts)
      return () => dictionaries.delete(namespace)
    },
    bind(namespace) {
      return (key, params) => {
        const dicts = dictionaries.get(namespace)
        const template = dicts?.zh?.[key] ?? key
        if (!params) return template
        return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
      }
    },
    subscribe: () => () => {},
    getSnapshot: () => ({ active: 'zh' }),
    getLocale: () => ({ active: 'zh' }),
    setLocale() {},
  }
  const ctx = {
    slots,
    locale,
    layout: {
      selectPanel() {},
      panelInfo,
      beginNavigation: () => new AbortController().signal,
      toggleSidebar() {},
    },
    sessions: {
      list: sessionsList,
      binding: () => undefined,
      scope: () => undefined,
      retainInfo: () => ({ getSnapshot: () => ({ referenceCount: 0 }), subscribe: () => () => {} }),
      retain() {
        throw new Error('client-smoke: retain is not used during apply')
      },
      search: async () => ({ ok: true, value: { items: [], hasMore: false } }),
      fork: async () => 'fork',
    },
    uiWorkspace: {
      openSession() {},
      startSession() {},
      archiveSession: async () => {},
      unarchiveSession: async () => {},
    },
    effect(callback) {
      const dispose = callback()
      const cleanup = typeof dispose === 'function' ? dispose : () => {}
      disposers.push(cleanup)
      return cleanup
    },
    on() {
      return () => {}
    },
    get() {
      return undefined
    },
    reflect: { provide: () => () => {} },
    interval() {
      return () => {}
    },
    timeout() {
      return () => {}
    },
    debounce: (fn) => fn,
    throttle: (fn) => fn,
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  }
  return {
    ctx,
    registrations,
    injectedSlotKeys,
    dictionaries,
    disposeAll() {
      for (const dispose of disposers.splice(0)) dispose()
    },
    registrationDisposers: disposers,
  }
}

/* -------------------------------- harness -------------------------------- */

/**
 * Execute client.js in a vm with a test-only tail that exposes the bundle's
 * internal DCS namespace, mirroring what the loader factory holds.
 */
function loadBundle() {
  const source = readFileSync(bundlePath, 'utf8')
  const instrumented = source.replace(
    'return { inject, apply };',
    'return { inject, apply, DCS };',
  )
  if (instrumented === source) {
    throw new Error('client-smoke: could not instrument the bundle footer; did build-client change?')
  }

  let captured = null
  const dom = createFakeDom()
  const windowListeners = new Map()
  const window = {
    __ModuleLoader__: {
      load(definition) {
        captured = definition
      },
    },
    document: dom.document,
    innerWidth: 1440,
    innerHeight: 900,
    scrollY: 0,
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set())
      windowListeners.get(type).add(handler)
    },
    removeEventListener(type, handler) {
      windowListeners.get(type)?.delete(handler)
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    scrollTo() {},
    getComputedStyle: () => ({ overflowY: 'visible' }),
  }
  const highlights = new Map()
  class Highlight {
    constructor(...ranges) {
      this.ranges = ranges
    }
  }
  const sandbox = {
    window,
    document: dom.document,
    console: {
      debug() {},
      info() {},
      warn() {},
      error(...args) {
        throw new Error('client-smoke: unexpected console.error: ' + args.map(String).join(' '))
      },
    },
    CSS: {
      highlights: {
        set(name, highlight) {
          highlights.set(name, highlight)
        },
        get(name) {
          return highlights.get(name)
        },
        delete(name) {
          return highlights.delete(name)
        },
        has(name) {
          return highlights.has(name)
        },
      },
    },
    Highlight,
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
    MutationObserver: class {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    AbortController,
    AbortSignal,
    Intl,
    URL,
    URLSearchParams,
    DOMException,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
    fetch: async () => {
      throw new Error('client-smoke: unexpected fetch during apply')
    },
    matchMedia: window.matchMedia,
    getComputedStyle: window.getComputedStyle,
    navigator: { language: 'zh-CN' },
    location: { href: 'http://localhost:62504/' },
    globalThis: null,
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(instrumented, sandbox, { filename: 'client.js' })
  return { definition: captured, sandbox, dom, windowListeners, highlights }
}

function makeRequire() {
  const react = createFakeReact()
  return (id) => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx: react.createElement, jsxs: react.createElement, Fragment: react.Fragment }
    throw new Error('client-smoke: unexpected module request "' + id + '"')
  }
}

/* --------------------------------- tests --------------------------------- */

test('bundle registers one factory under the package id and exports apply', () => {
  const { definition } = loadBundle()
  assert.ok(definition, 'window.__ModuleLoader__.load was not called')
  assert.equal(definition.id, manifest.name)
  const exports = definition.factory(makeRequire())
  assert.equal(typeof exports.apply, 'function')
  assert.ok(Array.isArray(exports.inject))
  for (const service of ['slots', 'locale', 'layout', 'sessions', 'uiWorkspace']) {
    assert.ok(exports.inject.includes(service), `apply injects ${service}`)
  }
})

test('apply mounts the sidebar row, the main page and the frame overlay', () => {
  const { definition } = loadBundle()
  const exports = definition.factory(makeRequire())
  const fake = createFakeContext()
  exports.apply(fake.ctx)

  const names = fake.registrations.map((entry) => entry.options.name)
  assert.ok(names.includes('sidebar.panellist'), 'sidebar row registered')
  assert.ok(names.includes('main'), 'main page registered')
  assert.ok(names.includes('shell.overlay'), 'find bar overlay registered')

  const row = fake.registrations.find((entry) => entry.options.name === 'sidebar.panellist')
  assert.equal(row.options.id, 'conversation-search')
  assert.equal(row.options.locale, 'conversation-search')
  assert.equal(typeof row.options.order, 'number')
  assert.equal(typeof row.options.label, 'function')
  assert.equal(typeof row.options.label(), 'string')

  const page = fake.registrations.find((entry) => entry.options.name === 'main')
  assert.equal(page.options.key, 'conversation-search')
  assert.equal(page.options.locale, 'conversation-search')

  const overlay = fake.registrations.find((entry) => entry.options.name === 'shell.overlay')
  assert.equal(overlay.options.locale, 'conversation-search')

  for (const entry of fake.registrations) {
    assert.equal(typeof entry.component, 'function', `${entry.options.name} has a component`)
  }
})

test('apply publishes the cross-part handlers the panel and jump engine share', () => {
  const { definition } = loadBundle()
  const exports = definition.factory(makeRequire())
  const fake = createFakeContext()
  exports.apply(fake.ctx)
  const { DCS } = exports
  assert.equal(typeof DCS.handlers.jumpToHit, 'function', 'jumpToHit published')
  assert.equal(typeof DCS.handlers.openFindBar, 'function', 'openFindBar published')
  assert.equal(typeof DCS.handlers.toast, 'function', 'toast published')

  // dispose everything the plugin registered and confirm the handlers go away
  fake.disposeAll()
  assert.equal(DCS.handlers.jumpToHit, undefined)
  assert.equal(DCS.handlers.openFindBar, undefined)
})

test('both locale dictionaries are registered with the same key set', () => {
  const { definition } = loadBundle()
  const exports = definition.factory(makeRequire())
  const fake = createFakeContext()
  exports.apply(fake.ctx)
  const dicts = fake.dictionaries.get('conversation-search')
  assert.ok(dicts, 'locale namespace registered')
  assert.ok(dicts.zh && dicts.en, 'zh and en dictionaries registered')
  const zhKeys = new Set(Object.keys(dicts.zh))
  const enKeys = new Set(Object.keys(dicts.en))
  const missingInEn = [...zhKeys].filter((key) => !enKeys.has(key))
  const missingInZh = [...enKeys].filter((key) => !zhKeys.has(key))
  assert.deepEqual(missingInEn, [], 'en carries every zh key')
  assert.deepEqual(missingInZh, [], 'zh carries every en key')
  for (const key of ['panel.title', 'panel.placeholder', 'find.placeholder', 'find.notFound']) {
    assert.ok(zhKeys.has(key), `dictionary has ${key}`)
  }
})

test('the stylesheet is injected once and carries highlight rules', () => {
  const { definition, dom } = loadBundle()
  const exports = definition.factory(makeRequire())
  const fake = createFakeContext()
  exports.apply(fake.ctx)
  const styleTags = dom.head.childNodes.filter((node) => node.tagName === 'STYLE')
  assert.equal(styleTags.length, 1, 'exactly one style tag')
  const css = styleTags[0].textContent
  assert.match(css, /::highlight\(dcs-find-match\)/)
  assert.match(css, /::highlight\(dcs-find-current\)/)
  assert.match(css, /\.dcs-findbar\b/)
  assert.match(css, /\.dcs-panel\b/)
  // The highlighter palette is deliberately fixed (marker yellow, never the
  // theme's link blue) and documented for overrides; every other colour must
  // come from a theme token.
  assert.match(css, /--dcs-find-match-bg:/)
  assert.match(css, /--dcs-find-current-bg:/)
  assert.match(css, /--dcs-jump-flash:/)
  const cssWithoutPalette = css
    .replace(/:root \{[^}]*\}/g, '')
    .replace(/::highlight\([^)]*\)[^}]*\}/g, '')
  assert.doesNotMatch(cssWithoutPalette, /(?<!var\()#[0-9a-fA-F]{3,8}(?!\))/)
})

test('apply is idempotent per context and leaves no listeners after dispose', () => {
  const { definition, windowListeners } = loadBundle()
  const exports = definition.factory(makeRequire())
  const fake = createFakeContext()
  exports.apply(fake.ctx)
  fake.disposeAll()
  for (const [type, handlers] of windowListeners) {
    assert.equal(handlers.size, 0, `window listener "${type}" removed on dispose`)
  }
})
