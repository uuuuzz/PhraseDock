# PhraseDock · 短语浮窗

点击悬浮按钮，把预设文字插入 Codex 当前输入框的光标处。可连续点击组合短语，由你检查后发送。

**当前版本：macOS 最小可用版。**界面、配置与平台适配层分离；Windows 输入适配尚未实现，不应视为已支持 Windows。

项目状态：macOS Apple Silicon 本地构建已验证；Windows 适配和面向公众的安装包仍在开发中。目前没有 GitHub Release。

## 使用

1. 打开打包好的 `PhraseDock.app`。建议把应用放在一个固定位置后再授权。
2. 首次使用，在中央按钮上点右键，选择「打开辅助功能设置」，然后在系统设置中启用 **PhraseDock**。若列表中没有它，用 `+` 添加正在运行的 `PhraseDock.app`。
3. 回到 Codex，点击文本框，确保看见输入光标。点击中央 `+` 展开短语，再点击需要的键帽。
4. 中央按钮的绿色小圆点表示目标输入框就绪。只会插入文字，不会按回车发送。

- 启动时只显示中央 `+`；点击后短语围绕中心展开，中央变为 `−`。再次点击即可全部收回。
- 点击短语后菜单保持展开，便于连续组合；只有点击中央 `−` 才收回。
- 拖动中央按钮的外圈可移动浮窗，中心位置自动保存。
- 中央按钮右键菜单和菜单栏气泡图标提供编辑、刷新、测试、隐藏和退出。
- 「打开输入测试」会打开一个本地测试框，用于测试插入、选区替换、连续点击和换行。关闭该窗口后，恢复为仅接收 Codex 输入。
- 光标在中间时插入到中间；选中文字时按正常粘贴规则替换选区。
- 仅鼠标悬停在输入框上不够，需要先点击输入框获得输入焦点。

## 自定义短语

点击「编辑短语」，修改 JSON 文件并保存，然后点击「刷新」。初次运行会从项目的 `config/phrases.json` 复制默认值到：

```text
~/Library/Application Support/PhraseDock/phrases.json
```

实际使用的是上面的用户配置，后续构建不会覆盖它。示例：

```json
{
  "schemaVersion": 1,
  "target": { "macBundleIds": ["com.openai.codex"] },
  "phrases": [
    { "id": "analyze", "label": "先分析", "text": "先分析，暂时不要修改代码。" },
    { "id": "check", "label": "检查", "text": "请检查结果。\n说明已验证和未验证的部分。" }
  ]
}
```

支持 1～12 个按钮，每个短语最多 8000 个 UTF-16 单元。文本按原样插入，包含换行和首尾空白。`id` 必须唯一。错误配置不会覆盖上一次已加载的有效配置；启动时遇到错误会显示提示并临时使用默认短语。

## 本地稳定签名与辅助功能权限

早期构建使用 ad-hoc 签名，每次重新打包都会改变系统识别应用所用的指定要求。系统因此可能保留旧构建的授权，导致开关是开的，当前构建却未获授权。系统日志已确认过 `Failed to match existing code requirement`；这与是否给输入辅助进程单独授权无关。

当前构建流程使用钥匙串中的 `PhraseDock Local Code Signing` 本地证书，并为根应用写入同时约束 Bundle ID 和证书指纹的稳定指定要求。证书的私钥只保存在登录钥匙串，没有加入系统受信任根。首次在一台 Mac 上开发时运行：

```sh
npm run setup:signing
```

该命令生成 3072 位 RSA 本地代码签名证书，有效期 10 年；导入完成后删除临时私钥和 PKCS#12 文件。构建脚本找不到证书时会停止，不会回退到 ad-hoc 签名。

在「隐私与安全性 → 辅助功能」中，用 `+` 重新选择你实际运行的 `PhraseDock.app`；如果旧条目未被更新，先选中旧条目并移除，再重新添加。系统可能要求本机登录验证。完成后退出并重新打开 PhraseDock。

若系统设置仍保留旧签名，可用系统提供的命令仅重置本工具，然后再次通过系统设置添加当前应用：

```sh
tccutil reset Accessibility com.phrasedock.desktop
```

该命令会撤销 PhraseDock 自身的这项授权，需要重新在系统设置中允许；不要省略应用标识以免重置其他应用。本次本机故障已通过这一流程修复。

