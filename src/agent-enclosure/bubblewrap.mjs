// bubblewrap.mjs — Linux: the arguments with which `bwrap` starts an agent (MOD-agent-enclosure, Data; ARC-054).
//
// Module: MOD-agent-enclosure
//
// bubblewrap mounts in the order of its arguments, each over what is there: the whole file system read-only first, then a new /dev and /proc and a
// private /tmp, then the agent's folders writable, and last an empty folder or /dev/null over each place that holds credentials, so that one inside a
// writable folder stays hidden. It mounts only over paths that exist; the caller leaves out a hidden place that does not.

/**
 * bubblewrapArgs({ writable, hidden, runtimeDir, workdir }) -> string[] — the arguments before `--` and the command: the process in a PID namespace of
 * its own and a new session, ended with the Bridge; `hidden` as `{ path, directory }`; the user's runtime folder, where the session bus and the agents
 * listen, replaced by an empty one; the working folder `workdir`. Pure.
 */
export function bubblewrapArgs({ writable, hidden, runtimeDir, workdir }) {
  return [
    "--die-with-parent", "--new-session", "--unshare-pid",
    "--ro-bind", "/", "/",
    "--dev", "/dev",
    "--proc", "/proc",
    "--tmpfs", "/tmp",
    ...writable.flatMap((path) => ["--bind", path, path]),
    ...(runtimeDir ? ["--tmpfs", runtimeDir] : []),
    ...hidden.flatMap(({ path, directory }) => (directory ? ["--tmpfs", path] : ["--ro-bind", "/dev/null", path])),
    "--chdir", workdir,
  ];
}
