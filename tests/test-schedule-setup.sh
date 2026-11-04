#!/bin/sh
# Agent M's own test setup — the `setup` of Agent M's schedule, as docs/architecture/MOD-test-schedule.md names it (Parts,
# *Agent M's own `command` and `setup`*): run in every test job before its tests, in the checkout's root, it installs xvfb and
# openbox, and Electron 44.5.1 into $HOME/agent-m-electron-44, so that the tests that start Electron find both installed and
# install nothing (their own install stays the local fallback), and the Bridge app's packages.
#
#   sh tests/test-schedule-setup.sh
#
# apt keeps the archives and package lists it fetches in $HOME/apt-archives and $HOME/apt-lists, the paths the schedule's
# `cache` names: with them restored nothing is fetched and no index is read from a mirror; without them they are fetched and
# left readable for the CI service's cache. Electron's package, $HOME/agent-m-electron-44/node_modules/electron with its
# executable, is a path of the `cache` too: with it restored, npm is not called for Electron, so that no test job asks the npm
# registry for it.
#
# Module: MOD-test-schedule
# Level: unit
set -eu

# Before it installs anything dpkg reads the file list of every installed package, one small file each; on a runner whose disk
# is cold that read is the slow part of the install. It starts here, in the background.
(ls /var/lib/dpkg/info/*.list 2>/dev/null | xargs -P 8 -n 150 cat > /dev/null 2>&1 &) || true

archives="$HOME/apt-archives"
lists="$HOME/apt-lists"
mkdir -p "$archives/partial" "$lists/partial"

# The runner is thrown away after the job, and four programs that apt and dpkg run around an install are of no use to it:
# debconf's hook `dpkg-preconfigure --apt` before dpkg, which extracts the templates of every package to be installed;
# update-notifier's check of the available updates after dpkg, which loads the whole package cache; and needrestart's two
# hooks, which look for services to restart. A hook runs only if its program can be executed. Where a program cannot be taken
# away, or on a machine that is no runner of GitHub Actions, the install is only slower and the machine stays as it is.
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  for hook in /usr/sbin/dpkg-preconfigure /usr/lib/update-notifier/update-motd-updates-available \
    /usr/lib/needrestart/apt-pinvoke /usr/lib/needrestart/dpkg-status; do
    if [ -x "$hook" ]; then sudo chmod -x "$hook" || true; fi
  done
fi

apt_options="-o Acquire::Retries=1 -o Acquire::http::Timeout=10 -o DPkg::Lock::Timeout=50 -o Dir::Cache::archives=$archives -o Dir::State::lists=$lists"
if ! sudo apt-get $apt_options install --yes --no-install-recommends --no-download xvfb openbox; then
  # Nothing restored: from the mirror. azure.archive.ubuntu.com sometimes sends one file so slowly that apt neither fails nor
  # tries the next mirror: the first download is bounded, and when it fails archive.ubuntu.com becomes the mirror. The install
  # is not bounded: a kill while dpkg unpacks would leave dpkg interrupted.
  sudo apt-get $apt_options update
  if ! sudo timeout 15 apt-get $apt_options install --download-only --yes --no-install-recommends xvfb openbox; then
    echo "http://archive.ubuntu.com/ubuntu/" | sudo tee /etc/apt/apt-mirrors.txt
    sudo apt-get $apt_options install --download-only --yes --no-install-recommends xvfb openbox
  fi
  sudo apt-get $apt_options install --yes --no-install-recommends xvfb openbox
fi
sudo chmod -R a+rX "$archives" "$lists"
openbox --version

# The component tests start the Bridge, which runs its agents in its real enclosure (MOD-agent-enclosure, ARC-054), on Linux bubblewrap. The row
# that runs them installs the package, and an administrator allows it to make user namespaces, which Ubuntu 23.10 and later refuse to a program
# without an AppArmor profile — the one-time steps the enclosure names. Other rows start no agent of the Bridge and install nothing of it.
if [ "${AGENT_M_ROW:-}" = "component" ] && [ -n "${GITHUB_ACTIONS:-}" ]; then
  sudo apt-get $apt_options install --yes --no-install-recommends bubblewrap \
    || { sudo apt-get $apt_options update && sudo apt-get $apt_options install --yes --no-install-recommends bubblewrap; }
  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0 || true
  bwrap --ro-bind / / --dev /dev --proc /proc --unshare-pid --die-with-parent -- true || echo "bubblewrap cannot make its namespaces on this runner"
fi

npm install --prefix src/bridge-build --omit=dev --ignore-scripts

# npm installs Electron's package without its executable; the package's install.js downloads it into dist/, as the tests' own
# install does in its step "binary acquisition".
electron="$HOME/agent-m-electron-44"
if [ ! -x "$electron/node_modules/electron/dist/electron" ]; then
  npm install --no-save --prefix "$electron" electron@44.5.1
  node "$electron/node_modules/electron/install.js"
fi
