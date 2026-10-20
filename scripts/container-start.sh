#!/bin/sh
set -eu
python3 scripts/openlore.py setup
python3 scripts/openlore.py start
exec node server/index.mjs
