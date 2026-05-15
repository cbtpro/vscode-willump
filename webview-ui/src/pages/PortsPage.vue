<script setup lang="ts">
import IconCheck from '@arco-design/web-vue/es/icon/icon-check';
import IconCopy from '@arco-design/web-vue/es/icon/icon-copy';
import IconSettings from '@arco-design/web-vue/es/icon/icon-settings';
import IconSort from '@arco-design/web-vue/es/icon/icon-sort';
import IconSortAscending from '@arco-design/web-vue/es/icon/icon-sort-ascending';
import IconSortDescending from '@arco-design/web-vue/es/icon/icon-sort-descending';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { t } from '../i18n';
import { getVsCodeApi, type PortInfo, type PortScanMode } from '../vscode';

interface WebviewMessage {
	type: 'portsUpdated' | 'killResult' | 'error';
	ports?: PortInfo[];
	mode?: PortScanMode;
	success?: boolean;
	port?: string;
	pid?: string;
	message?: string;
}

type PortColumnKey = 'port' | 'type' | 'localAddress' | 'listenAddress' | 'pid' | 'command' | 'processPath' | 'commandFull';
type ProcessColumnKey = 'command' | 'pid' | 'ports' | 'protocols' | 'connectionCount' | 'processPath' | 'commandFull';
type SortDirection = 'asc' | 'desc' | '';
type PortViewMode = 'connections' | 'processes';
type CopyState = 'idle' | 'success' | 'error';

interface KillTarget {
	port: string;
	pid: string;
	command: string;
}

interface NetworkProcessRow {
	rowId: string;
	pid: string;
	command: string;
	ports: string;
	protocols: string;
	connectionCount: number;
	processPath: string;
	commandFull: string;
}

const vscode = getVsCodeApi();
const initialPorts = window.__WILLUMP_INITIAL_STATE__?.ports ?? [];
const initialMode = window.__WILLUMP_INITIAL_STATE__?.portScanMode ?? 'listening';
const ports = ref<PortInfo[]>(initialPorts);
const scanMode = ref<PortScanMode>(initialMode);
const viewMode = ref<PortViewMode>('connections');
const keyword = ref('');
const isRefreshing = ref(false);
const isKilling = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const pendingKill = ref<KillTarget | null>(null);
const isFullCommandVisible = ref(false);
const fullCommandText = ref('');
const isCopyingFullCommand = ref(false);
const fullCommandCopyState = ref<CopyState>('idle');
const visibleColumnKeys = ref<PortColumnKey[]>(['port', 'type', 'localAddress', 'listenAddress', 'pid', 'command']);
const visibleProcessColumnKeys = ref<ProcessColumnKey[]>(['command', 'pid', 'ports', 'protocols', 'connectionCount']);
const sortState = ref<{ key: PortColumnKey; direction: SortDirection }>({
	key: 'port',
	direction: ''
});
const processSortState = ref<{ key: ProcessColumnKey; direction: SortDirection }>({
	key: 'connectionCount',
	direction: 'desc'
});
let fullCommandCopyResetTimer: ReturnType<typeof setTimeout> | undefined;
const isKillConfirmVisible = computed({
	get: () => Boolean(pendingKill.value),
	set: visible => {
		if (!visible) {
			closeKillConfirm();
		}
	}
});

const filteredPorts = computed(() => {
	const value = keyword.value.trim().toLowerCase();

	if (!value) {
		return ports.value;
	}

	return ports.value.filter(item =>
		[item.port, item.pid, item.command, item.type, item.localAddress, item.listenAddress, item.processPath ?? '', item.commandFull ?? ''].some(field =>
			field.toLowerCase().includes(value)
		)
	);
});

