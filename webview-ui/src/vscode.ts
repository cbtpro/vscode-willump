export interface PortInfo {
	port: string;
	pid: string;
	command: string;
	type: string;
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
