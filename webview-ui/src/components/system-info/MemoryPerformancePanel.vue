<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import { t } from '../../i18n';
import type { InfoRow, SelectOption } from './types';

type MemoryChartMode = 'doughnut' | 'line' | 'smoothLine';
type TemplateRefElement = Element | ComponentPublicInstance | null;

defineProps<{
	mode: MemoryChartMode;
	options: SelectOption<MemoryChartMode>[];
	usagePercent: number;
	collectedAtText: string;
	rows: InfoRow[];
	setCanvas: (el: TemplateRefElement) => void;
}>();

defineEmits<{
	modeChange: [value: string | number | boolean | Record<string, unknown> | Array<unknown>];
}>();
</script>

<template>
	<a-card class="config-panel performance-panel" :title="t('system.memory')" :bordered="false">
		<div class="memory-meter">
			<a-radio-group class="memory-chart-switch" :model-value="mode" type="button" @change="$emit('modeChange', $event)">
				<a-radio v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</a-radio>
			</a-radio-group>
			<div class="memory-chart-shell" :class="{ 'memory-chart-shell-line': mode !== 'doughnut' }">
				<canvas :ref="setCanvas" class="memory-chart" :aria-label="t('system.memoryUsage')" role="img"></canvas>
				<div v-if="mode === 'doughnut'" class="memory-chart-value">
					<span>{{ t('system.memoryUsage') }}</span>
					<strong>{{ usagePercent }}%</strong>
				</div>
			</div>
			<p class="muted-line">{{ t('system.collectedAt') }}: {{ collectedAtText }}</p>
		</div>
		<a-descriptions :column="1" bordered>
			<a-descriptions-item v-for="row in rows" :key="row.key" :label="row.label">
				{{ row.value }}
			</a-descriptions-item>
		</a-descriptions>
	</a-card>
</template>

<style scoped>
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
</style>
