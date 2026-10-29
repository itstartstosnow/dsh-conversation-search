/**
 * dsh-conversation-search — Host route access fence.
 *
 * Contract (`docs/api-contract.md` §2): only loopback callers may read the
 * search index or trigger a rebuild; everything else gets 403. The Host web
 * server itself forwards any request that matches the exact route without
 * authenticating it (the `/api` bridge of `dsh-client-connection` only owns the
 * prefix fallback, and exact routes win the match), so this fence is the only
 * thing protecting the plugin's routes.
 *
 * Accepted socket addresses:
 *  - IPv4 loopback `127.0.0.0/8` (this covers `127.0.0.1`);
 *  - IPv6 loopback `::1`;
 *  - IPv4-mapped loopback `::ffff:127.0.0.0/8` (the form Node reports when an
 *    IPv6 socket accepts an IPv4 loopback client; `::ffff:127.0.0.1` is the
 *    documented example).
 *
 * @module dsh-conversation-search/host/access
 */

/** IPv4 127/8 predicate: four decimal octets, first == 127, each <= 255. */
export function isIPv4Loopback(address) {
  if (typeof address !== 'string') return false;
  const parts = address.split('.');
  return (
    parts.length === 4 &&
    parts[0] === '127' &&
    parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255)
  );
}

/**
 * Whether a socket remote address names the loopback range.
 * @param {string | undefined | null} address `req.socket.remoteAddress`.
 * @returns {boolean}
 */
export function isLoopbackAddress(address) {
  if (typeof address !== 'string' || address.length === 0) return false;
  const normalized = address.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('::ffff:')) return isIPv4Loopback(normalized.slice('::ffff:'.length));
  return isIPv4Loopback(normalized);
}

/**
 * Whether one incoming HTTP request comes from the loopback interface.
 *
 * Deliberately narrow: the contract fence is the peer address, not the Host
 * header or `Origin` (the GUI page is served from the same loopback authority,
 * so a direct browser request carries a loopback socket). A request with no
 * socket address (should not happen for `node:http`) is refused rather than
 * trusted.
 *
 * @param {{socket?: {remoteAddress?: string}}} req node HTTP request.
 * @returns {boolean}
 */
export function isLoopbackRequest(req) {
  const address = req && req.socket ? req.socket.remoteAddress : undefined;
  return isLoopbackAddress(address);
}
