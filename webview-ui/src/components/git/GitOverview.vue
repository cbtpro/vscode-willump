<script setup lang="ts">
import { defineProps } from 'vue';
import { t } from '../../i18n';

const props = defineProps<{ workspaces: Array<any> }>();
</script>

<template>
	<a-card class="config-panel" :title="t('git.sections.overview')" :bordered="false">
		<a-table :data="props.workspaces" :pagination="false" :bordered="{ cell: true }" :scroll="{ x: 1280 }" row-key="path">
			<template #columns>
				<a-table-column :title="t('git.repo')" data-index="name" :width="140" />
				<a-table-column :title="t('git.author')" data-index="effectiveName" :width="160" />
				<a-table-column :title="t('git.email')" data-index="effectiveEmail" :width="220" />
				<a-table-column :title="t('git.branch')" data-index="branch" :width="160" />
				<a-table-column :title="t('git.upstream')" data-index="upstream" :width="180" />
				<a-table-column title="Remote" data-index="remote" :width="420" />
			</template>
		</a-table>
	</a-card>
</template>
