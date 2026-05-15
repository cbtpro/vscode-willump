export interface PortInfo {
	port: string;
	pid: string;
	command: string;
	type: string;
	localAddress: string;
	listenAddress: string;
}

export type PortScanMode = 'listening' | 'all';

export type CommandSpec =
	| {
			type: 'shell';
			command: string;
	  }
	| {
			type: 'file';
			file: string;
			args: string[];
	  };

export interface PortCommandProfile {
	checkPortUsage(port: string): CommandSpec;
	findListeningPids(port: string): CommandSpec;
	getProcessName(pid: string): CommandSpec;
	killPid(pid: string): CommandSpec;
	listProcessNames?(): CommandSpec;
	listAllPorts(): CommandSpec;
	listListeningPorts(): CommandSpec;
	parseAllPorts(stdout: string): PortInfo[];
	parseListeningPids(stdout: string, port: string): string[];
	parseListeningPorts(stdout: string): PortInfo[];
	parseProcessName(stdout: string, pid: string): string | undefined;
	parseProcessNameList?(stdout: string): Map<string, string>;
	isEmptyListeningResult(error: { code?: number | string; stdout?: string }): boolean;
}

const windowsProfile: PortCommandProfile = {
	checkPortUsage: port => ({
		type: 'shell',
		command: `netstat -ano | findstr :${port}`
	}),
	findListeningPids: () => ({
		type: 'shell',
		command: 'netstat -ano'
	}),
	getProcessName: pid => ({
		type: 'file',
		file: 'tasklist',
		args: ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']
	}),
	killPid: pid => ({
		type: 'file',
		file: 'taskkill',
		args: ['/PID', pid, '/F']
	}),
	listProcessNames: () => ({
		type: 'file',
		file: 'tasklist',
		args: ['/FO', 'CSV', '/NH']
	}),
	listAllPorts: () => ({
		type: 'shell',
		command: 'netstat -ano'
	}),
	listListeningPorts: () => ({
		type: 'shell',
		command: 'netstat -ano'
	}),
	parseListeningPids: (stdout, port) => {
		const pids = stdout
			.split('\n')
			.map(parseWindowsNetstatLine)
			.filter(item => item?.state === 'LISTENING' && item.port === port)
			.map(item => item?.pid ?? '');

		return unique(pids);
	},
	parseListeningPorts: stdout => {
		const ports = stdout
			.split('\n')
			.map(parseWindowsNetstatLine)
			.filter(item => item?.state === 'LISTENING' && item.port && item.port !== '0')
			.map(parts => ({
				command: 'Unknown',
				pid: parts?.pid ?? '',
				port: parts?.port ?? '',
				type: getConnectionType(parts?.protocol ?? '', parts?.state),
				localAddress: parts?.localAddress ?? '',
				listenAddress: getListenAddress(parts?.localAddress ?? '', parts?.state)
			}));

		return uniquePorts(ports);
	},
	parseAllPorts: stdout => {
		const ports = stdout
			.split('\n')
			.map(parseWindowsNetstatLine)
			.filter(item => item?.port && item.port !== '0')
			.map(parts => ({
				command: 'Unknown',
				pid: parts?.pid ?? '',
				port: parts?.port ?? '',
				type: getConnectionType(parts?.protocol ?? '', parts?.state),
				localAddress: parts?.localAddress ?? '',
				listenAddress: getListenAddress(parts?.localAddress ?? '', parts?.state)
			}));

		return uniquePorts(ports);
	},
	parseProcessName: stdout => {
		const line = stdout.trim().split(/\r?\n/)[0] ?? '';
		const firstColumn = parseCsvLine(line)[0];

		return firstColumn && !firstColumn.startsWith('INFO:') ? firstColumn : undefined;
	},
	parseProcessNameList: stdout => parseWindowsTaskList(stdout),
	isEmptyListeningResult: () => false
};

const posixProfile: PortCommandProfile = {
	checkPortUsage: port => ({
		type: 'file',
		file: 'lsof',
		args: [
			`-iTCP:${port}`,
			'-sTCP:LISTEN',
			'-P',
			'-n'
		]
	}),
	findListeningPids: port => ({
		type: 'file',
		file: 'lsof',
		args: [`-tiTCP:${port}`, '-sTCP:LISTEN']
	}),
	getProcessName: pid => ({
		type: 'file',
		file: 'ps',
		args: ['-p', pid, '-o', 'command=']
	}),
	killPid: pid => ({
		type: 'file',
		file: 'kill',
		args: ['-9', pid]
	}),
	listAllPorts: () => ({
		type: 'shell',
		command: 'lsof -i -P -n'
	}),
	listListeningPorts: () => ({
		type: 'file',
		file: 'lsof',
		args: ['-iTCP', '-sTCP:LISTEN', '-P', '-n']
	}),
	parseListeningPids: stdout => {
		const pids = stdout
			.split(/\s+/)
			.map(pid => pid.trim())
			.filter(pid => /^\d+$/.test(pid));

		return unique(pids);
	},
	parseListeningPorts: stdout => {
		const ports = stdout
			.split('\n')
			.slice(1)
			.map(parsePosixLsofLine)
			.filter((item): item is PortInfo => Boolean(item && item.port && item.type === 'TCP LISTEN'));

		return uniquePorts(ports);
	},
	parseAllPorts: stdout => {
		const ports = stdout
			.split('\n')
			.slice(1)
			.map(parsePosixLsofLine)
			.filter((item): item is PortInfo => Boolean(item && item.port && item.port !== '0'));

		return uniquePorts(ports);
	},
	parseProcessName: stdout => {
		const command = stdout.trim();
		const executable = command.match(/^"([^"]+)"/)?.[1] ?? command.split(/\s+/)[0] ?? '';
		const name = executable.split(/[\\/]/).filter(Boolean).pop();

		return name || undefined;
	},
	isEmptyListeningResult: error => error.code === 1 && !error.stdout?.trim()
};

