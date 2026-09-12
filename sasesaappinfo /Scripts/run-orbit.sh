#!/bin/bash
set -euo pipefail

ORBIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ORBIT_ROOT"
ORBIT_MODE="${1:-demo}"
case "$ORBIT_MODE" in
  demo|resume) ;;
  *) echo "Usage: Scripts/run-orbit.sh [demo|resume]"; exit 2 ;;
esac

for ORBIT_TOOL in xcrun xcodebuild python3; do
  if ! command -v "$ORBIT_TOOL" >/dev/null 2>&1; then
    echo "Missing $ORBIT_TOOL. Install Xcode and its command-line tools before launching Orbit."
    exit 1
  fi
done

if [ -z "${ORBIT_DEVICE:-}" ]; then
  if ! ORBIT_DEVICE="$(xcrun simctl list devices available -j | python3 -c 'import json,sys; devices=[d for group in json.load(sys.stdin)["devices"].values() for d in group if "iPhone" in d["name"] and d.get("isAvailable", False)]; devices.sort(key=lambda d:d["state"] != "Booted"); print(devices[0]["udid"] if devices else "")')"; then
    echo "Simulator could not list devices. Open Xcode once and finish its component setup, then try again."
    exit 1
  fi
fi
if [ -z "$ORBIT_DEVICE" ]; then
  echo "Install an iOS Simulator runtime in Xcode Settings > Components first."
  exit 1
fi

python3 Scripts/generate_projects.py Orbit
xcrun simctl boot "$ORBIT_DEVICE" 2>/dev/null || true
if [ "${ORBIT_SKIP_WINDOW:-0}" != "1" ]; then open -a Simulator; fi
xcrun simctl bootstatus "$ORBIT_DEVICE" -b

ORBIT_BUILD_DIR="${ORBIT_BUILD_DIR:-${TMPDIR:-/tmp}/OrbitDerivedData}"
mkdir -p Reports
echo "Building Orbit. Details: Reports/Orbit-build.log"
if ! xcodebuild -project Orbit.xcodeproj -scheme Orbit -configuration Debug \
  -destination "platform=iOS Simulator,id=$ORBIT_DEVICE" \
  -derivedDataPath "$ORBIT_BUILD_DIR" CODE_SIGNING_ALLOWED=NO build \
  > Reports/Orbit-build.log 2>&1; then
  tail -80 Reports/Orbit-build.log
  exit 1
fi

xcrun simctl install "$ORBIT_DEVICE" "$ORBIT_BUILD_DIR/Build/Products/Debug-iphonesimulator/Orbit.app"
xcrun simctl terminate "$ORBIT_DEVICE" com.besleyslab.orbit 2>/dev/null || true
if [ "$ORBIT_MODE" = "demo" ]; then
  xcrun simctl launch "$ORBIT_DEVICE" com.besleyslab.orbit --demo
  echo "Orbit is open in demo mode. Use You > Switch to my personal space to start your own library."
else
  xcrun simctl launch "$ORBIT_DEVICE" com.besleyslab.orbit
  echo "Orbit is open with its saved space. You can switch between personal and demo in You."
fi