const hasKeyword = computed(() => keyword.value.trim().length > 0);
const processRows = computed(() => aggregateNetworkProcesses(ports.value));
const filteredProcessRows = computed(() => {
	const value = keyword.value.trim().toLowerCase();

	if (!value) {
		return processRows.value;
	}

	return processRows.value.filter(item =>
		[item.command, item.pid, item.ports, item.protocols, item.processPath, item.commandFull, String(item.connectionCount)].some(field =>
			field.toLowerCase().includes(value)
		)
	);
});
const totalCountLabel = computed(() => (viewMode.value === 'processes' ? t('ports.processCount') : t('ports.occupiedCount')));
const totalCount = computed(() => (viewMode.value === 'processes' ? processRows.value.length : ports.value.length));
const filteredCount = computed(() => (viewMode.value === 'processes' ? filteredProcessRows.value.length : filteredPorts.value.length));
const fullCommandCopyFeedback = computed(() => {
	if (fullCommandCopyState.value === 'success') {
		return { type: 'success' as const, content: t('ports.copySuccess') };
	}

	if (fullCommandCopyState.value === 'error') {
		return { type: 'error' as const, content: t('ports.copyFailed') };
	}

	return null;
});
const fullCommandCopyButtonText = computed(() => {
	if (isCopyingFullCommand.value) {
		return t('ports.copying');
	}

	if (fullCommandCopyState.value === 'success') {
		return t('ports.copied');
	}

	return t('common.copy');
});
const portColumns = computed<Array<{ key: PortColumnKey; title: string; width?: number }>>(() => [
	{ key: 'port', title: t('ports.port'), width: 110 },
	{ key: 'type', title: t('ports.type'), width: 160 },
	{ key: 'localAddress', title: t('ports.localAddress'), width: 220 },
	{ key: 'listenAddress', title: t('ports.listenAddress'), width: 180 },
	{ key: 'pid', title: t('ports.pid'), width: 120 },
	{ key: 'command', title: t('ports.command') },
	{ key: 'processPath', title: t('ports.processPath'), width: 260 },
	{ key: 'commandFull', title: t('ports.startCommand'), width: 420 }
]);
const processColumns = computed<Array<{ key: ProcessColumnKey; title: string; width?: number }>>(() => [
	{ key: 'command', title: t('ports.command') },
	{ key: 'pid', title: t('ports.pid'), width: 120 },
	{ key: 'ports', title: t('ports.ports'), width: 220 },
	{ key: 'protocols', title: t('ports.protocols'), width: 180 },
	{ key: 'connectionCount', title: t('ports.connectionCount'), width: 140 },
	{ key: 'processPath', title: t('ports.processPath'), width: 260 },
	{ key: 'commandFull', title: t('ports.startCommand'), width: 420 }
]);
const visiblePortColumns = computed(() => portColumns.value.filter(column => isColumnVisible(column.key)));
const visibleProcessColumns = computed(() => processColumns.value.filter(column => isProcessColumnVisible(column.key)));
const tableRows = computed(() =>
	sortPorts(filteredPorts.value).map(item => ({
		...item,
		rowId: `${item.type}-${item.localAddress}-${item.port}-${item.pid}-${item.command}`
	}))
);
const processTableRows = computed(() => sortProcessRows(filteredProcessRows.value));

function sortPorts(items: PortInfo[]) {
	if (!sortState.value.direction) {
		return items;
	}

	return [...items].sort((left, right) => {
		const result = compareColumnValue(left[sortState.value.key], right[sortState.value.key], sortState.value.key);
		return sortState.value.direction === 'asc' ? result : -result;
	});
}

function sortProcessRows(items: NetworkProcessRow[]) {
	if (!processSortState.value.direction) {
		return items;
	}

	return [...items].sort((left, right) => {
		const result = compareColumnValue(left[processSortState.value.key], right[processSortState.value.key], processSortState.value.key);
		return processSortState.value.direction === 'asc' ? result : -result;
	});
}

