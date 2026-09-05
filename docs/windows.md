# Windows 使用与验收

Windows x64 的代码、编译和便携目录打包已完成。初次实现未做真实桌面测试；0.1.1 根据用户截图进一步检查了实际前台进程/程序包身份，并加入只读控件诊断。真实粘贴与剪贴板恢复尚未验收。未使用鼠标/键盘操控，未激活或切换目标应用，未发送文字或访问实际剪贴板。

## 启动与更新

- 先退出旧版，再双击 `dist/0.1.1/PhraseDock-win32-x64/PhraseDock.exe`，保留整个目录。可自行创建该 exe 的桌面快捷方式。应用使用单实例锁，旧版仍运行时打开新版会唤起旧版。
- 应用和窗口图标使用仓库现有 `resources/icons/PhraseDock.ico`，浮窗共用 Mac 的 HTML/CSS/交互代码。Windows 托盘采用同套彩色图标，Mac 菜单栏沿用单色模板图标。
- 主窗口保持不聚焦、置顶、不占任务栏；中央外圈拖动，空白区域鼠标穿透。系统菜单和字体由操作系统呈现。
- 用户短语位于 `%APPDATA%\PhraseDock\phrases.json`，窗口位置位于同目录的 `window.json`。更换程序目录或重建不会覆盖它们。
- JSON 缺少 Windows 字段时在内存中补入 `Codex.exe` 及 Codex 商店包身份；保留已有短语和用户文件。非商店目标使用 `target.windowsExecutables`，商店包使用 `target.windowsPackageFamilyNames`；后者设为空数组可明确关闭商店包默认匹配。
- 首次若状态未就绪，可悬停中央按钮查看原因；将焦点放在真实文本输入框。Windows 不提供 Mac 辅助功能设置入口。

## 输入与保护

1. 核对前台 HWND 所属进程的 exe 文件名或系统返回的程序包系列名称、进程权限等级及 UIA 聚焦控件所属窗口。Codex 商店包为 `OpenAI.Codex_2p2nqsd0c76g0`，在本机实际使用 `ChatGPT.exe`；不依据窗口标题或安装路径中可变的版本号。
2. 要求 Edit / Document / ComboBox 控件开启、聚焦、非密码，并通过 ValuePattern 或 TextPattern 确认可编辑。
3. 在修改剪贴板前检查输入目标，在剪贴板准备后再次核对同一窗口和 UIA runtime ID，并确认修饰键已释放。
4. 只发送一次 Ctrl-down、V-down、V-up、Ctrl-up，不调用激活窗口、移动光标、设置文本或回车接口。若系统只接收部分事件，仅释放已按下的键，不重复粘贴。
5. UIA 能读取完整文本和单一选区时计算预期文本并等待读回；否则返回 `sent-unverified`，清除后续点击队列。
6. 恢复剪贴板前检查序列号；用户复制的新内容保持不变。恢复失败会明确提示并停止队列。

连续队列在 Windows 绑定第一次操作的进程、窗口与控件。macOS 保留 Swift 内部焦点检查，共用队列额外绑定进程；不声称 Mac 的跨请求控件识别与 Windows 完全等同。

## 剪贴板范围

支持可复制的 HGLOBAL 数据格式（如文本、HTML/RTF、DIB、文件列表及部分注册格式），另对位图和增强元文件使用对应 Windows 复制/释放接口。原数据与替换在同一剪贴板锁内处理，总备份上限 32 MiB，格式数量上限 256。

无法读取、大小超限、私有句柄/owner-display、调色板、旧式 metafile-picture 和指定 OLE 对象格式会在修改前拒绝。不能将“格式处理代码已实现”视为每种真实剪贴板对象已验证。剪贴板占用会短暂等待；恢复仍失败时提示用户。

超时插入进程继续运行以完成清理，不接受下一次粘贴，退出应用也等待组件结束。只读状态查询超时可终止。系统崩溃、强制结束进程、极慢目标或特殊输入法仍属于需要实际验证的边界。

## 手动验收表（尚未执行）

| 场景 | 预期 |
| --- | --- |
| 启动、展开、收起、按压反馈 | 与 Mac 共用布局和动效，按钮完整可见 |
| Windows 浅色/深色托盘、exe、快捷方式 | 正确显示现有应用图标 |
| 点击短语、中央按钮、拖动外圈、右键菜单 | 原输入框焦点保留，按需手动关闭菜单后继续输入 |
| 本地测试框光标中间插入、选区替换 | 文本与预期一致，不自动提交 |
| 真实 Codex 输入框 | 正确识别当前版本的 UIA 控件并插入，不误入其他窗口 |
| 中文、emoji、多行、首尾空白、连续点击 | 内容保留，顺序正确；未确认时后续队列停止 |
| 同一应用切换窗口/输入框 | 队列停止，不继续粘贴到新控件 |
| 不允许的应用、只读或密码框、按住修饰键 | 不修改剪贴板、不发送粘贴 |
| 目标以管理员运行 | 明确提示权限不匹配 |
| 剪贴板为空、文本、图片、文件列表、自定义格式 | 可支持格式完整恢复；不可支持格式提前拒绝 |
| 粘贴期间复制新内容、剪贴板被占用 | 新内容保留，失败状态准确 |
| 收起时配置错误、刷新 | 提示在可见区域出现，原有效配置仍保留 |
| 100%/125%/150% 缩放、多屏、拔掉副屏 | 窗口可见、拖动与穿透正确、位置可恢复 |
| 隐藏、托盘恢复、重启、输入中退出 | 状态和位置正确，正常退出等待剪贴板收尾 |
| 虚拟桌面、全屏与中文输入法组合态 | 单独记录结果；不提前声明与 Mac 完全一致 |

## 构建

Node.js 22.12+、PowerShell 7、.NET 10 SDK。运行 `npm ci`、`npm run package:win`。打包程序带 .NET 运行时，终端用户无需安装 SDK。`npm run build:native` 后可运行 `npm run test:windows`；自测使用模拟输入/剪贴板环境，不访问实际桌面。

此版本为本地便携构建，未添加 Windows 安装器、自动更新或 Authenticode 签名。二进制产物保存在本地 `dist`，尚未发布 Release。

## 只读诊断

`npm run diagnose:win` 调用原生组件的独立 `diagnose` 请求。它输出前台窗口句柄、进程 ID、exe 文件名、程序包系列名称和是否匹配；只对允许的应用读取聚焦控件类型、框架、焦点、可编辑能力等元数据。不会返回控件名称、文字、选区或剪贴板内容，也不进入粘贴事务。若前台是浏览器、终端等非目标应用，`allowed: false` 是正常保护。

接口依据：[Electron 窗口](https://www.electronjs.org/docs/latest/api/base-window)、[UIA 文本模型](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-understandingtheuiautomationtextobjectmodel)、[SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)、[剪贴板所有权](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setclipboarddata)、[剪贴板序列号](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipboardsequencenumber)。
