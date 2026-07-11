<script setup lang="ts">
import IconCopy from '@arco-design/web-vue/es/icon/icon-copy';
import { t } from '../../i18n';
import CopyableValue from './CopyableValue.vue';
import InfoDescriptionCard from './InfoDescriptionCard.vue';
import type { GpuDisplayRow, InfoRow, LocalIpRow, PublicIpRow } from './types';

defineProps<{
	basicRows: InfoRow[];
	cpuRows: InfoRow[];
	memoryRows: InfoRow[];
	publicIpRows: PublicIpRow[];
	ipv6Rows: InfoRow[];
	localIpRows: LocalIpRow[];
	gpuRows: GpuDisplayRow[];
}>();

defineEmits<{
	copy: [value: string];
}>();

function renderIpAddress(record: LocalIpRow) {
	return record.cidr ?? record.address;
}
</script>

<template>
	<section class="system-info-grid">
		<InfoDescriptionCard :title="t('system.basic')" :rows="basicRows" copyable @copy="$emit('copy', $event)" />

		<InfoDescriptionCard :title="t('system.cpu')" :rows="cpuRows" />

		<InfoDescriptionCard :title="t('system.memory')" :rows="memoryRows" />

		<a-card class="config-panel" :title="t('system.publicIp')" :bordered="false">
			<a-descriptions :column="1" bordered>
				<a-descriptions-item v-for="row in publicIpRows" :key="row.key" :label="row.label">
					<CopyableValue :value="row.value" :copy-value="row.copyValue" @copy="$emit('copy', $event)">
						<small v-if="!row.available && row.error" class="muted-inline">{{ row.error }}</small>
					</CopyableValue>
				</a-descriptions-item>
				<a-descriptions-item v-for="row in ipv6Rows" :key="row.key" :label="row.label">
					<a-tag :color="row.value === t('common.yes') ? 'green' : 'gray'">{{ row.value }}</a-tag>
				</a-descriptions-item>
			</a-descriptions>
		</a-card>
	</section>

	<a-card class="config-panel" :title="t('system.network')" :bordered="false">
		<a-table :data="localIpRows" :pagination="false" :bordered="{ cell: true }" row-key="id">
			<template #columns>
				<a-table-column :title="t('system.interfaceName')" data-index="interfaceName" :width="180" />
				<a-table-column :title="t('system.family')" data-index="family" :width="100" />
				<a-table-column :title="t('system.address')">
					<template #cell="{ record }">
						<span class="copyable-value">
							<span>{{ renderIpAddress(record) }}</span>
							<a-tooltip :content="t('common.copy')">
								<a-button type="text" size="mini" @click="$emit('copy', record.address)">
									<template #icon><IconCopy /></template>
								</a-button>
							</a-tooltip>
						</span>
					</template>
				</a-table-column>
			</template>
			<template #empty>
				<a-empty :description="t('system.emptyAddress')" />
			</template>
		</a-table>
	</a-card>

	<a-card class="config-panel" :title="t('system.gpu')" :bordered="false">
		<a-table :data="gpuRows" :pagination="false" :bordered="{ cell: true }" row-key="id">
			<template #columns>
				<a-table-column :title="t('system.gpuName')" data-index="name" />
				<a-table-column :title="t('system.gpuVendor')" data-index="vendor" :width="180" />
				<a-table-column :title="t('system.gpuMemory')" data-index="memoryText" :width="140" />
				<a-table-column :title="t('system.gpuDriver')" data-index="driverVersion" :width="180" />
			</template>
			<template #empty>
				<a-empty :description="t('system.noGpuData')" />
			</template>
		</a-table>
	</a-card>
</template>

<style scoped>
.system-info-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16px;
	margin-bottom: 16px;
}

.copyable-value {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	max-width: 100%;
	word-break: break-all;
}

.muted-inline {
	display: block;
	margin-top: 4px;
	color: var(--willump-text-muted);
}

@media (max-width: 760px) {
	.system-info-grid {
		grid-template-columns: 1fr;
	}
}
</style>
