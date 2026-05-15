import type { PortInfo } from '../../vscode';

export type PortColumnKey = 'port' | 'type' | 'localAddress' | 'listenAddress' | 'pid' | 'command' | 'processPath' | 'commandFull';
export type ProcessColumnKey = 'command' | 'pid' | 'ports' | 'protocols' | 'connectionCount' | 'processPath' | 'commandFull';
export type SortDirection = 'asc' | 'desc' | '';
export type PortViewMode = 'connections' | 'processes';

export interface KillTarget {
	port: string;
	pid: string;
	command: string;
}

export interface NetworkProcessRow {
	rowId: string;
	pid: string;
	command: string;
	ports: string;
	protocols: string;
	connectionCount: number;
	processPath: string;
	commandFull: string;
}

export interface PortConnectionRow extends PortInfo {
	rowId: string;
}

export type PortTableRow = PortConnectionRow | NetworkProcessRow;

export interface PortTableColumn {
	key: PortColumnKey | ProcessColumnKey;
	title: string;
	width?: number;
}
