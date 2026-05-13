// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
	checkPortUsage,
	killProcessOnPort,
	listAllPorts,
	getPortListData,
	killProcessByPid
} from './utils/common.port';
import { getGitConfigInfo, updateGitConfig } from './utils/git.config';
import { Commands } from './constants';

const FEATURES_VIEW_TYPE = 'willump.featuresView';
const ROUTES = {
	PORTS: '/ports',
	GIT_CONFIG: '/dev-config/git'
} as const;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "willump" is now active!');

	// 新的 checkPort 命令
	const checkPortCommand = vscode.commands.registerCommand(Commands.CHECK_PORT, async () => {
		const input = await vscode.window.showInputBox({
			prompt: '请输入要检查的端口（用空格分隔），例如：3000 8080',
			placeHolder: '3000 8080'
		});

		if (!input) {
			return;
		}

		const ports = input
			.split(/\s+/)
			.map(p => p.trim())
			.filter(Boolean);

		for (const port of ports) {
			checkPortUsage(port);
		}
	});
	context.subscriptions.push(checkPortCommand);

	context.subscriptions.push(
		vscode.commands.registerCommand(Commands.KILL_PORT, async () => {
			const input = await vscode.window.showInputBox({
				prompt: '输入要终止进程的端口（用空格分隔）',
				placeHolder: '3000 8080'
			});
			if (!input) {
				return;
			}

			const ports = input.split(/\s+/).filter(Boolean);
			for (const port of ports) {
				await killProcessOnPort(port);
			}
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(Commands.LIST_ALL_PORTS, async () => {
			listAllPorts();
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(Commands.VIEW_PORTS, async () => {
			const portsInfo = await getPortListData();
			openWillumpWebview(context, '当前端口占用情况', ROUTES.PORTS, { ports: portsInfo });
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(Commands.VIEW_GIT_CONFIG, async () => {
			openWillumpWebview(context, 'Git 开发配置', ROUTES.GIT_CONFIG);
		})
	);
	context.subscriptions.push(vscode.window.registerTreeDataProvider(FEATURES_VIEW_TYPE, new FeaturesViewProvider()));
}

// This method is called when your extension is deactivated
export function deactivate() {}

function openWillumpWebview(context: vscode.ExtensionContext, title: string, route: string, state: Record<string, unknown> = {}) {
	const panel = vscode.window.createWebviewPanel('willumpView', title, vscode.ViewColumn.One, {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')]
	});

	panel.webview.html = getWillumpWebviewHtml(panel.webview, context.extensionUri, {
		route,
		...state
	});
	panel.webview.onDidReceiveMessage(message => handleWebviewMessage(panel, message), undefined, context.subscriptions);
}

function getWillumpWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	initialState: Record<string, unknown>
): string {
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'index.js'));
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'style.css'));
	const nonce = getNonce();
	const serializedState = JSON.stringify(initialState).replace(/</g, '\\u003c');

	return `<!doctype html>
	<html lang="zh-CN">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
			<link rel="stylesheet" href="${styleUri}">
			<title>Willump</title>
		</head>
		<body>
			<div id="app"></div>
			<script nonce="${nonce}">
				window.__WILLUMP_INITIAL_STATE__ = ${serializedState};
			</script>
			<script nonce="${nonce}" type="module" src="${scriptUri}"></script>
		</body>
	</html>`;
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
}

class FeatureItem extends vscode.TreeItem {
	constructor(label: string, description: string, iconId: string, command?: vscode.Command, collapsibleState = vscode.TreeItemCollapsibleState.None) {
		super(label, collapsibleState);
		this.description = description;
		this.command = command;
		this.iconPath = new vscode.ThemeIcon(iconId);
	}
}

class FeaturesViewProvider implements vscode.TreeDataProvider<FeatureItem> {
	private readonly devConfig = new FeatureItem('开发配置', 'Git / 后续更多配置', 'settings-gear', undefined, vscode.TreeItemCollapsibleState.Expanded);

	getTreeItem(element: FeatureItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: FeatureItem): FeatureItem[] {
		if (element === this.devConfig) {
			return [
				new FeatureItem(
					'Git',
					'作者 / 邮箱',
					'git-branch',
					{
						command: Commands.VIEW_GIT_CONFIG,
						title: '打开 Git 开发配置'
					}
				)
			];
		}

		return [
			new FeatureItem(
				'端口占用',
				'查看 / 搜索 / 终止',
				'plug',
				{
					command: Commands.VIEW_PORTS,
					title: '打开端口占用视图'
				}
			),
			this.devConfig
		];
	}
}

async function handleWebviewMessage(
	target: { webview: vscode.Webview },
	message: { type?: string; port?: string; pid?: string; scope?: 'local' | 'global'; name?: string; email?: string }
) {
	if (message?.type === 'refreshPorts') {
		const ports = await getPortListData();
		target.webview.postMessage({ type: 'portsUpdated', ports });
		return;
	}

	if (message?.type === 'killPort') {
		if (!message.port || !message.pid) {
			target.webview.postMessage({ type: 'error', message: '缺少端口或进程信息，无法终止进程' });
			return;
		}

		try {
			await killProcessByPid(message.port, message.pid);
			target.webview.postMessage({ type: 'killResult', success: true, port: message.port, pid: message.pid });
			const ports = await getPortListData();
			target.webview.postMessage({ type: 'portsUpdated', ports });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : '终止进程失败';
			vscode.window.showErrorMessage(errorMessage);
			target.webview.postMessage({ type: 'killResult', success: false, message: errorMessage });
		}

		return;
	}

	if (message?.type === 'getGitConfig') {
		const workspacePath = getWorkspacePath();

		if (!workspacePath) {
			target.webview.postMessage({ type: 'gitConfigUpdated', success: false, message: '当前没有打开工作区，无法读取项目 Git 配置' });
			return;
		}

		const config = await getGitConfigInfo(workspacePath);
		target.webview.postMessage({ type: 'gitConfigUpdated', success: true, config });
		return;
	}

	if (message?.type === 'updateGitConfig') {
		const workspacePath = getWorkspacePath();

		if (!workspacePath || !message.scope) {
			target.webview.postMessage({ type: 'gitConfigSaved', success: false, message: '缺少工作区或配置范围，无法保存 Git 配置' });
			return;
		}

		try {
			await updateGitConfig(
				message.scope,
				{
					name: message.name?.trim() ?? '',
					email: message.email?.trim() ?? ''
				},
				workspacePath
			);
			const config = await getGitConfigInfo(workspacePath);
			target.webview.postMessage({ type: 'gitConfigSaved', success: true, scope: message.scope, config });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : '保存 Git 配置失败';
			vscode.window.showErrorMessage(errorMessage);
			target.webview.postMessage({ type: 'gitConfigSaved', success: false, message: errorMessage });
		}
	}
}

function getWorkspacePath(): string | undefined {
	return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
