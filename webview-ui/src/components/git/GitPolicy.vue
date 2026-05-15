<script setup lang="ts">
import { defineProps } from 'vue';
import { t } from '../../i18n';

const props = defineProps<{
	form: any;
	isSaving: string;
	saveSetting: (scope: string, key: string, value: string) => void;
	saveEditor?: (value: string) => void;
}>();
</script>

<template>
	<section class="config-grid">
		<a-card class="config-panel" title="push.default" :bordered="false">
			<p>{{ t('git.pushDefaultTip') }}</p>
			<a-select v-model="props.form.pushDefault" allow-clear>
				<a-option value="simple">simple</a-option>
				<a-option value="current">current</a-option>
				<a-option value="upstream">upstream</a-option>
				<a-option value="matching">matching</a-option>
			</a-select>
			<a-button type="primary" :loading="props.isSaving === 'push.default'" @click="props.saveSetting('global', 'push.default', props.form.pushDefault)">
				{{ t('common.save') }}
			</a-button>
		</a-card>

		<a-card class="config-panel" :title="t('git.lineEndingTitle')" :bordered="false">
			<p>{{ t('git.lineEndingTip') }}</p>
			<a-form :model="props.form" layout="vertical">
				<a-form-item label="core.autocrlf"><a-input v-model="props.form.autocrlf" placeholder="input / true / false" /></a-form-item>
				<a-form-item label="core.eol"><a-input v-model="props.form.eol" placeholder="lf / crlf / native" /></a-form-item>
				<a-form-item label="core.ignorecase"><a-input v-model="props.form.ignorecase" placeholder="true / false" /></a-form-item>
			</a-form>
			<a-space wrap>
				<a-button @click="props.saveSetting('local', 'core.autocrlf', props.form.autocrlf)">core.autocrlf</a-button>
				<a-button @click="props.saveSetting('local', 'core.eol', props.form.eol)">core.eol</a-button>
				<a-button @click="props.saveSetting('local', 'core.ignorecase', props.form.ignorecase)">core.ignorecase</a-button>
			</a-space>
		</a-card>

		<a-card class="config-panel" :title="t('git.editorTitle')" :bordered="false">
			<p>{{ t('git.editorTip') }}</p>
			<a-input v-model="props.form.editor" placeholder="code --wait" />
			<a-space>
				<a-button @click="props.form.editor = 'code --wait'">VS Code</a-button>
				<a-button type="primary" :loading="props.isSaving === 'core.editor'" @click="props.saveSetting('global', 'core.editor', props.form.editor)">
					{{ t('common.save') }}
				</a-button>
			</a-space>
		</a-card>
	</section>
</template>
