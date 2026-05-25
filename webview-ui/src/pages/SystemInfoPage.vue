<script setup lang="ts">
import IconCopy from '@arco-design/web-vue/es/icon/icon-copy';
import { Message, Notification } from '@arco-design/web-vue';
import type { Chart, ChartConfiguration } from 'chart.js';
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue';
import PageHeader from '../components/common/PageHeader.vue';
import { t } from '../i18n';
import { getVsCodeApi, type DeviceFormFactor, type PublicIpInfo, type SystemGpuInfo, type SystemInfo, type SystemMemoryInfo, type SystemNetworkAddress } from '../vscode';

type SystemInfoMessage = {
	type: 'systemInfoUpdated';
	success: boolean;
	info?: SystemInfo;
	message?: string;
} | {
	type: 'systemMemoryUpdated';
	success: boolean;
	memory?: SystemMemoryInfo;
	message?: string;
};

interface InfoRow {
	key: string;
	label: string;
	value: string;
	copyValue?: string;
}

interface PublicIpRow extends InfoRow {
	error?: string;
	available: boolean;
}

type MemoryChartMode = 'doughnut' | 'line' | 'smoothLine';

interface MemorySample {
	timestamp: number;
	usagePercent: number;
	usedBytes: number;
	freeBytes: number;
}

const DEFAULT_MEMORY_REFRESH_SECONDS = 3;
const MIN_MEMORY_REFRESH_SECONDS = 1;
const MAX_MEMORY_REFRESH_SECONDS = 60;
const MEMORY_REFRESH_STORAGE_KEY = 'willump.memoryRefreshSeconds';

const vscode = getVsCodeApi();
const info = ref<SystemInfo | null>(null);
const isLoading = ref(false);
const memoryChartCanvas = ref<HTMLCanvasElement | null>(null);
const memoryChartMode = ref<MemoryChartMode>('doughnut');
const memoryRefreshSeconds = ref(getStoredMemoryRefreshSeconds());
const memorySamples = ref<MemorySample[]>([]);
const memoryChartOptions = computed<Array<{ label: string; value: MemoryChartMode }>>(() => [
	{ label: t('system.memoryChartDoughnut'), value: 'doughnut' },
	{ label: t('system.memoryChartLine'), value: 'line' },
	{ label: t('system.memoryChartSmoothLine'), value: 'smoothLine' }
]);
let memoryChart: Chart | undefined;
let chartJsModulePromise: Promise<typeof import('chart.js/auto')> | undefined;
let memoryRefreshTimer: ReturnType<typeof setInterval> | undefined;
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

