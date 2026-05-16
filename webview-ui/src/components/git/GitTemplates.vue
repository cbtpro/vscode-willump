<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import { t } from '../../i18n';

const props = defineProps<{
	identityTemplates: Array<any>;
	templateForm: any;
	githubUsername: string;
	generatedNoreplyEmail: string;
}>();

const emit = defineEmits<{
	(e: 'save-template'): void;
	(e: 'apply-template', template: any, scope: 'local'|'global'): void;
	(e: 'remove-template', index: number): void;
	(e: 'use-noreply', scope: 'local'|'global'): void;
}>();
</script>

<template>
	<section class="config-grid">
		<a-card class="config-panel" :title="t('git.templateCreate')" :bordered="false">
			<a-form :model="props.templateForm" layout="vertical">
				<a-form-item :label="t('git.templateName')"><a-input v-model="props.templateForm.name" /></a-form-item>
				<a-form-item :label="t('git.author')"><a-input v-model="props.templateForm.author" /></a-form-item>
				<a-form-item :label="t('git.email')"><a-input v-model="props.templateForm.email" /></a-form-item>
			</a-form>
			<a-button type="primary" @click="$emit('save-template')">{{ t('git.templateSave') }}</a-button>
		</a-card>

		<a-card class="config-panel" :title="t('git.templateList')" :bordered="false">
			<a-empty v-if="!props.identityTemplates.length" :description="t('git.templateEmpty')" />
			<div v-for="(template, index) in props.identityTemplates" :key="`${template.name}-${index}`" class="template-row">
				<div>
					<strong>{{ template.name }}</strong>
					<p>{{ template.author }} &lt;{{ template.email }}&gt;</p>
				</div>
				<a-space>
					<a-button size="small" @click="$emit('apply-template', template, 'local')">{{ t('git.applyLocal') }}</a-button>
					<a-button size="small" @click="$emit('apply-template', template, 'global')">{{ t('git.applyGlobal') }}</a-button>
					<a-popconfirm type="warning" position="left" :ok-text="t('common.delete')" :cancel-text="t('common.cancel')" @ok="$emit('remove-template', index)">
						<template #content>
							{{ t('common.delete') }} {{ template.name }}?
						</template>
						<a-button size="small" status="danger">{{ t('common.delete') }}</a-button>
					</a-popconfirm>
				</a-space>
			</div>
		</a-card>

		<a-card class="config-panel" :title="t('git.noreplyGenerator')" :bordered="false">
			<a-input-search v-model="props.githubUsername" :button-text="t('git.useLocal')" placeholder="GitHub username" @search="$emit('use-noreply','local')" />
			<p class="muted-line">{{ props.generatedNoreplyEmail || t('git.noreplyGenerateTip') }}</p>
		</a-card>
	</section>
</template>
