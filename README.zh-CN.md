<div align="center">

# SubStellar

### 下一代动态粒子与卡拉OK字幕制作工作室

**[English](README.md)** • **[Bahasa Indonesia](README.id.md)** • **[日本語](README.ja.md)** • **[简体中文](README.zh-CN.md)**

[![License: MIT OR Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.2-24C8D8?logo=tauri&logoColor=white)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PixiJS v8](https://img.shields.io/badge/PixiJS-v8.6-E72264?logo=pixijs&logoColor=white)](https://pixijs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#)
[![Performance](https://img.shields.io/badge/Low--End%20Ready-RAM%20%3C%20120MB%20%7C%2060%20FPS-success)](#)

*一款专业级桌面字幕与歌词视频制作软件，集成了星尘粒子特效、双层描边发光字体、日语振假名（Ruby）自动排版、逐词/逐字人声同步以及一键 YouTube 视频下载，采用优雅的 Gatefold 曜石黑动态视觉设计。*

[核心功能](#核心功能) • [技术栈](#技术栈) • [快速开始](#快速开始) • [键盘快捷键](#键盘快捷键) • [开源许可](#开源许可与致谢)

</div>

---

## 为什么选择 SubStellar？

目前制作富有表现力的动态歌词与字幕视频往往面临两个极端：
* **门槛过高：** 传统字幕工具（如 **Aegisub**）需要编写复杂的 Lua 自动化脚本（`kara-templater` / `PyonFX`）才能实现逐词动画和粒子特效。
* **过于臃肿且不够灵活：** 主流视频剪辑软件（**CapCut 剪映 / Premiere Pro / After Effects**）缺乏原生的日语振假名（汉字注音）排版支持，内存占用极高（动辄 16 GB+），且手动进行逐字卡拉OK时间轴对齐非常繁琐。

**SubStellar** 完美平衡了两者：**像剪映一样直观易用，像 After Effects 一样炫丽灵动，像 Aegisub 一样轻量高效**——即使在 4 GB 内存与集成显卡的低配笔记本上也能稳定保持 60 FPS 流畅运行。

---

## 核心功能

- **一键 YouTube 视频与音频下载 (`yt-dlp`)：** 粘贴 YouTube 链接即可自由选择视频分辨率（`360p` 至 `4K`）或仅提取音频，直接下载并载入工作室，无需 Google API 密钥即可自动提取封面与环境主题色。
- **多源同步歌词聚合引擎：** 支持从 5 大在线曲库（LRCLIB、网易云音乐、QQ音乐、酷狗音乐、Musixmatch）搜索同步歌词，同时支持导入本地 `.lrc` 与 `.srt` 字幕文件。
- **精细化逐词与逐字人声时间轴控制：**
  - 针对拉丁字母、中日韩（CJK）汉字与假名混合文本的智能自动分词。
  - **拆字与合并控制：** 支持将任意词语拆分为单个字符（`Split to Chars` / `All Chars`），或将相邻的字词与标点符号合并（`← Merge Left` / `Merge Right →`）。
  - **单区域动画静音（Static Mute）：** 可单独关闭某个词或标点符号的动画效果（`Anim: OFF (Static)`），使其保持静止且不触发弹跳或粒子爆发。
  - **词间过渡动画：** 内置 **Pop Bounce（弹跳）**、**Karaoke Sweep（卡拉OK扫光）** 与 **Vocal Float（人声漂浮）** 三种过渡风格，支持 `0ms–500ms` 过渡时长调节及音频波形图上的词边界拖拽对齐。
- **日语振假名（Ruby）与双语副字幕：** 原生支持 `{漢字|かんじ}` 注音语法与可视化点击编辑器，并可同时编辑与渲染底部的双语翻译副字幕。
- **零垃圾回收（Zero-GC）实时粒子引擎 (PixiJS v8)：** 采用预分配对象池与 GPU 纹理复用架构，在 60 FPS 下随人声节拍绽放星尘、樱花与宇宙流光粒子，彻底杜绝内存泄漏。
- **无限制字体排版与 X/Y 坐标偏移：** 支持填充色、当前演唱词高亮色、渐变色、双层内外描边、垂直基准锚点（`Bottom` / `Center` / `Top`）以及无范围限制的 `X/Y` 像素偏移（同时提供滑块与数字直接输入框）。
- **Gatefold 三区工作台与可拖拽调整侧边栏：** 基于 OKLCH 色彩空间的暗色工作台，配备经典顶部菜单栏（`File`、`Subtitle`、`View`、`Export`）、防重叠多轨时间轴，以及可自由左右拖动调节宽度的右侧属性检查器。
- **原生工程保存与硬件加速视频渲染 (FFmpeg)：**
  - 通过操作系统原生文件资源管理器保存与打开 `.substellar` 工程文件，并在下次启动应用时自动恢复上次工程与本地视频缓存。
  - **完整视频合成渲染 (`.mp4`, `.webm`, `.mov`)：** 支持通过 RGBA 透明画布管道或超高速 FFmpeg `ass=` 硬件字幕压制（`NVENC` / `QSV` / `AMF` / `VideoToolbox` / `libx264`），将动态字幕与粒子直接合成到源视频与音轨上。
  - **清晰的导出路径管理：** 导出 `.ass`（含完整 `\k` 标签与注音坐标）、`.srt` 或视频时均可指定目标保存路径，并在完成后一键**在资源管理器中打开所在文件夹**。

---

## 技术栈

| 层级 | 技术选型 | 核心职责 |
| :--- | :--- | :--- |
| **桌面外壳** | **Tauri v2 (Rust 1.94+)** | 超轻量级原生运行时、系统文件对话框与安全子进程管理。 |
| **前端框架** | **React 19 + TypeScript (Strict)** | 声明式工作室 UI、严格类型安全与零重绘播放循环。 |
| **渲染画布** | **PixiJS v8 (WebGPU / WebGL)** | 零内存分配 60 FPS 字幕排版、双层描边渲染与粒子特效系统。 |
| **视觉与主题** | **Tailwind CSS + Gatefold OKLCH** | 感知均匀的 OKLCH 色彩变量与封面动态环境光提取。 |
| **状态管理** | **Zustand** | 60 FPS 高频播放头同步（在 RAF 中直接读取状态），避免 React 组件树重渲染。 |
| **多媒体与渲染** | **FFmpeg (Native / Sidecar)** | 硬件编码器自动探测、RGBA 视频叠加合成与 ASS 硬件压制。 |
| **媒体下载** | **yt-dlp + Rust 白名单代理** | 多分辨率 YouTube 视频/音频下载与免跨域歌词抓取代理。 |

---

## 快速开始

### 系统前置要求
* [Node.js](https://nodejs.org/) v20+ 或 v24+
* [Rust & Cargo](https://rustup.rs/) v1.80+（推荐 v1.94+）
* 系统环境变量 `PATH` 中已配置 [FFmpeg](https://ffmpeg.org/) 与 [yt-dlp](https://github.com/yt-dlp/yt-dlp)（用于视频渲染导出与 YouTube 下载）

### 安装与开发模式运行

```bash
# 1. 克隆代码仓库
git clone https://github.com/SayMaven/sub-stellar.git
cd sub-stellar

# 2. 安装前端依赖
npm install

# 3. 启动 Tauri v2 桌面端开发模式
npm run tauri dev
```

### 构建生产环境安装包

```bash
# 构建桌面端原生安装包 (.msi / .exe / .dmg / .AppImage)
npm run tauri build
```

---

## 键盘快捷键

| 快捷键 | 功能说明 |
| :--- | :--- |
| **`Space`** | 播放 / 暂停视频或音频 |
| **`Ctrl + N`** | 在当前播放头位置添加新的空白字幕行 |
| **`Ctrl + S`** | 保存工程 (`.substellar`) |
| **`Ctrl + Shift + S`** | 工程另存为 (`.substellar`) |
| **`Delete`** | 删除当前选中的字幕行 |
| **`Ctrl + K`** | 打开 YouTube 视频/音频下载面板 |
| **`Ctrl + Q`** | 切换硬件性能质量档位 (`Low` / `Balanced` / `Ultra`) |
| **`Ctrl + Shift + D`** | 显示 / 隐藏实时性能监控面板（FPS、帧耗时、粒子数） |

---

## 开源许可与致谢

SubStellar 采用**双重开源许可（Dual-Licensed）**，您可以任选其一使用：

* **[MIT License](LICENSE-MIT)** ([http://opensource.org/licenses/MIT](http://opensource.org/licenses/MIT))
* **[Apache License, Version 2.0](LICENSE-APACHE)** ([http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0))

详情请参阅 [LICENSE](LICENSE) 文件。

**特别致谢与灵感来源：**
* **[Gatefold](https://github.com/SayMaven/gatefold-foobar2000)：** 启发了本项目的 OKLCH 动态色彩设计语言与多源歌词搜索架构。
* **[PixiJS](https://pixijs.com)：** 高性能 2D WebGL/WebGPU 渲染引擎。
* **[Tauri](https://tauri.app)：** 轻量、安全的跨平台桌面应用框架。

