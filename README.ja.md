<div align="center">

# SubStellar

### 次世代アニメーション＆パーティクル字幕スタジオ

**[English](README.md)** • **[Bahasa Indonesia](README.id.md)** • **[日本語](README.ja.md)** • **[简体中文](README.zh-CN.md)**

[![License: MIT OR Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.2-24C8D8?logo=tauri&logoColor=white)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PixiJS v8](https://img.shields.io/badge/PixiJS-v8.6-E72264?logo=pixijs&logoColor=white)](https://pixijs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#)
[![Performance](https://img.shields.io/badge/Low--End%20Ready-RAM%20%3C%20120MB%20%7C%2060%20FPS-success)](#)

*宇宙のようなパーティクル演出、二重縁取りグロー文字、自動ルビ（ふりがな）レイアウト、単語・文字単位のボーカル同期、そして1クリックYouTube連携を備えた、Gatefoldデザインのプロフェッショナル歌詞・字幕制作デスクトップスタジオ。*

[主な機能](#主な機能) • [技術スタック](#技術スタック) • [クイックスタート](#クイックスタート) • [キーボードショートカット](#キーボードショートカット) • [ライセンス](#ライセンスと謝辞)

</div>

---

## なぜ SubStellar なのか？

表現力豊かなMV（ミュージックビデオ）やアニメーション歌詞動画を作る際、従来のツールには大きな課題がありました：
* **難易度が高すぎる：** 古典的な字幕ソフト（**Aegisub**）では、高度なエフェクトを作るために複雑なLuaスクリプト（`kara-templater` / `PyonFX`）を書く必要があります。
* **重すぎて柔軟性に欠ける：** 一般的な動画編集ソフト（**CapCut / Premiere Pro / After Effects**）は、日本語のふりがな（ルビ）に標準対応しておらず、大量のメモリ（16GB以上）を消費し、1語ずつの細かなタイミング調整に手間がかかります。

**SubStellar** はその両方の長所を融合しました：**CapCutのように直感的で、After Effectsのように美しく、Aegisubのように軽量**。メモリ4GB・内蔵GPUのノートPCでも安定した60 FPSで動作するよう設計されています。

---

## 主な機能

- **1クリック YouTube 動画・音声ダウンロード (`yt-dlp`)：** YouTubeのURLを貼り付け、解像度（`360p`〜`4K`）または音声のみを選択して直接スタジオにダウンロード。APIキー不要でサムネイルとアンビエント配色も自動抽出します。
- **マルチソース同期歌詞エンジン：** 5つのオンライン歌詞データベース（LRCLIB、NetEase Cloud Music、QQ Music、Kugou、Musixmatch）からの自動検索・インポートに加え、ローカルの `.lrc` / `.srt` ファイル読み込みに対応。
- **単語・文字単位の精密ボーカルタイミング制御：**
  - 日本語（漢字・かな）・英語・中国語に対応したスマート自動トークン分割。
  - **文字分割＆結合コントロール：** 選択した単語を1文字ずつに分割（`Split to Chars` / `All Chars`）、または隣接する文字や記号を結合（`← Merge Left` / `Merge Right →`）。
  - **エリア別アニメーション無効化（ミュート）：** 句読点や特定の単語だけアニメーションをオフ（`Anim: OFF (Static)`）にし、バウンスやパーティクルを出さずに静止表示させることが可能。
  - **トランジションスタイル：** **Pop Bounce**、**Karaoke Sweep**、**Vocal Float** の3種類から選択でき、遷移時間（`0ms〜500ms`）や波形タイムライン上での単語境界ドラッグ調整に対応。
- **ふりがな（ルビ）＆二段翻訳字幕：** `{漢字|かんじ}` 記法とクリック編集エディタによる正確なルビ配置、およびメイン歌詞の下に表示される翻訳（サブテキスト）編集をサポート。
- **Zero-GC リアルタイム・パーティクルエンジン (PixiJS v8)：** オブジェクトプーリングとGPUテクスチャ再利用により、メモリリークを起こさず60 FPSで星屑・桜吹雪・光の粒子をボーカルに合わせて放出。
- **自由自在なタイポグラフィ＆X/Y座標オフセット：** 文字色、歌唱中ハイライト色、グラデーション、二重ストローク縁取り、配置基準（`Bottom` / `Center` / `Top`）、制限なしの `X/Y` ピクセルオフセットをスライダーと数値直接入力の両方で調整可能。
- **Gatefold 3ゾーンUI＆リサイズ可能な右サイドバー：** OKLCHカラースペースに基づくダークUI、標準メニューバー（`File` / `Subtitle` / `View` / `Export`）、重なりを自動解消するマルチレーンタイムライン、ドラッグで幅を自由に変更できる右インスペクターを搭載。
- **ネイティブプロジェクト保存＆ハードウェア動画レンダリング (FFmpeg)：**
  - OS標準のファイルダイアログによる `.substellar` プロジェクトの保存・読み込みと、次回起動時の自動復元（動画キャッシュ含む）。
  - **フル動画レンダリング (`.mp4`, `.webm`, `.mov`)：** 透過キャンバスパイプまたは高速FFmpeg `ass=` ハードウェア焼き付け（`NVENC` / `QSV` / `AMF` / `VideoToolbox` / `libx264`）により、元動画と音声の上に字幕を合成して出力。
  - **字幕ファイル出力：** 保存先フォルダを明示的に選択して `.ass`（ルビ＆`\k`タグ付き）・`.srt` を出力し、完了後にエクスプローラーで直接開くことができます。

---

## 技術スタック

| レイヤー | 採用技術 | 役割 |
| :--- | :--- | :--- |
| **デスクトップシェル** | **Tauri v2 (Rust 1.94+)** | 軽量ネイティブランタイム、OSファイルダイアログ、安全なプロセス管理。 |
| **フロントエンド** | **React 19 + TypeScript (Strict)** | 宣言的スタジオUI、厳格な型安全性、再レンダリング負荷ゼロの再生ループ。 |
| **描画キャンバス** | **PixiJS v8 (WebGPU / WebGL)** | ゼロアロケーション60 FPS字幕レイアウト、二重縁取り描画、パーティクル演出。 |
| **デザイン＆テーマ** | **Tailwind CSS + Gatefold OKLCH** | 知覚的に均一なOKLCHカラートークンと動的アンビエント配色抽出。 |
| **状態管理** | **Zustand** | Reactツリーを再描画せずに60 FPSの再生位置を同期。 |
| **メディア処理・出力** | **FFmpeg (Native / Sidecar)** | ハードウェアエンコーダ自動検出、RGBA動画オーバーレイ合成、ASS焼き付け。 |
| **ダウンローダー** | **yt-dlp + Rust Allowlist Proxy** | 解像度選択対応YouTubeダウンロードおよび安全な歌詞取得プロキシ。 |

---

## クイックスタート

### 動作要件
* [Node.js](https://nodejs.org/) v20+ または v24+
* [Rust & Cargo](https://rustup.rs/) v1.80+（v1.94以上推奨）
* システムの `PATH` に [FFmpeg](https://ffmpeg.org/) および [yt-dlp](https://github.com/yt-dlp/yt-dlp) が設定されていること（動画出力およびYouTubeダウンロード用）

### インストールと開発モード起動

```bash
# 1. リポジトリのクローン
git clone https://github.com/SayMaven/sub-stellar.git
cd sub-stellar

# 2. フロントエンド依存パッケージのインストール
npm install

# 3. Tauri v2 デスクトップ開発モードで起動
npm run tauri dev
```

### 本番用インストーラーのビルド

```bash
# デスクトップ用インストーラー (.msi / .exe / .dmg / .AppImage) をビルド
npm run tauri build
```

---

## キーボードショートカット

| ショートカット | 機能 |
| :--- | :--- |
| **`Space`** | 動画・音声の再生 / 一時停止 |
| **`Ctrl + N`** | 現在の再生位置に新しい空の字幕行を追加 |
| **`Ctrl + S`** | プロジェクトを上書き保存 (`.substellar`) |
| **`Ctrl + Shift + S`** | 名前を付けてプロジェクトを保存 (`.substellar`) |
| **`Delete`** | 選択中の字幕行を削除 |
| **`Ctrl + K`** | YouTube メディアダウンローダーを開く |
| **`Ctrl + Q`** | パフォーマンス品質モードの切り替え (`Low` / `Balanced` / `Ultra`) |
| **`Ctrl + Shift + D`** | リアルタイム・パフォーマンスモニターの表示切替 (FPS / フレーム時間 / パーティクル数) |

---

## ライセンスと謝辞

SubStellar は以下のいずれかのライセンスを選択できる**デュアルライセンス（二重ライセンス）**で提供されています：

* **[MIT License](LICENSE-MIT)** ([http://opensource.org/licenses/MIT](http://opensource.org/licenses/MIT))
* **[Apache License, Version 2.0](LICENSE-APACHE)** ([http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0))

詳細は [LICENSE](LICENSE) ファイルをご確認ください。

**謝辞・インスピレーション：**
* **[Gatefold](https://github.com/DEVIROYrus/gatefold-foobar2000)：** OKLCHデザイン言語およびマルチソース歌詞取得アーキテクチャのインスピレーション。
* **[PixiJS](https://pixijs.com)：** 高速2D WebGL/WebGPUレンダリングエンジン。
* **[Tauri](https://tauri.app)：** 軽量で安全なクロスプラットフォーム・デスクトップフレームワーク。