切换到稳定证书后的第一版仍需重新关联一次授权；后续内容变化会改变 cdhash，但同一证书和 Bundle ID 生成的指定要求保持一致。换电脑、删除证书或重新生成证书后需要重新授权。该本地证书不等于 Developer ID，也不会让应用通过其他 Mac 的 Gatekeeper；对外发布仍应采用 Developer ID 和公证。

## 开发与打包

要求 Node.js 22.12+。Mac 原生组件需要 Xcode Command Line Tools（Swift）。

```sh
npm ci
npm run setup:signing
npm start
```

开发运行时进程名可能是 Electron；日常使用请使用打包应用并给 PhraseDock 授权。

```sh
npm run check
npm test
npm run package:mac
```

Apple Silicon 构建位于 `dist/PhraseDock-darwin-arm64/PhraseDock.app`。在 Intel Mac 上构建得到 x64 版本；本次只在 Apple Silicon 机器构建验证。打包使用 PhraseDock 专用本地证书，没有 Developer ID 公证。

## 项目结构

```text
config/phrases.json          默认短语，跨平台共用
src/main.cjs                应用生命周期、悬浮窗、配置、系统适配调度
src/preload.cjs             有限的界面通信接口
src/core/config.cjs         配置校验与窗口位置恢复
src/core/radial-layout.cjs  放射位置、尺寸和中心锚点计算
src/renderer/              共用 HTML / CSS / JavaScript 界面
src/platform/macos.cjs      Mac 桥接进程管理
src/platform/windows.cjs    Windows 扩展入口（当前明确返回未实现）
native/macos/               Mac 的 Swift 输入组件
scripts/                   构建、打包和语法检查
test/                      配置及屏幕变化的关键边界检查
docs/architecture.md       平台适配约定与后续扩展
docs/validation.md         本次验证记录
```

## 输入行为与边界

- 浮窗不获取键盘焦点；发送前再次检查前台应用和输入框。默认允许 `com.openai.codex`，包括该应用内符合条件的文本输入框，不局限于某个任务的主输入框。
- 没有权限、目标应用不对、焦点不在文本框、修饰键仍按住时，不发送粘贴。
- 文本通过标准输入传给本机组件，不经过 shell 命令拼接。不会记录输入框内容或剪贴板内容，不连接远程服务。
- 暂时使用系统剪贴板，备份所有可读取的数据类型，粘贴后恢复；用户中途复制了新内容时保留新内容。过大（32 MiB 以上）或无法备份的剪贴板会被明确提示。
- AX 能读取输入结果时会校验插入后的完整文本。若无法确认，显示「已发送粘贴，请确认输入框中的结果」，不自动重试，避免重复输入。此时延迟恢复剪贴板仍可能受极慢的目标应用影响。
- 中文输入法仍在组词时，先完成候选词确认，再点击短语。跨输入法的组合态兼容需要进一步实测。

## 放射式轻立体键帽

- 收起窗口为 72×72px，只显示 64px 中央按钮；展开后按短语数量使用 344×284、440×340 或 560×420px 透明区域。
- 当前六个短语顺时针分布在单圈椭圆上。配置允许的 1～12 个按钮均有对应布局，并检查不重叠、不越界。
- 键帽按下时下移 2px、缩小至 98%；即使快速点击也会保留至少 72ms 的按压反馈。菜单展开约 145ms，并按配置顺序以 8ms 间隔错开出现。
- 中央按钮的可点击直径为 56px，外围保留 4px 拖动环。快速连续点击短语时按点击顺序排队执行，其他按钮不会整体禁用或变暗。
- 宿主窗口保持透明，空白区域通过 `setIgnoreMouseEvents` 允许鼠标落到后面的应用；中央按钮、拖动外圈和键帽仍可交互。
- 中心位置是窗口持久化单位。展开靠近屏幕边缘时只向屏幕内移动到足以完整显示的位置。

## License

PhraseDock 使用 [MIT License](LICENSE)。

## 参考

- [Electron 的窗口类型与焦点](https://www.electronjs.org/docs/latest/api/base-window)
- [Apple 非激活面板](https://developer.apple.com/documentation/appkit/nswindow/stylemask-swift.struct/nonactivatingpanel)
- [Apple 面板键盘焦点控制](https://developer.apple.com/documentation/appkit/nspanel/becomeskeyonlyifneeded)
- [Electron 安全边界](https://www.electronjs.org/docs/latest/tutorial/security)
