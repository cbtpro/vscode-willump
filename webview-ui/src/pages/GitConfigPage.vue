<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { t } from '../i18n';
import { getVsCodeApi, type GitConfigInfo, type GitConfigScope } from '../vscode';
import GitOverview from '../components/git/GitOverview.vue';
import GitIdentity from '../components/git/GitIdentity.vue';
import GitTemplates from '../components/git/GitTemplates.vue';
import GitRemote from '../components/git/GitRemote.vue';
import GitPolicy from '../components/git/GitPolicy.vue';
import GitSystem from '../components/git/GitSystem.vue';
import PageHeader from '../components/common/PageHeader.vue';
import useStatusNotifications from '../composables/useStatusNotifications';

interface GitMessage {
	type: 'gitConfigUpdated' | 'gitConfigSaved';
	success: boolean;
	config?: GitConfigInfo;
	scope?: 'local' | 'global';
	message?: string;
}

interface IdentityTemplate {
	name: string;
	author: string;
	email: string;
}

const vscode = getVsCodeApi();
const isLoading = ref(false);
const isSaving = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const workspacePath = ref('');
const githubUsername = ref('');
const identityTemplates = ref<IdentityTemplate[]>(loadTemplates());
const templateForm = reactive({
	name: '',
	author: '',
	email: ''
});
const config = ref<GitConfigInfo | null>(null);
const form = reactive({
	local: createEmptyScope(),
	global: createEmptyScope(),
	pushDefault: '',
	autocrlf: '',
	eol: '',
	ignorecase: '',
	editor: ''
});

const generatedNoreplyEmail = computed(() => {
	const username = githubUsername.value.trim();
	return username ? `${username}@users.noreply.github.com` : '';
});
const workspaceRows = computed(() => config.value?.workspaces ?? []);
const remoteRows = computed(() => config.value?.remote.remotes ?? []);
const hookRows = computed(() => config.value?.hooks ?? []);

useStatusNotifications({
	title: () => t('git.title'),
	successMessage,
	errorMessage
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
	isSaving.value = `identity-${scope}`;
	errorMessage.value = '';
	successMessage.value = '';
	vscode?.postMessage({
		type: 'updateGitConfig',
		scope,
		name: form[scope].name,
		email: form[scope].email
	});
}

function saveGitSetting(scope: 'local' | 'global', key: string, value: string) {
	isSaving.value = key;
	errorMessage.value = '';
	successMessage.value = '';
	vscode?.postMessage({
		type: 'updateGitSetting',
		scope,
		key,
		value
	});
}

function applyTemplate(template: IdentityTemplate, scope: 'local' | 'global') {
	form[scope].name = template.author;
	form[scope].email = template.email;
	saveGitConfig(scope);
}

function saveTemplate() {
	if (!templateForm.name || !templateForm.author || !templateForm.email) {
		return;
	}

	identityTemplates.value = [
		...identityTemplates.value,
		{
			name: templateForm.name,
			author: templateForm.author,
			email: templateForm.email
		}
	];
	localStorage.setItem('willump.gitIdentityTemplates', JSON.stringify(identityTemplates.value));
	templateForm.name = '';
	templateForm.author = '';
	templateForm.email = '';
}

function removeTemplate(index: number) {
	identityTemplates.value = identityTemplates.value.filter((_, currentIndex) => currentIndex !== index);
	localStorage.setItem('willump.gitIdentityTemplates', JSON.stringify(identityTemplates.value));
}

function useNoreplyEmail(scope: 'local' | 'global') {
	if (!generatedNoreplyEmail.value) {
		return;
	}

	form[scope].email = generatedNoreplyEmail.value;
	saveGitConfig(scope);
}

function applyConfig(nextConfig: GitConfigInfo) {
	config.value = nextConfig;
	workspacePath.value = nextConfig.workspacePath;
	form.local = { ...nextConfig.local };
	form.global = { ...nextConfig.global };
	form.pushDefault = nextConfig.pushDefault;
	form.autocrlf = nextConfig.lineEnding.autocrlf;
	form.eol = nextConfig.lineEnding.eol;
	form.ignorecase = nextConfig.lineEnding.ignorecase;
	form.editor = nextConfig.editor;
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
			successMessage.value = t('git.saveSuccess');
			return;
		}

		errorMessage.value = message.message ?? t('git.saveFailed');
	}
}

function loadTemplates(): IdentityTemplate[] {
	try {
		const value = localStorage.getItem('willump.gitIdentityTemplates');
		return value ? JSON.parse(value) : [];
	} catch (err) {
		return [];
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
		<PageHeader :title="t('git.title')" :subtitle="t('git.subtitle')" :action-label="t('common.refresh')" :loading="isLoading" @action="refreshGitConfig" />

		<a-collapse :default-active-key="[]">
			<a-collapse-item key="overview" :header="t('git.sections.overview')">
				<GitOverview :workspaces="workspaceRows" />
			</a-collapse-item>

			<a-collapse-item key="identity" :header="t('git.sections.identity')">
				<GitIdentity :form="form" :config="config" :is-saving="isSaving" @save="saveGitConfig" />
			</a-collapse-item>

			<a-collapse-item key="templates" :header="t('git.sections.templates')">
				<GitTemplates
					:identity-templates="identityTemplates"
					:template-form="templateForm"
					:github-username="githubUsername"
					:generated-noreply-email="generatedNoreplyEmail"
					@save-template="saveTemplate"
					@apply-template="applyTemplate"
					@remove-template="removeTemplate"
					@use-noreply="useNoreplyEmail"
				/>
			</a-collapse-item>

			<a-collapse-item key="remote" :header="t('git.sections.remote')">
				<GitRemote :remote-rows="remoteRows" :branch="config?.branch" />
			</a-collapse-item>

			<a-collapse-item key="policy" :header="t('git.sections.policy')">
				<GitPolicy :form="form" :is-saving="isSaving" :save-setting="saveGitSetting" />
			</a-collapse-item>

			<a-collapse-item key="system" :header="t('git.sections.system')">
				<GitSystem :config="config" :hook-rows="hookRows" />
			</a-collapse-item>
		</a-collapse>
	</main>
</template>
