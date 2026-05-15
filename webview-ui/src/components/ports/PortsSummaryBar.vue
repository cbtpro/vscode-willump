<script setup lang="ts">
import { t } from '../../i18n';
import type { PortScanMode } from '../../vscode';
import type { PortViewMode } from './ports.types';

defineProps<{
	totalCountLabel: string;
	totalCount: number;
	filteredCount: number;
	scanMode: PortScanMode;
	viewMode: PortViewMode;
	keyword: string;
}>();

const emit = defineEmits<{
	'update:keyword': [value: string];
	'change-scan-mode': [value: string | number | boolean];
	'change-view-mode': [value: string | number | boolean];
}>();
</script>

<template>
	<a-card class="summary" :bordered="false">
		<div>
			<span class="summary-label">{{ totalCountLabel }}</span>
			<strong>{{ totalCount }}</strong>
		</div>
		<div>
			<span class="summary-label">{{ t('ports.filterCount') }}</span>
			<strong>{{ filteredCount }}</strong>
		</div>
		<a-radio-group :model-value="scanMode" type="button" @change="value => emit('change-scan-mode', value)">
			<a-radio value="listening">{{ t('ports.listening') }}</a-radio>
			<a-radio value="all">{{ t('ports.allConnections') }}</a-radio>
		</a-radio-group>
		<a-radio-group :model-value="viewMode" type="button" @change="value => emit('change-view-mode', value)">
			<a-radio value="connections">{{ t('ports.connectionDetails') }}</a-radio>
			<a-radio value="processes">{{ t('ports.processAggregation') }}</a-radio>
		</a-radio-group>
		<a-input-search
			:model-value="keyword"
			class="search"
			allow-clear
			:placeholder="t('ports.searchPlaceholder')"
			@update:model-value="value => emit('update:keyword', String(value))"
		/>
	</a-card>
</template>
