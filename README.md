# ゲーム制作演習 Team7

大学「ゲーム制作演習」Team7 の共同開発リポジトリです。使用エンジン: Unity

## 初回セットアップ(Mac / Windows 共通)

```bash
git clone https://github.com/eitag0128/game-seminar-team7.git
cd game-seminar-team7
```

Unity Hub から、このフォルダ(Unity プロジェクトのルート)を開いてください。

## 日々の作業の流れ

```bash
git pull                      # 作業開始前に最新を取得
# ... 作業 ...
git add -A
git commit -m "変更内容"
git push                      # 作業終了時に共有
```

## 自動プッシュ(30分ごと)

変更があれば自動で `commit → pull --rebase → push` します。競合や認証失敗の場合は何も壊さず中断し、`.git/auto-push.log` に記録します。

| OS | 登録 | 解除 |
|---|---|---|
| Mac | `tools/auto-push/install-mac.sh` | `tools/auto-push/install-mac.sh uninstall` |
| Windows | `.\tools\auto-push\install-windows.ps1` | `.\tools\auto-push\install-windows.ps1 -Uninstall` |

- 事前に GitHub の認証(Mac: `gh auth login`、Windows: 初回 push 時の Git Credential Manager)を済ませておくこと
- 95MB を超えるファイルは自動でコミット対象から外れる(GitHub の 100MB 制限対策)
- 競合でログに `pull --rebase failed` が出たら、手動で `git pull` して解消する
- Unity で編集中の状態もコミットされるため、履歴は `auto:` コミットが多くなる

## 運用ルール

- 作業開始前に必ず `git pull`、終わったら `git push`
- 同じシーン / プレハブを同時に編集しない(YAML のマージ衝突を避けるため)
- Unity の **Edit > Project Settings > Editor** で
  - Version Control Mode: **Visible Meta Files**
  - Asset Serialization Mode: **Force Text**
  に設定する
- `.meta` ファイルは必ずコミットする
- `Library/` `Temp/` `Obj/` `Build/` などはコミットしない(`.gitignore` 設定済み)

## ⚠ クラウド同期フォルダについて

このリポジトリのフォルダ自体を iCloud Drive / OneDrive / Dropbox などの中に置かないでください。
`.git` が破損する原因になります。Mac ⇔ Windows の共有は **GitHub(push / pull)** で行います。
