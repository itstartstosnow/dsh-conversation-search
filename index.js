/**
 * dsh-conversation-search — Host entry.
 *
 * Mounts the conversation-search Host half: one `SearchService` that indexes
 * the read-only session logs into `$DSH_HOME/cache/dsh-conversation-search`,
 * the five HTTP routes the browser half calls, and the background refresh loop.
 *
 * Activation never waits for the index: the first build runs in the background
 * (the panel sees `{building:true, progress}` on `/status` and a 503
 * `{code:'indexing'}` from `/search` until it is ready). Every resource is
 * registered through `ctx.effect`/`ctx.interval` so a plugin reload or disable
 * tears the service, its routes and its timer down cleanly.
 *
 * @module dsh-conversation-search
 */

import { DEFAULT_REFRESH_INTERVAL_MS, createSearchService } from './lib/host/service.js';
import { registerRoutes } from './lib/host/routes.js';

/** Host services this plugin needs before it may activate. */
export const inject = ['webServer'];

/**
 * Mount the Host half.
 * @param {any} ctx host root context (`webServer` injected).
 */
export function apply(ctx) {
  const logger = ctx.logger ?? null;
  const service = createSearchService({ logger });

  // Routes first: /status must answer while the first build is still running.
  ctx.effect(
    () =>
      registerRoutes(ctx, service, { logger }),
    'conversation-search: host routes',
  );

  // Index lifecycle: start in the background, stop on dispose.
  ctx.effect(
    () => {
      const starting = service.start();
      starting.catch((error) => {
        // start() does not reject by contract, but never let a rejection escape
        // the plugin fiber if that ever changes.
        try {
          logger?.warn?.(`[conversation-search] index start failed: ${error && error.message ? error.message : error}`);
        } catch {
          // Logging must not break activation.
        }
      });
      return () => {
        // Fire-and-forget: the fiber disposer must not wait for a scan to settle
        // (stop() aborts in-flight work, so this settles promptly).
        void service.stop();
      };
    },
    'conversation-search: host index',
  );

  // Periodic incremental scan. A bare timer registered inside `ctx.effect` is
  // deliberately used instead of `ctx.interval`: the timer mixin is an optional
  // Host service, and touching it without `inject: ['timer']` throws
  // ("cannot get property timer without inject"). The effect owns the cleanup.
  ctx.effect(() => {
    const refreshTick = () => {
      service.refresh().catch((error) => {
        try {
          logger?.debug?.(`[conversation-search] background refresh failed: ${error && error.message ? error.message : error}`);
        } catch {
          // Logging must not break the timer.
        }
      });
    };
    const timer = setInterval(refreshTick, DEFAULT_REFRESH_INTERVAL_MS);
    if (typeof timer.unref === 'function') timer.unref();
    return () => clearInterval(timer);
  }, 'conversation-search: refresh timer');
}
