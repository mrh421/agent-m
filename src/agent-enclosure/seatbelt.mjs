// seatbelt.mjs — macOS: the profile `/usr/bin/sandbox-exec` puts around an agent (MOD-agent-enclosure, Data; ARC-054).
//
// Module: MOD-agent-enclosure
//
// A later rule of a profile overrides an earlier one for the same operation (docs/measurements/2026-10-27_what-an-agent-on-a-bridge-reaches.md): the
// profile allows by default, denies every write, allows writing the agent's folders, and only then hides the places that hold credentials, so that a
// hidden place inside a writable folder stays hidden. The paths are matched as the system resolves them; the caller resolves them first.

// A string of the profile language, with its quote and backslash escaped.
const quoted = (text) => `"${String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
// A regular expression of the profile language matching exactly `path`.
const exactly = (path) => `#"^${String(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/"/g, '\\"')}$"`;

// The services through which a process of the user reaches the keychain.
const KEYCHAIN = ["com.apple.SecurityServer", "com.apple.securityd.xpc", "com.apple.secd"];
// launchd's SSH agent, which macOS starts for every user.
const LAUNCHD_AGENT = '#"^/private/tmp/com\\.apple\\.launchd\\.[^/]+/Listeners$"';

/**
 * seatbeltProfile({ writable, hidden, sockets }) -> string — the profile: writing only below `writable`, `/private/tmp` and `/dev`; neither reading nor
 * writing below `hidden`; no lookup of the keychain's services; no connection to the Unix sockets `sockets` nor to launchd's SSH agent. Pure.
 */
export function seatbeltProfile({ writable, hidden, sockets }) {
  return [
    "(version 1)",
    "(allow default)",
    "(deny file-write*)",
    `(allow file-write*\n${[...writable, "/private/tmp", "/dev"].map((path) => `  (subpath ${quoted(path)})`).join("\n")})`,
    ...(hidden.length ? [`(deny file-read* file-write*\n${hidden.map((path) => `  (subpath ${quoted(path)})`).join("\n")})`] : []),
    `(deny mach-lookup${KEYCHAIN.map((name) => ` (global-name ${quoted(name)})`).join("")})`,
    `(deny network-outbound\n${[...sockets.map(exactly), LAUNCHD_AGENT].map((pattern) => `  (remote unix-socket (path-regex ${pattern}))`).join("\n")})`,
    "",
  ].join("\n");
}
