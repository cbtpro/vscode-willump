import type { SystemNetworkAddress } from '../../vscode';

export interface InfoRow {
	key: string;
	label: string;
	value: string;
	copyValue?: string;
}

export interface PublicIpRow extends InfoRow {
	error?: string;
	available: boolean;
}

export interface GpuDisplayRow {
	id: string;
	name: string;
	vendor?: string | null;
	memoryText: string;
	driverVersion?: string | null;
}

export type LocalIpRow = SystemNetworkAddress;
