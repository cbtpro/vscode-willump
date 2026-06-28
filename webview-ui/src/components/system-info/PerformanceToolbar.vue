<script setup lang="ts">
import { t } from '../../i18n';

defineProps<{
	refreshSeconds: number;
	minRefreshSeconds: number;
	maxRefreshSeconds: number;
	isAutoRefreshEnabled: boolean;
}>();

defineEmits<{
	refreshSecondsChange: [value: string | number | null | undefined];
	autoRefreshEnabledChange: [value: boolean];
}>();
</script>

<template>
	<div class="performance-toolbar">
		<a-switch
			:checked="isAutoRefreshEnabled"
			@change="$emit('autoRefreshEnabledChange', $event)"
		/>
		<p class="muted-line">
			{{ t('system.performanceAutoRefreshLabel') }}
			<a-input-number
				class="memory-refresh-input"
				:model-value="refreshSeconds"
				:min="minRefreshSeconds"
				:max="maxRefreshSeconds"
				:step="1"
				:precision="0"
				size="mini"
				@change="$emit('refreshSecondsChange', $event)"
			/>
			{{ t('system.performanceAutoRefreshUnit') }}
		</p>
	</div>
</template>

<style scoped>
.performance-toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 16px;
}

.memory-refresh-input {
	width: 64px;
	margin: 0 4px;
}
</style>
