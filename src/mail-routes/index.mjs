// MOD-mail-routes — one mailbox interface over Microsoft Graph and over the Bridge (docs/architecture/MOD-mail-routes.md): its
// interface. ITM-423 builds the format MailConnection, routeFor and providerLinks, ITM-424 signIn (graph-route.mjs), ITM-425 mailbox and the
// mailbox's test (graph-route.mjs, bridge-route.mjs). ITM-834 builds the Bridge route's read, find, drafts and sent, ITM-836 the Graph route's (the mail parser is vendor/postal-mime/). ITM-837 the Graph route's draft and send operations.
//
// Module: MOD-mail-routes
//
// It belongs to Issues and mail (ARC-044) and runs in the browser. Its requests go to Microsoft's sign-in service, the provider's one
// origin the page names: routeFor's one lookup, and those of the sign-in library signIn uses; providerLinks makes none. It keeps nothing: the connection is written by MOD-settings-pages.

import PROVIDERS from "./providers.json" with { type: "json" };

import { graphMailbox } from "./graph-route.mjs";
import { bridgeMailbox } from "./bridge-route.mjs";
import { failure } from "./errors.mjs";

export { signIn } from "./graph-route.mjs";

/**
 * A mailbox connection, which Access keeps in this browser (MOD-browser-store) and nowhere else: `route` is "graph" or "imap", and only
 * the part of that route is present — `graph` for the web-API route, `imap` for the Bridge route.
 * @typedef {{ address: string, route: "graph" | "imap", folders: string[],
 *   places: { place: string, outsideEu: boolean, notCompliantNoted?: boolean }[],
 *   graph?: { clientId: string, account: string },
 *   imap?: { bridge: string, jumpHostNoted: boolean, imap: Server, smtp: Server, account: string,
 *     smtpAccount?: string, sender?: { name: string | null, address: string }, password: string } }} MailConnection
 * @typedef {{ host: string, port: number, security: "tls" | "starttls" | "none" }} Server
 */

export const SIGN_IN_SERVICE = "https://login.microsoftonline.com";

/**
 * routeFor(address: string) -> Promise<{ route: "graph" | "imap", servers: { imap: Server, smtp: Server } | null, reason: string }> — the
 * route to preselect for a mail address. A domain of a known provider (providers.json) is the IMAP route with the provider's servers:
 * Microsoft's service answers for such a domain as it does for a tenant, so it is not asked. Any other domain is looked up at
 * Microsoft's sign-in service: a Microsoft 365 organisation is the Microsoft route, another domain the IMAP route with no servers, and
 * a service that cannot be reached the IMAP route with the reason — never a throw, the person may change the route. Crosses the network
 * to Microsoft's sign-in service, once. Throws a TypeError for a text that is no mail address, before any request.
 * @param {string} address
 */
export async function routeFor(address) {
  const domain = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(String(address ?? "").trim())?.[1]?.toLowerCase();
  if (!domain) throw new TypeError("Enter a mail address, like name@example.org.");
  const known = PROVIDERS[domain];
  if (known) {
    return { route: "imap", servers: { imap: { ...known.imap }, smtp: { ...known.smtp } },
      reason: `${known.name} mail is read over IMAP through a Bridge, with ${known.name}'s servers filled in.` };
  }
  let status;
  try {
    status = (await fetch(`${SIGN_IN_SERVICE}/${encodeURIComponent(domain)}/v2.0/.well-known/openid-configuration`, { credentials: "omit", cache: "no-store" })).status;
  } catch (failure) {
    return unreachable(failure?.message ?? String(failure));
  }
  if (status === 200) return { route: "graph", servers: null, reason: `${domain} belongs to a Microsoft 365 organisation: the mailbox is opened with Microsoft's sign-in.` };
  if (status === 400) return { route: "imap", servers: null, reason: `${domain} belongs to no Microsoft 365 organisation: mail is read over IMAP through a Bridge, with the servers you enter.` };
  return unreachable(`it answered ${status}`);
}

const unreachable = (why) => ({ route: "imap", servers: null,
  reason: `Microsoft's sign-in service could not be reached (${why}): the IMAP route is preselected; you may change it.` });

/**
 * providerLinks() -> { appRegistration: string, accessWithdrawal: string } — the addresses of Microsoft's page for registering the app
 * (Microsoft Entra: App registrations, New registration) and of its page on which a person reviews and removes the applications that
 * have access to their data (My Apps). Makes no request.
 */
export function providerLinks() {
  return { appRegistration: "https://entra.microsoft.com", accessWithdrawal: "https://myapps.microsoft.com" };
}

/**
 * mailbox(connection: MailConnection, bridge: Bridge | null) -> Mailbox — the mailbox on the connection's route; `bridge` is Access's
 * Bridge for the one the connection names, needed on the Bridge route only. Makes no request. Throws BridgeNeeded on the Bridge route
 * without one. ITM-425 builds its `test()`; reading, finding, drafts and sending are UC-038's and UC-039's.
 * @param {MailConnection} connection
 * @param {object | null} bridge
 */
export function mailbox(connection, bridge) {
  if (connection.route === "graph") return graphMailbox(connection);
  if (connection.route !== "imap") throw new TypeError(`a mailbox is reached on the route graph or imap, not ${connection.route}`);
  if (!bridge) throw failure("BridgeNeeded", {}, `The mailbox ${connection.address} is reached through a Bridge: choose one.`);
  return bridgeMailbox(connection, bridge);
}
