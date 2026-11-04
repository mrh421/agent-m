// Component integration coverage for ITM-294's authenticated HTTPS reverse-tunnel path.
//
// This fixture is intentionally executable only by the existing GitHub Ubuntu Node job.  It starts temporary
// Apache and nginx processes, a fixture CA trusted by the worker only, an ssh2 jump host, and the production Bridge.
// No system trust store, external host, browser, or user state is used.
//
// Module: MOD-settings-pages; MOD-browser-store; MOD-bridge-client; MOD-tunnels; MOD-desktop-shell;
//         MOD-bridge-http; MOD-bridge-jobs; MOD-endpoint-calls
// Level: component
// Guards: UC-003; UC-044; A BRIDGE CAN BE REACHED OVER HTTPS THROUGH THE JUMP HOST
// Guards: THE JUMP HOST FORWARDS TO A BRIDGE ONLY AFTER ITS OWN LOGIN; THE JUMP HOST ALLOWS CROSS-ORIGIN REQUESTS ONLY FROM THE INSTANCE
// Guards: A REVERSE TUNNEL LISTENS ONLY ON THE JUMP HOST'S LOOPBACK

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { ssh2NodePath } from "./ssh2-fixture.mjs";

const root = new URL("..", import.meta.url).pathname;
const sourceRoot = process.env.AGENT_M_294_SOURCE_ROOT ?? new URL("../src/", import.meta.url).pathname;
const ssh2Cache = join(tmpdir(), "agent-m-294-component-ssh2-1.17.0");
const onControlledUbuntu = process.env.GITHUB_ACTIONS === "true" && process.platform === "linux";

function command(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 40_000, ...options });
  process.stdout.write(`itm294-command ${JSON.stringify({ utc: new Date().toISOString(), cwd: options.cwd ?? process.cwd(), argv: [command, ...args], status: result.status, signal: result.signal, error: result.error?.code ?? null, stdout: result.stdout, stderr: result.stderr })}\n`);
  return result;
}

function requireSuccess(commandName, args, options = {}) {
  const result = command(commandName, args, options);
  assert.equal(result.status, 0, `${commandName} ${args.join(" ")} failed: ${result.stderr}`);
  return result;
}

function stageSsh2() {
  return ssh2NodePath(ssh2Cache);
}

function ensureWebServers() {
  for (const binary of ["apache2", "nginx", "openssl"]) {
    if (command("sh", ["-c", `command -v ${binary}`]).status !== 0) {
      requireSuccess("sudo", ["apt-get", "-o", "DPkg::Lock::Timeout=50", "-o", "Acquire::Retries=3", "update"], { timeout: 60_000 });
      requireSuccess("sudo", ["apt-get", "-o", "DPkg::Lock::Timeout=50", "-o", "Acquire::Retries=3", "install", "--yes", "--no-install-recommends", "apache2", "nginx", "openssl"], { timeout: 60_000 });
      return;
    }
  }
}

function certificate(folder) {
  const caKey = join(folder, "fixture-ca-key.pem"), ca = join(folder, "fixture-ca.pem");
  const key = join(folder, "jump-host-key.pem"), csr = join(folder, "jump-host.csr"), cert = join(folder, "jump-host-cert.pem"), ext = join(folder, "jump-host.ext");
  requireSuccess("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", caKey, "-out", ca, "-days", "1", "-subj", "/CN=ITM-294 fixture CA"]);
  requireSuccess("openssl", ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", csr, "-subj", "/CN=localhost"]);
  writeFileSync(ext, "subjectAltName=DNS:localhost\n");
  requireSuccess("openssl", ["x509", "-req", "-in", csr, "-CA", ca, "-CAkey", caKey, "-CAcreateserial", "-out", cert, "-days", "1", "-extfile", ext]);
  return { ca, key, cert };
}

