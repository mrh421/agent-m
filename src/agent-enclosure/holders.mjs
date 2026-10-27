// holders.mjs — the places that hold credentials, which every enclosure hides, and the environment an agent receives (MOD-agent-enclosure, Data).
//
// Module: MOD-agent-enclosure
//
// NO MODEL READS A CREDENTIAL: what the Bridge keeps lies in its data folder; what the computer's git login uses lies in these places of the person's
// home, or in the system's credential store, which each platform's enclosure closes by its own means. The environment is chosen, not inherited: an
// agent receives what a program needs to run and nothing the Bridge's environment may carry beside it.

import { posix, win32 } from "node:path";

// The git login's places in the person's home: SSH, git's credential store and cache, the netrc file, and the command-line clients of the servers.
export const GIT_LOGIN_PLACES = [".ssh", ".git-credentials", ".config/git/credentials", ".netrc", ".cache/git/credential", ".git-credential-cache", ".config/gh", ".config/glab-cli"];

/** hiddenPaths({ platform, dataFolder, personHome }) -> string[] — every place an enclosure hides, whether it exists or not. Pure. */
export function hiddenPaths({ platform, dataFolder, personHome }) {
  const join = platform === "win32" ? win32.join : posix.join;
  return [dataFolder, ...GIT_LOGIN_PLACES.map((place) => join(personHome, place)), ...(platform === "darwin" ? [join(personHome, "Library", "Keychains")] : [])];
}

// The variables passed as they are; everything else of the Bridge's environment stays out.
const PASSED = ["PATH", "LANG", "LC_ALL", "LC_CTYPE", "LC_MESSAGES", "TERM", "TZ", "SHELL", "USER", "LOGNAME"];
const PASSED_WINDOWS = ["SystemRoot", "SystemDrive", "windir", "ComSpec", "PATHEXT", "OS", "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS", "ProgramFiles",
  "ProgramFiles(x86)", "ProgramW6432", "ProgramData", "CommonProgramFiles"];

/**
 * agentEnvironment({ platform, env, home, identity }) -> Record<string, string> — the environment an agent receives: the passed variables of `env`,
 * its home and the folders below it, git's prompt switched off, and the git identity where `identity` names one. On Windows the account's own folders
 * of programs come before the PATH. Pure.
 */
export function agentEnvironment({ platform, env, home, identity }) {
  const windows = platform === "win32";
  const chosen = {};
  for (const name of [...PASSED, ...(windows ? PASSED_WINDOWS : [])]) if (typeof env[name] === "string") chosen[name] = env[name];
  if (windows) {
    const local = win32.join(home, "AppData", "Local");
    Object.assign(chosen, { USERPROFILE: home, HOMEDRIVE: home.slice(0, 2), HOMEPATH: home.slice(2), APPDATA: win32.join(home, "AppData", "Roaming"), LOCALAPPDATA: local,
      TEMP: win32.join(local, "Temp"), TMP: win32.join(local, "Temp") });
    const own = [win32.join(home, ".local", "bin"), win32.join(home, "AppData", "Roaming", "npm")];
    chosen.PATH = [...own, ...(chosen.PATH ? [chosen.PATH] : [])].join(";");
  } else {
    Object.assign(chosen, { HOME: home, XDG_CONFIG_HOME: posix.join(home, ".config"), XDG_DATA_HOME: posix.join(home, ".local", "share"),
      XDG_CACHE_HOME: posix.join(home, ".cache"), XDG_STATE_HOME: posix.join(home, ".local", "state"), TMPDIR: posix.join(home, "tmp") });
  }
  chosen.GIT_TERMINAL_PROMPT = "0";
  if (identity?.name) Object.assign(chosen, { GIT_AUTHOR_NAME: identity.name, GIT_COMMITTER_NAME: identity.name });
  if (identity?.email) Object.assign(chosen, { GIT_AUTHOR_EMAIL: identity.email, GIT_COMMITTER_EMAIL: identity.email });
  return chosen;
}
