import { isIP } from "node:net";

export function workspaceUrl(value) {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Use the workspace address without credentials, query parameters, or a fragment.");
  }
  const host = url.hostname;
  const octets = host.split(".").map(Number);
  const privateHost = host === "localhost" || host === "[::1]" || (isIP(host) === 4 && (
    octets[0] === 127 || octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
  ));
  if (url.protocol !== "https:" && !(url.protocol === "http:" && privateHost)) {
    throw new Error("Use HTTPS, or an HTTP address on your private network or VPN.");
  }
  return url.href;
}

export function workspaceRequestAllowed(candidate, address) {
  if (!address) return false;
  try {
    const target = new URL(candidate);
    const workspace = new URL(address);
    if (target.protocol === "ws:") target.protocol = "http:";
    if (target.protocol === "wss:") target.protocol = "https:";
    return target.origin === workspace.origin;
  } catch {
    return false;
  }
}
