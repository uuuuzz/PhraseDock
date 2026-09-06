# 一点，追加。 · V2

23.6 秒，60 fps。针对抖音与 B 站分别排版，替换了第一版的配乐、说明文案及镜头安排。

## 成片

- `V2_Douyin_1080x1920_60fps.mp4`：抖音竖屏。
- `V2_Bilibili_1920x1080_60fps.mp4`：B 站横屏。
- 同名 `_cover.png`：对应封面。

画面以原始应用图标、六按钮菜单和输入框为主，使用独立的形状衔接、镜头推进与节拍动作。中段没有步骤标题、解释性字幕或旁白；片尾文案为“一点，追加。”。

## 音画编排

配乐为 122 BPM，48 拍。起始截取位置为原曲 15.763705 秒，开始于节奏段。点击、整句追加和转场音效共用同一时间轴。

| 拍数 | 时间约值 | 画面 |
| --- | --- | --- |
| 0–4 | 0–1.97 秒 | 点、线组成加号，圆形键帽围绕加号形成。 |
| 4–8 | 1.97–3.93 秒 | 镜头拉开，输入框展开；先聚焦，再写下项目需求。 |
| 8–12 | 3.93–5.90 秒 | 中央加号按下，六个真实预设依次展开。 |
| 12 | 5.90 秒 | 点击“先分析先不做”，约 89 毫秒后整句追加。 |
| 16 | 7.87 秒 | 点击“有疑问直接问”，约 89 毫秒后整句追加。 |
| 20–28 | 9.84–13.77 秒 | 镜头靠近输入结果，音乐短暂收弱，继续输入。 |
| 30 | 14.75 秒 | 收起菜单，保留已输入内容。 |
| 32–40 | 15.74–19.67 秒 | 镜头回到中央键帽，与原始图标的圆形中心衔接。 |
| 40–48 | 19.67–23.60 秒 | 图标让出文字空间，显示产品名、平台和项目地址。 |

## 真实性和素材

- 图标直接引用 `resources/icons/source/PhraseDock-windows.png`。
- 预设及布局读取当前项目的 `config/phrases.json`、`src/core/radial-layout.cjs`。
- 菜单视觉参考实际 `src/renderer/style.css`。
- 两次追加都一次性出现完整文本，没有模拟 AI 逐字生成。
- 输入框是为视频重建的示意界面，片内标注“交互演示动画”。没有操作真实 Codex、粘贴到真实应用或点击发送。
- 音乐来源、许可和音效处理见 `MUSIC_CREDITS.md`。

## 参考方向

- [Apple Wonderful Tools / ADC 作品说明](https://www.oneclub.org/awards/adcawards/-award/35328/wonderful-tools/)：简洁形状、线条与图标之间的连续衔接。
- [Apple iMac Pro / Antfood 制作说明](https://www.antfood.com/work/apple-imac)：音乐与音效紧密配合动画。
- 本片重新设计了自己的镜头及动作，没有使用参考片的画面或原曲。

## 源文件与复现

- `film.js`：按音乐拍数驱动全部动画；`window.renderAt(seconds)` 可定位任意时间点。
- `index.html` / `film.css`：画面结构与视觉。
- `music.py`：准备选定曲目、裁切、生成点击和转场音效、混音。
- `render.mjs`：离屏 Chromium 渲染、H.264 / AAC 合成、关键帧检查。
- `analyze_music.py`：选曲阶段的音轨节拍分析。
- `timing.json` / `render-manifest.json`：导出参数、时间点、源资产及成片哈希。

在此目录通过 PowerShell 7 运行：

```powershell
& 'C:\Users\24092\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' .\music.py
& 'C:\Users\24092\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\render.mjs --preview
& 'C:\Users\24092\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\render.mjs
```

Python 需要 NumPy；Node 需要 Playwright / Sharp。当前使用本机 Chromium、Noto Sans SC 字体和剪映附带的 FFmpeg，通过 NVIDIA H.264 编码器导出。环境迁移时调整脚本路径，或设置 `PROMO_NODE_MODULES`、`PROMO_CHROMIUM`、`PROMO_FFMPEG`。

`index.html?format=portrait&play` 或 `index.html?format=landscape&play` 可预览动画，点击画面从头播放音乐；`t=6.2` 可定位到某秒。先运行 `music.py` 与一次渲染脚本以生成数据。

原版成片及源文件保存在相邻的 `phrasedock-promo` 目录。
