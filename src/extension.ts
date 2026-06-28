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
import { getGitConfigInfo, updateGitConfig, updateGitSetting } from './utils/git.config';
import { getSystemCpuUsageInfo, getSystemInfo, getSystemMemoryInfo } from './utils/system.info';
import { Commands } from './constants';
import { localize } from './i18n';

const FEATURES_VIEW_TYPE = 'willump.featuresView';
const ROUTES = {
	PORTS: '/ports',
	GIT_CONFIG: '/dev-config/git',
	SYSTEM_INFO: '/system-info'
} as const;
let willumpPanel: vscode.WebviewPanel | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "willump" is now active!');

	// 新的 checkPort 命令
	const checkPortCommand = vscode.commands.registerCommand(Commands.CHECK_PORT, async () => {
		const input = await vscode.window.showInputBox({
			prompt: localize('command.checkPort.prompt'),
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
				prompt: localize('command.killPort.prompt'),
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
			openWillumpWebview(context, 'Willump', ROUTES.PORTS, { portScanMode: 'listening' });
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(Commands.VIEW_GIT_CONFIG, async () => {
			openWillumpWebview(context, localize('git.title'), ROUTES.GIT_CONFIG);
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(Commands.VIEW_SYSTEM_INFO, async () => {
			openWillumpWebview(context, localize('system.title'), ROUTES.SYSTEM_INFO);
		})
	);
	context.subscriptions.push(vscode.window.registerTreeDataProvider(FEATURES_VIEW_TYPE, new FeaturesViewProvider()));
}

// This method is called when your extension is deactivated
export function deactivate() {}

function openWillumpWebview(context: vscode.ExtensionContext, title: string, route: string, state: Record<string, unknown> = {}) {
	if (willumpPanel) {
		willumpPanel.title = title;
		willumpPanel.reveal(vscode.ViewColumn.One);
		willumpPanel.webview.postMessage({
			type: 'navigate',
			route,
			...state
		});
		return;
	}

	const panel = vscode.window.createWebviewPanel('willumpView', title, vscode.ViewColumn.One, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')]
	});
	willumpPanel = panel;

	panel.webview.html = getWillumpWebviewHtml(panel.webview, context.extensionUri, {
		language: vscode.env.language,
		route,
		...state
	});
	panel.webview.onDidReceiveMessage(message => handleWebviewMessage(panel, message), undefined, context.subscriptions);
	panel.onDidDispose(() => {
		willumpPanel = undefined;
	});
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
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}';">
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
	private readonly devConfig = new FeatureItem(
		localize('feature.devConfig.title'),
		localize('feature.devConfig.description'),
		'settings-gear',
		undefined,
		vscode.TreeItemCollapsibleState.Expanded
	);

	getTreeItem(element: FeatureItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: FeatureItem): FeatureItem[] {
		if (element === this.devConfig) {
			return [
				new FeatureItem(
					localize('feature.devConfig.git.title'),
					localize('feature.devConfig.git.description'),
					'git-branch',
					{
						command: Commands.VIEW_GIT_CONFIG,
						title: localize('feature.devConfig.git.open')
					}
				)
			];
		}

		return [
			new FeatureItem(
				localize('feature.system.title'),
				localize('feature.system.description'),
				'device-desktop',
				{
					command: Commands.VIEW_SYSTEM_INFO,
					title: localize('feature.system.open')
				}
			),
			new FeatureItem(
				localize('feature.ports.title'),
				localize('feature.ports.description'),
				'plug',
				{
					command: Commands.VIEW_PORTS,
					title: localize('feature.ports.open')
				}
			),
			this.devConfig
		];
	}
}

async function handleWebviewMessage(
	target: { webview: vscode.Webview },
	message: { type?: string; port?: string; pid?: string; mode?: 'listening' | 'all'; scope?: 'local' | 'global'; name?: string; email?: string; key?: string; value?: string }
) {
	if (message?.type === 'refreshPorts') {
		const mode = message.mode === 'all' ? 'all' : 'listening';
		const ports = await getPortListData(mode);
		target.webview.postMessage({ type: 'portsUpdated', ports, mode });
		return;
	}

	if (message?.type === 'killPort') {
		if (!message.port || !message.pid) {
			target.webview.postMessage({ type: 'error', message: localize('port.kill.missing') });
			return;
		}

		try {
			await killProcessByPid(message.port, message.pid);
			target.webview.postMessage({ type: 'killResult', success: true, port: message.port, pid: message.pid });
			const mode = message.mode === 'all' ? 'all' : 'listening';
			const ports = await getPortListData(mode);
			target.webview.postMessage({ type: 'portsUpdated', ports, mode });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : localize('port.killResult.failed');
			vscode.window.showErrorMessage(errorMessage);
			target.webview.postMessage({ type: 'killResult', success: false, message: errorMessage });
		}

		return;
	}

	if (message?.type === 'getSystemInfo') {
		try {
			const info = await getSystemInfo();
			target.webview.postMessage({ type: 'systemInfoUpdated', success: true, info });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : localize('system.loadFailed');
			target.webview.postMessage({ type: 'systemInfoUpdated', success: false, message: errorMessage });
		}

		return;
	}

	if (message?.type === 'getSystemMemoryInfo') {
		target.webview.postMessage({ type: 'systemMemoryUpdated', success: true, memory: getSystemMemoryInfo() });
		return;
	}

	if (message?.type === 'getSystemCpuInfo') {
		target.webview.postMessage({ type: 'systemCpuUpdated', success: true, cpu: getSystemCpuUsageInfo() });
		return;
	}

	if (message?.type === 'getGitConfig') {
		const workspacePath = getWorkspacePath();

		if (!workspacePath) {
			target.webview.postMessage({ type: 'gitConfigUpdated', success: false, message: localize('git.noWorkspace') });
			return;
		}

		const config = await getGitConfigInfo(workspacePath, getWorkspacePaths());
		target.webview.postMessage({ type: 'gitConfigUpdated', success: true, config });
		return;
	}

	if (message?.type === 'updateGitConfig') {
		const workspacePath = getWorkspacePath();

		if (!workspacePath || !message.scope) {
			target.webview.postMessage({ type: 'gitConfigSaved', success: false, message: localize('git.saveMissingScope') });
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
			const config = await getGitConfigInfo(workspacePath, getWorkspacePaths());
			target.webview.postMessage({ type: 'gitConfigSaved', success: true, scope: message.scope, config });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : localize('git.saveFailed');
			vscode.window.showErrorMessage(errorMessage);
			target.webview.postMessage({ type: 'gitConfigSaved', success: false, message: errorMessage });
		}
	}

	if (message?.type === 'updateGitSetting') {
		const workspacePath = getWorkspacePath();

		if (!workspacePath || !message.scope || !message.key) {
			target.webview.postMessage({ type: 'gitConfigSaved', success: false, message: localize('git.saveMissingScope') });
			return;
		}

		try {
			await updateGitSetting(message.scope, message.key, message.value?.trim() ?? '', workspacePath);
			const config = await getGitConfigInfo(workspacePath, getWorkspacePaths());
			target.webview.postMessage({ type: 'gitConfigSaved', success: true, scope: message.scope, config });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : localize('git.saveFailed');
			vscode.window.showErrorMessage(errorMessage);
			target.webview.postMessage({ type: 'gitConfigSaved', success: false, message: errorMessage });
		}
	}
}

function getWorkspacePath(): string | undefined {
	return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getWorkspacePaths(): string[] {
	return vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [];
}
