# AI 常用提示词快捷追加器 · 产品动画

25 秒产品宣传片，30 fps。浅色画面、原始应用图标、轻微镜头推进、真实的六按钮菜单、逐句追加演示；无旁白，配有程序合成的音乐与点击音效。

## 成片

- `Bilibili_1920x1080.mp4`：横屏，1920 × 1080。
- `Douyin_1080x1920.mp4`：竖屏，1080 × 1920，单独排版。
- 同名 `_cover.png`：各平台封面。
- 编码为 H.264 / YUV 4:2:0 / BT.709，AAC 48 kHz 立体声，MP4 支持快速播放。

## 时间线

| 时间 | 画面与信息 |
| --- | --- |
| 0–3.5 秒 | 原始图标出场；“常用提示词。一点，追加。” |
| 3.5–7.3 秒 | 在示意的 Codex 输入框写下“帮我分析一下这个项目。” |
| 7.3–9.6 秒 | 点击中央加号，六个真实预设展开。 |
| 9.6–12.6 秒 | 点击“先分析先不做”，完整句子一次性追加。 |
| 12.6–15.7 秒 | 点击“有疑问直接问”，第二句一次性追加。 |
| 15.7–18.4 秒 | 继续手动输入“重点看看交互体验。” |
| 18.4–21 秒 | 停留展示组合结果；“看一眼，再发送。” |
| 21–25 秒 | 图标、完整中英文产品名、macOS / Windows、GitHub 地址。 |

## 素材与真实性

- 图标直接引用项目的 `resources/icons/source/PhraseDock-windows.png`，未重绘。
- 渲染时读取项目 `config/phrases.json` 和 `src/core/radial-layout.cjs`，使用实际预设内容及六按钮布局。
- 菜单的颜色、边框、阴影、尺寸和按压反馈参考 `src/renderer/style.css`。
- 输入框是为影片重建的演示画面；画面标注“交互演示动画”。本片不是操作系统录屏或原生输入验收记录。
- 完整预设按真实粘贴方式整句出现，没有模拟逐字生成。最终发送按钮未被点击。
- 音轨由 `audio.py` 合成，不含外部音乐、采样或 AI 配音。
- 字体使用本机 Noto Sans SC 与 Segoe UI；没有向项目复制系统字体。

## 可编辑源文件

- `index.html` / `scene.css`：画面结构及两种画幅的排版。
- `scene.js`：可按时间点准确定位的动作、文字和镜头。
- `render.mjs`：读取项目资产，以离屏 Chromium 逐帧渲染并合成成片。
- `audio.py`：音轨生成。
- `qc/`：关键帧、画面检查表、编码后的抽帧。
- `render-manifest.json`：时长、帧数、输出尺寸、资产及成片哈希。

## 再次渲染

在 PowerShell 7 中运行 `audio.py`，再运行 `render.mjs --preview` 检查关键画面，最后运行 `render.mjs` 导出。使用安装了 NumPy 的 Python，以及可找到 Playwright / Sharp 的 Node 环境。

```powershell
& 'C:\Users\24092\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' .\audio.py
& 'C:\Users\24092\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\render.mjs --preview
& 'C:\Users\24092\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\render.mjs
```

`PROMO_NODE_MODULES`、`PROMO_CHROMIUM`、`PROMO_FFMPEG` 可以覆盖脚本中的本机路径。当前编码使用 NVIDIA H.264 编码器。换电脑时，需要调整浏览器、字体和编码器路径。

在浏览器打开 `index.html?format=portrait&play` 或 `index.html?format=landscape&play` 可预览无声音画；`t=10.05` 可以固定到某一时刻。先运行一次渲染脚本生成 `data.js`。
