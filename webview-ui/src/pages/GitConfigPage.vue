<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
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

		errorMessage.value = message.message ?? '读取 Git 配置失败';
	}

	if (message.type === 'gitConfigSaved') {
		isSaving.value = '';

		if (message.success && message.config) {
			applyConfig(message.config);
			successMessage.value = message.scope === 'global' ? '已保存全局 Git 作者信息' : '已保存当前项目 Git 作者信息';
			return;
		}

		errorMessage.value = message.message ?? '保存 Git 配置失败';
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
				<h1>Git 开发配置</h1>
				<p>查看并修改当前项目和全局的 Git 作者、邮箱信息。</p>
			</div>
			<button class="refresh-button" type="button" :disabled="isLoading" @click="refreshGitConfig">
				{{ isLoading ? '刷新中' : '刷新' }}
			</button>
		</header>

		<p v-if="workspacePath" class="muted-line">当前项目：{{ workspacePath }}</p>
		<p v-if="successMessage" class="success-message">{{ successMessage }}</p>
		<p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

		<section class="config-grid">
			<form class="config-panel" @submit.prevent="saveGitConfig('local')">
				<header>
					<h2>当前项目</h2>
					<p>写入当前仓库的 `.git/config`，只影响这个项目。</p>
				</header>

				<label class="field">
					<span>作者</span>
					<input v-model="form.local.name" type="text" placeholder="user.name" :disabled="!form.local.available" />
				</label>
				<label class="field">
					<span>邮箱</span>
					<input v-model="form.local.email" type="email" placeholder="user.email" :disabled="!form.local.available" />
				</label>
				<p class="muted-line">{{ form.local.configPath || form.local.error || '尚未设置当前项目 Git 作者信息' }}</p>
				<button class="refresh-button" type="submit" :disabled="!form.local.available || isSaving === 'local'">
					{{ isSaving === 'local' ? '保存中' : '保存当前项目配置' }}
				</button>
			</form>

			<form class="config-panel" @submit.prevent="saveGitConfig('global')">
				<header>
					<h2>全局配置</h2>
					<p>写入全局 Git 配置，作为所有仓库的默认作者信息。</p>
				</header>

				<label class="field">
					<span>作者</span>
					<input v-model="form.global.name" type="text" placeholder="user.name" />
				</label>
				<label class="field">
					<span>邮箱</span>
					<input v-model="form.global.email" type="email" placeholder="user.email" />
				</label>
				<p class="muted-line">{{ form.global.configPath || '尚未设置全局 Git 作者信息' }}</p>
				<button class="refresh-button" type="submit" :disabled="isSaving === 'global'">
					{{ isSaving === 'global' ? '保存中' : '保存全局配置' }}
				</button>
			</form>
		</section>
	</main>
</template>
