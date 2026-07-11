<script setup lang="ts">
import { Message, Notification } from '@arco-design/web-vue';
import type { Chart, ChartConfiguration } from 'chart.js';
import type { ComponentPublicInstance } from 'vue';
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue';
import PageHeader from '../components/common/PageHeader.vue';
import SystemBasicTab from '../components/system-info/SystemBasicTab.vue';
import SystemPerformanceTab from '../components/system-info/SystemPerformanceTab.vue';
import type { CpuCoreChartItem, InfoRow, PublicIpRow } from '../components/system-info/types';
import { t } from '../i18n';
import { getVsCodeApi, type DeviceFormFactor, type PublicIpInfo, type SystemCpuUsageInfo, type SystemGpuInfo, type SystemInfo, type SystemMemoryInfo } from '../vscode';

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
} | {
	type: 'systemCpuUpdated';
	success: boolean;
	cpu?: SystemCpuUsageInfo;
	message?: string;
};

type MemoryChartMode = 'doughnut' | 'line' | 'smoothLine';
type CpuChartMode = 'total' | 'cores';
type PerformancePanelKey = 'cpu' | 'memory';
type TemplateRefElement = Element | ComponentPublicInstance | null;

interface MemorySample {
	timestamp: number;
	usagePercent: number;
	usedBytes: number;
	freeBytes: number;
}

interface CpuSample {
	timestamp: number;
	usagePercent: number;
	coreUsagePercentages: number[];
}

type SystemInfoTab = 'basic' | 'performance';

