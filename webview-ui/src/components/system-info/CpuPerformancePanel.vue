<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import { t } from '../../i18n';
import CpuCoreCharts from './CpuCoreCharts.vue';
import CpuTotalChart from './CpuTotalChart.vue';
import type { CpuCoreChartItem, SelectOption } from './types';

type CpuChartMode = 'total' | 'cores';
type TemplateRefElement = Element | ComponentPublicInstance | null;

defineProps<{
	mode: CpuChartMode;
	options: SelectOption<CpuChartMode>[];
	usagePercent: number;
	collectedAtText: string;
	coreItems: CpuCoreChartItem[];
	setTotalCanvas: (el: TemplateRefElement) => void;
	setCoreCanvas: (index: number, el: TemplateRefElement) => void;
}>();

const emit = defineEmits<{
	modeChange: [value: string | number | boolean | Record<string, unknown> | Array<unknown>];
	syncChart: [];
}>();
</script>

<template>
	<a-card class="config-panel performance-panel" :title="t('system.cpu')" :bordered="false">
		<div class="cpu-meter">
			<a-radio-group class="cpu-chart-switch" :model-value="mode" type="button" @change="$emit('modeChange', $event)">
				<a-radio v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</a-radio>
			</a-radio-group>
			<CpuTotalChart v-if="mode === 'total'" :usage-percent="usagePercent" :set-canvas="setTotalCanvas" @sync-chart="emit('syncChart')" />
			<CpuCoreCharts v-else :items="coreItems" :set-canvas="setCoreCanvas" />
			<p class="muted-line">{{ t('system.collectedAt') }}: {{ collectedAtText }}</p>
		</div>
	</a-card>
</template>

<style scoped>
.cpu-meter {
	display: grid;
	gap: 12px;
}

.cpu-chart-switch {
	justify-self: stretch;
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}
</style>
