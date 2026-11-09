#!/bin/sh
# Quiz Word 실행 (macOS·Linux) — 옵션은 ./start.sh --help
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 가 필요합니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요."
  exit 1
fi
exec node scripts/launch.mjs "$@"
