#!/usr/bin/env bash
set -e
echo "Starting FluxRoute local dev stack..."
cp .env.example .env 2>/dev/null || true
npm install
npm run dev