const memoryStatus = computed(() => {
	const usage = info.value?.memory.usagePercent ?? 0;
	return usage >= 90 ? 'danger' : usage >= 75 ? 'warning' : 'normal';
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

function refreshMemoryInfo() {
	vscode?.postMessage({ type: 'getSystemMemoryInfo' });
}

function startMemoryRefreshTimer() {
	stopMemoryRefreshTimer();
	memoryRefreshTimer = setInterval(refreshMemoryInfo, memoryRefreshSeconds.value * 1000);
}

function stopMemoryRefreshTimer() {
	if (!memoryRefreshTimer) {
		return;
	}

	clearInterval(memoryRefreshTimer);
	memoryRefreshTimer = undefined;
}

function restartMemoryRefreshTimer() {
	startMemoryRefreshTimer();
	refreshMemoryInfo();
}

function activateSystemInfoPage() {
	if (isSystemInfoPageListening) {
		return;
	}

	window.addEventListener('message', handleMessage);
	isSystemInfoPageListening = true;
	refreshSystemInfo();
	startMemoryRefreshTimer();
}

function deactivateSystemInfoPage() {
	if (isSystemInfoPageListening) {
		window.removeEventListener('message', handleMessage);
		isSystemInfoPageListening = false;
	}

	stopMemoryRefreshTimer();
}

function handleMemoryRefreshSecondsChange(value: string | number | null | undefined) {
	const seconds = normalizeMemoryRefreshSeconds(value);
	memoryRefreshSeconds.value = seconds;
	localStorage.setItem(MEMORY_REFRESH_STORAGE_KEY, String(seconds));
	restartMemoryRefreshTimer();
}

function handleMessage(event: MessageEvent<unknown>) {
	const message = parseSystemInfoMessage(event.data);

	if (!message) {
		return;
	}

	if (message.type === 'systemMemoryUpdated') {
		if (message.success && message.memory && info.value) {
			recordMemorySample(message.memory);
			info.value = {
				...info.value,
				memory: message.memory
			};
		}
		return;
	}

	if (message.type !== 'systemInfoUpdated') {
		return;
	}

	isLoading.value = false;

	if (message.success && message.info) {
		info.value = message.info;
		recordMemorySample(message.info.memory);
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

	if (type !== 'systemInfoUpdated' && type !== 'systemMemoryUpdated') {
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

function renderIpAddress(record: SystemNetworkAddress) {
	return record.cidr ?? record.address;
}

function loadChartJs() {
	chartJsModulePromise ||= import('chart.js/auto');
	return chartJsModulePromise;
}

function handleMemoryChartModeChange(value: string | number | boolean | Record<string, unknown> | Array<unknown>) {
	if (!isMemoryChartMode(value)) {
		return;
	}

	memoryChartMode.value = value;
}

async function syncMemoryChart() {
	await nextTick();

	if (!info.value || !memoryChartCanvas.value) {
		return;
	}

	if (!memoryChart) {
		const { default: ChartConstructor } = await loadChartJs();

		if (!info.value || !memoryChartCanvas.value) {
			return;
		}

		memoryChart = new ChartConstructor(memoryChartCanvas.value, createMemoryChartConfig() as ChartConfiguration);
	}

	updateMemoryChart();
}

function createMemoryChartConfig(): ChartConfiguration {
	return memoryChartMode.value === 'doughnut'
		? createMemoryDoughnutConfig() as ChartConfiguration
		: createMemoryLineConfig() as ChartConfiguration;
}

function createMemoryDoughnutConfig(): ChartConfiguration<'doughnut', number[], string> {
	const colors = getMemoryChartColors();

	return {
		type: 'doughnut',
		data: {
			labels: [t('system.memoryUsed'), t('system.memoryFree')],
			datasets: [
				{
					data: getMemoryChartData(),
					backgroundColor: [colors.used, colors.free],
					borderColor: colors.border,
					borderWidth: 1,
					hoverOffset: 2,
					spacing: 2
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			cutout: '72%',
			color: colors.text,
			animation: {
				duration: 180
			},
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					callbacks: {
						label: item => `${item.label}: ${formatBytes(Number(item.raw))}`
					}
				}
			}
		}
	};
}

function createMemoryLineConfig(): ChartConfiguration<'line', number[], string> {
	const colors = getMemoryChartColors();

	return {
		type: 'line',
		data: {
			labels: getMemoryTrendLabels(),
			datasets: [
				{
					label: t('system.memoryUsage'),
					data: getMemoryTrendData(),
					borderColor: colors.used,
					backgroundColor: colors.usedSoft,
					borderWidth: 2,
					fill: memoryChartMode.value === 'smoothLine',
					pointRadius: memoryChartMode.value === 'line' ? 2 : 0,
					pointHoverRadius: 4,
					tension: memoryChartMode.value === 'smoothLine' ? 0.38 : 0
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			color: colors.text,
			animation: {
				duration: 180
			},
			scales: {
				x: {
					grid: {
						display: false
					},
					ticks: {
						color: colors.muted,
						maxRotation: 0,
						autoSkip: true,
						maxTicksLimit: 4
					}
				},
				y: {
					min: 0,
					max: 100,
					grid: {
						color: colors.grid
					},
					ticks: {
						color: colors.muted,
						callback: value => `${value}%`
					}
				}
			},
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					callbacks: {
						label: item => `${t('system.memoryUsage')}: ${Number(item.raw).toFixed(1)}%`
					}
				}
			}
		}
	};
}

function updateMemoryChart() {
	if (!memoryChart || !info.value) {
		return;
	}

	const colors = getMemoryChartColors();
	memoryChart.options.color = colors.text;

	if (memoryChartMode.value !== 'doughnut') {
		updateMemoryLineChart(colors);
		memoryChart.update();
		return;
	}

	const dataset = memoryChart.data.datasets[0];
	dataset.data = getMemoryChartData();
	dataset.backgroundColor = [colors.used, colors.free];
	dataset.borderColor = colors.border;
	memoryChart.data.labels = [t('system.memoryUsed'), t('system.memoryFree')];
	memoryChart.update();
}

function updateMemoryLineChart(colors: ReturnType<typeof getMemoryChartColors>) {
	const dataset = memoryChart?.data.datasets[0];

	if (!dataset || !memoryChart) {
		return;
	}

	dataset.label = t('system.memoryUsage');
	dataset.data = getMemoryTrendData();
	dataset.borderColor = colors.used;
	dataset.backgroundColor = colors.usedSoft;
	dataset.fill = memoryChartMode.value === 'smoothLine';
	dataset.pointRadius = memoryChartMode.value === 'line' ? 2 : 0;
	dataset.pointHoverRadius = 4;
	dataset.tension = memoryChartMode.value === 'smoothLine' ? 0.38 : 0;
	memoryChart.data.labels = getMemoryTrendLabels();
}

function getMemoryChartData(): number[] {
	const memory = info.value?.memory;

	if (!memory) {
		return [0, 0];
	}

	return [
		Math.max(memory.usedBytes, 0),
		Math.max(memory.freeBytes, 0)
	];
}

function getMemoryTrendData(): number[] {
	return getMemorySamples().map(item => item.usagePercent);
}

function getMemoryTrendLabels(): string[] {
	return getMemorySamples().map(item => formatChartTime(item.timestamp));
}

function getMemorySamples(): MemorySample[] {
	if (memorySamples.value.length) {
		return memorySamples.value;
	}

	const memory = info.value?.memory;

	return memory
		? [createMemorySample(memory)]
		: [];
}

function getMemoryChartColors() {
	const usedColor = memoryStatus.value === 'danger'
		? getCssVariable('--willump-danger')
		: memoryStatus.value === 'warning'
			? '#f59e0b'
			: getCssVariable('--willump-primary');

	return {
		used: usedColor,
		usedSoft: `${usedColor}33`,
		free: getCssVariable('--willump-fill-subtle'),
		border: getCssVariable('--willump-surface'),
		text: getCssVariable('--willump-text'),
		muted: getCssVariable('--willump-text-muted'),
		grid: getCssVariable('--willump-border')
	};
}

function getCssVariable(name: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function destroyMemoryChart() {
	memoryChart?.destroy();
	memoryChart = undefined;
}

function recordMemorySample(memory: SystemMemoryInfo) {
	const nextSamples = [...memorySamples.value, createMemorySample(memory)];
	memorySamples.value = nextSamples.slice(-24);
}

function createMemorySample(memory: SystemMemoryInfo): MemorySample {
	const timestamp = new Date(memory.collectedAt).getTime();

	return {
		timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
		usagePercent: memory.usagePercent,
		usedBytes: memory.usedBytes,
		freeBytes: memory.freeBytes
	};
}

function getStoredMemoryRefreshSeconds(): number {
	return normalizeMemoryRefreshSeconds(localStorage.getItem(MEMORY_REFRESH_STORAGE_KEY));
}

function normalizeMemoryRefreshSeconds(value: unknown): number {
	if (value === undefined || value === null || value === '') {
		return DEFAULT_MEMORY_REFRESH_SECONDS;
	}

	const seconds = Math.round(Number(value));

	if (!Number.isFinite(seconds)) {
		return DEFAULT_MEMORY_REFRESH_SECONDS;
	}

	return Math.min(Math.max(seconds, MIN_MEMORY_REFRESH_SECONDS), MAX_MEMORY_REFRESH_SECONDS);
}

function formatChartTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

function isMemoryChartMode(value: unknown): value is MemoryChartMode {
	return value === 'doughnut' || value === 'line' || value === 'smoothLine';
}

watch(
	() => info.value?.memory,
	() => {
		void syncMemoryChart();
	},
	{ flush: 'post' }
);

watch(memoryChartMode, () => {
	destroyMemoryChart();
	void syncMemoryChart();
});

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
	destroyMemoryChart();
});
</script>

<template>
	<main class="page">
		<PageHeader :title="t('system.title')" :subtitle="t('system.subtitle')" :action-label="t('common.refresh')" :loading="isLoading" @action="refreshSystemInfo" />

		<a-spin :loading="isLoading">
			<section v-if="info" class="system-info-grid">
				<a-card class="config-panel" :title="t('system.basic')" :bordered="false">
					<a-descriptions :column="1" bordered>
						<a-descriptions-item v-for="row in basicRows" :key="row.key" :label="row.label">
							<span class="copyable-value">
								<span>{{ row.value }}</span>
								<a-tooltip v-if="row.copyValue" :content="t('common.copy')">
									<a-button type="text" size="mini" @click="copyValue(row.copyValue)">
										<template #icon><IconCopy /></template>
									</a-button>
								</a-tooltip>
							</span>
						</a-descriptions-item>
					</a-descriptions>
				</a-card>

				<a-card class="config-panel" :title="t('system.cpu')" :bordered="false">
					<a-descriptions :column="1" bordered>
						<a-descriptions-item v-for="row in cpuRows" :key="row.key" :label="row.label">
							{{ row.value }}
						</a-descriptions-item>
					</a-descriptions>
				</a-card>

				<a-card class="config-panel" :title="t('system.memory')" :bordered="false">
					<div class="memory-meter">
						<a-radio-group class="memory-chart-switch" :model-value="memoryChartMode" type="button" @change="handleMemoryChartModeChange">
							<a-radio v-for="option in memoryChartOptions" :key="option.value" :value="option.value">{{ option.label }}</a-radio>
						</a-radio-group>
						<div class="memory-chart-shell" :class="{ 'memory-chart-shell-line': memoryChartMode !== 'doughnut' }">
							<canvas ref="memoryChartCanvas" class="memory-chart" :aria-label="t('system.memoryUsage')" role="img"></canvas>
							<div v-if="memoryChartMode === 'doughnut'" class="memory-chart-value">
								<span>{{ t('system.memoryUsage') }}</span>
								<strong>{{ info.memory.usagePercent }}%</strong>
							</div>
						</div>
						<div class="memory-refresh-line">
							<p class="muted-line">{{ t('system.memoryAutoRefresh', { seconds: memoryRefreshSeconds }) }} / {{ t('system.collectedAt') }}: {{ formatDateTime(info.memory.collectedAt) }}</p>
							<label class="memory-refresh-control">
								<span>{{ t('system.memoryRefreshInterval') }}</span>
								<a-input-number
									class="memory-refresh-input"
									:model-value="memoryRefreshSeconds"
									:min="MIN_MEMORY_REFRESH_SECONDS"
									:max="MAX_MEMORY_REFRESH_SECONDS"
									:step="1"
									:precision="0"
									size="mini"
									@change="handleMemoryRefreshSecondsChange"
								/>
								<span>{{ t('system.memoryRefreshUnit') }}</span>
							</label>
						</div>
					</div>
					<a-descriptions :column="1" bordered>
						<a-descriptions-item v-for="row in memoryRows" :key="row.key" :label="row.label">
							{{ row.value }}
						</a-descriptions-item>
					</a-descriptions>
				</a-card>

				<a-card class="config-panel" :title="t('system.publicIp')" :bordered="false">
					<a-descriptions :column="1" bordered>
						<a-descriptions-item v-for="row in publicIpRows" :key="row.key" :label="row.label">
							<span class="copyable-value">
								<span>
									{{ row.value }}
									<small v-if="!row.available && row.error" class="muted-inline">{{ row.error }}</small>
								</span>
								<a-tooltip v-if="row.copyValue" :content="t('common.copy')">
									<a-button type="text" size="mini" @click="copyValue(row.copyValue)">
										<template #icon><IconCopy /></template>
									</a-button>
								</a-tooltip>
							</span>
						</a-descriptions-item>
						<a-descriptions-item v-for="row in ipv6Rows" :key="row.key" :label="row.label">
							<a-tag :color="row.value === t('common.yes') ? 'green' : 'gray'">{{ row.value }}</a-tag>
						</a-descriptions-item>
					</a-descriptions>
				</a-card>
			</section>

			<a-card v-if="info" class="config-panel" :title="t('system.network')" :bordered="false">
				<a-table :data="localIpRows" :pagination="false" :bordered="{ cell: true }" row-key="id">
					<template #columns>
						<a-table-column :title="t('system.interfaceName')" data-index="interfaceName" :width="180" />
						<a-table-column :title="t('system.family')" data-index="family" :width="100" />
						<a-table-column :title="t('system.address')">
							<template #cell="{ record }">
								<span class="copyable-value">
									<span>{{ renderIpAddress(record) }}</span>
									<a-tooltip :content="t('common.copy')">
										<a-button type="text" size="mini" @click="copyValue(record.address)">
											<template #icon><IconCopy /></template>
										</a-button>
									</a-tooltip>
								</span>
							</template>
						</a-table-column>
					</template>
					<template #empty>
						<a-empty :description="t('system.emptyAddress')" />
					</template>
				</a-table>
			</a-card>

			<a-card v-if="info" class="config-panel" :title="t('system.gpu')" :bordered="false">
				<a-table :data="gpuRows" :pagination="false" :bordered="{ cell: true }" row-key="id">
					<template #columns>
						<a-table-column :title="t('system.gpuName')" data-index="name" />
						<a-table-column :title="t('system.gpuVendor')" data-index="vendor" :width="180" />
						<a-table-column :title="t('system.gpuMemory')" data-index="memoryText" :width="140" />
						<a-table-column :title="t('system.gpuDriver')" data-index="driverVersion" :width="180" />
					</template>
					<template #empty>
						<a-empty :description="t('system.noGpuData')" />
					</template>
				</a-table>
			</a-card>
		</a-spin>
	</main>
</template>

<style scoped>
.system-info-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16px;
	margin-bottom: 16px;
}

.copyable-value {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	max-width: 100%;
	word-break: break-all;
}

.memory-meter {
	display: grid;
	justify-items: center;
	gap: 12px;
}

.memory-chart-switch {
	justify-self: stretch;
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.memory-chart-shell {
	position: relative;
	width: min(180px, 100%);
	aspect-ratio: 1;
}

.memory-chart-shell-line {
	width: 100%;
	height: 220px;
	aspect-ratio: auto;
}

.memory-chart {
	display: block;
	width: 100%;
	height: 100%;
}

.memory-chart-value {
	position: absolute;
	inset: 0;
	display: grid;
	align-items: center;
	justify-items: center;
	align-content: center;
	gap: 4px;
	padding: 32px;
	text-align: center;
	pointer-events: none;
}

.memory-chart-value span {
	color: var(--willump-text-muted);
	font-size: 12px;
	line-height: 1.2;
}

.memory-chart-value strong {
	color: var(--willump-text);
	font-size: 28px;
	line-height: 1;
}

.memory-refresh-line {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	width: 100%;
}

.memory-refresh-control {
	display: inline-flex;
	align-items: center;
	flex: 0 0 auto;
	gap: 6px;
	color: var(--willump-text-muted);
	font-size: 12px;
}

.memory-refresh-input {
	width: 86px;
}

.muted-inline {
	display: block;
	margin-top: 4px;
	color: var(--willump-text-muted);
}

@media (max-width: 760px) {
	.system-info-grid {
		grid-template-columns: 1fr;
	}

	.memory-refresh-line {
		align-items: flex-start;
		flex-direction: column;
	}
}
</style>
