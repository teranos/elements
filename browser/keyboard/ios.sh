#!/usr/bin/env bash
# Boot an iPhone in the Simulator with its software keyboard, open Safari on the
# keyboard harness, and let idb's finger run browser/keyboard/ios.ts.
set -euo pipefail

# idb: real taps and typing in the Simulator.
# The companion is a prebuilt release: Homebrew's formula compiles it, against an Xcode it insists on.
curl -sSL https://github.com/facebook/idb/releases/download/v1.1.8/idb-companion.universal.tar.gz | tar -xz
COMPANION=$(dirname "$(find "$PWD" -name idb_companion -type f -perm -u+x | head -1)")
export PATH="$COMPANION:$PATH"
idb_companion --version || true
python -m pip install --quiet fb-idb

# The Simulator's keyboard is the Mac's unless told otherwise; with a hardware
# keyboard connected, iOS raises no software keyboard at all.
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false

RUNTIME=$(xcrun simctl list runtimes available -j | jq -r '[.runtimes[] | select(.platform == "iOS")] | sort_by(.version) | last | .identifier')
UDID=$(xcrun simctl list devices available -j | jq -r --arg rt "$RUNTIME" '[.devices[$rt][] | select(.name | startswith("iPhone"))] | first | .udid')
NAME=$(xcrun simctl list devices available -j | jq -r --arg rt "$RUNTIME" --arg u "$UDID" '.devices[$rt][] | select(.udid == $u) | .name')
echo "Simulator: $NAME ($RUNTIME, $UDID)"

xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b

bun browser/keyboard/harness.ts > harness.log 2>&1 &
for i in $(seq 1 30); do curl -sf http://localhost:5181/ > /dev/null && break; sleep 1; done

xcrun simctl openurl "$UDID" http://localhost:5181/

UDID="$UDID" bun browser/keyboard/ios.ts
