#! /bin/sh
set -e

PROJECT_ID="$1"

test -n "${PROJECT_ID:?}" || {
    echo "Usage: ${0} GAS_PROJECT_ID"
    exit 1
}

set -x
npx clasp login
npx clasp clone "${PROJECT_ID:?}" --rootDir dist
