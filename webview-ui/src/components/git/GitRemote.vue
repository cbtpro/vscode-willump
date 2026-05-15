<script setup lang="ts">
import { defineProps } from 'vue';
import { t } from '../../i18n';

const props = defineProps<{
	remoteRows: Array<{ name: string; url: string }>;
	branch: { current?: string; upstream?: string } | undefined;
}>();
</script>

<template>
	<a-card class="config-panel" :title="t('git.sections.remote')" :bordered="false">
		<a-descriptions :column="1" bordered>
			<a-descriptions-item :label="t('git.branch')">{{ props.branch?.current || '-' }}</a-descriptions-item>
			<a-descriptions-item :label="t('git.upstream')">{{ props.branch?.upstream || '-' }}</a-descriptions-item>
		</a-descriptions>

		<a-table class="section-table" :data="props.remoteRows" :pagination="false" :bordered="{ cell: true }" :scroll="{ x: 760 }" row-key="name">
			<template #columns>
				<a-table-column title="Remote" data-index="name" :width="180" />
				<a-table-column title="URL" data-index="url" :width="560" />
			</template>
		</a-table>
	</a-card>
</template>
