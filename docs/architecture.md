# 平台边界

## 本次技术选择

Electron 负责两端共用的界面、配置、菜单与应用生命周期。操作系统输入 API 封装在适配层；Mac 通过一个 Swift 辅助进程访问 AX 与 Quartz。项目不依赖修改 Codex 本体。

Renderer → preload 的有限 IPC → main 查询目标 → platform.insert → 原生组件再次检查焦点 → 粘贴 → 校验 → 有条件恢复剪贴板。

只把短语 ID 从界面传到主进程；文本从已校验配置取得。Renderer 启用 sandbox、contextIsolation，关闭 Node 集成，拒绝外部导航与新窗口。配置用 textContent 呈现。无自动更新或远程资源。

放射菜单以屏幕坐标中的中心锚点保存位置。收起时窗口为 72×72px；展开前主进程以同一中心扩大透明窗口，Renderer 再让键帽从中心移动到计算位置。收回时先播放 Renderer 动画，再缩小原生窗口。透明空白区域通过受限 IPC 切换 `setIgnoreMouseEvents(..., { forward: true })`，避免展开窗口挡住后面的应用；该 IPC 只接受布尔值。

## 系统适配接口

`src/platform/index.cjs` 选择平台实现。各实现提供：

```js
configure(target)                 // 更新允许的目标应用
status()                         // Promise<Status>
insert(text, expectedPid)         // Promise<Result>
close()                          // 释放原生资源
```

`Status`：`ok`、`ready`、`trusted`、`code`、`message`，就绪时还含 `pid`、`bundleId`、`appName`、`role`。

`Result`：除状态字段外，粘贴后含 `verified` 与 `clipboardRestored`。`ok: true` 表示粘贴事件已发送，只有 `verified: true` 表示已通过 AX 读回验证；这两种状态必须在产品反馈中保持区分。

原生桥使用 stdin/stdout 单请求 JSON，不把短语作为命令行参数。错误不输出输入框、选区文字、剪贴板或完整配置。主进程拒绝并发插入，不重试已经发出的粘贴。

## 添加 Windows 支持

1. 保持共用界面与配置模块不变，在配置 schema 中增加 Windows 目标应用标识。
2. 实现 `src/platform/windows.cjs`：检查前台窗口及进程，读取 UI Automation 焦点与可编辑文本元素。
3. 选择 Windows 原生桥（例如 C#/.NET），实现 `Ctrl+V`、完整剪贴板备份、选区与插入结果校验。遵循同一 JSON 协议和状态语义。
4. 验证 Electron `focusable: false` 的点击行为，必要时在 Windows 原生层设置不激活窗口策略。
5. 增加 Windows 本机打包脚本和实际测试。打包能生成 exe 不等于输入适配完成。

本仓库目前的 Windows adapter 明确返回 `unsupported`，不会静默模拟成功。Linux 也未实现。

## 后续功能

短语图形编辑、多分组、排序、快捷键、开机启动、应用白名单编辑、跨设备配置同步。同步功能引入前维持纯本地数据路径。
