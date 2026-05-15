<script setup lang="ts">
import IconCheck from '@arco-design/web-vue/es/icon/icon-check';
import IconCopy from '@arco-design/web-vue/es/icon/icon-copy';
import { computed, onUnmounted, ref, watch } from 'vue';
import { t } from '../../i18n';

type CopyState = 'idle' | 'success' | 'error';

const props = defineProps<{
	visible: boolean;
	command: string;
}>();

const emit = defineEmits<{
	'update:visible': [visible: boolean];
}>();

const isCopying = ref(false);
const copyState = ref<CopyState>('idle');
let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

const visibleModel = computed({
	get: () => props.visible,
	set: visible => {
		if (visible) {
			emit('update:visible', true);
			return;
		}

		closeModal();
	}
});
const copyFeedback = computed(() => {
	if (copyState.value === 'success') {
		return { type: 'success' as const, content: t('ports.copySuccess') };
	}

	if (copyState.value === 'error') {
		return { type: 'error' as const, content: t('ports.copyFailed') };
	}

	return null;
});
const copyButtonText = computed(() => {
	if (isCopying.value) {
		return t('ports.copying');
	}

	if (copyState.value === 'success') {
		return t('ports.copied');
	}

	return t('common.copy');
});

watch(
	() => props.visible,
	visible => {
		if (visible) {
			clearCopyFeedback();
		}
	}
);

function clearCopyFeedback() {
	if (copyResetTimer) {
		clearTimeout(copyResetTimer);
		copyResetTimer = undefined;
	}

	isCopying.value = false;
	copyState.value = 'idle';
}

function scheduleCopyFeedbackReset() {
	if (copyResetTimer) {
		clearTimeout(copyResetTimer);
	}

	copyResetTimer = setTimeout(() => {
		copyState.value = 'idle';
		copyResetTimer = undefined;
	}, 2000);
}

function closeModal() {
	emit('update:visible', false);
	clearCopyFeedback();
}

async function copyCommand() {
	if (isCopying.value) {
		return;
	}

	if (copyResetTimer) {
		clearTimeout(copyResetTimer);
		copyResetTimer = undefined;
	}

	isCopying.value = true;
	copyState.value = 'idle';

	try {
		if (!navigator.clipboard?.writeText) {
			throw new Error('Clipboard API is not available');
		}

		await navigator.clipboard.writeText(props.command || '');
		copyState.value = 'success';
	} catch (err) {
		copyState.value = 'error';
	} finally {
		isCopying.value = false;
		scheduleCopyFeedbackReset();
	}
}

onUnmounted(() => {
	clearCopyFeedback();
});
</script>

<template>
	<a-modal v-model:visible="visibleModel" :title="t('ports.startCommand')" :footer="false" :mask-closable="!isCopying">
		<div class="full-command-modal">
			<pre class="full-command-content">{{ command }}</pre>
			<a-alert v-if="copyFeedback" class="full-command-feedback" :type="copyFeedback.type">
				{{ copyFeedback.content }}
			</a-alert>
			<div class="dialog-actions">
				<a-button :disabled="isCopying" @click="closeModal">{{ t('common.close') }}</a-button>
				<a-button type="primary" :status="copyState === 'success' ? 'success' : 'normal'" :loading="isCopying" @click="copyCommand">
					<template #icon>
						<IconCheck v-if="copyState === 'success'" />
						<IconCopy v-else />
					</template>
					{{ copyButtonText }}
				</a-button>
			</div>
		</div>
	</a-modal>
</template>

<style scoped>
.full-command-modal {
	display: grid;
	gap: 12px;
}

.full-command-content {
	white-space: pre-wrap;
	word-break: break-word;
	overflow-x: auto;
	max-height: 60vh;
	display: block;
	margin: 0;
	padding: 12px;
	border: 1px solid var(--color-border-2);
	border-radius: 6px;
	background: var(--color-fill-2);
	color: var(--color-text-1);
}

.full-command-feedback {
	margin: 0;
}
</style>
