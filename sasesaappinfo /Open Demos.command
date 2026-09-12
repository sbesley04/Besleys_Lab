#!/bin/bash
set -euo pipefail
CHOICE_ROOT="$(cd "$(dirname "$0")" && pwd)"
exec /bin/bash "$CHOICE_ROOT/Scripts/run-demo.sh" both
