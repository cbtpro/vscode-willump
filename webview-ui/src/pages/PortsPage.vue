<script setup lang="ts">
import { t } from '../i18n';
import PageHeader from '../components/common/PageHeader.vue';
import FullCommandModal from '../components/ports/FullCommandModal.vue';
import PortsSummaryBar from '../components/ports/PortsSummaryBar.vue';
import PortsTable from '../components/ports/PortsTable.vue';
import usePorts from '../composables/usePorts';
import useStatusNotifications from '../composables/useStatusNotifications';

const {
	scanMode,
	viewMode,
	keyword,
	isRefreshing,
	isKilling,
	errorMessage,
	successMessage,
	isFullCommandVisible,
	fullCommandText,
	hasKeyword,
	totalCountLabel,
	totalCount,
	filteredCount,
	activeRows,
	activeColumns,
	activeAllColumns,
	activeSortKey,
	activeSortDirection,
	refreshPorts,
	handleScanModeChange,
	handleViewModeChange,
	toggleSort,
	toggleVisibleColumn,
	openFullCommand,
	handleFullCommandVisibleChange,
	handleKill
} = usePorts();

useStatusNotifications({
	title: () => t('ports.title'),
	successMessage,
	errorMessage
});
</script>

<template>
	<main class="page">
		<PageHeader :title="t('ports.title')" :subtitle="t('ports.subtitle')" :action-label="t('common.refresh')" :loading="isRefreshing" @action="refreshPorts" />

		<PortsSummaryBar
			v-model:keyword="keyword"
			:total-count-label="totalCountLabel"
			:total-count="totalCount"
			:filtered-count="filteredCount"
			:scan-mode="scanMode"
			:view-mode="viewMode"
			@change-scan-mode="handleScanModeChange"
			@change-view-mode="handleViewModeChange"
		/>

		<PortsTable
			:mode="viewMode"
			:rows="activeRows"
			:columns="activeColumns"
			:all-columns="activeAllColumns"
			:sort-key="activeSortKey"
			:sort-direction="activeSortDirection"
			:loading="isRefreshing"
			:has-keyword="hasKeyword"
			:is-killing="isKilling"
			@toggle-sort="toggleSort"
			@toggle-column="toggleVisibleColumn"
			@view-command="openFullCommand"
			@kill="handleKill"
		/>

		<FullCommandModal :visible="isFullCommandVisible" :command="fullCommandText" @update:visible="handleFullCommandVisibleChange" />
	</main>
</template>
