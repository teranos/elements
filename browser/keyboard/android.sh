#!/usr/bin/env bash
# Inside a booted Android emulator: open Chrome on the specimens page with its
# software keyboard on, and run browser/keyboard/android.ts.
set -euo pipefail

adb wait-for-device
echo "Android $(adb shell getprop ro.build.version.release), $(adb shell wm size)"
adb shell pm list packages | grep -i -e chrome -e webview || true
adb shell pm path com.android.chrome > /dev/null || { echo "No Chrome on this image"; exit 1; }

# A keyboard attached to the emulator hides the software one unless told not to.
adb shell settings put secure show_ime_with_hard_keyboard 1

# Chrome's first-run screens stand between it and the page.
adb shell 'echo "_ --disable-fre --no-default-browser-check --no-first-run" > /data/local/tmp/chrome-command-line'
adb shell am set-debug-app --persistent com.android.chrome

# The page on the host, as the phone's own localhost.
adb reverse tcp:5180 tcp:5180

adb shell am start -n com.android.chrome/com.google.android.apps.chrome.Main -a android.intent.action.VIEW -d http://localhost:5180/

# What the screen shows before anything is asked of it.
mkdir -p keyboard-shots
sleep 5
adb exec-out screencap -p > keyboard-shots/android-0-start.png

# Chrome opens its DevTools socket when it is ready; a slow emulator takes a while.
adb forward tcp:9222 localabstract:chrome_devtools_remote
for i in $(seq 1 45); do
  if curl -s http://localhost:9222/json | grep -q 'localhost:5180'; then break; fi
  sleep 2
done
echo "DevTools sockets on the device:"
adb shell cat /proc/net/unix | grep -i devtools || echo "  none"
curl -s http://localhost:9222/json || echo "no answer on the DevTools socket"
adb exec-out screencap -p > keyboard-shots/android-0-ready.png

bun browser/keyboard/android.ts