const DEFAULT_MEMORY_REFRESH_SECONDS = 3;
const MIN_MEMORY_REFRESH_SECONDS = 1;
const MAX_MEMORY_REFRESH_SECONDS = 60;
const MEMORY_REFRESH_STORAGE_KEY = 'willump.memoryRefreshSeconds';
const MEMORY_AUTO_REFRESH_ENABLED_KEY = 'willump.memoryAutoRefreshEnabled';
const CPU_CORE_COLORS = ['#22c55e', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899'];

const vscode = getVsCodeApi();
const info = ref<SystemInfo | null>(null);
const isLoading = ref(false);
const systemInfoTab = ref<SystemInfoTab>('basic');
const cpuChartCanvas = ref<HTMLCanvasElement | null>(null);
const cpuCoreChartCanvases = ref<Array<HTMLCanvasElement | undefined>>([]);
const memoryChartCanvas = ref<HTMLCanvasElement | null>(null);
const cpuChartMode = ref<CpuChartMode>('total');
const memoryChartMode = ref<MemoryChartMode>('doughnut');
const memoryRefreshSeconds = ref(getStoredMemoryRefreshSeconds());
const isMemoryAutoRefreshEnabled = ref(getStoredAutoRefreshEnabled());
const cpuSamples = ref<CpuSample[]>([]);
const memorySamples = ref<MemorySample[]>([]);
const cpuChartOptions = computed<Array<{ label: string; value: CpuChartMode }>>(() => [
	{ label: t('system.cpuChartTotal'), value: 'total' },
	{ label: t('system.cpuChartCores'), value: 'cores' }
]);
const cpuCoreChartItems = computed(() => getCpuCoreChartItems());
const memoryChartOptions = computed<Array<{ label: string; value: MemoryChartMode }>>(() => [
	{ label: t('system.memoryChartDoughnut'), value: 'doughnut' },
	{ label: t('system.memoryChartLine'), value: 'line' },
	{ label: t('system.memoryChartSmoothLine'), value: 'smoothLine' }
]);
let cpuChart: Chart | undefined;
const cpuCoreCharts = new Map<number, Chart>();
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
const cpuStatus = computed(() => {
	const usage = info.value?.cpu.usage.usagePercent ?? 0;
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
const cpuCollectedAtText = computed(() => info.value ? formatDateTime(info.value.cpu.usage.collectedAt) : '');
const memoryCollectedAtText = computed(() => info.value ? formatDateTime(info.value.memory.collectedAt) : '');

function refreshSystemInfo() {
	isLoading.value = true;

	if (!vscode) {
		isLoading.value = false;
		return;
	}

	vscode.postMessage({ type: 'getSystemInfo' });
}

function refreshPerformanceInfo() {
	vscode?.postMessage({ type: 'getSystemMemoryInfo' });
	vscode?.postMessage({ type: 'getSystemCpuInfo' });
}

function startMemoryRefreshTimer() {
	stopMemoryRefreshTimer();

	if (!isMemoryAutoRefreshEnabled.value) {
		return;
	}

	memoryRefreshTimer = setInterval(refreshPerformanceInfo, memoryRefreshSeconds.value * 1000);
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

	if (isMemoryAutoRefreshEnabled.value) {
		refreshPerformanceInfo();
	}
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

function handleMemoryAutoRefreshEnabledChange(value: boolean) {
	isMemoryAutoRefreshEnabled.value = value;
	localStorage.setItem(MEMORY_AUTO_REFRESH_ENABLED_KEY, String(value));
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

	if (message.type === 'systemCpuUpdated') {
		if (message.success && message.cpu && info.value) {
			recordCpuSample(message.cpu);
			info.value = {
				...info.value,
				cpu: {
					...info.value.cpu,
					usage: message.cpu
				}
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
		recordCpuSample(message.info.cpu.usage);
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

	if (type !== 'systemInfoUpdated' && type !== 'systemMemoryUpdated' && type !== 'systemCpuUpdated') {
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

function handleCpuChartModeChange(value: string | number | boolean | Record<string, unknown> | Array<unknown>) {
	if (!isCpuChartMode(value)) {
		return;
	}

	cpuChartMode.value = value;
}

function handleSystemInfoTabChange(value: string | number) {
	if (value !== 'basic' && value !== 'performance') {
		return;
	}

	systemInfoTab.value = value;

	if (value === 'performance') {
		void syncCpuChart();
		void syncMemoryChart();
	}
}

function handlePerformancePanelChange(value: PerformancePanelKey) {
	if (value === 'cpu') {
		void syncCpuChart();
		return;
	}

	void syncMemoryChart();
}

async function syncCpuChart() {
	await nextTick();

	if (systemInfoTab.value !== 'performance' || !info.value) {
		return;
	}

	if (cpuChartMode.value === 'cores') {
		await syncCpuCoreCharts();
		return;
	}

	destroyCpuCoreCharts();

	if (!cpuChartCanvas.value) {
		return;
	}

	if (!cpuChart) {
		const { default: ChartConstructor } = await loadChartJs();

		if (!info.value || !cpuChartCanvas.value) {
			return;
		}

		cpuChart = new ChartConstructor(cpuChartCanvas.value, createCpuChartConfig() as ChartConfiguration);
	}

	updateCpuChart();
}

async function syncCpuCoreCharts() {
	destroyCpuChart();
	const { default: ChartConstructor } = await loadChartJs();
	const activeCoreIndexes = new Set<number>();

	for (let index = 0; index < getCpuCoreCount(); index += 1) {
		const canvas = cpuCoreChartCanvases.value[index];

		if (!canvas) {
			continue;
		}

		activeCoreIndexes.add(index);

		if (!cpuCoreCharts.has(index)) {
			cpuCoreCharts.set(index, new ChartConstructor(canvas, createCpuCoreChartConfig(index) as ChartConfiguration));
		}
	}

	for (const index of cpuCoreCharts.keys()) {
		if (!activeCoreIndexes.has(index)) {
			destroyCpuCoreChart(index);
		}
	}

	updateCpuCoreCharts();
}

async function syncMemoryChart() {
	await nextTick();

	if (systemInfoTab.value !== 'performance' || !info.value || !memoryChartCanvas.value) {
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

function createCpuChartConfig(): ChartConfiguration<'line', number[], string> {
	const colors = getCpuChartColors();

	return {
		type: 'line',
		data: {
			labels: getCpuTrendLabels(),
			datasets: [
				{
					label: t('system.cpuUsage'),
					data: getCpuTrendData(),
					borderColor: colors.used,
					backgroundColor: colors.usedSoft,
					borderWidth: 2,
					fill: true,
					pointRadius: 0,
					pointHoverRadius: 4,
					tension: 0.38
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			color: colors.text,
			animation: {
				duration: 0
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
						label: item => `${item.dataset.label}: ${Number(item.raw).toFixed(1)}%`
					}
				}
			}
		}
	};
}

function createCpuCoreChartConfig(coreIndex: number): ChartConfiguration<'line', number[], string> {
	const colors = getCpuChartColors();
	const color = getCpuCoreColor(coreIndex);

	return {
		type: 'line',
		data: {
			labels: getCpuTrendLabels(),
			datasets: [
				{
					label: t('system.cpuCoreLabel', { index: coreIndex + 1 }),
					data: getCpuCoreTrendData(coreIndex),
					borderColor: color,
					backgroundColor: color,
					borderWidth: 1.4,
					fill: false,
					pointRadius: getCpuCoreTrendData(coreIndex).length > 1 ? 0 : 1.8,
					pointHoverRadius: 2,
					tension: 0
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			layout: {
				padding: 1
			},
			color: colors.text,
			animation: {
				duration: 0
			},
			scales: {
				x: {
					grid: {
						display: false
					},
					ticks: {
						display: false
					}
				},
				y: {
					min: 0,
					max: 100,
					grid: {
						display: false
					},
					ticks: {
						display: false
					}
				}
			},
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					callbacks: {
						label: item => `${item.dataset.label}: ${Number(item.raw).toFixed(1)}%`
					}
				}
			}
		}
	};
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

function updateCpuChart() {
	if (!cpuChart || !info.value) {
		return;
	}

	const colors = getCpuChartColors();
	cpuChart.options.color = colors.text;
	const dataset = cpuChart.data.datasets[0];
	dataset.label = t('system.cpuUsage');
	dataset.data = getCpuTrendData();
	dataset.borderColor = colors.used;
	dataset.backgroundColor = colors.usedSoft;
	cpuChart.data.labels = getCpuTrendLabels();
	cpuChart.update('none');
}

function updateCpuCoreCharts() {
	const colors = getCpuChartColors();

	for (const [index, chart] of cpuCoreCharts) {
		const color = getCpuCoreColor(index);
		const dataset = chart.data.datasets[0];

		chart.options.color = colors.text;
		dataset.label = t('system.cpuCoreLabel', { index: index + 1 });
		dataset.data = getCpuCoreTrendData(index);
		dataset.borderColor = color;
		dataset.backgroundColor = color;
		dataset.pointRadius = getCpuCoreTrendData(index).length > 1 ? 0 : 1.8;
		chart.data.labels = getCpuTrendLabels();
		chart.update('none');
	}
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

function getCpuTrendData(): number[] {
	return getCpuSamples().map(item => item.usagePercent);
}

function getCpuCoreTrendData(coreIndex: number): number[] {
	return getCpuSamples().map(item => item.coreUsagePercentages[coreIndex] ?? 0);
}

function getCpuTrendLabels(): string[] {
	return getCpuSamples().map(item => formatChartTime(item.timestamp));
}

function getCpuCoreCount(): number {
	return Math.max(
		info.value?.cpu.cores ?? 0,
		info.value?.cpu.usage.cores.length ?? 0,
		...getCpuSamples().map(item => item.coreUsagePercentages.length)
	);
}

function getCpuCoreChartItems(): CpuCoreChartItem[] {
	const usageCores = info.value?.cpu.usage.cores ?? [];
	const coreCount = getCpuCoreCount();

	return Array.from({ length: coreCount }, (_, index) => {
		const core = usageCores.find(item => item.index === index) ?? usageCores[index];

		return {
			index,
			usagePercent: core?.usagePercent ?? 0,
			idlePercent: core?.idlePercent ?? 100,
			hasUsage: Boolean(core)
		};
	});
}

function getCpuCoreColor(index: number): string {
	return CPU_CORE_COLORS[index % CPU_CORE_COLORS.length];
}

function getCpuSamples(): CpuSample[] {
	if (cpuSamples.value.length) {
		return cpuSamples.value;
	}

	const cpu = info.value?.cpu.usage;

	return cpu
		? [createCpuSample(cpu)]
		: [];
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

function getCpuChartColors() {
	const usedColor = cpuStatus.value === 'danger'
		? getCssVariable('--willump-danger')
		: cpuStatus.value === 'warning'
			? '#f59e0b'
			: '#22c55e';

	return {
		used: usedColor,
		usedSoft: `${usedColor}2e`,
		text: getCssVariable('--willump-text'),
		muted: getCssVariable('--willump-text-muted'),
		grid: getCssVariable('--willump-border')
	};
}

function getCssVariable(name: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function destroyCpuChart() {
	cpuChart?.destroy();
	cpuChart = undefined;
}

function destroyCpuCoreChart(index: number) {
	cpuCoreCharts.get(index)?.destroy();
	cpuCoreCharts.delete(index);
}

function destroyCpuCoreCharts() {
	for (const chart of cpuCoreCharts.values()) {
		chart.destroy();
	}

	cpuCoreCharts.clear();
}

function destroyMemoryChart() {
	memoryChart?.destroy();
	memoryChart = undefined;
}

function recordCpuSample(cpu: SystemCpuUsageInfo) {
	const nextSamples = [...cpuSamples.value, createCpuSample(cpu)];
	cpuSamples.value = nextSamples.slice(-24);
}

function recordMemorySample(memory: SystemMemoryInfo) {
	const nextSamples = [...memorySamples.value, createMemorySample(memory)];
	memorySamples.value = nextSamples.slice(-24);
}

function createCpuSample(cpu: SystemCpuUsageInfo): CpuSample {
	const timestamp = new Date(cpu.collectedAt).getTime();

	return {
		timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
		usagePercent: cpu.usagePercent,
		coreUsagePercentages: cpu.cores.map(item => item.usagePercent)
	};
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

function getStoredAutoRefreshEnabled(): boolean {
	const stored = localStorage.getItem(MEMORY_AUTO_REFRESH_ENABLED_KEY);

	if (stored === null || stored === undefined) {
		return true;
	}

	return stored === 'true';
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

function setCpuChartCanvas(el: TemplateRefElement) {
	cpuChartCanvas.value = el instanceof HTMLCanvasElement ? el : null;
}

function setCpuCoreChartCanvas(index: number, el: TemplateRefElement) {
	cpuCoreChartCanvases.value[index] = el instanceof HTMLCanvasElement ? el : undefined;
}

function setMemoryChartCanvas(el: TemplateRefElement) {
	memoryChartCanvas.value = el instanceof HTMLCanvasElement ? el : null;
}

function isMemoryChartMode(value: unknown): value is MemoryChartMode {
	return value === 'doughnut' || value === 'line' || value === 'smoothLine';
}

function isCpuChartMode(value: unknown): value is CpuChartMode {
	return value === 'total' || value === 'cores';
}

watch(
	() => info.value?.cpu.usage,
	() => {
		void syncCpuChart();
	},
	{ flush: 'post' }
);

watch(
	() => info.value?.memory,
	() => {
		void syncMemoryChart();
	},
	{ flush: 'post' }
);

watch(cpuChartMode, () => {
	destroyCpuChart();
	void syncCpuChart();
});

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
	destroyCpuChart();
	destroyCpuCoreCharts();
	destroyMemoryChart();
});
</script>

<template>
	<main class="page">
		<PageHeader :title="t('system.title')" :subtitle="t('system.subtitle')" :action-label="t('common.refresh')" :loading="isLoading" @action="refreshSystemInfo" />

		<a-spin :loading="isLoading">
			<a-tabs v-if="info" class="system-info-tabs" :active-key="systemInfoTab" lazy-load @change="handleSystemInfoTabChange">
				<a-tab-pane key="basic">
					<template #title>{{ t('system.basicInfoTab') }}</template>

					<SystemBasicTab
						:basic-rows="basicRows"
						:cpu-rows="cpuRows"
						:public-ip-rows="publicIpRows"
						:ipv6-rows="ipv6Rows"
						:local-ip-rows="localIpRows"
						:gpu-rows="gpuRows"
						@copy="copyValue"
					/>
				</a-tab-pane>

<!--
				<a-tab-pane key="performance">
					<template #title>{{ t('system.performanceTab') }}</template>

					<SystemPerformanceTab
						:memory-refresh-seconds="memoryRefreshSeconds"
						:min-memory-refresh-seconds="MIN_MEMORY_REFRESH_SECONDS"
						:max-memory-refresh-seconds="MAX_MEMORY_REFRESH_SECONDS"
						:is-auto-refresh-enabled="isMemoryAutoRefreshEnabled"
						:cpu-chart-mode="cpuChartMode"
						:cpu-chart-options="cpuChartOptions"
						:cpu-usage-percent="info.cpu.usage.usagePercent"
						:cpu-collected-at-text="cpuCollectedAtText"
						:cpu-core-items="cpuCoreChartItems"
						:memory-chart-mode="memoryChartMode"
						:memory-chart-options="memoryChartOptions"
						:memory-usage-percent="info.memory.usagePercent"
						:memory-collected-at-text="memoryCollectedAtText"
						:memory-rows="memoryRows"
						:set-cpu-chart-canvas="setCpuChartCanvas"
						:set-cpu-core-chart-canvas="setCpuCoreChartCanvas"
						:set-memory-chart-canvas="setMemoryChartCanvas"
						@memory-refresh-seconds-change="handleMemoryRefreshSecondsChange"
						@auto-refresh-enabled-change="handleMemoryAutoRefreshEnabledChange"
						@cpu-chart-mode-change="handleCpuChartModeChange"
						@memory-chart-mode-change="handleMemoryChartModeChange"
						@panel-change="handlePerformancePanelChange"
					/>
				</a-tab-pane>
-->
			</a-tabs>
		</a-spin>
	</main>
</template>

<style scoped>
.system-info-tabs {
	min-width: 0;
}
</style>
