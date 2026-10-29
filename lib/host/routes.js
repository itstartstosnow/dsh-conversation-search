/**
 * dsh-conversation-search — Host HTTP routes.
 *
 * Five exact routes under `/api/dsh-conversation-search` (contract
 * `docs/api-contract.md` §2):
 *
 * ```text
 * GET  /api/dsh-conversation-search/status
 * POST /api/dsh-conversation-search/rebuild
 * GET  /api/dsh-conversation-search/search?q=&caseSensitive=&wholeWord=&limit=&kinds=&includeSubagents=
 * GET  /api/dsh-conversation-search/session?sessionId=&q=&caseSensitive=&wholeWord=&kinds=&includeSubagents=
 * GET  /api/dsh-conversation-search/message?sessionId=&seq=
 * ```
 *
 * Every response uses the shared envelope (`{ok:true, ...}` / `{ok:false,
 * error:{code,message}}`) that `DCS.api` on the client already unwraps. Exact
 * routes are matched by the Host web server before the `/api` connection
 * bridge, so each handler runs this plugin's own fence: loopback only, 403
 * otherwise.
 *
 * @module dsh-conversation-search/host/routes
 */

import { isLoopbackRequest } from './access.js';

/** URL prefix owned by this plugin. */
export const API_PREFIX = '/api/dsh-conversation-search';

/** Stable error code → HTTP status mapping (contract §2). */
const ERROR_STATUS = {
  indexing: 503,
  'empty-query': 400,
  'unknown-session': 404,
  'bad-request': 400,
  'bad-kinds': 400,
  forbidden: 403,
  'method-not-allowed': 405,
};

/** Default `cache-control` for every API response: index data must not be cached. */
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
};

/**
 * Write one JSON response.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status HTTP status.
 * @param {unknown} body JSON envelope.
 */
function writeJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

/** Write `{ok:true, ...payload}`. */
function sendOk(res, payload) {
  writeJson(res, 200, { ok: true, ...payload });
}

/** Write `{ok:false, error:{code,message}}` at the given status. */
function sendError(res, status, code, message) {
  writeJson(res, status, { ok: false, error: { code, message } });
}

/**
 * Map one thrown service error to its HTTP response. Unknown errors become a
 * 500 `internal`; coded `HostSearchError`s keep their contract status.
 * @param {import('node:http').ServerResponse} res
 * @param {unknown} error
 * @param {{warn?: Function} | null} [logger]
 */
function sendServiceError(res, error, logger) {
  const code = error && typeof error.code === 'string' && error.code.length > 0 ? error.code : 'internal';
  const known = Object.prototype.hasOwnProperty.call(ERROR_STATUS, code);
  const status = known ? ERROR_STATUS[code] : 500;
  const wireCode = known ? code : 'internal';
  const message = error instanceof Error ? error.message : String(error ?? 'request failed');
  if (!known) {
    try {
      logger?.warn?.(`[conversation-search] route failed (${code}): ${message}`);
    } catch {
      // Logging must never replace the response.
    }
  }
  sendError(res, status, wireCode, message);
}

/** Parse the request query string; never throws on a malformed URL. */
function queryOf(req) {
  try {
    return new URL(req.url ?? '/', 'http://127.0.0.1').searchParams;
  } catch {
    return new URLSearchParams();
  }
}

/** Parse a contract boolean (`1`/`0`; `true`/`false` tolerated). */
function booleanOf(params, name) {
  const raw = params.get(name);
  return raw === '1' || raw === 'true';
}

