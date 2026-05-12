import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import { CommandSpec, getPortCommandProfile, PortInfo } from './port.commands';

/**
 * 检查指定端口的使用情况。
 * 根据不同的操作系统执行相应的命令，判断端口是否被占用，并显示相应的提示信息。
 * @param port - 要检查使用情况的端口号
 */
export function checkPortUsage(port: string) {
	const profile = getPortCommandProfile();

	// 执行命令检查端口使用情况
	executeCommand(profile.checkPortUsage(port), { maxBuffer: 1024 * 1024 })
		.then(({ stdout }) => {
			if (!stdout.trim()) {
				vscode.window.showInformationMessage(`✅ 端口 ${port} 没有被占用`);
				return;
			}

			vscode.window.showWarningMessage(`❌ 端口 ${port} 已被占用：\n${stdout}`);
		})
		// 如果执行命令过程中出现错误、有标准错误输出或者没有输出结果
		.catch(() => {
			vscode.window.showInformationMessage(`✅ 端口 ${port} 没有被占用`);
		});
}

/**
 * 列出所有被占用的端口信息。
 * 根据不同的操作系统执行相应的命令，将结果显示在 VS Code 的输出面板中。
 */
export function listAllPorts() {
	const profile = getPortCommandProfile();

	// 执行命令，设置最大缓冲区为 1MB
	executeCommand(profile.listAllPorts(), { maxBuffer: 1024 * 1024 })
		.then(({ stdout }) => {
			// 创建一个名为 'Willump Ports' 的输出通道
			const outputChannel = vscode.window.createOutputChannel('Willump Ports');
			// 清空输出通道中的原有内容
			outputChannel.clear();
			// 向输出通道添加标题行
			outputChannel.appendLine('📡 当前占用端口：');
			// 向输出通道添加命令执行结果
			outputChannel.appendLine(stdout);
			// 显示输出通道
			outputChannel.show();
		})
		.catch(() => {
			vscode.window.showErrorMessage('❌ 获取端口信息失败');
		});
}

const execAsync = promisify(childProcess.exec);
const execFileAsync = promisify(childProcess.execFile);

async function executeCommand(command: CommandSpec, options: childProcess.ExecOptions = {}): Promise<{ stdout: string; stderr: string }> {
	const execOptions = {
		encoding: 'utf8' as BufferEncoding,
		...options
	};

	if (command.type === 'shell') {
		const result = await execAsync(command.command, execOptions);

		return {
			stdout: String(result.stdout),
			stderr: String(result.stderr)
		};
	}

	const result = await execFileAsync(command.file, command.args, execOptions);

	return {
		stdout: String(result.stdout),
		stderr: String(result.stderr)
	};
}

export async function killProcessByPid(port: string, pid: string): Promise<void> {
	if (!/^\d+$/.test(pid)) {
		throw new Error(`无效的进程 PID：${pid}`);
	}

	const profile = getPortCommandProfile();

	try {
		await executeCommand(profile.killPid(pid), { timeout: 5000 });
		vscode.window.showInformationMessage(`✅ 已终止端口 ${port} 的进程 ${pid}`);
	} catch (err) {
		throw new Error(`无法终止端口 ${port} 的进程 ${pid}`);
	}
}

export async function killProcessOnPort(port: string): Promise<void> {
	if (!/^\d+$/.test(port)) {
		vscode.window.showErrorMessage(`❌ 无效的端口：${port}`);
		return;
	}

	const pids = await getListeningPidsByPort(port);

	if (!pids.length) {
		vscode.window.showInformationMessage(`✅ 端口 ${port} 没有被占用`);
		return;
	}

	const failedPids: string[] = [];

	for (const pid of pids) {
		try {
			await killProcessByPid(port, pid);
		} catch (err) {
			failedPids.push(pid);
		}
	}

	if (failedPids.length) {
		vscode.window.showErrorMessage(`❌ 无法终止端口 ${port} 的进程 ${failedPids.join(', ')}`);
		return;
	}

	vscode.window.showInformationMessage(`✅ 已终止端口 ${port} 的进程 ${pids.join(', ')}`);
}

export async function getPortListData(): Promise<PortInfo[]> {
	const profile = getPortCommandProfile();

	try {
		const { stdout } = await executeCommand(profile.listListeningPorts(), { maxBuffer: 1024 * 1024, timeout: 5000 });
		return profile.parseListeningPorts(stdout);
	} catch (err) {
		const execError = err as childProcess.ExecException & { stdout?: string };

		if (profile.isEmptyListeningResult(execError)) {
			return [];
		}

		vscode.window.showErrorMessage('❌ 获取端口数据失败');
		return [];
	}
}

async function getListeningPidsByPort(port: string): Promise<string[]> {
	const profile = getPortCommandProfile();

	try {
		const { stdout } = await executeCommand(profile.findListeningPids(port), { maxBuffer: 1024 * 1024, timeout: 5000 });
		return profile.parseListeningPids(stdout, port);
	} catch (err) {
		const execError = err as childProcess.ExecException & { stdout?: string };

		if (profile.isEmptyListeningResult(execError)) {
			return [];
		}

		throw err;
	}
}
