#!/bin/bash
set -euo pipefail
CHOICE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$CHOICE_ROOT"
CHOICE_REQUEST="${1:-both}"
case "$CHOICE_REQUEST" in
  Gather|Keeps) CHOICE_APPS=("$CHOICE_REQUEST") ;;
  both) CHOICE_APPS=(Gather Keeps) ;;
  *) echo "Usage: Scripts/run-demo.sh [Gather|Keeps|both]"; exit 2 ;;
esac
CHOICE_DEVICE="$(xcrun simctl list devices available -j | python3 -c 'import json,sys; devices=[d for group in json.load(sys.stdin)["devices"].values() for d in group if "iPhone" in d["name"]]; devices.sort(key=lambda d:d["state"]!="Booted"); print(devices[0]["udid"] if devices else "")')"
if [ -z "$CHOICE_DEVICE" ]; then
  echo "Install an iOS Simulator runtime in Xcode Settings > Components first."
  exit 1
fi
xcrun simctl boot "$CHOICE_DEVICE" 2>/dev/null || true
if [ "${CHOICE_SKIP_WINDOW:-0}" != "1" ]; then open -a Simulator; fi
xcrun simctl bootstatus "$CHOICE_DEVICE" -b
mkdir -p Reports
for CHOICE_APP in "${CHOICE_APPS[@]}"; do
  echo "Building ${CHOICE_APP}..."
  if ! xcodebuild -workspace ChoiceApps.xcworkspace -scheme "$CHOICE_APP" -configuration Debug -destination "platform=iOS Simulator,id=$CHOICE_DEVICE" -derivedDataPath /tmp/ChoiceAppsDerivedData CODE_SIGNING_ALLOWED=NO build > "Reports/$CHOICE_APP-build.log" 2>&1; then
    tail -80 "Reports/$CHOICE_APP-build.log"
    exit 1
  fi
  xcrun simctl install "$CHOICE_DEVICE" "/tmp/ChoiceAppsDerivedData/Build/Products/Debug-iphonesimulator/$CHOICE_APP.app"
  CHOICE_BUNDLE="com.besleyslab.$(echo "$CHOICE_APP" | tr '[:upper:]' '[:lower:]')"
  xcrun simctl terminate "$CHOICE_DEVICE" "$CHOICE_BUNDLE" 2>/dev/null || true
  xcrun simctl launch "$CHOICE_DEVICE" "$CHOICE_BUNDLE" --demo
done