// TST-294001
// level: component
// module: MOD-settings-pages
// guards: UC-003; UC-044; A BRIDGE CAN BE REACHED OVER HTTPS THROUGH THE JUMP HOST; THE JUMP HOST FORWARDS TO A BRIDGE ONLY AFTER ITS OWN LOGIN; THE JUMP HOST ALLOWS CROSS-ORIGIN REQUESTS ONLY FROM THE INSTANCE; A REVERSE TUNNEL LISTENS ONLY ON THE JUMP HOST'S LOOPBACK
// given: the Settings public endpoint route, emitted Apache and nginx configurations adapted only with temporary ports/files, a fixture CA trusted by the worker with hostname verification, and a real own-key ssh2 reverse tunnel to a composed Bridge and controlled model; the web servers listen, and the jump host accepts the reverse forward, 2.5 s after they are asked
// input: Save and test one own-model endpoint through each authenticated HTTPS jump-host choice; valid and foreign preflights, missing web login, and a refused Bridge token use the same configured HTTPS address
// expect: only the instance preflight is answered locally; no rejected request reaches the tunnel/model; a saved endpoint/key survives refusal; the routed loopback tunnel yields the controlled one-word answer; web login, Bridge token, endpoint key and repository/cookie state remain separate
// GitHub Ubuntu additionally copies the guarded production proxy emitter, faults its upstream production template in
// that copy, records this case's failure, restores the exact bytes, and records the restored same-case positive.
test("TST-294001: Settings reaches the composed Bridge through real Apache and nginx TLS reverse tunnels", { skip: !onControlledUbuntu }, () => {
  ensureWebServers();
  const folder = mkdtempSync(join(tmpdir(), "agent-m-294-component-"));
  const tls = certificate(folder), nodePath = stageSsh2();
  const worker = `
    import assert from "node:assert/strict";
    import { createHash, timingSafeEqual } from "node:crypto";
    import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
    import { createRequire } from "node:module";
    import http from "node:http";
    import net from "node:net";
    import { spawn } from "node:child_process";
    import { join } from "node:path";
    import { openDashboard, press, repoServer, richDocument } from ${JSON.stringify(new URL("./app-harness.mjs", import.meta.url).href)};
    import { proxyConfiguration } from ${JSON.stringify(pathToFileURL(join(sourceRoot, "bridge-client/index.mjs")).href)};
    import { compose } from ${JSON.stringify(pathToFileURL(join(sourceRoot, "desktop-shell/compose.mjs")).href)};
    import { saveSettings } from ${JSON.stringify(pathToFileURL(join(sourceRoot, "desktop-shell/settings.mjs")).href)};
    import { ensureKey } from ${JSON.stringify(pathToFileURL(join(sourceRoot, "tunnels/index.mjs")).href)};
    const require = createRequire(import.meta.url), { Server, utils } = require("ssh2");
    const [folder, ca, certificate, certificateKey] = process.argv.slice(1);
    const origin = "https://akmaier.github.io", prefix = "agent-m:akmaier/agent-m:", nativeFetch = globalThis.fetch;
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const listen = server => new Promise((resolve, reject) => { const onError = error => reject(error); server.once("error", onError); server.listen(0, "127.0.0.1", () => { server.off("error", onError); resolve(server.address().port); }); });
    const listenAt = (server, port, host) => new Promise((resolve, reject) => { const onError = error => reject(error); server.once("error", onError); server.listen(port, host, () => { server.off("error", onError); resolve(); }); });
    const close = server => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const hash = value => "{SHA}" + createHash("sha1").update(value).digest("base64");
    const reservePort = async () => { const server = net.createServer(); const port = await listen(server); await close(server); return port; };
    // Waits on the condition itself. A check that throws ends the wait at once; the ceiling is only a backstop for a condition that never comes
    // (three waits of it fit in the 40 s the test gives this worker), so a slow runner is waited for and a dead one is named with its state.
    const waitFor = async (check, label, state = () => "", ceiling = 8000) => { const started = Date.now(); for (;;) { if (await check()) return; if (Date.now() - started >= ceiling) throw new Error(label + " after " + (Date.now() - started) + " ms: " + state()); await pause(20); } };
    // A cold runner answers late: the main run makes the web servers listen, and the jump host accept the reverse forward, 2.5 s after
    // they are asked. The counter-proof children run without that delay, so that the faulted one fails as fast as it did.
    const slowStart = process.env.AGENT_M_294_FAULT_CHILD ? 0 : 2500;
    const start = (binary, args, options = {}, delay = 0) => { const child = delay > 0 ? spawn("sh", ["-c", 'sleep "$0"; exec "$@"', String(delay / 1000), binary, ...args], { stdio: ["ignore", "ignore", "pipe"], ...options }) : spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"], ...options }); let stderr = "", spawnError = null; child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-4000); }); child.once("error", error => { spawnError = error; }); return { child, stderr: () => stderr, error: () => spawnError }; };
    const stop = async process => { if (!process || process.exitCode !== null) return; process.kill("SIGTERM"); await Promise.race([new Promise(resolve => process.once("exit", resolve)), pause(5000)]); if (process.exitCode === null) process.kill("SIGKILL"); };
    const modelReceipts = [], tunnelReceipts = [], sshAuthentication = [], sshForwarding = [], proxyProcesses = new Set();
    // A working test also reads the model's context from the endpoint's listings (GET /models, GET /model/info: modelContext of MOD-endpoint-calls);
    // the controlled model lists none, so the receipts stay the model calls.
    const model = http.createServer(async (request, response) => { if (request.method === "GET") { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ data: [] })); return; } let body = ""; for await (const chunk of request) body += chunk; modelReceipts.push({ path: request.url, authorization: request.headers.authorization, body: JSON.parse(body) }); response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] })); });
    const modelPort = await listen(model);
    const bridgeFolder = join(folder, "bridge"); mkdirSync(bridgeFolder, { recursive: true });
    const persistedKey = await ensureKey(bridgeFolder), persistedPublicKey = readFileSync(join(bridgeFolder, "ssh", "id_ed25519.pub"), "utf8"), allowedBridgeKey = utils.parseKey(persistedPublicKey);
    assert.ok(!(allowedBridgeKey instanceof Error), "the production-persisted Bridge public key parses for ssh2 authentication");
    assert.equal(persistedKey.publicKey, persistedPublicKey, "the permitted SSH key is the Bridge's persisted public key");
    let receiptOrder = 0, signedAuthentication = null, remote;
    const ssh = new Server({ hostKeys: [utils.generateKeyPairSync("rsa", { bits: 2048 }).private] }, client => {
      client.on("error", () => {});
      client.on("authentication", context => {
        const receipt = { order: ++receiptOrder, username: context.username, method: context.method, signed: Boolean(context.signature), keyMatches: false, signatureValid: null, accepted: false };
        sshAuthentication.push(receipt);
        if (context.username !== "fixture" || context.method !== "publickey") return context.reject();
        const expected = allowedBridgeKey.getPublicSSH();
        receipt.keyMatches = context.key.algo === allowedBridgeKey.type && context.key.data.length === expected.length && timingSafeEqual(context.key.data, expected);
        if (!receipt.keyMatches) return context.reject();
        if (!context.signature) { receipt.accepted = true; return context.accept(); }
        receipt.signatureValid = allowedBridgeKey.verify(context.blob, context.signature, context.hashAlgo) === true;
        if (!receipt.signatureValid) return context.reject();
        receipt.accepted = true; signedAuthentication = receipt; context.accept();
      });
      client.on("request", async (accept, reject, name, info) => {
        if (name !== "tcpip-forward" || info.bindAddr !== "127.0.0.1" || !signedAuthentication) return reject();
        const receipt = { order: ++receiptOrder, signedAuthenticationOrder: signedAuthentication.order, bind: info.bindAddr, port: info.bindPort }; sshForwarding.push(receipt);
        assert.ok(receipt.signedAuthenticationOrder < receipt.order, "the signed Bridge-key authentication precedes reverse forwarding");
        await pause(slowStart);
        remote = net.createServer(socket => client.forwardOut(info.bindAddr, info.bindPort, socket.remoteAddress, socket.remotePort, (error, stream) => { if (error) return socket.destroy(error); tunnelReceipts.push({ bind: info.bindAddr, port: info.bindPort, signedAuthenticationOrder: signedAuthentication.order }); socket.pipe(stream).pipe(socket); }));
        try { await listenAt(remote, info.bindPort, info.bindAddr); accept(); } catch (error) { reject(); }
      });
    });
    const sshPort = await listen(ssh), tunnelPort = await reservePort(), persistedPort = await reservePort();
    const persisted = saveSettings(bridgeFolder, { name: "component", port: persistedPort, agents: [], products: [], every: 300, paused: false, jumpHost: { hostname: "127.0.0.1", user: "fixture", sshPort }, tunnels: [{ direction: "reverse", jumpHost: "127.0.0.1", user: "fixture", sshPort, remotePort: tunnelPort, bind: "127.0.0.1", bridgePort: persistedPort }] });
    assert.equal(persisted.port, persistedPort, "the public settings writer persists a valid Bridge port for the composed runtime");
    const bridge = await compose({ instance: "akmaier/agent-m", origin, dataFolder: bridgeFolder });
    assert.equal(bridge.key.publicKey, persistedPublicKey, "composition reuses the actual persisted Bridge public key required by the fixture jump host");
    assert.equal(Number(new URL(bridge.address).port), persistedPort, "composition listens at the Bridge port the reverse tunnel names");
    let tunnelRows = [];
    await waitFor(async () => { tunnelRows = await bridge.tunnels(); return tunnelRows[0]?.state === "open"; }, "reverse tunnel did not become open", () => JSON.stringify(tunnelRows));
    assert.ok(signedAuthentication?.accepted && signedAuthentication.signed && signedAuthentication.signatureValid, "the reverse tunnel completed signed public-key authentication with the Bridge key");
    assert.ok(sshForwarding.length > 0 && sshForwarding.every(receipt => receipt.signedAuthenticationOrder < receipt.order), "every accepted reverse forward follows signed Bridge-key authentication");
    const directPair = await nativeFetch(bridge.address + "/v1/pair", { headers: { Origin: origin, "x-agent-m-bridge-token": bridge.token } });
    assert.equal(directPair.status, 200, "the composed loopback Bridge pairs before the authenticated HTTPS proxy probe");
    const login = { user: "fixture-web", password: "fixture-web-password" };
    const loginFile = join(folder, "jump-host.htpasswd"); writeFileSync(loginFile, login.user + ":" + hash(login.password) + "\\n");
    const runServer = async kind => {
      const port = await reservePort(), root = join(folder, kind); mkdirSync(root, { recursive: true });
      const emitted = proxyConfiguration({ hostname: "localhost" }, [{ name: "component", port: tunnelPort, token: bridge.token }], origin, kind)
        .replaceAll("/etc/agent-m/jump-host-cert.pem", certificate).replaceAll("/etc/agent-m/jump-host-key.pem", certificateKey).replaceAll("/etc/agent-m/jump-host.htpasswd", loginFile);
      let serverProcess;
      if (kind === "apache") {
        // The generated virtual host needs these modules, some of which are normally disabled on a fresh Ubuntu
        // worker. Resolve them from the installed package's available modules, rather than copying the host's
        // enabled set. The temporary ServerRoot receives their load files and optional matching configuration only.
        const available = "/etc/apache2/mods-available", modules = join(root, "modules"); mkdirSync(modules, { recursive: true });
        const availableNames = new Set(readdirSync(available));
        const mpm = ["mpm_event", "mpm_worker", "mpm_prefork"].find(name => availableNames.has(name + ".load"));
        assert.ok(mpm, "an installed Apache MPM is available for the temporary ServerRoot");
        // Production apache() emits SSL, Header, Rewrite, Basic/file authentication,
        // Require valid-user authorization, and HTTP proxy directives. ssl.conf adds
        // AddType (mime), BrowserMatch (setenvif), and SSLSessionCache (socache_shmcb).
        const emittedModules = ["ssl", "proxy", "proxy_http", "rewrite", "headers", "auth_basic", "authn_file", "authn_core", "authz_core", "authz_user"];
        const sslConfigurationDependencies = ["mime", "setenvif", "socache_shmcb"];
        const required = [...emittedModules, ...sslConfigurationDependencies, mpm];
        const configured = new Set(["ssl"]);
        for (const name of required) {
          assert.ok(availableNames.has(name + ".load"), "installed Apache module is available: " + name);
          cpSync(join(available, name + ".load"), join(modules, name + ".load"), { dereference: true });
          if (configured.has(name) && availableNames.has(name + ".conf")) cpSync(join(available, name + ".conf"), join(modules, name + ".conf"), { dereference: true });
        }
        const loaded = readdirSync(modules).filter(name => name.endsWith(".load"));
        assert.ok([...emittedModules, ...sslConfigurationDependencies].every(name => loaded.includes(name + ".load")), "temporary Apache configuration loads every generated directive provider and ssl.conf dependency");
        assert.ok(readdirSync(modules).includes("ssl.conf"), "temporary Apache configuration stages the installed SSL configuration");
        assert.deepEqual(loaded.filter(name => /^mpm_.*\.load$/.test(name)), [mpm + ".load"], "temporary Apache configuration stages exactly one installed MPM");
        // The installed mime module resolves its TypesConfig relative to this temporary
        // ServerRoot. Copy the installed package data to that resolved temporary path.
        const mimeTypes = "/etc/mime.types";
        assert.ok(existsSync(mimeTypes), "the installed Apache MIME data is available");
        cpSync(mimeTypes, join(root, "mime.types"), { dereference: true });
        assert.ok(existsSync(join(root, "mime.types")), "temporary ServerRoot stages the installed MIME data");
        const runtime = join(root, "run"), logs = join(root, "log"), locks = join(root, "lock"); mkdirSync(runtime, { recursive: true }); mkdirSync(logs, { recursive: true }); mkdirSync(locks, { recursive: true });
        const apacheEnvironment = { ...process.env, APACHE_RUN_DIR: runtime, APACHE_LOG_DIR: logs, APACHE_LOCK_DIR: locks, APACHE_PID_FILE: join(root, "httpd.pid") };
        const config = ["ServerRoot \\\"" + root + "\\\"", "DefaultRuntimeDir \\\"" + runtime + "\\\"", "PidFile \\\"" + join(root, "httpd.pid") + "\\\"", "Listen 127.0.0.1:" + port, "ServerName localhost", "ErrorLog \\\"" + join(root, "error.log") + "\\\"", "CustomLog \\\"" + join(root, "access.log") + "\\\" combined", "IncludeOptional \\\"" + join(modules, "*.load") + "\\\"", "IncludeOptional \\\"" + join(modules, "*.conf") + "\\\"", emitted.replace("<VirtualHost *:443>", "<VirtualHost 127.0.0.1:" + port + ">")].join("\\n");
        const file = join(root, "httpd.conf"); writeFileSync(file, config); serverProcess = start("apache2", ["-f", file, "-DFOREGROUND"], { env: apacheEnvironment }, slowStart);
      } else {
        const config = ["pid " + join(root, "nginx.pid") + ";", "error_log " + join(root, "error.log") + ";", "events {}", "http {", "  access_log " + join(root, "access.log") + ";", emitted.replace("listen 443 ssl;", "listen 127.0.0.1:" + port + " ssl;").split("\\n").map(line => "  " + line).join("\\n"), "}"].join("\\n");
        const file = join(root, "nginx.conf"); writeFileSync(file, config); serverProcess = start("nginx", ["-p", root, "-c", file, "-g", "daemon off;"], {}, slowStart);
      }
      const base = "https://localhost:" + port + "/bridge/component", readiness = { attempts: 0, statuses: [], errors: [] }, readinessAuthorization = "Basic " + btoa(login.user + ":" + login.password);
      const redact = value => String(value ?? "").replaceAll(bridge.token, "<bridge-token>").replaceAll(readinessAuthorization, "<jump-login-authorization>").replaceAll(login.password, "<jump-login-password>");
      const logTail = file => { try { return redact(readFileSync(file, "utf8").slice(-4000)); } catch (error) { return "unavailable:" + (error.code ?? error.name); } };
      const ready = async () => {
        if (serverProcess.child.exitCode !== null || serverProcess.error()) throw new Error(kind + " exited, so it did not accept TLS");
        readiness.attempts += 1;
        try {
          const reply = await nativeFetch(base + "/v1/pair", { headers: { Origin: origin, Authorization: readinessAuthorization, "x-agent-m-bridge-token": bridge.token } });
          readiness.statuses.push(reply.status);
          return reply.status === 200;
        } catch (error) {
          readiness.errors.push(redact((error.name ?? "Error") + ": " + (error.message ?? "")));
          return false;
        }
      };
      try { await waitFor(ready, kind + " did not accept TLS", () => "last status " + (readiness.statuses.at(-1) ?? "none")); return { base, process: serverProcess }; }
      catch (error) {
        const diagnostic = { kind, readiness: { attempts: readiness.attempts, statuses: [...new Set(readiness.statuses)], lastStatus: readiness.statuses.at(-1) ?? null, errors: [...new Set(readiness.errors)].slice(-4) }, process: { exitCode: serverProcess.child.exitCode, signalCode: serverProcess.child.signalCode, spawnError: serverProcess.error()?.code ?? null, stderr: redact(serverProcess.stderr()) }, logs: { errorLog: logTail(join(root, "error.log")), accessLog: logTail(join(root, "access.log")) } };
        console.log("TST-294001-readiness " + JSON.stringify(diagnostic));
        await stop(serverProcess.child); throw new Error(kind + " startup: " + JSON.stringify(diagnostic) + "; " + error.message);
      }
    };
    try {
      for (const kind of ["apache", "nginx"]) {
        const proxy = await runServer(kind), base = proxy.base; proxyProcesses.add(proxy.process);
        const beforeRejected = tunnelReceipts.length, modelsBeforeRejected = modelReceipts.length, basic = "Basic " + btoa(login.user + ":" + login.password);
        const foreign = await nativeFetch(base + "/v1/probes/endpoint-test", { method: "OPTIONS", headers: { Origin: "https://foreign.example", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-agent-m-bridge-token" } });
        assert.equal(foreign.status, 403, kind + " refuses foreign preflight before its tunnel");
        const allowed = await nativeFetch(base + "/v1/probes/endpoint-test", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-agent-m-bridge-token" } });
        assert.equal(allowed.status, 204, kind + " answers the instance preflight itself"); assert.equal(tunnelReceipts.length, beforeRejected, kind + " did not forward preflights");
        const noLogin = await nativeFetch(base + "/v1/probes/endpoint-test", { method: "POST", headers: { Origin: origin, "content-type": "application/json", "x-agent-m-bridge-token": bridge.token }, body: JSON.stringify({ args: {} }) });
        assert.equal(noLogin.status, 401, kind + " refuses its own missing web login"); assert.equal(tunnelReceipts.length, beforeRejected, kind + " did not forward missing login");
        const badToken = await nativeFetch(base + "/v1/probes/endpoint-test", { method: "POST", headers: { Origin: origin, Authorization: basic, "content-type": "application/json", "x-agent-m-bridge-token": "wrong-token" }, body: JSON.stringify({ args: { name: "wrong", kind: "openai-compatible", baseUrl: "http://127.0.0.1:" + modelPort + "/v1", model: "controlled", key: "endpoint-key" } }) });
        assert.equal(badToken.status, 401, kind + " carries a refused Bridge token to the Bridge"); assert.equal(modelReceipts.length, modelsBeforeRejected, kind + " refuses the Bridge token before another model call");
        const server = await repoServer({ files: {}, handlers: [async (url, init) => url.origin === new URL(base).origin ? nativeFetch(url.href, { ...init, headers: { ...init.headers, Origin: origin } }) : null, async (url, init) => url.origin === "http://127.0.0.1:" + modelPort ? nativeFetch(url.href, init) : null] });
        const entries = { [prefix + "bridge:component"]: JSON.stringify({ name: "component", port: tunnelPort, token: "wrong-token" }), [prefix + "jump-host"]: JSON.stringify({ hostname: "localhost", user: "fixture", sshPort, portRange: [tunnelPort, tunnelPort], httpsAddress: new URL(base).origin, login }) };
        const page = await openDashboard({ server, hash: "#uc", entries }); const dom = richDocument(), main = dom.byId("main"); let mounted = []; globalThis.document.cookie = "";
        const replace = main.replaceChildren.bind(main); main.replaceChildren = (...children) => { mounted = children; replace(...children); };
        await page.go("#settings");
        const pane = mounted.find(node => node.className === "settings-tab-panel" && /Endpoints & Agents/.test(node.textContent));
        const configure = pane?.querySelector("button.settings-endpoint-configure");
        assert.ok(configure, kind + " public Settings mounts Configure in Endpoints & Agents");
        await press(server, configure);
        assert.equal(globalThis.location.hash, "#settings", kind + " public Settings Configure stays in place");
        assert.ok(main.querySelector(".endpoint-name"), kind + " public Settings opens the endpoint form");
        const key = "endpoint-key-" + kind; main.querySelector(".endpoint-name").value = "through-" + kind; main.querySelector(".endpoint-url").value = "http://127.0.0.1:" + modelPort + "/v1"; main.querySelector(".endpoint-model").value = "controlled-" + kind; main.querySelector(".endpoint-key").value = key; main.querySelector(".endpoint-bridge").value = "component";
        await press(server, main.querySelector(".endpoint-test")); assert.match(main.querySelector(".endpoint-result").textContent, /Bridge refused its pairing token/, kind + " Settings shows its real refused Bridge token");
        assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(prefix + "endpoint:through-" + kind)), { url: "http://127.0.0.1:" + modelPort + "/v1", kind: "openai-compatible", model: "controlled-" + kind, bridge: "component", key }, kind + " saved endpoint/key survives refusal");
        globalThis.localStorage.setItem(prefix + "bridge:component", JSON.stringify({ name: "component", port: tunnelPort, token: bridge.token })); await press(server, main.querySelector(".endpoint-test")); assert.match(main.querySelector(".endpoint-result").textContent, new RegExp("controlled-" + kind + " is working"), kind + " visible failure node: Settings shows the routed model answer");
        assert.equal(globalThis.document.cookie, "", kind + " stores no configuration cookie"); assert.equal(server.writes.length, 0, kind + " writes no repository credential"); assert.equal(server.requests.some(request => request.includes(key) || request.includes(login.password) || request.includes(bridge.token)), false, kind + " repository ledger receives no credential"); assert.equal(base.includes(key) || base.includes(login.password) || base.includes(bridge.token), false, kind + " configured URL contains no credential");
        const forwardsBeforeDirect = tunnelReceipts.length; main.querySelector(".endpoint-name").value = "direct-" + kind; main.querySelector(".endpoint-model").value = "direct-" + kind; main.querySelector(".endpoint-key").value = "direct-key-" + kind; main.querySelector(".endpoint-bridge").value = "";
        await press(server, main.querySelector(".endpoint-test")); assert.match(main.querySelector(".endpoint-result").textContent, new RegExp("direct-" + kind + " is working"), kind + " ordinary endpoint remains browser-direct"); assert.equal(tunnelReceipts.length, forwardsBeforeDirect, kind + " ordinary endpoint did not use the HTTPS tunnel");
        await stop(proxy.process.child); proxyProcesses.delete(proxy.process);
      }
      assert.deepEqual(modelReceipts.map(value => ({ path: value.path, authorization: value.authorization, body: value.body })), ["apache", "nginx"].flatMap(kind => [{ path: "/v1/chat/completions", authorization: "Bearer endpoint-key-" + kind, body: { model: "controlled-" + kind, messages: [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }], max_tokens: 64,
        tools: [{ type: "function", function: { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", parameters: { type: "object", properties: {}, additionalProperties: false } } }], stream: false } }, { path: "/v1/chat/completions", authorization: "Bearer direct-key-" + kind, body: { model: "direct-" + kind, messages: [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }], max_tokens: 64,
        tools: [{ type: "function", function: { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", parameters: { type: "object", properties: {}, additionalProperties: false } } }], stream: false } }]), "the actual Bridge handler and ordinary direct route each call the controlled model once per configured web server");
      assert.ok(tunnelReceipts.every(value => value.bind === "127.0.0.1" && value.port === tunnelPort && value.signedAuthenticationOrder < sshForwarding[0].order), "the web servers reached only the reverse tunnel loopback end after signed Bridge-key authentication");
      console.log("itm294-component-positive", JSON.stringify({ webServers: ["apache", "nginx"], modelCalls: modelReceipts.length, tunnelForwards: tunnelReceipts.length, sshAuthentication, sshForwarding }));
    } finally { for (const proxy of proxyProcesses) await stop(proxy.child); await bridge.close(); if (remote) await close(remote).catch(() => {}); await close(ssh); await close(model); rmSync(folder, { recursive: true, force: true }); }
  `;
  try {
    const result = command(process.execPath, ["--input-type=module", "--eval", worker, folder, tls.ca, tls.cert, tls.key], { cwd: root, env: { ...process.env, NODE_PATH: nodePath, NODE_EXTRA_CA_CERTS: tls.ca } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /itm294-component-positive/);
    if (!process.env.AGENT_M_294_FAULT_CHILD) {
      const temporary = mkdtempSync(join(tmpdir(), "agent-m-294-fault-")), copied = join(temporary, "src"), emitter = join(copied, "bridge-client", "proxy.mjs");
      cpSync(sourceRoot, copied, { recursive: true });
      const original = readFileSync(emitter), originalHash = createHash("sha256").update(original).digest("hex");
      const mutation = Buffer.from(original.toString().replaceAll('`http://127.0.0.1:${session.port}/`', '`http://127.0.0.1:1/`'));
      assert.notDeepEqual(mutation, original, "fault text exists in the guarded production proxy emitter");
      const childArgv = [process.execPath, "--test", "--test-name-pattern", "TST-294001", new URL(import.meta.url).pathname];
      const childEnvironment = { AGENT_M_294_SOURCE_ROOT: copied, AGENT_M_294_FAULT_CHILD: "1" };
      const invoke = () => { const env = { ...process.env, ...childEnvironment }; delete env.NODE_TEST_CONTEXT; return command(childArgv[0], childArgv.slice(1), { cwd: root, env }); };
      try {
        const faultStarted = new Date().toISOString(); writeFileSync(emitter, mutation); const faultSourceHash = createHash("sha256").update(readFileSync(emitter)).digest("hex"), failed = invoke(), faultEnded = new Date().toISOString();
        const restoredStarted = new Date().toISOString(); writeFileSync(emitter, original); const restoredSourceHash = createHash("sha256").update(readFileSync(emitter)).digest("hex"), passed = invoke(), restoredEnded = new Date().toISOString();
        const receipt = { case: "TST-294001", cwd: root, childArgv, childEnvironment: { ...childEnvironment, NODE_TEST_CONTEXT: null }, originalHash, faultSourceHash, restoredSourceHash, testHash: createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex"), fault: "proxy.mjs upstream template `http://127.0.0.1:${session.port}/` -> `http://127.0.0.1:1/`", faultStarted, faultEnded, faultStatus: failed.status, faultSignal: failed.signal, faultError: failed.error?.code ?? null, faultStdout: failed.stdout, faultStderr: failed.stderr, restoredStarted, restoredEnded, restoredStatus: passed.status, restoredSignal: passed.signal, restoredError: passed.error?.code ?? null, restoredStdout: passed.stdout, restoredStderr: passed.stderr };
        process.stdout.write(`TST-294001-counterproof ${JSON.stringify(receipt)}\\n`);
        assert.equal(restoredSourceHash, originalHash, "byte-exact source restoration precedes the same-case positive");
        const faultOutput = `${failed.stdout}\\n${failed.stderr}`, restoredOutput = `${passed.stdout}\\n${passed.stderr}`;
        assert.equal(failed.status, 1, "faulted same case exits with Node test failure status 1"); assert.equal(failed.signal, null, "fault receipt is not a timed-out child"); assert.equal(failed.error, undefined, "fault receipt has no launcher error");
        assert.match(faultOutput, /not ok 1 - TST-294001: Settings reaches the composed Bridge through real Apache and nginx TLS reverse tunnels/, "the fault receipt identifies the failed same case");
        assert.match(faultOutput, /visible working assertion|(?:apache|nginx) did not accept TLS/, "fault reaches the guarded emitted HTTPS route assertion");
        assert.equal(passed.status, 0, "byte-restored same case passes"); assert.equal(passed.signal, null, "restored receipt is not a timed-out child"); assert.equal(passed.error, undefined, "restored receipt has no launcher error"); assert.match(restoredOutput, /ok 1 - TST-294001: Settings reaches the composed Bridge through real Apache and nginx TLS reverse tunnels/, "restored receipt identifies the same passing case");
      } finally { writeFileSync(emitter, original); rmSync(temporary, { recursive: true, force: true }); }
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
