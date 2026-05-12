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
import { Commands } from './constants';

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
			const panel = vscode.window.createWebviewPanel(
				'willumpPortsView',
				'当前端口占用情况',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')]
				}
			);

			const portsInfo = await getPortListData();
			panel.webview.html = getPortsWebviewHtml(panel.webview, context.extensionUri, portsInfo);

			panel.webview.onDidReceiveMessage(message => handlePortsWebviewMessage(panel, message), undefined, context.subscriptions);
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function getPortsWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	portsInfo: Array<{ port: string; pid: string; command: string }>
): string {
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'index.js'));
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'style.css'));
	const nonce = getNonce();
	const initialState = JSON.stringify({ ports: portsInfo }).replace(/</g, '\\u003c');

	return `<!doctype html>
	<html lang="zh-CN">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
			<link rel="stylesheet" href="${styleUri}">
			<title>Willump Ports</title>
		</head>
		<body>
			<div id="app"></div>
			<script nonce="${nonce}">
				window.__WILLUMP_INITIAL_STATE__ = ${initialState};
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

async function handlePortsWebviewMessage(panel: vscode.WebviewPanel, message: { type?: string; port?: string; pid?: string }) {
	if (message?.type === 'refreshPorts') {
		const ports = await getPortListData();
		panel.webview.postMessage({ type: 'portsUpdated', ports });
		return;
	}

	if (message?.type === 'killPort') {
		if (!message.port || !message.pid) {
			panel.webview.postMessage({ type: 'error', message: '缺少端口或进程信息，无法终止进程' });
			return;
		}

		try {
			await killProcessByPid(message.port, message.pid);
			panel.webview.postMessage({ type: 'killResult', success: true, port: message.port, pid: message.pid });
			const ports = await getPortListData();
			panel.webview.postMessage({ type: 'portsUpdated', ports });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : '终止进程失败';
			vscode.window.showErrorMessage(`❌ ${errorMessage}`);
			panel.webview.postMessage({ type: 'killResult', success: false, message: errorMessage });
		}
	}
}
