# ゲーム制作演習 Team7

大学「ゲーム制作演習」Team7 の共同開発リポジトリです。使用エンジン: Unity

## 初回セットアップ(Mac / Windows 共通)

```bash
git clone https://github.com/eitag0128/game-seminar-team7.git
cd game-seminar-team7
```

Unity Hub の **Add → Add project from disk** で、このフォルダ(Unity プロジェクトのルート)を開いてください。

- Unity バージョン: **6000.3.10f1**(Unity Hub で同じバージョンをインストールすること)
- テンプレート: 3D (URP / Universal 3D)
- 初回起動時は `Library/` の生成とパッケージ解決で数分かかります
- Apple Silicon の Mac で Intel 版エディタを入れた場合は Rosetta 2 が必要です。可能なら Silicon 版を入れてください

## 日々の作業の流れ

```bash
git pull                      # 作業開始前に最新を取得
# ... 作業 ...
git add -A
git commit -m "変更内容"
git push                      # 作業終了時に共有
```

## ワンコマンドで保存&共有(commit → pull → push)

定期実行はしません。必要な時に手動で実行します(Claude Code に「プッシュして」と頼んでもOK)。

| OS | コマンド |
|---|---|
| Mac | `bash tools/auto-push/auto-push.sh` |
| Windows | `powershell -File .\tools\auto-push\auto-push.ps1` |

- 変更を全部 `commit` し、`pull --rebase` で最新を取り込んでから `push` します
- 競合や認証失敗の場合は何も壊さず中断し、`.git/auto-push.log` に記録します
- 95MB を超えるファイルは自動でコミット対象から外れます(GitHub の 100MB 制限対策)
- 事前に GitHub の認証(Mac: `gh auth login`、Windows: 初回 push 時の Git Credential Manager)を済ませておくこと

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
