# Willump

[![CI](https://github.com/cbtpro/vscode-willump/actions/workflows/ci.yml/badge.svg)](https://github.com/cbtpro/vscode-willump/actions/workflows/ci.yml) [![Powered by ChatGPT](https://img.shields.io/badge/Powered%20by-ChatGPT-10B981?logo=openai&logoColor=white)](https://chat.openai.com/) [![Powered by GitHub Copilot](https://img.shields.io/badge/Powered%20by-GitHub%20Copilot-2ea44f?logo=github&logoColor=white)](https://github.com/features/copilot)

简洁的 VS Code 本地端口诊断与管理扩展。将系统级端口诊断命令封装为编辑器内操作，并提供可视化 Webview 界面与安全的进程终止流程，方便前端、Node.js 与本地服务开发者快速定位和释放端口。

快速概览

- 支持监听/全部连接两种扫描模式
- 显示端口、协议、本地地址、PID、简短命令与完整启动命令
- 为常用端口提供友好服务名（HTTP、Redis、MySQL 等）
- 在表格中按进程聚合端口，支持搜索、排序与列配置
- 在确认对话框中安全终止占用进程

主要场景

- 启动开发服务器时快速定位占用端口的进程
- 多项目并行开发时查看当前机器端口使用情况
- 在 VS Code 内快速诊断并（可选）释放被占用端口

安装与本地开发

- 克隆并安装依赖：

```bash
git clone https://github.com/cbtpro/vscode-willump.git
cd vscode-willump
npm install
```

- 本地调试：在 VS Code 中按 F5 启动 Extension Development Host，然后在新窗口命令面板中运行 "Willump: 查看端口占用"。

构建与打包：

```bash
npm run compile
npm run package
```

- 开发指南

## 环境要求

- Node.js 18+（推荐 20.x）
- VS Code（用于本地调试 Extension Development Host）
- npm 用于安装依赖与执行脚本

## 本地开发流程

- 安装依赖：

```bash
npm install
```

- 编译源码：

```bash
npm run compile
```

- 启动开发宿主：在 VS Code 中按 F5（Run Extension）启动 Extension Development Host，并在新窗口命令面板中运行 "Willump: 查看端口占用" 进行验证。

监听开发：

```bash
npm run watch
npm run watch:webview
```

修改后在 Extension Development Host 中执行 `Developer: Reload Window` 以应用更改。

## 编译

```bash
npm run compile
```

## 打包

```bash
npm run package
```

## 打tag

```bash
git tag v0.0.6
git push --tags
```



## 调试要点

- 在 `src/extension.ts` 或 `src/utils/common.port.ts` 中设置断点来调试扩展侧逻辑。
- Webview 源码位于 `webview-ui/src/`，可在浏览器控制台查看 Webview 日志（通过 `acquireVsCodeApi().postMessage`/`onmessage` 通信）。
- 涉及系统命令的解析代码应被抽象成可测试的解析器，便于在无权限环境下通过 mock 进行单元测试。

## 新命令开发流程

1. 在 `src/constants/port.ts` 中增加命令 ID。
2. 在 `package.json` 的 `contributes.commands` 中声明命令。
3. 在 `src/extension.ts` 的 `activate` 中注册命令并调用实现。
4. 将具体逻辑放在 `src/utils/` 中编写，保持入口文件轻量。

## 端口功能开发约定

- 平台相关命令与解析应分离（例如 `port.commands.ts`），便于扩展与测试。
- 对系统命令输出做结构化解析，并对权限不足或输出格式异常场景做好降级处理。
- 终止进程前务必提供确认弹窗并展示 PID、命令与受影响端口。

Webview 使用说明

- 页面由 Vue 3 + Vite 构建，默认展示短命令（表格），并在需要时通过“查看”弹窗显示完整命令与复制功能。
- PortsTable 支持列显示/隐藏、排序与横向滚动，PortsSummaryBar 提供搜索与模式切换。
- 进程聚合视图可按 PID 汇总该进程占用的所有端口，便于判断服务实例。

实现要点与平台兼容性

- macOS / Linux：使用 lsof、ps 获取监听信息与完整命令。
- Windows：使用 netstat + tasklist，尽可能通过 PowerShell 读取 CommandLine 字段以获取完整启动命令。
- 权限限制：若无法获取完整命令，界面会回退显示可用的进程名或短命令。

代码结构（要点）

- src/ — 扩展主逻辑与 VS Code API 交互
- src/utils/ — 平台命令配置与输出解析（port.commands.ts、common.port.ts）
- webview-ui/src/ — Vue Webview 源码（组件化设计）
- webview-ui/src/composables — 复用逻辑（usePorts、useTableColumns、useTableSort）
- webview-ui/tests — 单元测试（Vitest）

测试与 CI

- 单元测试：`npm run test:unit`（基于 Vitest，限制在 webview-ui/tests）
- 集成测试：`npm test`（基于 @vscode/test-electron，用于集成/端到端检验）
- CI：GitHub Actions workflow (.github/workflows/ci.yml) 包含 unit 与 integration 阶段，integration 在多平台矩阵上运行。

贡献

欢迎通过 Issue 或 PR 贡献：

- 提交新特性前建议先在 Issue 讨论。
- 所有 PR 请保证通过 CI（单元与集成测试）。

致谢

- ChatGPT（OpenAI） — 在重构建议、示例与问题排查上提供了大量帮助。
- GitHub Copilot — 在编码与重构时提升了开发效率。

许可证

MIT — 详见 [LICENSE.md](./LICENSE.md)
