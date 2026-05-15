<script setup lang="ts">
import { defineProps, defineEmits, reactive } from 'vue';
import { t } from '../../i18n';

const props = defineProps<{
	form: any;
	config: any;
	isSaving: string;
}>();

const emit = defineEmits<{
	(e: 'save', scope: 'local' | 'global'): void;
}>();

const localForm = reactive({
	name: props.form.local?.name ?? '',
	email: props.form.local?.email ?? ''
});

function saveLocal() {
	emit('save', 'local');
}

function saveGlobal() {
	emit('save', 'global');
}
</script>

<template>
	<section class="config-grid">
		<a-card class="config-panel" :title="t('git.currentProjectConfig')" :bordered="false">
			<p>{{ t('git.identityPreview') }}: {{ props.config?.effectiveIdentity.name || '-' }} &lt;{{ props.config?.effectiveIdentity.email || '-' }}&gt;</p>
			<p>{{ t('git.identitySource') }}: {{ props.config?.effectiveIdentity.source || '-' }}</p>
			<a-alert :type="props.config?.effectiveIdentity.isGithubNoreply ? 'success' : 'warning'">{{ props.config?.effectiveIdentity.isGithubNoreply ? t('git.noreplyDetected') : t('git.noreplyTip') }}</a-alert>
			<a-form :model="props.form.local" layout="vertical">
				<a-form-item :label="t('git.author')">
					<a-input v-model="props.form.local.name" placeholder="user.name" :disabled="!props.form.local.available" />
				</a-form-item>
				<a-form-item :label="t('git.email')">
					<a-input v-model="props.form.local.email" placeholder="user.email" :disabled="!props.form.local.available" />
				</a-form-item>
			</a-form>
			<a-button type="primary" :disabled="!props.form.local.available" :loading="props.isSaving === 'identity-local'" @click="saveLocal">{{ t('git.saveCurrent') }}</a-button>
		</a-card>

		<a-card class="config-panel" :title="t('git.globalConfig')" :bordered="false">
			<a-form :model="props.form.global" layout="vertical">
				<a-form-item :label="t('git.author')">
					<a-input v-model="props.form.global.name" placeholder="user.name" />
				</a-form-item>
				<a-form-item :label="t('git.email')">
					<a-input v-model="props.form.global.email" placeholder="user.email" />
				</a-form-item>
			</a-form>
			<a-button type="primary" :loading="props.isSaving === 'identity-global'" @click="saveGlobal">{{ t('git.saveGlobal') }}</a-button>
		</a-card>
	</section>
</template>