function compareColumnValue(left: string | number, right: string | number, key: PortColumnKey | ProcessColumnKey) {
	if (key === 'port' || key === 'pid' || key === 'connectionCount') {
		return Number(left) - Number(right);
	}

	return String(left).localeCompare(String(right));
}

function aggregateNetworkProcesses(items: PortInfo[]): NetworkProcessRow[] {
	const rows = new Map<string, { pid: string; command: string; ports: Set<string>; protocols: Set<string>; connectionCount: number; processPath: string; commandFull: string }>();

	for (const item of items) {
		const pid = item.pid || '-';
		const command = item.command || 'Unknown';
		const key = `${pid}-${command}`;
		const row = rows.get(key) ?? {
			pid,
			command,
			ports: new Set<string>(),
			protocols: new Set<string>(),
			connectionCount: 0,
			processPath: item.processPath ?? '',
			commandFull: item.commandFull ?? ''
		};

		if (item.port) {
			row.ports.add(item.port);
		}

		const protocol = getProtocol(item.type);
		if (protocol) {
			row.protocols.add(protocol);
		}

		row.processPath ||= item.processPath ?? '';
		row.commandFull ||= item.commandFull ?? '';
		row.connectionCount += 1;
		rows.set(key, row);
	}

	return Array.from(rows.values()).map(row => ({
		rowId: `${row.pid}-${row.command}`,
		pid: row.pid,
		command: row.command,
		ports: sortPortValues(Array.from(row.ports)).join(', '),
		protocols: Array.from(row.protocols).sort().join(', '),
		connectionCount: row.connectionCount,
		processPath: row.processPath,
		commandFull: row.commandFull
	}));
}

function getProtocol(type: string) {
	return type.trim().split(/\s+/)[0] ?? '';
}

function sortPortValues(values: string[]) {
	return values.sort((left, right) => Number(left) - Number(right));
}

function refreshPorts() {
	isRefreshing.value = true;
	errorMessage.value = '';
	successMessage.value = '';
	vscode?.postMessage({ type: 'refreshPorts', mode: scanMode.value });
}

function changeScanMode(mode: PortScanMode) {
	if (scanMode.value === mode) {
		return;
	}

	scanMode.value = mode;
	if (mode === 'listening' && viewMode.value === 'processes') {
		viewMode.value = 'connections';
	}

	ports.value = [];
	refreshPorts();
}

function handleScanModeChange(value: string | number | boolean) {
	if (value === 'listening' || value === 'all') {
		changeScanMode(value);
	}
}

function changeViewMode(mode: PortViewMode) {
	if (viewMode.value === mode) {
		return;
	}

	viewMode.value = mode;

	if (mode === 'processes' && scanMode.value !== 'all') {
		changeScanMode('all');
	}
}

function handleViewModeChange(value: string | number | boolean) {
	if (value === 'connections' || value === 'processes') {
		changeViewMode(value);
	}
}

function toggleSort(key: PortColumnKey) {
	if (sortState.value.key !== key) {
		sortState.value = { key, direction: 'asc' };
		return;
	}

	sortState.value = {
		key,
		direction: sortState.value.direction === 'asc' ? 'desc' : sortState.value.direction === 'desc' ? '' : 'asc'
	};
}

function toggleProcessSort(key: ProcessColumnKey) {
	if (processSortState.value.key !== key) {
		processSortState.value = { key, direction: 'asc' };
		return;
	}

	processSortState.value = {
		key,
		direction: processSortState.value.direction === 'asc' ? 'desc' : processSortState.value.direction === 'desc' ? '' : 'asc'
	};
}

function getSortIcon(key: PortColumnKey) {
	if (sortState.value.key !== key || !sortState.value.direction) {
		return IconSort;
	}

	return sortState.value.direction === 'asc' ? IconSortAscending : IconSortDescending;
}

function getProcessSortIcon(key: ProcessColumnKey) {
	if (processSortState.value.key !== key || !processSortState.value.direction) {
		return IconSort;
	}

	return processSortState.value.direction === 'asc' ? IconSortAscending : IconSortDescending;
}

