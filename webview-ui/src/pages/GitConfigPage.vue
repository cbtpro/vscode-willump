<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { t } from '../i18n';
import { getVsCodeApi, type GitConfigInfo, type GitConfigScope } from '../vscode';

interface GitMessage {
	type: 'gitConfigUpdated' | 'gitConfigSaved';
	success: boolean;
	config?: GitConfigInfo;
	scope?: 'local' | 'global';
	message?: string;
}

const vscode = getVsCodeApi();
const isLoading = ref(false);
const isSaving = ref<'local' | 'global' | ''>('');
const errorMessage = ref('');
const successMessage = ref('');
const workspacePath = ref('');
const form = reactive({
	local: createEmptyScope(),
	global: createEmptyScope()
});

function createEmptyScope(): GitConfigScope {
	return {
		name: '',
		email: '',
		configPath: '',
		available: true
	};
}

function refreshGitConfig() {
	isLoading.value = true;
	errorMessage.value = '';
	successMessage.value = '';
	vscode?.postMessage({ type: 'getGitConfig' });
}

function saveGitConfig(scope: 'local' | 'global') {
	isSaving.value = scope;
	errorMessage.value = '';
	successMessage.value = '';
	vscode?.postMessage({
		type: 'updateGitConfig',
		scope,
		name: form[scope].name,
		email: form[scope].email
	});
}

function applyConfig(config: GitConfigInfo) {
	workspacePath.value = config.workspacePath;
	form.local = { ...config.local };
	form.global = { ...config.global };
}

function handleMessage(event: MessageEvent<GitMessage>) {
	const message = event.data;

	if (message.type === 'gitConfigUpdated') {
		isLoading.value = false;

		if (message.success && message.config) {
			applyConfig(message.config);
			return;
		}

		errorMessage.value = message.message ?? t('git.loadFailed');
	}

	if (message.type === 'gitConfigSaved') {
		isSaving.value = '';

		if (message.success && message.config) {
			applyConfig(message.config);
			successMessage.value = message.scope === 'global' ? t('git.saveGlobalSuccess') : t('git.saveCurrentSuccess');
			return;
		}

		errorMessage.value = message.message ?? t('git.saveFailed');
	}
}

onMounted(() => {
	window.addEventListener('message', handleMessage);
	refreshGitConfig();
});

onUnmounted(() => {
	window.removeEventListener('message', handleMessage);
});
</script>

<template>
	<main class="page">
		<header class="toolbar">
			<div>
				<h1>{{ t('git.title') }}</h1>
				<p>{{ t('git.subtitle') }}</p>
			</div>
			<a-button type="primary" :loading="isLoading" @click="refreshGitConfig">{{ t('common.refresh') }}</a-button>
		</header>

		<p v-if="workspacePath" class="muted-line">{{ t('git.currentProject') }}：{{ workspacePath }}</p>
		<a-alert v-if="successMessage" type="success" :content="successMessage" />
		<a-alert v-if="errorMessage" type="error" :content="errorMessage" />

		<section class="config-grid">
			<a-card class="config-panel" :title="t('git.currentProjectConfig')" :bordered="false">
				<p>{{ t('git.currentProjectDescription') }}</p>
				<a-form :model="form.local" layout="vertical">
					<a-form-item :label="t('git.author')">
						<a-input v-model="form.local.name" placeholder="user.name" :disabled="!form.local.available" />
					</a-form-item>
					<a-form-item :label="t('git.email')">
						<a-input v-model="form.local.email" placeholder="user.email" :disabled="!form.local.available" />
					</a-form-item>
				</a-form>
				<p class="muted-line">{{ form.local.configPath || form.local.error || t('git.localEmpty') }}</p>
				<a-button type="primary" :disabled="!form.local.available" :loading="isSaving === 'local'" @click="saveGitConfig('local')">
					{{ t('git.saveCurrent') }}
				</a-button>
			</a-card>

			<a-card class="config-panel" :title="t('git.globalConfig')" :bordered="false">
				<p>{{ t('git.globalDescription') }}</p>
				<a-form :model="form.global" layout="vertical">
					<a-form-item :label="t('git.author')">
						<a-input v-model="form.global.name" placeholder="user.name" />
					</a-form-item>
					<a-form-item :label="t('git.email')">
						<a-input v-model="form.global.email" placeholder="user.email" />
					</a-form-item>
				</a-form>
				<p class="muted-line">{{ form.global.configPath || t('git.globalEmpty') }}</p>
				<a-button type="primary" :loading="isSaving === 'global'" @click="saveGitConfig('global')">{{ t('git.saveGlobal') }}</a-button>
			</a-card>
		</section>
	</main>
</template>
