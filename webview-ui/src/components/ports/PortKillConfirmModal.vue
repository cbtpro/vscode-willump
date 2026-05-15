<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import type { KillTarget } from './ports.types';

const props = defineProps<{
	visible: boolean;
	target: KillTarget | null;
	isKilling: boolean;
}>();

const emit = defineEmits<{
	'update:visible': [visible: boolean];
	confirm: [];
}>();

const visibleModel = computed({
	get: () => props.visible,
	set: visible => emit('update:visible', visible)
});
</script>

<template>
	<a-modal v-model:visible="visibleModel" :title="t('ports.confirmKillTitle')" :footer="false" :mask-closable="!isKilling">
		<p>{{ t('ports.confirmKillDescription') }}</p>
		<a-descriptions v-if="target" class="process-detail" :column="1" bordered>
			<a-descriptions-item :label="t('ports.port')">{{ target.port }}</a-descriptions-item>
			<a-descriptions-item :label="t('ports.pid')">{{ target.pid }}</a-descriptions-item>
			<a-descriptions-item :label="t('ports.command')">{{ target.command }}</a-descriptions-item>
		</a-descriptions>
		<div class="dialog-actions">
			<a-button :disabled="isKilling" @click="emit('update:visible', false)">{{ t('common.cancel') }}</a-button>
			<a-button type="primary" status="danger" :loading="isKilling" @click="emit('confirm')">{{ t('ports.confirmKill') }}</a-button>
		</div>
	</a-modal>
</template>
