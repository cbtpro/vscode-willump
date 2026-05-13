<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { t } from '../i18n';
import { getVsCodeApi, type GitConfigInfo, type GitConfigScope } from '../vscode';

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
		<header class="toolbar">
			<div>
				<h1>{{ t('git.title') }}</h1>
				<p>{{ t('git.subtitle') }}</p>
			</div>
			<a-button type="primary" :loading="isLoading" @click="refreshGitConfig">{{ t('common.refresh') }}</a-button>
		</header>

		<p v-if="workspacePath" class="muted-line">{{ t('git.currentProject') }}: {{ workspacePath }}</p>
		<a-alert v-if="successMessage" type="success" :content="successMessage" />
		<a-alert v-if="errorMessage" type="error" :content="errorMessage" />

		<a-collapse :default-active-key="[]">
			<a-collapse-item key="overview" :header="t('git.sections.overview')">
				<a-table :data="workspaceRows" :pagination="false" :bordered="{ cell: true }" :scroll="{ x: 1280 }" row-key="path">
					<template #columns>
						<a-table-column :title="t('git.repo')" data-index="name" :width="140" />
						<a-table-column :title="t('git.author')" data-index="effectiveName" :width="160" />
						<a-table-column :title="t('git.email')" data-index="effectiveEmail" :width="220" />
						<a-table-column :title="t('git.branch')" data-index="branch" :width="160" />
						<a-table-column :title="t('git.upstream')" data-index="upstream" :width="180" />
						<a-table-column title="Remote" data-index="remote" :width="420" />
					</template>
				</a-table>
			</a-collapse-item>

			<a-collapse-item key="identity" :header="t('git.sections.identity')">
				<section class="config-grid">
					<a-card class="config-panel" :title="t('git.currentProjectConfig')" :bordered="false">
						<p>{{ t('git.identityPreview') }}: {{ config?.effectiveIdentity.name || '-' }} &lt;{{ config?.effectiveIdentity.email || '-' }}&gt;</p>
						<p>{{ t('git.identitySource') }}: {{ config?.effectiveIdentity.source || '-' }}</p>
						<a-alert
							:type="config?.effectiveIdentity.isGithubNoreply ? 'success' : 'warning'"
							:content="config?.effectiveIdentity.isGithubNoreply ? t('git.noreplyDetected') : t('git.noreplyTip')"
						/>
						<a-form :model="form.local" layout="vertical">
							<a-form-item :label="t('git.author')">
								<a-input v-model="form.local.name" placeholder="user.name" :disabled="!form.local.available" />
							</a-form-item>
							<a-form-item :label="t('git.email')">
								<a-input v-model="form.local.email" placeholder="user.email" :disabled="!form.local.available" />
							</a-form-item>
						</a-form>
						<a-button type="primary" :disabled="!form.local.available" :loading="isSaving === 'identity-local'" @click="saveGitConfig('local')">
							{{ t('git.saveCurrent') }}
						</a-button>
					</a-card>

					<a-card class="config-panel" :title="t('git.globalConfig')" :bordered="false">
						<a-form :model="form.global" layout="vertical">
							<a-form-item :label="t('git.author')">
								<a-input v-model="form.global.name" placeholder="user.name" />
							</a-form-item>
							<a-form-item :label="t('git.email')">
								<a-input v-model="form.global.email" placeholder="user.email" />
							</a-form-item>
						</a-form>
						<a-button type="primary" :loading="isSaving === 'identity-global'" @click="saveGitConfig('global')">{{ t('git.saveGlobal') }}</a-button>
					</a-card>
				</section>
			</a-collapse-item>

			<a-collapse-item key="templates" :header="t('git.sections.templates')">
				<section class="config-grid">
					<a-card class="config-panel" :title="t('git.templateCreate')" :bordered="false">
						<a-form :model="templateForm" layout="vertical">
							<a-form-item :label="t('git.templateName')"><a-input v-model="templateForm.name" /></a-form-item>
							<a-form-item :label="t('git.author')"><a-input v-model="templateForm.author" /></a-form-item>
							<a-form-item :label="t('git.email')"><a-input v-model="templateForm.email" /></a-form-item>
						</a-form>
						<a-button type="primary" @click="saveTemplate">{{ t('git.templateSave') }}</a-button>
					</a-card>
					<a-card class="config-panel" :title="t('git.templateList')" :bordered="false">
						<a-empty v-if="!identityTemplates.length" :description="t('git.templateEmpty')" />
						<div v-for="(template, index) in identityTemplates" :key="`${template.name}-${index}`" class="template-row">
							<div>
								<strong>{{ template.name }}</strong>
								<p>{{ template.author }} &lt;{{ template.email }}&gt;</p>
							</div>
							<a-space>
								<a-button size="small" @click="applyTemplate(template, 'local')">{{ t('git.applyLocal') }}</a-button>
								<a-button size="small" @click="applyTemplate(template, 'global')">{{ t('git.applyGlobal') }}</a-button>
								<a-button size="small" status="danger" @click="removeTemplate(index)">{{ t('common.delete') }}</a-button>
							</a-space>
						</div>
					</a-card>
				</section>
				<a-card class="config-panel" :title="t('git.noreplyGenerator')" :bordered="false">
					<a-input-search v-model="githubUsername" :button-text="t('git.useLocal')" placeholder="GitHub username" @search="useNoreplyEmail('local')" />
					<p class="muted-line">{{ generatedNoreplyEmail || t('git.noreplyGenerateTip') }}</p>
				</a-card>
			</a-collapse-item>

			<a-collapse-item key="remote" :header="t('git.sections.remote')">
				<a-descriptions :column="1" bordered>
					<a-descriptions-item :label="t('git.branch')">{{ config?.branch.current || '-' }}</a-descriptions-item>
					<a-descriptions-item :label="t('git.upstream')">{{ config?.branch.upstream || t('git.noUpstream') }}</a-descriptions-item>
				</a-descriptions>
				<a-table class="section-table" :data="remoteRows" :pagination="false" :bordered="{ cell: true }" :scroll="{ x: 760 }" row-key="name">
					<template #columns>
						<a-table-column title="Remote" data-index="name" :width="180" />
						<a-table-column title="URL" data-index="url" :width="560" />
					</template>
				</a-table>
			</a-collapse-item>

			<a-collapse-item key="policy" :header="t('git.sections.policy')">
				<section class="config-grid">
					<a-card class="config-panel" title="push.default" :bordered="false">
						<p>{{ t('git.pushDefaultTip') }}</p>
						<a-select v-model="form.pushDefault" allow-clear>
							<a-option value="simple">simple</a-option>
							<a-option value="current">current</a-option>
							<a-option value="upstream">upstream</a-option>
							<a-option value="matching">matching</a-option>
						</a-select>
						<a-button type="primary" :loading="isSaving === 'push.default'" @click="saveGitSetting('global', 'push.default', form.pushDefault)">
							{{ t('common.save') }}
						</a-button>
					</a-card>
					<a-card class="config-panel" :title="t('git.lineEndingTitle')" :bordered="false">
						<p>{{ t('git.lineEndingTip') }}</p>
						<a-form :model="form" layout="vertical">
							<a-form-item label="core.autocrlf"><a-input v-model="form.autocrlf" placeholder="input / true / false" /></a-form-item>
							<a-form-item label="core.eol"><a-input v-model="form.eol" placeholder="lf / crlf / native" /></a-form-item>
							<a-form-item label="core.ignorecase"><a-input v-model="form.ignorecase" placeholder="true / false" /></a-form-item>
						</a-form>
						<a-space wrap>
							<a-button @click="saveGitSetting('local', 'core.autocrlf', form.autocrlf)">core.autocrlf</a-button>
							<a-button @click="saveGitSetting('local', 'core.eol', form.eol)">core.eol</a-button>
							<a-button @click="saveGitSetting('local', 'core.ignorecase', form.ignorecase)">core.ignorecase</a-button>
						</a-space>
					</a-card>
					<a-card class="config-panel" :title="t('git.editorTitle')" :bordered="false">
						<p>{{ t('git.editorTip') }}</p>
						<a-input v-model="form.editor" placeholder="code --wait" />
						<a-space>
							<a-button @click="form.editor = 'code --wait'">VS Code</a-button>
							<a-button type="primary" :loading="isSaving === 'core.editor'" @click="saveGitSetting('global', 'core.editor', form.editor)">
								{{ t('common.save') }}
							</a-button>
						</a-space>
					</a-card>
				</section>
			</a-collapse-item>

			<a-collapse-item key="system" :header="t('git.sections.system')">
				<section class="config-grid">
					<a-card class="config-panel" :title="t('git.availability')" :bordered="false">
						<a-descriptions :column="1" bordered>
							<a-descriptions-item label="Git">{{ config?.git.available ? t('common.available') : t('common.unavailable') }}</a-descriptions-item>
							<a-descriptions-item :label="t('common.version')">{{ config?.git.version || '-' }}</a-descriptions-item>
							<a-descriptions-item :label="t('common.path')">{{ config?.git.path || '-' }}</a-descriptions-item>
						</a-descriptions>
					</a-card>
					<a-card class="config-panel" :title="t('git.sshStatus')" :bordered="false">
						<p>{{ t('git.publicKeys') }}: {{ config?.ssh.publicKeys.length ?? 0 }}</p>
						<p>{{ t('git.agentKeys') }}: {{ config?.ssh.agentKeys.length ?? 0 }}</p>
						<p v-for="key in config?.ssh.publicKeys" :key="key" class="muted-line">{{ key }}</p>
						<p v-if="config?.ssh.error" class="muted-line">{{ config.ssh.error }}</p>
					</a-card>
					<a-card class="config-panel" :title="t('git.hooks')" :bordered="false">
						<a-empty v-if="!hookRows.length" :description="t('git.noHooks')" />
						<a-table v-else :data="hookRows" :pagination="false" :bordered="{ cell: true }" row-key="name">
							<template #columns>
								<a-table-column :title="t('common.name')" data-index="name" />
								<a-table-column :title="t('git.executable')" data-index="executable" />
							</template>
						</a-table>
					</a-card>
					<a-card class="config-panel" title="Git LFS" :bordered="false">
						<a-descriptions :column="1" bordered>
							<a-descriptions-item label="LFS">{{ config?.lfs.available ? t('common.available') : t('common.unavailable') }}</a-descriptions-item>
							<a-descriptions-item :label="t('common.version')">{{ config?.lfs.version || '-' }}</a-descriptions-item>
							<a-descriptions-item :label="t('git.enabled')">{{ config?.lfs.enabled ? 'Yes' : 'No' }}</a-descriptions-item>
						</a-descriptions>
					</a-card>
				</section>
			</a-collapse-item>
		</a-collapse>
	</main>
</template>