function isColumnVisible(key: PortColumnKey) {
	return visibleColumnKeys.value.includes(key);
}

function isProcessColumnVisible(key: ProcessColumnKey) {
	return visibleProcessColumnKeys.value.includes(key);
}

function toggleColumnVisible(key: PortColumnKey, checked: string | number | boolean) {
	if (checked) {
		visibleColumnKeys.value = Array.from(new Set([...visibleColumnKeys.value, key]));
		return;
	}

	if (visibleColumnKeys.value.length <= 1) {
		return;
	}

	visibleColumnKeys.value = visibleColumnKeys.value.filter(item => item !== key);
}

function toggleProcessColumnVisible(key: ProcessColumnKey, checked: string | number | boolean) {
	if (checked) {
		visibleProcessColumnKeys.value = Array.from(new Set([...visibleProcessColumnKeys.value, key]));
		return;
	}

	if (visibleProcessColumnKeys.value.length <= 1) {
		return;
	}

	visibleProcessColumnKeys.value = visibleProcessColumnKeys.value.filter(item => item !== key);
}

function openKillConfirm(item: KillTarget) {
	errorMessage.value = '';
	successMessage.value = '';
	pendingKill.value = item;
}

function openProcessKillConfirm(item: NetworkProcessRow) {
	openKillConfirm({
		port: item.ports || '-',
		pid: item.pid,
		command: item.command
	});
}

function closeKillConfirm() {
	if (isKilling.value) {
		return;
	}

	pendingKill.value = null;
}

function clearFullCommandCopyFeedback() {
	if (fullCommandCopyResetTimer) {
		clearTimeout(fullCommandCopyResetTimer);
		fullCommandCopyResetTimer = undefined;
	}

	isCopyingFullCommand.value = false;
	fullCommandCopyState.value = 'idle';
}

function scheduleFullCommandCopyFeedbackReset() {
	if (fullCommandCopyResetTimer) {
		clearTimeout(fullCommandCopyResetTimer);
	}

	fullCommandCopyResetTimer = setTimeout(() => {
		fullCommandCopyState.value = 'idle';
		fullCommandCopyResetTimer = undefined;
	}, 2000);
}

function openFullCommand(command?: string) {
	clearFullCommandCopyFeedback();
	fullCommandText.value = command ?? '';
	isFullCommandVisible.value = true;
}

function closeFullCommand() {
	isFullCommandVisible.value = false;
	fullCommandText.value = '';
	clearFullCommandCopyFeedback();
}

async function copyFullCommand() {
	if (isCopyingFullCommand.value) {
		return;
	}

	if (fullCommandCopyResetTimer) {
		clearTimeout(fullCommandCopyResetTimer);
		fullCommandCopyResetTimer = undefined;
	}

	isCopyingFullCommand.value = true;
	fullCommandCopyState.value = 'idle';

	try {
		if (!navigator.clipboard?.writeText) {
			throw new Error('Clipboard API is not available');
		}

		await navigator.clipboard.writeText(fullCommandText.value || '');
		fullCommandCopyState.value = 'success';
	} catch (err) {
		fullCommandCopyState.value = 'error';
	} finally {
		isCopyingFullCommand.value = false;
		scheduleFullCommandCopyFeedbackReset();
	}
}

function confirmKillPort() {
	if (!pendingKill.value) {
		return;
	}

	isKilling.value = true;
	errorMessage.value = '';
	successMessage.value = '';
	vscode?.postMessage({
		type: 'killPort',
		port: pendingKill.value.port,
		pid: pendingKill.value.pid,
		mode: scanMode.value
	});
}

function isKillable(pid: string) {
	return /^\d+$/.test(pid);
}

