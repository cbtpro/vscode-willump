<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import { ref } from 'vue';
import { t } from '../../i18n';
import CpuPerformancePanel from './CpuPerformancePanel.vue';
import MemoryPerformancePanel from './MemoryPerformancePanel.vue';
import PerformanceToolbar from './PerformanceToolbar.vue';
import type { CpuCoreChartItem, InfoRow, SelectOption } from './types';

type MemoryChartMode = 'doughnut' | 'line' | 'smoothLine';
type CpuChartMode = 'total' | 'cores';
type PerformancePanelKey = 'cpu' | 'memory';
type TemplateRefElement = Element | ComponentPublicInstance | null;
type RadioValue = string | number | boolean | Record<string, unknown> | Array<unknown>;

const activePerformancePanel = ref<PerformancePanelKey>('cpu');

defineProps<{
	memoryRefreshSeconds: number;
	minMemoryRefreshSeconds: number;
	maxMemoryRefreshSeconds: number;
	isAutoRefreshEnabled: boolean;
	cpuChartMode: CpuChartMode;
	cpuChartOptions: SelectOption<CpuChartMode>[];
	cpuUsagePercent: number;
	cpuCollectedAtText: string;
	cpuCoreItems: CpuCoreChartItem[];
	memoryChartMode: MemoryChartMode;
	memoryChartOptions: SelectOption<MemoryChartMode>[];
	memoryUsagePercent: number;
	memoryCollectedAtText: string;
	memoryRows: InfoRow[];
	setCpuChartCanvas: (el: TemplateRefElement) => void;
	setCpuCoreChartCanvas: (index: number, el: TemplateRefElement) => void;
	setMemoryChartCanvas: (el: TemplateRefElement) => void;
}>();

const emit = defineEmits<{
	memoryRefreshSecondsChange: [value: string | number | null | undefined];
	autoRefreshEnabledChange: [value: boolean];
	cpuChartModeChange: [value: RadioValue];
	memoryChartModeChange: [value: RadioValue];
	panelChange: [value: PerformancePanelKey];
	cpuChartSync: [];
}>();

function handlePerformancePanelChange(value: string | number) {
	if (value !== 'cpu' && value !== 'memory') {
		return;
	}

	activePerformancePanel.value = value;
	emit('panelChange', value);
}
</script>

<template>
	<PerformanceToolbar
		:refresh-seconds="memoryRefreshSeconds"
		:min-refresh-seconds="minMemoryRefreshSeconds"
		:max-refresh-seconds="maxMemoryRefreshSeconds"
		:is-auto-refresh-enabled="isAutoRefreshEnabled"
		@refresh-seconds-change="emit('memoryRefreshSecondsChange', $event)"
		@auto-refresh-enabled-change="emit('autoRefreshEnabledChange', $event)"
	/>

	<a-tabs class="performance-side-tabs" :active-key="activePerformancePanel" position="top" @change="handlePerformancePanelChange">
		<a-tab-pane key="cpu">
			<template #title>{{ t('system.cpu') }}</template>

			<CpuPerformancePanel
				:mode="cpuChartMode"
				:options="cpuChartOptions"
				:usage-percent="cpuUsagePercent"
				:collected-at-text="cpuCollectedAtText"
				:core-items="cpuCoreItems"
				:set-total-canvas="setCpuChartCanvas"
				:set-core-canvas="setCpuCoreChartCanvas"
				@mode-change="emit('cpuChartModeChange', $event)"
				@sync-chart="emit('cpuChartSync')"
			/>
		</a-tab-pane>

		<a-tab-pane key="memory">
			<template #title>{{ t('system.memory') }}</template>

			<MemoryPerformancePanel
				:mode="memoryChartMode"
				:options="memoryChartOptions"
				:usage-percent="memoryUsagePercent"
				:collected-at-text="memoryCollectedAtText"
				:rows="memoryRows"
				:set-canvas="setMemoryChartCanvas"
				@mode-change="emit('memoryChartModeChange', $event)"
			/>
		</a-tab-pane>
	</a-tabs>
</template>

<style scoped>
.performance-side-tabs {
	min-width: 0;
}

.performance-side-tabs :deep(.arco-tabs-nav) {
	flex: 0 0 128px;
}

.performance-side-tabs :deep(.arco-tabs-content) {
	min-width: 0;
}

.performance-side-tabs :deep(.arco-tabs-content-list),
.performance-side-tabs :deep(.arco-tabs-pane) {
	min-width: 0;
}
</style>
