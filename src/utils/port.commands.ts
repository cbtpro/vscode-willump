export interface PortInfo {
	port: string;
	pid: string;
	command: string;
}

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
	killPid(pid: string): CommandSpec;
	listAllPorts(): CommandSpec;
	listListeningPorts(): CommandSpec;
	parseListeningPids(stdout: string, port: string): string[];
	parseListeningPorts(stdout: string): PortInfo[];
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
	killPid: pid => ({
		type: 'file',
		file: 'taskkill',
		args: ['/PID', pid, '/F']
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
			.map(line => line.trim().split(/\s+/))
			.filter(parts => parts.length >= 5 && parts[0] === 'TCP' && parts[3] === 'LISTENING')
			.filter(parts => getPortFromAddress(parts[1]) === port)
			.map(parts => parts[4]);

		return unique(pids);
	},
	parseListeningPorts: stdout => {
		const ports = stdout
			.split('\n')
			.map(line => line.trim().split(/\s+/))
			.filter(parts => parts.length >= 5 && parts[0] === 'TCP' && parts[3] === 'LISTENING')
			.map(parts => ({
				command: 'Unknown',
				pid: parts[4],
				port: getPortFromAddress(parts[1])
			}))
			.filter(item => item.port);

		return uniquePorts(ports);
	},
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
			.map(line => line.trim().split(/\s+/))
			.filter(parts => parts.length > 8)
			.map(parts => ({
				command: parts[0],
				pid: parts[1],
				port: getPortFromAddress(parts[8]),
				name: parts.slice(8).join(' ')
			}))
			.filter(item => item.port && item.name.includes('(LISTEN)'))
			.map(({ command, pid, port }) => ({ command, pid, port }));

		return uniquePorts(ports);
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
	return address.split(':').pop() || '';
}

function unique(values: string[]): string[] {
	return Array.from(new Set(values));
}

function uniquePorts(ports: PortInfo[]): PortInfo[] {
	const seen = new Set<string>();

	return ports.filter(item => {
		const key = `${item.port}-${item.pid}`;

		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
}
