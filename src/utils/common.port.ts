import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { promisify } from 'util';

/**
 * 检查指定端口的使用情况。
 * 根据不同的操作系统执行相应的命令，判断端口是否被占用，并显示相应的提示信息。
 * @param port - 要检查使用情况的端口号
 */
export function checkPortUsage(port: string) {
	// 获取当前操作系统平台
	const platform = process.platform;

	// 用于存储要执行的命令
	let cmd = '';
	// 根据不同的操作系统设置不同的命令
	if (platform === 'win32') {
		// Windows 系统使用 netstat 命令结合 findstr 查找指定端口的信息
		cmd = `netstat -ano | findstr :${port}`;
	} else {
		// macOS 或 Linux 系统使用 lsof 命令查找指定端口的信息
		cmd = `lsof -i :${port}`;
	}

	// 执行命令检查端口使用情况
	childProcess.exec(cmd, (err, stdout, stderr) => {
		// 如果执行命令过程中出现错误、有标准错误输出或者没有输出结果
		if (err || stderr || !stdout.trim()) {
			// 显示端口未被占用的信息
			vscode.window.showInformationMessage(`✅ 端口 ${port} 没有被占用`);
		} else {
			// 显示端口已被占用的信息，并附上命令输出结果
			vscode.window.showWarningMessage(`❌ 端口 ${port} 已被占用：\n${stdout}`);
		}
	});
}

/**
 * 列出所有被占用的端口信息。
 * 根据不同的操作系统执行相应的命令，将结果显示在 VS Code 的输出面板中。
 */
export function listAllPorts() {
	// 获取当前操作系统平台
	const platform = process.platform;
	// 用于存储要执行的命令
	let cmd = '';

	// 根据不同的操作系统设置不同的命令
	if (platform === 'win32') {
		// Windows 系统使用 netstat -ano 命令获取端口信息
		cmd = 'netstat -ano';
	} else {
		// macOS 或 Linux 系统使用 lsof -i -P -n 命令获取端口信息
		cmd = 'lsof -i -P -n';
	}

	// 执行命令，设置最大缓冲区为 1MB
	childProcess.exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
		// 如果执行命令过程中出现错误或有标准错误输出
		if (err || stderr) {
			// 显示错误信息给用户
			vscode.window.showErrorMessage('❌ 获取端口信息失败');
			return;
		}

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
	});
}

const execAsync = promisify(childProcess.exec);
const execFileAsync = promisify(childProcess.execFile);

export async function killProcessByPid(port: string, pid: string): Promise<void> {
	if (!/^\d+$/.test(pid)) {
		throw new Error(`无效的进程 PID：${pid}`);
	}

	const platform = process.platform;

	try {
		if (platform === 'win32') {
			await execFileAsync('taskkill', ['/PID', pid, '/F'], { timeout: 5000 });
		} else {
			await execFileAsync('kill', ['-9', pid], { timeout: 5000 });
		}

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

export async function getPortListData(): Promise<Array<{ port: string; pid: string; command: string }>> {
	const platform = process.platform;
	const cmd = platform === 'win32' ? 'netstat -ano' : 'lsof -iTCP -sTCP:LISTEN -P -n';

	try {
		const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024, timeout: 5000 });
		const result: Array<{ port: string; pid: string; command: string }> = [];
		const seen = new Set<string>();

		if (platform === 'win32') {
			const lines = stdout.split('\n').slice(4);
			for (const line of lines) {
				const parts = line.trim().split(/\s+/);
				if (parts.length >= 5 && parts[0] === 'TCP' && parts[3] === 'LISTENING') {
					const localAddress = parts[2];
					const pid = parts[4];
					const port = localAddress.split(':').pop() || '';
					const key = `${port}-${pid}`;

					if (port && !seen.has(key)) {
						seen.add(key);
						result.push({ port, pid, command: 'Unknown' });
					}
				}
			}
		} else {
			const lines = stdout.split('\n').slice(1);
			for (const line of lines) {
				const parts = line.trim().split(/\s+/);
				if (parts.length > 8) {
					const name = parts.slice(8).join(' ');
					const port = parts[8].split(':').pop() || '';
					const pid = parts[1];
					const key = `${port}-${pid}`;

					if (port && name.includes('(LISTEN)') && !seen.has(key)) {
						seen.add(key);
						result.push({
							command: parts[0],
							pid,
							port
						});
					}
				}
			}
		}

		return result;
	} catch (err) {
		const execError = err as childProcess.ExecException & { stdout?: string };

		if (platform !== 'win32' && execError.code === 1 && !execError.stdout?.trim()) {
			return [];
		}

		vscode.window.showErrorMessage('❌ 获取端口数据失败');
		return [];
	}
}

async function getListeningPidsByPort(port: string): Promise<string[]> {
	const platform = process.platform;

	if (platform === 'win32') {
		const { stdout } = await execAsync('netstat -ano', { maxBuffer: 1024 * 1024, timeout: 5000 });
		const pids = stdout
			.split('\n')
			.map(line => line.trim().split(/\s+/))
			.filter(parts => parts.length >= 5 && parts[0] === 'TCP' && parts[3] === 'LISTENING')
			.filter(parts => (parts[1].split(':').pop() || '') === port)
			.map(parts => parts[4]);

		return Array.from(new Set(pids));
	}

	try {
		const { stdout } = await execFileAsync('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN'], { timeout: 5000 });
		const pids = stdout
			.split(/\s+/)
			.map(pid => pid.trim())
			.filter(pid => /^\d+$/.test(pid));

		return Array.from(new Set(pids));
	} catch (err) {
		const execError = err as childProcess.ExecException & { stdout?: string };

		if (execError.code === 1 && !execError.stdout?.trim()) {
			return [];
		}

		throw err;
	}
}
