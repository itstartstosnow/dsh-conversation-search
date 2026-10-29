/**
 * dsh-conversation-search — Host filesystem paths.
 *
 * One place resolves `$DSH_HOME`, the read-only session-log root and the
 * plugin-owned cache directory. Nothing here writes outside the cache.
 *
 * Layout (contract: docs/api-contract.md §3; the cache file *name* deviates from
 * the contract's manifest+shards layout by Lead decision — see
 * docs/host-service.md). Stale versioned index files are pruned on startup:
 *
 * ```text
 * <DSH_HOME>/sessions/--<project>--/<sessionId>/session.v4.jsonl.zstd   (read-only)
 * <DSH_HOME>/cache/dsh-conversation-search/index.v<version>.json      (plugin cache)
 * ```
 *
 * @module dsh-conversation-search/host/paths
 */

import fsSync from 'node:fs';
import path from 'node:path';

import {
  INDEX_VERSION,
  defaultSessionsRoot as coreDefaultSessionsRoot,
  resolveDshHome,
  writeJsonFileAtomic,
} from '../search-core.js';

/** Directory name under `<DSH_HOME>/cache` owned by this plugin. */
export const CACHE_DIR_NAME = 'dsh-conversation-search';

/**
 * Cache schema version. Kept alongside the search-core index version: the
 * single-file cache simply serializes the in-memory index document, so the two
 * versions move together.
 */
export const CACHE_VERSION = INDEX_VERSION;

/** Default session-log root (`<DSH_HOME>/sessions`). Re-exported for tests/tools. */
export function defaultSessionsRoot(env = process.env) {
  return coreDefaultSessionsRoot(env);
}

/** Absolute cache directory for this plugin (`<DSH_HOME>/cache/dsh-conversation-search`). */
export function resolveCacheDir(env = process.env) {
  return path.join(resolveDshHome(env), 'cache', CACHE_DIR_NAME);
}

/** Absolute path of the single-file index cache. */
export function resolveIndexPath(cacheDir) {
  return path.join(cacheDir, `index.v${CACHE_VERSION}.json`);
}

/**
 * Resolve every path the service needs.
 *
 * `DSH_HOME` is honored exactly as the shipped plugins honor it (absolute,
 * `~`, `~/...` or a relative path resolved against the process cwd). Tests pass
 * a temporary `env` object and never touch the real `~/.dsh`.
 *
 * @param {Record<string, string | undefined>} [env] environment to read.
 * @param {{dshHome?: string, sessionsRoot?: string, cacheDir?: string, indexPath?: string}} [overrides]
 * @returns {{dshHome: string, sessionsRoot: string, cacheDir: string, indexPath: string}}
 */
export function resolvePaths(env = process.env, overrides = {}) {
  const dshHome = overrides.dshHome ?? resolveDshHome(env);
  const sessionsRoot = overrides.sessionsRoot ?? path.join(dshHome, 'sessions');
  const cacheDir = overrides.cacheDir ?? path.join(dshHome, 'cache', CACHE_DIR_NAME);
  const indexPath = overrides.indexPath ?? resolveIndexPath(cacheDir);
  return { dshHome, sessionsRoot, cacheDir, indexPath };
}

/** Create a directory with owner-only permissions (recursive, idempotent). */
export function ensureDir(dir) {
  fsSync.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/**
 * Atomically write one JSON document (exclusive-create temp in the same
 * directory, fsync, rename; mode 0600). Re-exported from the search core so the
 * module boundary has exactly one atomic-write implementation.
 *
 * @param {string} filePath target path.
 * @param {unknown} value JSON-serializable value.
 * @param {{fs?: typeof fsSync, mode?: number, dirMode?: number}} [options]
 * @returns {{bytes: number, file: string}}
 */
export function writeJsonAtomic(filePath, value, options) {
  return writeJsonFileAtomic(filePath, value, options);
}

/** Files this plugin owns inside its cache directory, regardless of version. */
const CACHE_FILE_PATTERN = /^index\.v\d+\.json$/;

/** Development-only artifact written by earlier builds of this plugin. */
const DEV_ARTIFACTS = new Set(['selftest.log']);

/**
 * Remove cache files this build no longer owns: index documents from an older
 * cache version and development self-test logs. Only the plugin's own cache
 * directory is touched, and every failure is best-effort — a leftover file must
 * never block indexing.
 *
 * @param {string} cacheDir plugin cache directory.
 * @param {string} indexPath current cache file to keep.
 * @param {{fs?: typeof fsSync}} [options]
 * @returns {{removed: string[]}} basenames removed.
 */
export function pruneStaleCacheFiles(cacheDir, indexPath, options = {}) {
  const fs = options.fs ?? fsSync;
  const removed = [];
  const keep = path.basename(indexPath);
  let entries;
  try {
    entries = fs.readdirSync(cacheDir);
  } catch {
    return { removed };
  }
  for (const name of entries) {
    if (name === keep) continue;
    const staleVersion = CACHE_FILE_PATTERN.test(name);
    if (!staleVersion && !DEV_ARTIFACTS.has(name)) continue;
    try {
      fs.unlinkSync(path.join(cacheDir, name));
      removed.push(name);
    } catch {
      // A running Host may hold the file open on some platforms; skip it.
    }
  }
  return { removed };
}
