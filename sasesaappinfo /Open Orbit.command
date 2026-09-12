#!/bin/bash
set -euo pipefail
ORBIT_ROOT="$(cd "$(dirname "$0")" && pwd)"
if /bin/bash "$ORBIT_ROOT/Scripts/run-orbit.sh" demo; then
  exit 0
else
  ORBIT_EXIT=$?
  echo
  echo "Orbit could not launch. The error is shown above. Press Return to close this window."
  read -r || true
  exit "$ORBIT_EXIT"
fi
