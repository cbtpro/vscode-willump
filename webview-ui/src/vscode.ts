export interface PortInfo {
	port: string;
	pid: string;
	command: string;
	type: string;
	localAddress: string;
	listenAddress: string;
	service?: string;
	processPath?: string;
	commandFull?: string;
}

export type PortScanMode = 'listening' | 'all';

export interface GitConfigScope {
	name: string;
	email: string;
	configPath: string;
	available: boolean;
	error?: string;
}

export interface GitConfigInfo {
	local: GitConfigScope;
	global: GitConfigScope;
	workspacePath: string;
	workspaces: GitWorkspaceOverview[];
	effectiveIdentity: {
		name: string;
		email: string;
		source: string;
		isGithubNoreply: boolean;
	};
	git: {
		available: boolean;
		version: string;
		path: string;
		error?: string;
	};
	remote: {
		remotes: Array<{ name: string; url: string }>;
	};
	branch: {
		current: string;
		upstream: string;
	};
	pushDefault: string;
	lineEnding: {
		autocrlf: string;
		eol: string;
		ignorecase: string;
	};
	editor: string;
	ssh: {
		publicKeys: string[];
		agentKeys: string[];
		error?: string;
	};
	hooks: Array<{ name: string; executable: boolean }>;
	lfs: {
		available: boolean;
		version: string;
		enabled: boolean;
	};
}

export interface GitWorkspaceOverview {
	name: string;
	path: string;
	localName: string;
	localEmail: string;
	effectiveName: string;
	effectiveEmail: string;
	branch: string;
	upstream: string;
	remote: string;
	available: boolean;
	error?: string;
}

export interface WillumpInitialState {
	language?: string;
	route?: string;
	ports?: PortInfo[];
	portScanMode?: PortScanMode;
}

export interface VsCodeApi {
	postMessage(message: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
}

declare global {
	interface Window {
		acquireVsCodeApi?: () => VsCodeApi;
		__WILLUMP_INITIAL_STATE__?: WillumpInitialState;
	}
}

let vscodeApi: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi | undefined {
	if (!vscodeApi && typeof window.acquireVsCodeApi === 'function') {
		vscodeApi = window.acquireVsCodeApi();
	}

	return vscodeApi;
}
