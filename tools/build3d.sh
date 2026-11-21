#!/bin/sh
# Bouwt js/vendor/tuin3d.js (three.js + 3D-wandeling) uit src3d/. Eenmalig: npm install
set -e
cd "$(dirname "$0")/.."
npx esbuild src3d/entry.js --bundle --minify --format=iife --target=es2020 --legal-comments=inline --outfile=js/vendor/tuin3d.js
