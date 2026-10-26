// The subject the Settings page gives the prompt bar (MOD-settings-pages, Interfaces: "Each route gives the prompt bar its subject (UC-049 3c): the page
// names each setting and whether it is stored ... never a value"). One line per setting this browser can keep, with whether it is stored; a value is never read into a line.
//
// Module: MOD-settings-pages

import { listSettings, readSetting } from "../browser-store/index.mjs";

// The mailbox is one setting that stores what its route stores: the IMAP route its password, the Microsoft route its sign-in, which is stored once the connection has an
// account recorded (Store and test records it after the sign-in); with no mailbox, nothing. -> { name, stored } for the mailbox's line.
function mailboxLine(store) {
  const kept = readSetting(store, "mailbox");
  if (kept === null || kept === undefined) return { name: "Mailbox", stored: false };
  if (kept.route === "graph") return { name: "Mailbox sign-in", stored: typeof kept.graph?.account === "string" && kept.graph.account !== "" };
  return { name: "Mailbox password", stored: typeof kept.imap?.password === "string" && kept.imap.password !== "" };
}

// One setting's line: its name and whether it is stored. An endpoint is named by its key, and is stored when it holds one.
function lineOf(info, store) {
  if (info.key === "mailbox") return mailboxLine(store);
  if (info.key.startsWith("endpoint:")) {
    const kept = readSetting(store, info.key);
    return { name: `Endpoint key: ${info.key.slice("endpoint:".length)}`, stored: typeof kept?.key === "string" && kept.key !== "" };
  }
  return { name: info.label, stored: readSetting(store, info.key) !== null };
}

// Settings that are records of the browser, not settings a person sets: they are not named.
// The mailbox's sign-in has no key of its own: the mailbox's line says it.
const RECORDS = ["notified", "browser", "mailbox-sign-in"];
const named = (info) => info.label !== undefined && !RECORDS.includes(info.key) && !/^(last-test|acknowledged):/.test(info.key);

/**
 * settingsSubject(context, drawn) -> Subject — context only; its page is the title, the menu entry's label, the address of the page, the text the page has drawn (`drawn()`;
 * an input's value is no text, so no stored secret is in it) and one line `<setting>: stored` or `<setting>: not set` for each setting.
 */
export function settingsSubject(context, drawn = () => "") {
  const address = context.product?.address ?? `https://github.com/${context.instance.repository}`;
  return {
    key: context.product ? `settings/product=${encodeURIComponent(context.product.address)}` : "settings",
    title: "Settings",
    entry: "settings",
    paramsFor: () => ({
      page: ["Settings", "Settings", address, drawn(), ...listSettings(context.store).filter(named).map((info) => lineOf(info, context.store)).map(({ name, stored }) => `${name}: ${stored ? "stored" : "not set"}`)].join("\n"),
    }),
    draftRoute: null,
    withhold: null,
    refuses: [],
  };
}
