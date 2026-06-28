<script setup lang="ts">
import CopyableValue from './CopyableValue.vue';
import type { InfoRow } from './types';

defineProps<{
	title: string;
	rows: InfoRow[];
	copyable?: boolean;
}>();

defineEmits<{
	copy: [value: string];
}>();
</script>

<template>
	<a-card class="config-panel" :title="title" :bordered="false">
		<a-descriptions :column="1" bordered>
			<a-descriptions-item v-for="row in rows" :key="row.key" :label="row.label">
				<CopyableValue
					v-if="copyable"
					:value="row.value"
					:copy-value="row.copyValue"
					@copy="$emit('copy', $event)"
				/>
				<template v-else>{{ row.value }}</template>
			</a-descriptions-item>
		</a-descriptions>
	</a-card>
</template>
