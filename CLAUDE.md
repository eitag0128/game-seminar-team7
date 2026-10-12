# CLAUDE.md

## プッシュ

GitHub への反映は **ユーザーが「プッシュして」「共有して」等と指示した時だけ** 行う。定期実行・自動実行(launchd / cron / フック)は設定しない。

指示を受けたら `bash tools/auto-push/auto-push.sh` を実行し、`.git/auto-push.log` の末尾で結果(pushed / 失敗理由)を報告する。
