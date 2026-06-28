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

export interface CpuCoreChartItem {
	index: number;
	usagePercent: number;
	idlePercent: number;
	hasUsage: boolean;
}

export interface SelectOption<T extends string> {
	label: string;
	value: T;
}

export type LocalIpRow = SystemNetworkAddress;