const profiles: Partial<Record<NodeJS.Platform, PortCommandProfile>> = {
	win32: windowsProfile
};

export function getPortCommandProfile(platform: NodeJS.Platform = process.platform): PortCommandProfile {
	return profiles[platform] ?? posixProfile;
}

function getPortFromAddress(address: string): string {
	const match = address.trim().match(/:(\d+)$/);
	return match?.[1] ?? '';
}

function parseWindowsNetstatLine(line: string): { protocol: string; port: string; state: string; pid: string; localAddress: string } | undefined {
	const parts = line.trim().split(/\s+/);
	const protocol = parts[0]?.toUpperCase();

	if (protocol !== 'TCP' && protocol !== 'UDP') {
		return undefined;
	}

	const localAddress = parts[1] ?? '';
	const state = protocol === 'TCP' ? parts[3]?.toUpperCase() ?? '' : '';
	const pid = protocol === 'TCP' ? parts[4] ?? '' : parts[3] ?? '';

	if (!/^\d+$/.test(pid)) {
		return undefined;
	}

	return {
		protocol,
		port: getPortFromAddress(localAddress),
		state,
		pid,
		localAddress
	};
}

function parseCsvLine(line: string): string[] {
	const values: string[] = [];
	let current = '';
	let quoted = false;

	for (let index = 0; index < line.length; index++) {
		const char = line[index];
		const nextChar = line[index + 1];

		if (char === '"' && quoted && nextChar === '"') {
			current += char;
			index++;
			continue;
		}

		if (char === '"') {
			quoted = !quoted;
			continue;
		}

		if (char === ',' && !quoted) {
			values.push(current);
			current = '';
			continue;
		}

		current += char;
	}

	values.push(current);
	return values;
}

function parseWindowsTaskList(stdout: string): Map<string, string> {
	const namesByPid = new Map<string, string>();

	for (const line of stdout.trim().split(/\r?\n/)) {
		const [name, pid] = parseCsvLine(line);

		if (name && /^\d+$/.test(pid)) {
			namesByPid.set(pid, name);
		}
	}

	return namesByPid;
}

function parsePosixLsofLine(line: string): PortInfo | undefined {
	const parts = line.trim().split(/\s+/);

	if (parts.length <= 8) {
		return undefined;
	}

	const command = parts[0];
	const pid = parts[1];
	const protocol = parts[7]?.toUpperCase() ?? '';
	const name = parts.slice(8).join(' ');
	const localAddress = name.split('->')[0]?.replace(/\s+\([^)]+\)$/, '').trim() ?? '';
	const port = getPortFromAddress(localAddress);

	if (protocol !== 'TCP' && protocol !== 'UDP') {
		return undefined;
	}

	return {
		command,
		pid,
		port,
		type: getConnectionType(protocol, getPosixConnectionState(name)),
		localAddress,
		listenAddress: getListenAddress(localAddress, getPosixConnectionState(name))
	};
}

function getConnectionType(protocol: string, state?: string): string {
	return [protocol, state].filter(Boolean).join(' ');
}

function getPosixConnectionState(name: string): string {
	return name.match(/\(([^)]+)\)$/)?.[1] ?? '';
}

function getListenAddress(localAddress: string, state?: string): string {
	return state === 'LISTEN' || state === 'LISTENING' ? getHostFromAddress(localAddress) : '';
}

function getHostFromAddress(address: string): string {
	const value = address.trim();
	const bracketed = value.match(/^(\[[^\]]+\]):\d+$/);

	if (bracketed) {
		return bracketed[1];
	}

	return value.replace(/:\d+$/, '');
}

function unique(values: string[]): string[] {
	return Array.from(new Set(values));
}

function uniquePorts(ports: PortInfo[]): PortInfo[] {
	const seen = new Set<string>();

	return ports.filter(item => {
		const key = `${item.type}-${item.localAddress}-${item.port}-${item.pid}-${item.command}`;

		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
}
