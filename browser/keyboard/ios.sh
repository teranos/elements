#!/usr/bin/env bash
# Boot an iPhone in the Simulator with its software keyboard, let safaridriver
# drive its Safari, and run browser/keyboard/ios.ts against the specimens page.
set -euo pipefail

# The Simulator's keyboard is the Mac's unless told otherwise; with a hardware
# keyboard connected, iOS raises no software keyboard at all.
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false

RUNTIME=$(xcrun simctl list runtimes available -j | jq -r '[.runtimes[] | select(.platform == "iOS")] | sort_by(.version) | last | .identifier')
UDID=$(xcrun simctl list devices available -j | jq -r --arg rt "$RUNTIME" '[.devices[$rt][] | select(.name | startswith("iPhone"))] | first | .udid')
NAME=$(xcrun simctl list devices available -j | jq -r --arg rt "$RUNTIME" --arg u "$UDID" '.devices[$rt][] | select(.udid == $u) | .name')
echo "Simulator: $NAME ($RUNTIME, $UDID)"

xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b

# WebDriver needs Remote Automation on in Safari's settings.
xcrun simctl spawn "$UDID" defaults write com.apple.mobilesafari RemoteAutomationEnabled -bool YES || true

sudo safaridriver --enable
safaridriver -p 4444 > safaridriver.log 2>&1 &
sleep 2

UDID="$UDID" bun browser/keyboard/ios.ts
