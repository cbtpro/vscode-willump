<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import { t } from '../../i18n';
import type { CpuCoreChartItem } from './types';

type TemplateRefElement = Element | ComponentPublicInstance | null;

defineProps<{
	items: CpuCoreChartItem[];
	setCanvas: (index: number, el: TemplateRefElement) => void;
}>();

function formatPercent(value: number): string {
	if (!Number.isFinite(value)) {
		return '0%';
	}

	const rounded = Math.min(Math.max(Math.round(value * 10) / 10, 0), 100);
	return `${rounded}%`;
}
</script>

<template>
	<div class="cpu-core-chart-rows">
		<div
			v-for="core in items"
			:key="core.index"
			class="cpu-core-chart-card"
			:class="{ 'is-empty': !core.hasUsage }"
			:title="`${t('system.cpuCoreLabel', { index: core.index + 1 })}: ${formatPercent(core.usagePercent)}`"
		>
			<div class="cpu-core-chart-canvas">
				<canvas
					:ref="el => setCanvas(core.index, el)"
					class="usage-chart"
					:aria-label="t('system.cpuCoreLabel', { index: core.index + 1 })"
					role="img"
				></canvas>
			</div>
			<div class="cpu-core-chart-meta">
				<span>{{ t('system.cpuCoreLabel', { index: core.index + 1 }) }}</span>
				<strong>{{ formatPercent(core.usagePercent) }}</strong>
			</div>
		</div>
	</div>
</template>

<style scoped>
.cpu-core-chart-rows {
	--cpu-core-chart-size: minmax(72px, 1fr);
	display: grid;
	grid-template-columns: repeat(auto-fill, var(--cpu-core-chart-size));
	gap: 6px;
}

.cpu-core-chart-card {
	box-sizing: border-box;
	display: grid;
	grid-template-rows: minmax(0, 1fr) auto;
	gap: 4px;
	min-width: 0;
	aspect-ratio: 1;
	padding: 6px;
	border: 1px solid var(--willump-border);
	border-radius: 4px;
	background: var(--willump-fill-subtle);
}

.cpu-core-chart-card.is-empty {
	opacity: 0.6;
}

.cpu-core-chart-canvas {
	position: relative;
	min-width: 0;
	min-height: 0;
}

.usage-chart {
	display: block;
	width: 100%;
	height: 100%;
}

.cpu-core-chart-meta {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 4px;
	min-width: 0;
}

.cpu-core-chart-meta span {
	overflow: hidden;
	color: var(--willump-text-muted);
	font-size: 10px;
	line-height: 1;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.cpu-core-chart-meta strong {
	color: var(--willump-text);
	font-size: 16px;
	line-height: 1;
}

@media (max-width: 900px) {
	.cpu-core-chart-rows {
		grid-template-columns: repeat(4, minmax(72px, 1fr));
	}
}

@media (max-width: 520px) {
	.cpu-core-chart-rows {
		grid-template-columns: repeat(2, minmax(72px, 1fr));
	}
}
</style>
