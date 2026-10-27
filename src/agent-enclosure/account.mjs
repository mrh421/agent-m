// account.mjs — Windows: the Bridge's own account, its one-time setup, a program started as it, and the folders granted to it (MOD-agent-enclosure,
// Data; ARC-054).
//
// Module: MOD-agent-enclosure
//
// The launcher and the setup are PowerShell texts of this folder, read here and run with `-EncodedCommand`, since the Bridge's own files lie in its
// app archive, which PowerShell cannot read. The account's password reaches the launcher only as the first line of its standard input, and the setup
// only through the file in the Bridge's data folder: never in an argument, which every process of the person may read, nor in a variable.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, win32 } from "node:path";

const LAUNCHER = readFileSync(new URL("./launcher.ps1", import.meta.url), "utf8");
const SETUP = readFileSync(new URL("./setup.ps1", import.meta.url), "utf8");
const POWERSHELL = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand"];

/** accountName(dataFolder) -> string — `agentm-` and the first twelve hexadecimal digits of the SHA-256 of the data folder's path: twenty characters at most. */
export const accountName = (dataFolder) => `agentm-${createHash("sha256").update(dataFolder).digest("hex").slice(0, 12)}`;

/** accountHome(account, env) -> string — the account's own profile, below the system drive's `Users`. */
export const accountHome = (account, env) => win32.join(`${env.SystemDrive ?? "C:"}\\`, "Users", account);

/** The file in the Bridge's data folder that keeps the account's name and password. */
export const accountFile = (dataFolder) => join(dataFolder, "agent-account.json");

/** readAccount(dataFolder) -> { account, password } | null — what the data folder keeps, or null where it keeps nothing readable. */
export function readAccount(dataFolder) {
  const file = accountFile(dataFolder);
  if (!existsSync(file)) return null;
  try {
    const kept = JSON.parse(readFileSync(file, "utf8"));
    return typeof kept?.account === "string" && typeof kept?.password === "string" ? kept : null;
  } catch { return null; }
}

/** keepAccount(dataFolder) -> { account, password } — a new random password for the account, written into the data folder, readable by its owner only. */
export function keepAccount(dataFolder) {
  const kept = { account: accountName(dataFolder), password: `${randomBytes(24).toString("base64url")}aA1!` };
  writeFileSync(accountFile(dataFolder), JSON.stringify(kept), { mode: 0o600 });
  return kept;
}

// A PowerShell single-quoted string.
const literal = (text) => `'${String(text).replace(/'/g, "''")}'`;
// A script run with -EncodedCommand: its UTF-16LE bytes in base64.
const encoded = (script) => Buffer.from(script, "utf16le").toString("base64");

/** One argument of a Windows command line, quoted as CommandLineToArgvW reads it back. */
export function quoteArgument(argument) {
  const text = String(argument);
  if (text !== "" && !/[\s"]/.test(text)) return text;
  let quoted = '"', slashes = 0;
  for (const character of text) {
    if (character === "\\") { slashes += 1; continue; }
    if (character === '"') { quoted += "\\".repeat(slashes * 2 + 1) + '"'; slashes = 0; continue; }
    quoted += "\\".repeat(slashes) + character;
    slashes = 0;
  }
  return `${quoted}${"\\".repeat(slashes * 2)}"`;
}

/**
 * launchCommand({ account, workdir, command, args, console }) -> { command, args, script } — PowerShell running the launcher, then
 * `Invoke-Launch` for the account with the working folder, the program and its arguments as one command line in base64; `console` opens the program
 * in a console window of its own instead of relaying its streams. `script` is the text that `-EncodedCommand` carries. Pure.
 */
export function launchCommand({ account, workdir, command, args, console = false }) {
  const line = Buffer.from(args.map(quoteArgument).join(" "), "utf8").toString("base64");
  const script = `${LAUNCHER}\nInvoke-Launch -Account ${literal(account)} -Directory ${literal(workdir)} -Program ${literal(command)} -ArgumentLine ${literal(line)}${console ? " -Console" : ""}\n`;
  return { command: "powershell.exe", args: [...POWERSHELL, encoded(script)], script };
}

/**
 * setUpCommand({ account, file }) -> { command, args, script } — PowerShell asking Windows' elevation prompt to run the setup for the account with the
 * password in `file`, and waiting for it. Pure.
 */
export function setUpCommand({ account, file }) {
  const script = `${SETUP}\nInvoke-SetUp -Account ${literal(account)} -PasswordFile ${literal(file)}\n`;
  const elevate = `Start-Process -FilePath powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded(script)}'`;
  return { command: "powershell.exe", args: [...POWERSHELL, encoded(elevate)], script };
}

/** grantCommands({ account, writable, readable }) -> [command, args][] — `icacls` granting the account each writable folder for changing, each readable one for reading, below them too. Pure. */
export function grantCommands({ account, writable, readable }) {
  return [...writable.map((path) => ["icacls", [path, "/grant", `${account}:(OI)(CI)M`, "/Q"]]),
    ...readable.map((path) => ["icacls", [path, "/grant", `${account}:(OI)(CI)RX`, "/Q"]])];
}
