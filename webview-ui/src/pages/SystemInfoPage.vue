<script setup lang="ts">
import { Message, Notification } from '@arco-design/web-vue';
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue';
import PageHeader from '../components/common/PageHeader.vue';
import SystemBasicTab from '../components/system-info/SystemBasicTab.vue';
import type { InfoRow, PublicIpRow } from '../components/system-info/types';
import { t } from '../i18n';
import { getVsCodeApi, type DeviceFormFactor, type PublicIpInfo, type SystemGpuInfo, type SystemInfo } from '../vscode';

type SystemInfoMessage = {
	type: 'systemInfoUpdated';
	success: boolean;
	info?: SystemInfo;
	message?: string;
};

const vscode = getVsCodeApi();
const info = ref<SystemInfo | null>(null);
const isLoading = ref(false);
let isSystemInfoPageListening = false;

const basicRows = computed<InfoRow[]>(() => {
	if (!info.value) {
		return [];
	}

	return [
		{ key: 'hostname', label: t('system.computerName'), value: info.value.hostname || '-', copyValue: info.value.hostname },
		{ key: 'deviceType', label: t('system.deviceType'), value: formatDeviceType(info.value.device.formFactor) },
		{ key: 'deviceModel', label: t('system.deviceModel'), value: formatDeviceModel(info.value.device) },
		{ key: 'os', label: t('system.operatingSystem'), value: `${formatPlatform(info.value.platform)} ${info.value.release}` },
		{ key: 'arch', label: t('system.arch'), value: info.value.arch },
		{ key: 'uptime', label: t('system.uptime'), value: formatUptime(info.value.uptimeSeconds) },
		{ key: 'collectedAt', label: t('system.collectedAt'), value: formatDateTime(info.value.collectedAt) }
	];
});

const cpuRows = computed<InfoRow[]>(() => {
	if (!info.value) {
		return [];
	}

	return [
		{ key: 'cpuModel', label: t('system.cpuModel'), value: info.value.cpu.model || '-' },
		{ key: 'cpuCores', label: t('system.cpuCores'), value: String(info.value.cpu.cores) },
		{ key: 'cpuSpeed', label: t('system.cpuSpeed'), value: info.value.cpu.speedMHz ? `${info.value.cpu.speedMHz} MHz` : '-' }
	];
});

const memoryRows = computed<InfoRow[]>(() => {
	if (!info.value) {
		return [];
	}

	return [
		{ key: 'memoryTotal', label: t('system.memoryTotal'), value: formatBytes(info.value.memory.totalBytes) },
		{ key: 'memoryUsed', label: t('system.memoryUsed'), value: formatBytes(info.value.memory.usedBytes) },
		{ key: 'memoryFree', label: t('system.memoryFree'), value: formatBytes(info.value.memory.freeBytes) }
	];
});

const gpuRows = computed(() =>
	(info.value?.gpus ?? []).map((item, index) => ({
		...item,
		id: `${item.name}-${index}`,
		memoryText: formatGpuMemory(item)
	}))
);

const localIpRows = computed(() => {
	const localIpv4 = info.value?.network.localIpv4 ?? [];
	const localIpv6 = info.value?.network.localIpv6 ?? [];
	return [...localIpv4, ...localIpv6];
});

const publicIpRows = computed<PublicIpRow[]>(() => {
	if (!info.value) {
		return [];
	}

	return [
		createPublicIpRow('publicIpv4', t('system.publicIpv4'), info.value.network.publicIpv4),
		createPublicIpRow('publicIpv6', t('system.publicIpv6'), info.value.network.publicIpv6)
	];
});

const ipv6Rows = computed<InfoRow[]>(() => {
	if (!info.value) {
		return [];
	}

	return [
		{
			key: 'ipv6Enabled',
			label: t('system.ipv6Enabled'),
			value: info.value.network.ipv6Enabled ? t('common.yes') : t('common.no')
		},
		{
			key: 'ipv6PublicReachable',
			label: t('system.ipv6PublicReachable'),
			value: info.value.network.ipv6PublicReachable ? t('common.yes') : t('common.no')
		}
	];
});

function refreshSystemInfo() {
	isLoading.value = true;

	if (!vscode) {
		isLoading.value = false;
		return;
	}

	vscode.postMessage({ type: 'getSystemInfo' });
}

