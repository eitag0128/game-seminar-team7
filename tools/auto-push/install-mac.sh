#!/bin/bash
# Mac: 30分ごとに auto-push.sh を実行する launchd ジョブを登録する
#   登録:   tools/auto-push/install-mac.sh
#   解除:   tools/auto-push/install-mac.sh uninstall
set -eu

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL="com.eitago.game-seminar-team7.autopush"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true

if [ "${1:-}" = "uninstall" ]; then
  rm -f "$PLIST"
  echo "解除しました"
  exit 0
fi

chmod +x "$REPO/tools/auto-push/auto-push.sh"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO/tools/auto-push/auto-push.sh</string>
  </array>
  <key>StartInterval</key>
  <integer>1800</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin</string>
  </dict>
</dict>
</plist>
EOF

launchctl bootstrap "$DOMAIN" "$PLIST"
echo "登録しました: 30分ごとに自動プッシュします (ログ: $REPO/.git/auto-push.log)"
