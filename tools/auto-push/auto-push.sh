#!/bin/bash
# Team7 自動コミット&プッシュ (Mac用)
# 変更があれば add -A -> commit -> pull --rebase -> push を行う。
# 競合・認証失敗などの場合は何も壊さず中断し、ログに残す。
set -u
export GIT_TERMINAL_PROMPT=0   # 認証が無い場合に入力待ちで固まらないようにする

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO" || exit 1

LOG="$REPO/.git/auto-push.log"
LOCK="$REPO/.git/auto-push.lock"
MAX_BYTES=$((95 * 1024 * 1024))   # GitHub の 100MB 制限の手前

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

# 二重起動防止(60分以上古いロックは破棄)
find "$LOCK" -maxdepth 0 -mmin +60 -exec rmdir {} \; 2>/dev/null
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# 手動のgit操作の最中は触らない
GITDIR="$(git rev-parse --git-dir)"
for f in index.lock MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
  if [ -e "$GITDIR/$f" ]; then log "skip: $f exists"; exit 0; fi
done

if [ "$(git branch --show-current)" != "main" ]; then log "skip: not on main"; exit 0; fi

git add -A

# 95MB超のファイルはコミットから外す
while IFS= read -r -d '' file; do
  size=$(stat -f%z "$file" 2>/dev/null || echo 0)
  if [ "$size" -gt "$MAX_BYTES" ]; then
    git reset -q -- "$file"
    log "skip large file (${size}B): $file"
  fi
done < <(git diff --cached --name-only -z)

if ! git diff --cached --quiet; then
  git commit -q -m "auto: $(date '+%F %H:%M') $(scutil --get LocalHostName 2>/dev/null || hostname -s)" \
    && log "committed" || { log "commit failed"; exit 1; }
fi

# リモートに main があれば取り込む(競合したら中断)
if git ls-remote --exit-code --heads origin main >/dev/null 2>&1; then
  if ! out=$(git pull --rebase origin main 2>&1); then
    git rebase --abort >/dev/null 2>&1
    log "pull --rebase failed (要手動対応): $out"
    exit 1
  fi
fi

# プッシュすべきものがある時だけpush
if [ -z "$(git ls-remote --heads origin main 2>/dev/null | cut -f1)" ] \
   || [ "$(git rev-parse HEAD)" != "$(git rev-parse -q --verify origin/main 2>/dev/null)" ]; then
  if out=$(git push -u origin main 2>&1); then
    log "pushed $(git rev-parse --short HEAD)"
  else
    log "push failed: $out"
    exit 1
  fi
fi