function activateSystemInfoPage() {
	if (isSystemInfoPageListening) {
		return;
	}

	window.addEventListener('message', handleMessage);
	isSystemInfoPageListening = true;
	refreshSystemInfo();
}

function deactivateSystemInfoPage() {
	if (isSystemInfoPageListening) {
		window.removeEventListener('message', handleMessage);
		isSystemInfoPageListening = false;
	}
}

function handleMessage(event: MessageEvent<unknown>) {
	const message = parseSystemInfoMessage(event.data);

	if (!message) {
		return;
	}

	if (message.type !== 'systemInfoUpdated') {
		return;
	}

	isLoading.value = false;

	if (message.success && message.info) {
		info.value = message.info;
		return;
	}

	Notification.error({
		title: t('system.title'),
		content: message.message ?? t('system.loadFailed'),
		closable: true
	});
}

function parseSystemInfoMessage(value: unknown): SystemInfoMessage | undefined {
	if (!value || typeof value !== 'object') {
		return undefined;
	}

	const type = (value as { type?: unknown }).type;

	if (type !== 'systemInfoUpdated') {
		return undefined;
	}

	return value as SystemInfoMessage;
}

async function copyValue(value?: string) {
	if (!value) {
		return;
	}

	try {
		await navigator.clipboard.writeText(value);
		Message.success({
			id: 'system-info-copy',
			content: t('common.copySuccess')
		});
	} catch (err) {
		Message.error({
			id: 'system-info-copy',
			content: t('common.copyFailed')
		});
	}
}

function createPublicIpRow(key: string, label: string, item: PublicIpInfo): PublicIpRow {
	return {
		key,
		label,
		value: item.address || t('system.unavailable'),
		copyValue: item.address || undefined,
		error: item.error,
		available: item.available
	};
}

function formatDeviceType(value: DeviceFormFactor) {
	return value === 'laptop' ? t('system.laptop') : value === 'desktop' ? t('system.desktop') : t('system.unknown');
}

function formatDeviceModel(device: SystemInfo['device']) {
	return [device.manufacturer, device.model].filter(Boolean).join(' ') || '-';
}

function formatPlatform(value: string) {
	const names: Record<string, string> = {
		win32: 'Windows',
		darwin: 'macOS',
		linux: 'Linux'
	};

	return names[value] ?? value;
}

function formatBytes(value?: number) {
	if (!value || value <= 0) {
		return '-';
	}

	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let next = value;
	let unitIndex = 0;

	while (next >= 1024 && unitIndex < units.length - 1) {
		next /= 1024;
		unitIndex += 1;
	}

	return `${next.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatGpuMemory(item: SystemGpuInfo) {
	if (item.memory) {
		return item.memory;
	}

	return formatBytes(item.memoryBytes);
}

function formatUptime(seconds: number) {
	const totalMinutes = Math.max(Math.floor(seconds / 60), 0);
	const days = Math.floor(totalMinutes / 1440);
	const hours = Math.floor((totalMinutes % 1440) / 60);
	const minutes = totalMinutes % 60;
	const parts = [
		days ? `${days}d` : '',
		hours ? `${hours}h` : '',
		`${minutes}m`
	].filter(Boolean);

	return parts.join(' ');
}

function formatDateTime(value: string) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString();
}

onMounted(() => {
	activateSystemInfoPage();
});

onActivated(() => {
	activateSystemInfoPage();
});

onDeactivated(() => {
	deactivateSystemInfoPage();
});

onUnmounted(() => {
	deactivateSystemInfoPage();
});
</script>

<template>
	<main class="page">
		<PageHeader :title="t('system.title')" :subtitle="t('system.subtitle')" :action-label="t('common.refresh')" :loading="isLoading" @action="refreshSystemInfo" />

		<a-spin :loading="isLoading">
			<SystemBasicTab
				v-if="info"
				:basic-rows="basicRows"
				:cpu-rows="cpuRows"
				:memory-rows="memoryRows"
				:public-ip-rows="publicIpRows"
				:ipv6-rows="ipv6Rows"
				:local-ip-rows="localIpRows"
				:gpu-rows="gpuRows"
				@copy="copyValue"
			/>
		</a-spin>
	</main>
</template>

<style scoped>
.page {
	min-width: 0;
}
</style>
