<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import { ref, watch } from 'vue';
import { t } from '../../i18n';

type TemplateRefElement = Element | ComponentPublicInstance | null;

const props = defineProps<{
	usagePercent: number;
	setCanvas: (el: TemplateRefElement) => void;
}>();

const emit = defineEmits<{
	syncChart: [];
}>();

const isInitialized = ref(false);

// 当 usagePercent 从 undefined 变为有值时，说明组件已挂载，通知父组件同步图表
watch(
	() => props.usagePercent,
	(newValue, oldValue) => {
		if (oldValue === undefined && newValue !== undefined && !isInitialized.value) {
			isInitialized.value = true;
			emit('syncChart');
		}
	}
);
</script>

<template>
	<div class="cpu-total-chart" @vue:mounted="emit('syncChart')">
		<div class="usage-summary">
			<span>{{ t('system.cpuUsage') }}</span>
			<strong>{{ usagePercent }}%</strong>
		</div>
		<div class="usage-chart-shell">
			<canvas :ref="setCanvas" class="usage-chart" :aria-label="t('system.cpuUsage')" role="img"></canvas>
		</div>
	</div>
</template>

<style scoped>
.cpu-total-chart {
	display: grid;
	gap: 12px;
}

.usage-summary {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
}

.usage-summary span {
	color: var(--willump-text-muted);
	font-size: 12px;
}

.usage-summary strong {
	color: var(--willump-text);
	font-size: 28px;
	line-height: 1;
}

.usage-chart-shell {
	width: 100%;
	height: 220px;
}

.usage-chart {
	display: block;
	width: 100%;
	height: 100%;
}
</style>
