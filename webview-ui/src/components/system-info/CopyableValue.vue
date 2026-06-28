<script setup lang="ts">
import IconCopy from '@arco-design/web-vue/es/icon/icon-copy';
import { t } from '../../i18n';

defineProps<{
	value: string;
	copyValue?: string;
}>();

defineEmits<{
	copy: [value: string];
}>();
</script>

<template>
	<span class="copyable-value">
		<span>
			{{ value }}
			<slot />
		</span>
		<a-tooltip v-if="copyValue" :content="t('common.copy')">
			<a-button type="text" size="mini" @click="$emit('copy', copyValue)">
				<template #icon><IconCopy /></template>
			</a-button>
		</a-tooltip>
	</span>
</template>

<style scoped>
.copyable-value {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	max-width: 100%;
	word-break: break-all;
}
</style>
