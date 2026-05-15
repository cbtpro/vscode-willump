<script setup lang="ts">
import { t } from '../i18n';
import PageHeader from '../components/common/PageHeader.vue';
import StatusAlerts from '../components/common/StatusAlerts.vue';
import FullCommandModal from '../components/ports/FullCommandModal.vue';
import PortKillConfirmModal from '../components/ports/PortKillConfirmModal.vue';
import PortsSummaryBar from '../components/ports/PortsSummaryBar.vue';
import PortsTable from '../components/ports/PortsTable.vue';
import usePorts from '../composables/usePorts';

const {
	ports,
	scanMode,
	viewMode,
	keyword,
	isRefreshing,
	isKilling,
	errorMessage,
	successMessage,
	pendingKill,
	isFullCommandVisible,
	fullCommandText,
	visibleColumnKeys,
	visibleProcessColumnKeys,
	sortState,
	processSortState,
	isKillConfirmVisible,
	filteredPorts,
	hasKeyword,
	processRows,
	filteredProcessRows,
	totalCountLabel,
	totalCount,
	filteredCount,
	portColumns,
	processColumns,
	visiblePortColumns,
	visibleProcessColumns,
	tableRows,
	processTableRows,
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
	handleKill,
	confirmKillPort,
	closeKillConfirm
} = usePorts();
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

		<StatusAlerts :success-message="successMessage" :error-message="errorMessage" />

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

		<PortKillConfirmModal v-model:visible="isKillConfirmVisible" :target="pendingKill" :is-killing="isKilling" @confirm="confirmKillPort" />
		<FullCommandModal :visible="isFullCommandVisible" :command="fullCommandText" @update:visible="handleFullCommandVisibleChange" />
	</main>
</template>
