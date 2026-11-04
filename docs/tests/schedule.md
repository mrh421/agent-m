---
nightly: 02:17
command: node tests/test-schedule-command.mjs
setup: sh tests/test-schedule-setup.sh
cache:
  - /home/runner/apt-archives
  - /home/runner/apt-lists
  - /home/runner/agent-m-electron-44/node_modules/electron
minutes: 2
---
## Levels

| Row | every commit | pull request | nightly | release candidate | on demand | runs on | shards |
|---|---|---|---|---|---|---|---|
| unit | | ✓ | ✓ | ✓ | ✓ | | 16 |
| component | | ✓ | ✓ | ✓ | ✓ | | 8 |
| system | | ✓ | ✓ | ✓ | ✓ | | 6 |
| paid | | | ✓ | ✓ | ✓ | | |
| release | | ✓ | ✓ | ✓ | ✓ | | 12 |
| user | | | | ✓ | ✓ | | |