/** Parse the optional `limit` parameter (default applied by the service). */
function limitOf(params) {
  const raw = params.get('limit');
  if (raw === null) return undefined;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

/**
 * Parse the optional `kinds` scope parameter: a comma-separated list of entry
 * kinds (`user,assistant,tool,thinking`). Missing → undefined so the service
 * applies its dialogue default; present-but-empty or containing an unknown kind
 * is rejected by the service as `bad-kinds` (HTTP 400), not silently ignored.
 */
function kindsOf(params) {
  const raw = params.get('kinds');
  if (raw === null) return undefined;
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Parse the optional `includeSubagents` parameter.
 *
 * `1`/`true` → true, `0`/`false` → false; a missing or unrecognized value falls
 * back to `fallback` (invalid values are ignored, contract §2). `/search`
 * defaults to exclusion (false), `/session` to inclusion (true) because an
 * explicit session-id lookup is deliberate.
 */
function includeSubagentsOf(params, fallback) {
  const raw = params.get('includeSubagents');
  if (raw === null) return fallback;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

/**
 * Wrap one handler's shared prologue: loopback fence, method check, error
 * envelope. The handler owns the success response.
 * @param {{method: 'GET' | 'POST', run: (req: any, res: any) => unknown, logger?: any}} options
 */
function makeHandler({ method, run, logger }) {
  return (req, res) => {
    if (!isLoopbackRequest(req)) {
      sendError(res, 403, 'forbidden', 'loopback requests only');
      return undefined;
    }
    if ((req.method ?? 'GET').toUpperCase() !== method) {
      sendError(res, 405, 'method-not-allowed', `use ${method}`);
      return undefined;
    }
    let outcome;
    try {
      outcome = run(req, res);
    } catch (error) {
      sendServiceError(res, error, logger);
      return undefined;
    }
    if (outcome && typeof outcome.then === 'function') {
      return outcome.catch((error) => sendServiceError(res, error, logger));
    }
    return undefined;
  };
}

const STATUS_PATH = `${API_PREFIX}/status`;
const REBUILD_PATH = `${API_PREFIX}/rebuild`;
const SEARCH_PATH = `${API_PREFIX}/search`;
const SESSION_PATH = `${API_PREFIX}/session`;
const MESSAGE_PATH = `${API_PREFIX}/message`;

/**
 * Build the five route definitions for one service instance.
 *
 * Kept free of any Cordis dependency so tests can register the routes on a fake
 * `webServer` and drive the handlers directly.
 *
 * @param {import('./service.js').SearchService} service
 * @param {{logger?: any}} [options]
 * @returns {Array<{kind: 'exact', path: string, handler: (req: any, res: any) => void}>}
 */
export function createRoutes(service, options = {}) {
  const logger = options.logger ?? null;

  /** GET /status */
  const statusRoute = {
    kind: 'exact',
    path: STATUS_PATH,
    handler: makeHandler({
      method: 'GET',
      logger,
      run: (req, res) => {
        sendOk(res, service.status());
      },
    }),
  };

  /** POST /rebuild — starts an async full rebuild and answers immediately. */
  const rebuildRoute = {
    kind: 'exact',
    path: REBUILD_PATH,
    handler: makeHandler({
      method: 'POST',
      logger,
      run: (req, res) => {
        // The rebuild promise is owned by the service; the route only acks the
        // start (contract: `{ok:true, started:true}`). Errors surface via /status.
        Promise.resolve(service.rebuild()).catch(() => undefined);
        sendOk(res, { started: true });
      },
    }),
  };

  /** GET /search?q=&caseSensitive=&wholeWord=&limit=&kinds=&includeSubagents= */
  const searchRoute = {
    kind: 'exact',
    path: SEARCH_PATH,
    handler: makeHandler({
      method: 'GET',
      logger,
      run: async (req, res) => {
        const params = queryOf(req);
        const result = await service.search(params.get('q') ?? '', {
          caseSensitive: booleanOf(params, 'caseSensitive'),
          wholeWord: booleanOf(params, 'wholeWord'),
          limit: limitOf(params),
          kinds: kindsOf(params),
          includeSubagents: includeSubagentsOf(params, false),
        });
        sendOk(res, result);
      },
    }),
  };

  /** GET /session?sessionId=&q=&caseSensitive=&wholeWord=&kinds=&includeSubagents= */
  const sessionRoute = {
    kind: 'exact',
    path: SESSION_PATH,
    handler: makeHandler({
      method: 'GET',
      logger,
      run: async (req, res) => {
        const params = queryOf(req);
        const result = await service.sessionHits(params.get('sessionId') ?? '', params.get('q') ?? '', {
          caseSensitive: booleanOf(params, 'caseSensitive'),
          wholeWord: booleanOf(params, 'wholeWord'),
          kinds: kindsOf(params),
          // Explicit id lookup includes subagent sessions unless the caller opts out.
          includeSubagents: includeSubagentsOf(params, true),
        });
        sendOk(res, result);
      },
    }),
  };

  /** GET /message?sessionId=&seq= */
  const messageRoute = {
    kind: 'exact',
    path: MESSAGE_PATH,
    handler: makeHandler({
      method: 'GET',
      logger,
      run: async (req, res) => {
        const params = queryOf(req);
        const rawSeq = params.get('seq');
        const seq = rawSeq === null ? Number.NaN : Number(rawSeq);
        if (!Number.isInteger(seq) || seq < 0) {
          throw Object.assign(new Error('seq must be a non-negative integer'), { code: 'bad-request' });
        }
        sendOk(res, await service.message(params.get('sessionId') ?? '', seq));
      },
    }),
  };

  return [statusRoute, rebuildRoute, searchRoute, sessionRoute, messageRoute];
}

/**
 * Register every route on the Host web server and return one disposer.
 * `index.js` hands this to `ctx.effect`.
 *
 * @param {{webServer: {register: (route: object) => () => void}}} ctx host context.
 * @param {import('./service.js').SearchService} service
 * @param {{logger?: any}} [options]
 * @returns {() => void}
 */
export function registerRoutes(ctx, service, options = {}) {
  const disposers = createRoutes(service, options).map((route) => ctx.webServer.register(route));
  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        // The route's owning fiber may already be gone during shutdown.
      }
    }
  };
}
