<script setup lang="ts">
import IconSort from '@arco-design/web-vue/es/icon/icon-sort';
import IconSortAscending from '@arco-design/web-vue/es/icon/icon-sort-ascending';
import IconSortDescending from '@arco-design/web-vue/es/icon/icon-sort-descending';
import { computed, toRef } from 'vue';
import useTableSort from '../../composables/useTableSort';
import ColumnSettingsDropdown from './ColumnSettingsDropdown.vue';
import { t } from '../../i18n';
import type { PortTableColumn, PortTableRow, PortViewMode, SortDirection } from './ports.types';

const props = defineProps<{
	mode: PortViewMode;
	rows: PortTableRow[];
	columns: PortTableColumn[];
	allColumns: PortTableColumn[];
	sortKey: string;
	sortDirection: SortDirection;
	loading: boolean;
	hasKeyword: boolean;
	isKilling: boolean;
}>();

const emit = defineEmits<{
	'toggle-sort': [key: string];
	'toggle-column': [key: string, checked: string | number | boolean];
	'view-command': [command: string];
	kill: [record: PortTableRow];
}>();

const emptyDescription = computed(() => {
	if (props.hasKeyword) {
		return t('ports.noMatch');
	}

	return props.mode === 'processes' ? t('ports.noProcessData') : t('ports.empty');
});

const killOkButtonProps = { type: 'primary' as const, status: 'danger' as const };
const { getSortIcon } = useTableSort(toRef(props, 'sortKey'), toRef(props, 'sortDirection'));

function isKillDisabled(record: PortTableRow) {
	return props.isKilling || (props.mode === 'processes' && !/^\d+$/.test(record.pid));
}

function getKillPort(record: PortTableRow) {
	return 'ports' in record ? record.ports || '-' : record.port;
}
</script>

<template>
	<a-table :data="rows" :loading="loading" :pagination="false" :bordered="{ cell: true }" :scroll="{ x: 1240 }" row-key="rowId">
		<template #columns>
			<a-table-column v-for="column in columns" :key="column.key" :data-index="column.key" :width="column.width">
				<template #title>
					<button class="table-header-button" type="button" @click="emit('toggle-sort', column.key)">
						<span>{{ column.title }}</span>
						<component :is="getSortIcon(column.key)" />
					</button>
				</template>
			</a-table-column>
			<a-table-column :width="120" align="right">
				<template #title>
					<div class="table-action-header">
						<span>{{ t('ports.action') }}</span>
						<ColumnSettingsDropdown :all-columns="allColumns" :current-columns="columns" @toggle-column="(key, checked) => emit('toggle-column', key, checked)" />
					</div>
				</template>
				<template #cell="{ record }">
					<a-space>
						<a-button v-if="record.commandFull" type="text" size="small" @click="emit('view-command', record.commandFull)">
							{{ t('ports.view') }}
						</a-button>
						<a-popconfirm
							v-if="!isKillDisabled(record)"
							type="warning"
							position="left"
							:ok-text="t('ports.confirmKill')"
							:cancel-text="t('common.cancel')"
							:ok-button-props="killOkButtonProps"
							@ok="emit('kill', record)"
						>
							<template #content>
								<div class="kill-confirm-content">
									<strong>{{ t('ports.confirmKillTitle') }}</strong>
									<p>{{ t('ports.confirmKillDescription') }}</p>
									<p>{{ t('ports.port') }}: {{ getKillPort(record) }} / {{ t('ports.pid') }}: {{ record.pid }}</p>
								</div>
							</template>
							<a-button type="text" status="danger" size="small">
								{{ t('ports.kill') }}
							</a-button>
						</a-popconfirm>
						<a-button v-else type="text" status="danger" size="small" disabled>
							{{ t('ports.kill') }}
						</a-button>
					</a-space>
				</template>
			</a-table-column>
		</template>
		<template #empty>
			<a-empty :description="emptyDescription" />
		</template>
	</a-table>
</template>

<style scoped>
.table-action-header a-button {
	margin-left: 4px;
}

.kill-confirm-content {
	max-width: 280px;
}

.kill-confirm-content p {
	margin: 4px 0 0;
}
</style>
