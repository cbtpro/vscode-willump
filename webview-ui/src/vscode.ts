export interface PortInfo {
	port: string;
	pid: string;
	command: string;
}

export interface WillumpInitialState {
	ports: PortInfo[];
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
