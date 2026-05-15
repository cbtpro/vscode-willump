<script setup lang="ts">
import { defineProps } from 'vue';
import { t } from '../../i18n';

const props = defineProps<{
	config: any;
	hookRows: Array<any>;
}>();
</script>

<template>
	<section class="config-grid">
		<a-card class="config-panel" :title="t('git.availability')" :bordered="false">
			<a-descriptions :column="1" bordered>
				<a-descriptions-item label="Git">{{ props.config?.git.available ? t('common.available') : t('common.unavailable') }}</a-descriptions-item>
				<a-descriptions-item :label="t('common.version')">{{ props.config?.git.version || '-' }}</a-descriptions-item>
				<a-descriptions-item :label="t('common.path')">{{ props.config?.git.path || '-' }}</a-descriptions-item>
			</a-descriptions>
		</a-card>

		<a-card class="config-panel" :title="t('git.sshStatus')" :bordered="false">
			<p>{{ t('git.publicKeys') }}: {{ props.config?.ssh.publicKeys.length ?? 0 }}</p>
			<p>{{ t('git.agentKeys') }}: {{ props.config?.ssh.agentKeys.length ?? 0 }}</p>
			<p v-for="key in props.config?.ssh.publicKeys" :key="key" class="muted-line">{{ key }}</p>
			<p v-if="props.config?.ssh.error" class="muted-line">{{ props.config.ssh.error }}</p>
		</a-card>

		<a-card class="config-panel" :title="t('git.hooks')" :bordered="false">
			<a-empty v-if="!props.hookRows.length" :description="t('git.noHooks')" />
			<a-table v-else :data="props.hookRows" :pagination="false" :bordered="{ cell: true }" row-key="name">
				<template #columns>
					<a-table-column :title="t('common.name')" data-index="name" />
					<a-table-column :title="t('git.executable')" data-index="executable" />
				</template>
			</a-table>
		</a-card>

		<a-card class="config-panel" title="Git LFS" :bordered="false">
			<a-descriptions :column="1" bordered>
				<a-descriptions-item label="LFS">{{ props.config?.lfs.available ? t('common.available') : t('common.unavailable') }}</a-descriptions-item>
				<a-descriptions-item :label="t('common.version')">{{ props.config?.lfs.version || '-' }}</a-descriptions-item>
				<a-descriptions-item :label="t('git.enabled')">{{ props.config?.lfs.enabled ? 'Yes' : 'No' }}</a-descriptions-item>
			</a-descriptions>
		</a-card>
	</section>
</template>
