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
