---
id: ITM-294
title: The authenticated HTTPS reverse-tunnel integration
level: component
realises:
  - UC-003
  - UC-044
  - A BRIDGE CAN BE REACHED OVER HTTPS THROUGH THE JUMP HOST
  - THE JUMP HOST FORWARDS TO A BRIDGE ONLY AFTER ITS OWN LOGIN
  - THE JUMP HOST ALLOWS CROSS-ORIGIN REQUESTS ONLY FROM THE INSTANCE
  - A REVERSE TUNNEL LISTENS ONLY ON THE JUMP HOST'S LOOPBACK
modules:
  - MOD-settings-pages
  - MOD-browser-store
  - MOD-bridge-client
  - MOD-tunnels
  - MOD-desktop-shell
  - MOD-bridge-http
  - MOD-bridge-jobs
  - MOD-endpoint-calls
builds_on:
  - ITM-266
  - ITM-282
  - ITM-283
  - ITM-284
  - ITM-285
  - ITM-286
  - ITM-287
  - ITM-288
  - ITM-291
  - ITM-404
tests:
  - component
origin:
  - UC-003 alternative 2a
  - UC-044 alternative 6a step 5
  - MOD-bridge-client proxyConfiguration
built_by:
  - b508cede042458de8a8f27b61e141236e51a84ee
---
# ITM-294 The authenticated HTTPS reverse-tunnel integration

**REGISTER**

## Outcome

Integrate the delivered configured-HTTPS path needed by UC-003 alternative 2a: the public Settings endpoint route
stores and tests an own-model endpoint whose configuration names a Bridge reached through the jump host — at the
jump host's HTTPS address with that Bridge's path `/bridge/<name>` —, through an authenticated HTTPS jump-host route,
its real loopback reverse tunnel, and the production composed Bridge and endpoint handler. The controlled model observes the short request
and the page shows the real answer. Use the existing public interfaces and actual emitted Apache/nginx configurations;
no result stub or direct fetch to the Bridge replaces the HTTPS or tunnel segment.

This component outcome joins delivered modules. ITM-266's configured HTTPS forwarding fixture, ITM-282's configuration
string checks and ITM-291's real own-key reverse path remain unchanged. It adds the missing real web-server integration,
without duplicating their completed outcomes or claiming current-browser measurement. It implements no discovery,
updates, agent installation, watch/mail workflow, signing/distribution or new API.

## Acceptance

- New component tests exercise both supported proxyConfiguration server choices with real temporary web servers,
  TLS, web-server login and the actual tunnel runtime/key/composed Bridge. Temporary ports, certificate and login-file
  paths adapt the emitted configuration to the controlled fixture; authentication, CORS and forwarding semantics remain
  the production configuration's. Read the existing public caller and controlled fixture patterns before writing.
- Follow the actual public endpoint route: save before testing, separate web-server login and Bridge-token headers,
  real controlled-model answer, and the UC-003 refusal behavior without discarding the saved endpoint/key. Ordinary
  remote endpoints retain browser-direct behavior.
- Verify the accepted failure boundaries at their real nodes: refused web-server login forwards nothing; instance-only
  CORS/preflight is handled by the web server without forwarding; the Bridge's path reaches its loopback reverse end;
  refused Bridge token reaches no model. Credentials do not enter URLs, repository writes or configuration cookies.
- Use a fixture CA trusted only by the controlled test client/process, with hostname verification; never disable TLS
  verification, change system trust or describe a fixture certificate as an authority trusted by current browsers.
  The real trusted host and authorized Chrome/Firefox/Safari evidence of ITM-267 remain separate unfinished work.
- Only new tests and their necessary controlled test data/adapters change. A concrete product failure is handed back
  with its caller/data-flow path for a separately bounded owned source correction; expectations stay accepted-contract
  expectations. Component evidence has the existing canonical declarations, relevant production fault and SAME-case
  failure/restoration/positive required by SPEC; no additional per-assertion proof quota is introduced.
- Execute full/native/web-server integration only in controlled GitHub Ubuntu, each job within120 seconds. Temporary
  servers, tunnels and private fixture files are closed/removed; no external SSH host, paid model or personal state is
  accessed. No local full/native/browser work or whole UC-003/UC-044 completion claim.
