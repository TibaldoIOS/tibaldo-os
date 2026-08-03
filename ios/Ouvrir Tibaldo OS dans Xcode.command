#!/bin/zsh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$SCRIPT_DIR/TibaldoOSNative/TibaldoOS.xcodeproj"

if [[ -d "$HOME/Downloads/Xcode-beta.app" ]]; then
  open -a "$HOME/Downloads/Xcode-beta.app" "$PROJECT"
elif [[ -d "/Applications/Xcode-beta.app" ]]; then
  open -a "/Applications/Xcode-beta.app" "$PROJECT"
else
  open -a Xcode "$PROJECT"
fi