function handleMessage(event: MessageEvent<WebviewMessage>) {
	const message = event.data;

	if (message.type === 'portsUpdated') {
		ports.value = message.ports ?? [];
		scanMode.value = message.mode ?? scanMode.value;
		isRefreshing.value = false;
		isKilling.value = false;
		return;
	}

	if (message.type === 'killResult') {
		isKilling.value = false;

		if (message.success) {
			successMessage.value = t('ports.killSuccess', {
				port: message.port ?? '',
				pid: message.pid ?? ''
			});
			pendingKill.value = null;
			return;
		}

		errorMessage.value = message.message ?? t('ports.killFailed');
		return;
	}

	if (message.type === 'error') {
		errorMessage.value = message.message ?? t('ports.loadFailed');
		isRefreshing.value = false;
		isKilling.value = false;
	}
}

onMounted(() => {
	window.addEventListener('message', handleMessage);

	if (!ports.value.length) {
		refreshPorts();
	}
});

onUnmounted(() => {
	window.removeEventListener('message', handleMessage);
	clearFullCommandCopyFeedback();
});
</script>

<template>
	<main class="page">
		<header class="toolbar">
			<div>
				<h1>{{ t('ports.title') }}</h1>
				<p>{{ t('ports.subtitle') }}</p>
			</div>
			<a-button type="primary" :loading="isRefreshing" @click="refreshPorts">{{ t('common.refresh') }}</a-button>
		</header>

		<a-card class="summary" :bordered="false">
			<div>
				<span class="summary-label">{{ totalCountLabel }}</span>
				<strong>{{ totalCount }}</strong>
			</div>
			<div>
				<span class="summary-label">{{ t('ports.filterCount') }}</span>
				<strong>{{ filteredCount }}</strong>
			</div>
			<a-radio-group :model-value="scanMode" type="button" @change="handleScanModeChange">
				<a-radio value="listening">{{ t('ports.listening') }}</a-radio>
				<a-radio value="all">{{ t('ports.allConnections') }}</a-radio>
			</a-radio-group>
			<a-radio-group :model-value="viewMode" type="button" @change="handleViewModeChange">
				<a-radio value="connections">{{ t('ports.connectionDetails') }}</a-radio>
				<a-radio value="processes">{{ t('ports.processAggregation') }}</a-radio>
			</a-radio-group>
			<a-input-search v-model="keyword" class="search" allow-clear :placeholder="t('ports.searchPlaceholder')" />
		</a-card>

		<a-alert v-if="successMessage" type="success">{{ successMessage }}</a-alert>
		<a-alert v-if="errorMessage" type="error">{{ errorMessage }}</a-alert>

		<a-table
			v-if="viewMode === 'connections'"
			:data="tableRows"
			:loading="isRefreshing"
			:pagination="false"
			:bordered="{ cell: true }"
			:scroll="{ x: 1240 }"
			row-key="rowId"
		>
			<template #columns>
				<a-table-column v-for="column in visiblePortColumns" :key="column.key" :data-index="column.key" :width="column.width">
					<template #title>
						<button class="table-header-button" type="button" @click="toggleSort(column.key)">
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
											v-for="column in portColumns"
											:key="column.key"
											:model-value="isColumnVisible(column.key)"
											@change="checked => toggleColumnVisible(column.key, checked)"
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
							<a-button v-if="record.commandFull" type="text" size="small" @click="openFullCommand(record.commandFull)">
								{{ t('ports.view') }}
							</a-button>
							<a-button type="text" status="danger" size="small" :disabled="isKilling" @click="openKillConfirm(record)">
								{{ t('ports.kill') }}
							</a-button>
						</a-space>
					</template>
				</a-table-column>
			</template>
			<template #empty>
				<a-empty :description="hasKeyword ? t('ports.noMatch') : t('ports.empty')" />
			</template>
		</a-table>

		<a-table
			v-else
			:data="processTableRows"
			:loading="isRefreshing"
			:pagination="false"
			:bordered="{ cell: true }"
			:scroll="{ x: 1240 }"
			row-key="rowId"
		>
			<template #columns>
				<a-table-column v-for="column in visibleProcessColumns" :key="column.key" :data-index="column.key" :width="column.width">
					<template #title>
						<button class="table-header-button" type="button" @click="toggleProcessSort(column.key)">
							<span>{{ column.title }}</span>
							<component :is="getProcessSortIcon(column.key)" />
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
											v-for="column in processColumns"
											:key="column.key"
											:model-value="isProcessColumnVisible(column.key)"
											@change="checked => toggleProcessColumnVisible(column.key, checked)"
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
							<a-button v-if="record.commandFull" type="text" size="small" @click="openFullCommand(record.commandFull)">
								{{ t('ports.view') }}
							</a-button>
							<a-button
								type="text"
								status="danger"
								size="small"
								:disabled="isKilling || !isKillable(record.pid)"
								@click="openProcessKillConfirm(record)"
							>
								{{ t('ports.kill') }}
							</a-button>
						</a-space>
					</template>
				</a-table-column>
			</template>
			<template #empty>
				<a-empty :description="hasKeyword ? t('ports.noMatch') : t('ports.noProcessData')" />
			</template>
		</a-table>

		<a-modal v-model:visible="isKillConfirmVisible" :title="t('ports.confirmKillTitle')" :footer="false" :mask-closable="!isKilling">
			<p>{{ t('ports.confirmKillDescription') }}</p>
			<a-descriptions v-if="pendingKill" class="process-detail" :column="1" bordered>
				<a-descriptions-item :label="t('ports.port')">{{ pendingKill.port }}</a-descriptions-item>
				<a-descriptions-item :label="t('ports.pid')">{{ pendingKill.pid }}</a-descriptions-item>
				<a-descriptions-item :label="t('ports.command')">{{ pendingKill.command }}</a-descriptions-item>
			</a-descriptions>
			<div class="dialog-actions">
				<a-button :disabled="isKilling" @click="closeKillConfirm">{{ t('common.cancel') }}</a-button>
				<a-button type="primary" status="danger" :loading="isKilling" @click="confirmKillPort">{{ t('ports.confirmKill') }}</a-button>
			</div>
		</a-modal>

		<a-modal v-model:visible="isFullCommandVisible" :title="t('ports.startCommand')" :footer="false" :mask-closable="!isCopyingFullCommand">
			<div class="full-command-modal">
				<pre class="full-command-content">{{ fullCommandText }}</pre>
				<a-alert v-if="fullCommandCopyFeedback" class="full-command-feedback" :type="fullCommandCopyFeedback.type">
					{{ fullCommandCopyFeedback.content }}
				</a-alert>
				<div class="dialog-actions">
					<a-button :disabled="isCopyingFullCommand" @click="closeFullCommand">{{ t('common.close') }}</a-button>
					<a-button type="primary" :status="fullCommandCopyState === 'success' ? 'success' : 'normal'" :loading="isCopyingFullCommand" @click="copyFullCommand">
						<template #icon>
							<IconCheck v-if="fullCommandCopyState === 'success'" />
							<IconCopy v-else />
						</template>
						{{ fullCommandCopyButtonText }}
					</a-button>
				</div>
			</div>
		</a-modal>
	</main>
</template>

<style scoped>
.full-command-modal {
	display: grid;
	gap: 12px;
}

.full-command-content {
	white-space: pre-wrap;
	word-break: break-word;
	overflow-x: auto;
	max-height: 60vh;
	display: block;
	margin: 0;
	padding: 12px;
	border: 1px solid var(--color-border-2);
	border-radius: 6px;
	background: var(--color-fill-2);
	color: var(--color-text-1);
}

.full-command-feedback {
	margin: 0;
}

.table-action-header a-button {
	margin-left: 4px;
}
</style>
