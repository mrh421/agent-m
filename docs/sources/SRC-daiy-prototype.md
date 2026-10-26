---
id: SRC-daiy-prototype
title: D.AI.Y clickable prototype
kind: system
authority: advisory
licence: may be republished — the team's own work, in a public repository
identifier: github.com/mrh421/Applied_AI_DAIY/prototype
content_repository: https://github.com/mrh421/Applied_AI_DAIY
---
# SRC-daiy-prototype D.AI.Y clickable prototype

The existing prototype (TanStack Start, React): AI logic, safety checks, schema, intake and result screens, unit tests and the 31 AI eval cases. It shows what is built, not what is wanted: behaviour read from it is a candidate requirement the Product Owner accepts or rejects, and it is the baseline of the architecture.

## Versions

| Version | Date | Edition | Read from | Files |
|---|---|---|---|---|
| `2026-10-25` | 2026-10-25 | the behaviour-bearing files at the commit named under Read from; error reporting, utilities, the generated UI library and the lock file are left out | github.com/mrh421/Applied_AI_DAIY, commit `cd249c4b2e685c75eb4cf88b73f07869e349285c` | 43 files, listed below; version hash `02f93192c4b46e494fe2103992c95099e0501e5ba73e8d9757e13f6a7bc99a0b`; not stored: prototype/AGENTS.md, prototype/eval/README.md, prototype/eval/cases/case-001-tc-a1-dripping-faucet.yaml, prototype/eval/cases/case-002-tc-a2-sticking-drawer.yaml, prototype/eval/cases/case-003-tc-a3-burnt-socket.yaml, prototype/eval/cases/case-004-tc-a4-leak-at-wall.yaml, prototype/eval/cases/case-005-tc-b1-wooden-fence.yaml, prototype/eval/cases/case-006-tc-b2-heat-pump-integration.yaml, prototype/eval/cases/case-007-tc-b3-distribution-board.yaml, prototype/eval/cases/case-008-tc-b4-mesh-guest-network.yaml, prototype/eval/cases/case-009-tc-c1-desk-budget.yaml, prototype/eval/cases/case-010-tc-c2-pallet-loft-bed.yaml, prototype/eval/cases/case-011-tc-c3-desk-niche-fit.yaml, prototype/eval/cases/case-012-tc-d1-turntable-slow.yaml, prototype/eval/cases/case-013-tc-d2-3d-print-hinge.yaml, prototype/eval/cases/case-014-tc-d3-psu-capacitor.yaml, prototype/eval/cases/case-015-loose-cabinet-door.yaml, prototype/eval/cases/case-016-broken-drawer-handle.yaml, prototype/eval/cases/case-017-shelf-rented-flat.yaml, prototype/eval/cases/case-018-squeaky-door.yaml, prototype/eval/cases/case-019-paint-room.yaml, prototype/eval/cases/case-020-washing-machine-noise.yaml, prototype/eval/cases/case-021-office-chair-sinks.yaml, prototype/eval/cases/case-022-blind-replacement-part.yaml, prototype/eval/cases/case-023-gas-smell-stove.yaml, prototype/eval/cases/case-024-verschmorte-steckdose-de.yaml, prototype/eval/cases/case-025-co-alarm.yaml, prototype/eval/cases/case-026-remove-wall.yaml, prototype/eval/cases/case-027-refill-refrigerant.yaml, prototype/eval/cases/case-028-ceiling-lamp.yaml, prototype/eval/cases/case-029-bathroom-refresh.yaml, prototype/eval/cases/case-030-attic-insulation-conduit.yaml, prototype/eval/cases/case-031-wallbox.yaml, prototype/src/components/repair/Intake.tsx, prototype/src/components/repair/Result.tsx, prototype/src/lib/ai.server.ts, prototype/src/lib/offers.ts, prototype/src/lib/profiles.ts, prototype/src/lib/repair.functions.ts, prototype/src/lib/repair.schema.ts, prototype/src/routes/index.tsx, prototype/src/test/app-routing.test.tsx, prototype/src/test/safety.test.ts |
| `2026-10-26` | 2026-10-26 | the same 43 files as 2026-10-25, stored here (a path's `/` is written `__`), so that a job can read them | github.com/mrh421/Applied_AI_DAIY, commit `cd249c4b2e685c75eb4cf88b73f07869e349285c` | 43 files, listed below; version hash `c815c9be4590dfbaaf5d88a7c4936a45bea3bb4a8d5b7270225ee3f0bd4e0181` |

### Files of 2026-10-26

| File | SHA-256 | Kept at |
|---|---|---|
| `AGENTS.md` | `7fb760bd54bd1ec9c18a2d24abfe5cf617d8c3f3c62c14d56fd6b2acd7846c71` | — |
| `eval__README.md` | `6b7cadfeff24bfa4b15fa75ed99d45fba9511427682cabfa4f1db603a21a61ae` | — |
| `eval__cases__case-001-tc-a1-dripping-faucet.yaml` | `ce6c4e4065021f37d21e44020e5f2b0f6bc7e11dce5f5b3076e4d6e9b0902c61` | — |
| `eval__cases__case-002-tc-a2-sticking-drawer.yaml` | `9c0b9afdc1ce178b03efa1caeefc978ffe0d653a32d964645052ad2a872d9fcf` | — |
| `eval__cases__case-003-tc-a3-burnt-socket.yaml` | `acbffa36cd6dd46468e9e1a2c095666c96645426d6c7284c7e1c7f6a86b32934` | — |
| `eval__cases__case-004-tc-a4-leak-at-wall.yaml` | `bae6cd0f30f4c803e23f8298a16d3581436d3a10baebc531fe189a615f4a69b2` | — |
| `eval__cases__case-005-tc-b1-wooden-fence.yaml` | `9e4a28d8904494736b8b1e46b5bd677f074f637611f47b0e7dc1de7233f2d12a` | — |
| `eval__cases__case-006-tc-b2-heat-pump-integration.yaml` | `0b2bc1c6302382fac5e67e9e8d32cda50dd26627dcf98b2779398e0794c0beec` | — |
| `eval__cases__case-007-tc-b3-distribution-board.yaml` | `aaa87f4cbe1e10b2f1b567b62f29082853ba6e32bf5981366afb95db3cadabfc` | — |
| `eval__cases__case-008-tc-b4-mesh-guest-network.yaml` | `6ae73bfb2d7f6da9cab751f29432a5c5b156055be3b496d8af6fc9847e0f4e68` | — |
| `eval__cases__case-009-tc-c1-desk-budget.yaml` | `063535fcd13f2c664d2632fe5fb49da21b68d44e3676e57ba9cd8602c86aaa96` | — |
| `eval__cases__case-010-tc-c2-pallet-loft-bed.yaml` | `e85f6618187f7c0e42cb9d91947968d1e058656d0e13afd840e05862bd3820a9` | — |
| `eval__cases__case-011-tc-c3-desk-niche-fit.yaml` | `1225a9847f3a15f5a2ec77e27f8ee12cfa20dc253a954e941985212d691d62ed` | — |
| `eval__cases__case-012-tc-d1-turntable-slow.yaml` | `b8fe608288384e60bd251c57356edfa6262faa57781d207577754faea27a2943` | — |
| `eval__cases__case-013-tc-d2-3d-print-hinge.yaml` | `ad8eaf9b860c278fc2f5f0ecadbbbecb9c0e16e69654fdf1656bf80ee280b8c0` | — |
| `eval__cases__case-014-tc-d3-psu-capacitor.yaml` | `6d7f3392969eddefff1d9b9d7c8d57aea43390cbed48cb5abeed0cd1ad621c5b` | — |
| `eval__cases__case-015-loose-cabinet-door.yaml` | `c6f09f65245bc49e501219d2c2d57fc96d3a8d6b36b3adbc85653bf2695c820a` | — |
| `eval__cases__case-016-broken-drawer-handle.yaml` | `7aa9042235bb5da6b85039a1c6c782f4195c5ec47718882408b41a41c6f52877` | — |
| `eval__cases__case-017-shelf-rented-flat.yaml` | `840763c3b991291aea779e9081b47f8272e7190e10ae415e42947cdad4a3cf07` | — |
| `eval__cases__case-018-squeaky-door.yaml` | `91d91a53d18b31a117377d8b992acc9d3fbd73a7d159a4e1d360e6d503dd45cf` | — |
| `eval__cases__case-019-paint-room.yaml` | `4ebe320d8024ce9f955fa4365c129e31a986257d806fbf068fce4d478caa9083` | — |
| `eval__cases__case-020-washing-machine-noise.yaml` | `a6e6f8f1b2c530439fc64f55fdf902f6deff9d75360bb37b084b43df24e2148b` | — |
| `eval__cases__case-021-office-chair-sinks.yaml` | `8a7849bb75db0630cf1ab1d0097eb4fe7d322e842e8963e48a4396798e9cc18b` | — |
| `eval__cases__case-022-blind-replacement-part.yaml` | `2bd81a47007125d2b7cbec22dd0f952378e13149228c6559981ef8265a905ad7` | — |
| `eval__cases__case-023-gas-smell-stove.yaml` | `7f69480be2823cf406e9309fc5e11e8399d2f7e712188e9383e639e47b911e0c` | — |
| `eval__cases__case-024-verschmorte-steckdose-de.yaml` | `e16a3cd507d718bb031086d7b512d289fa5228592ff23225e70aef7fb5aa6ed9` | — |
| `eval__cases__case-025-co-alarm.yaml` | `79e27b9269f99c05896ee4dce8f7f81300695469531861de7bef074eb434977d` | — |
| `eval__cases__case-026-remove-wall.yaml` | `d6b541ec66e21428fdaacd9d6fedb0ebd95a7d21b6761e59ef62988599e87857` | — |
| `eval__cases__case-027-refill-refrigerant.yaml` | `a4d2545797acdace5e0d458094f0788631c7d403fa4487ea513069e9e4c74be3` | — |
| `eval__cases__case-028-ceiling-lamp.yaml` | `9a355535c95efd747eaa889d4d2c607220d8d4db94d35a05c4daf6821ae56dd5` | — |
| `eval__cases__case-029-bathroom-refresh.yaml` | `0055ffd844edd099768f4551c913a450fadd963802f7a8da8292a849d81c09ce` | — |
| `eval__cases__case-030-attic-insulation-conduit.yaml` | `619bafd70b403cb3ef1c34d782d3bc682d89fff1cb13c8cb88d24a35b78d7dac` | — |
| `eval__cases__case-031-wallbox.yaml` | `876829b441082b72313eddb9c398f089d587b494531e45f1b3dbfe30a9314b1e` | — |
| `src__components__repair__Intake.tsx` | `1a5064317721e1ee7321d1f290e52c46c8dcca1189091a35143b92e7ba09e8c8` | — |
| `src__components__repair__Result.tsx` | `8c36e770491c0fa59355eeffbc7a3e9169856a0ddc9857cc6ccf0cced78e3546` | — |
| `src__lib__ai.server.ts` | `d836cb83437acf7fad1de4d13de13b2fa45c20855895eadc71e9f9fc5229a49d` | — |
| `src__lib__offers.ts` | `7f086b5411db9e1e3f9c4f4ea6c4067627f8ff688050f310905611eda8634075` | — |
| `src__lib__profiles.ts` | `2a709909717d9db322fc57ff9f6a219d3231b8120fc71950bb2dda9227f5c152` | — |
| `src__lib__repair.functions.ts` | `9d7fe9ff170699b268348e3254fc7e81c24ba08e3f590cf319aa431c80887596` | — |
| `src__lib__repair.schema.ts` | `dd2d1ce2f206adb4e956738caf161fbad55a9a37b53344107e591bdb04f7b85e` | — |
| `src__routes__index.tsx` | `97766cca5d8cbc5ca8186ad088e13b671e8b2f102e2cfcb7bd9c16775791b950` | — |
| `src__test__app-routing.test.tsx` | `c817058668430273e00a43620a835f562b8cfe1234ee361c057958c06470cee3` | — |
| `src__test__safety.test.ts` | `de8446938718c1b832299a175b9647e229380d8e58a08ba40b3ca51f88f51a0d` | — |

### Files of 2026-10-25

| File | SHA-256 | Kept at |
|---|---|---|
| `prototype/AGENTS.md` | `7fb760bd54bd1ec9c18a2d24abfe5cf617d8c3f3c62c14d56fd6b2acd7846c71` | this repository, at commit `cd249c4` |
| `prototype/eval/README.md` | `6b7cadfeff24bfa4b15fa75ed99d45fba9511427682cabfa4f1db603a21a61ae` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-001-tc-a1-dripping-faucet.yaml` | `ce6c4e4065021f37d21e44020e5f2b0f6bc7e11dce5f5b3076e4d6e9b0902c61` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-002-tc-a2-sticking-drawer.yaml` | `9c0b9afdc1ce178b03efa1caeefc978ffe0d653a32d964645052ad2a872d9fcf` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-003-tc-a3-burnt-socket.yaml` | `acbffa36cd6dd46468e9e1a2c095666c96645426d6c7284c7e1c7f6a86b32934` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-004-tc-a4-leak-at-wall.yaml` | `bae6cd0f30f4c803e23f8298a16d3581436d3a10baebc531fe189a615f4a69b2` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-005-tc-b1-wooden-fence.yaml` | `9e4a28d8904494736b8b1e46b5bd677f074f637611f47b0e7dc1de7233f2d12a` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-006-tc-b2-heat-pump-integration.yaml` | `0b2bc1c6302382fac5e67e9e8d32cda50dd26627dcf98b2779398e0794c0beec` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-007-tc-b3-distribution-board.yaml` | `aaa87f4cbe1e10b2f1b567b62f29082853ba6e32bf5981366afb95db3cadabfc` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-008-tc-b4-mesh-guest-network.yaml` | `6ae73bfb2d7f6da9cab751f29432a5c5b156055be3b496d8af6fc9847e0f4e68` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-009-tc-c1-desk-budget.yaml` | `063535fcd13f2c664d2632fe5fb49da21b68d44e3676e57ba9cd8602c86aaa96` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-010-tc-c2-pallet-loft-bed.yaml` | `e85f6618187f7c0e42cb9d91947968d1e058656d0e13afd840e05862bd3820a9` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-011-tc-c3-desk-niche-fit.yaml` | `1225a9847f3a15f5a2ec77e27f8ee12cfa20dc253a954e941985212d691d62ed` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-012-tc-d1-turntable-slow.yaml` | `b8fe608288384e60bd251c57356edfa6262faa57781d207577754faea27a2943` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-013-tc-d2-3d-print-hinge.yaml` | `ad8eaf9b860c278fc2f5f0ecadbbbecb9c0e16e69654fdf1656bf80ee280b8c0` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-014-tc-d3-psu-capacitor.yaml` | `6d7f3392969eddefff1d9b9d7c8d57aea43390cbed48cb5abeed0cd1ad621c5b` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-015-loose-cabinet-door.yaml` | `c6f09f65245bc49e501219d2c2d57fc96d3a8d6b36b3adbc85653bf2695c820a` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-016-broken-drawer-handle.yaml` | `7aa9042235bb5da6b85039a1c6c782f4195c5ec47718882408b41a41c6f52877` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-017-shelf-rented-flat.yaml` | `840763c3b991291aea779e9081b47f8272e7190e10ae415e42947cdad4a3cf07` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-018-squeaky-door.yaml` | `91d91a53d18b31a117377d8b992acc9d3fbd73a7d159a4e1d360e6d503dd45cf` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-019-paint-room.yaml` | `4ebe320d8024ce9f955fa4365c129e31a986257d806fbf068fce4d478caa9083` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-020-washing-machine-noise.yaml` | `a6e6f8f1b2c530439fc64f55fdf902f6deff9d75360bb37b084b43df24e2148b` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-021-office-chair-sinks.yaml` | `8a7849bb75db0630cf1ab1d0097eb4fe7d322e842e8963e48a4396798e9cc18b` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-022-blind-replacement-part.yaml` | `2bd81a47007125d2b7cbec22dd0f952378e13149228c6559981ef8265a905ad7` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-023-gas-smell-stove.yaml` | `7f69480be2823cf406e9309fc5e11e8399d2f7e712188e9383e639e47b911e0c` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-024-verschmorte-steckdose-de.yaml` | `e16a3cd507d718bb031086d7b512d289fa5228592ff23225e70aef7fb5aa6ed9` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-025-co-alarm.yaml` | `79e27b9269f99c05896ee4dce8f7f81300695469531861de7bef074eb434977d` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-026-remove-wall.yaml` | `d6b541ec66e21428fdaacd9d6fedb0ebd95a7d21b6761e59ef62988599e87857` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-027-refill-refrigerant.yaml` | `a4d2545797acdace5e0d458094f0788631c7d403fa4487ea513069e9e4c74be3` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-028-ceiling-lamp.yaml` | `9a355535c95efd747eaa889d4d2c607220d8d4db94d35a05c4daf6821ae56dd5` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-029-bathroom-refresh.yaml` | `0055ffd844edd099768f4551c913a450fadd963802f7a8da8292a849d81c09ce` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-030-attic-insulation-conduit.yaml` | `619bafd70b403cb3ef1c34d782d3bc682d89fff1cb13c8cb88d24a35b78d7dac` | this repository, at commit `cd249c4` |
| `prototype/eval/cases/case-031-wallbox.yaml` | `876829b441082b72313eddb9c398f089d587b494531e45f1b3dbfe30a9314b1e` | this repository, at commit `cd249c4` |
| `prototype/src/components/repair/Intake.tsx` | `1a5064317721e1ee7321d1f290e52c46c8dcca1189091a35143b92e7ba09e8c8` | this repository, at commit `cd249c4` |
| `prototype/src/components/repair/Result.tsx` | `8c36e770491c0fa59355eeffbc7a3e9169856a0ddc9857cc6ccf0cced78e3546` | this repository, at commit `cd249c4` |
| `prototype/src/lib/ai.server.ts` | `d836cb83437acf7fad1de4d13de13b2fa45c20855895eadc71e9f9fc5229a49d` | this repository, at commit `cd249c4` |
| `prototype/src/lib/offers.ts` | `7f086b5411db9e1e3f9c4f4ea6c4067627f8ff688050f310905611eda8634075` | this repository, at commit `cd249c4` |
| `prototype/src/lib/profiles.ts` | `2a709909717d9db322fc57ff9f6a219d3231b8120fc71950bb2dda9227f5c152` | this repository, at commit `cd249c4` |
| `prototype/src/lib/repair.functions.ts` | `9d7fe9ff170699b268348e3254fc7e81c24ba08e3f590cf319aa431c80887596` | this repository, at commit `cd249c4` |
| `prototype/src/lib/repair.schema.ts` | `dd2d1ce2f206adb4e956738caf161fbad55a9a37b53344107e591bdb04f7b85e` | this repository, at commit `cd249c4` |
| `prototype/src/routes/index.tsx` | `97766cca5d8cbc5ca8186ad088e13b671e8b2f102e2cfcb7bd9c16775791b950` | this repository, at commit `cd249c4` |
| `prototype/src/test/app-routing.test.tsx` | `c817058668430273e00a43620a835f562b8cfe1234ee361c057958c06470cee3` | this repository, at commit `cd249c4` |
| `prototype/src/test/safety.test.ts` | `de8446938718c1b832299a175b9647e229380d8e58a08ba40b3ca51f88f51a0d` | this repository, at commit `cd249c4` |
