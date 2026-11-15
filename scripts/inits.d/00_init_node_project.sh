#! /bin/sh
set -e

test -d .git || {
    cat <<- EOM
    [Error] You are NOT in the project git repository.
            Create and move into a project git repo first.
EOM
    exit 1
}

test -f package.json || npm init -y
npm install -D typescript @types/google-apps-script @google/clasp vite vite-plugin-singlefile esbuild konva
