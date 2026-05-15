<script setup lang="ts">
import IconSettings from '@arco-design/web-vue/es/icon/icon-settings';
import IconSort from '@arco-design/web-vue/es/icon/icon-sort';
import IconSortAscending from '@arco-design/web-vue/es/icon/icon-sort-ascending';
import IconSortDescending from '@arco-design/web-vue/es/icon/icon-sort-descending';
import { computed } from 'vue';
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

function getSortIcon(key: string) {
	if (props.sortKey !== key || !props.sortDirection) {
		return IconSort;
	}

	return props.sortDirection === 'asc' ? IconSortAscending : IconSortDescending;
}

function isColumnVisible(key: string) {
	return props.columns.some(column => column.key === key);
}

function isKillDisabled(record: PortTableRow) {
	return props.isKilling || (props.mode === 'processes' && !/^\d+$/.test(record.pid));
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
						<a-dropdown trigger="click" position="br">
							<a-button type="text" size="small" :title="t('ports.columnSettings')">
								<IconSettings />
							</a-button>
							<template #content>
								<div class="column-menu">
									<a-checkbox
										v-for="column in allColumns"
										:key="column.key"
										:model-value="isColumnVisible(column.key)"
										@change="checked => emit('toggle-column', column.key, checked)"
									>
										{{ column.title }}
									</a-checkbox>
								</div>
							</template>
						</a-dropdown>
					</div>
				</template>
				<template #cell="{ record }">
					<a-space>
						<a-button v-if="record.commandFull" type="text" size="small" @click="emit('view-command', record.commandFull)">
							{{ t('ports.view') }}
						</a-button>
						<a-button type="text" status="danger" size="small" :disabled="isKillDisabled(record)" @click="emit('kill', record)">
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
</style>
