<script setup lang="ts">
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

const vscode = getVsCodeApi();
const initialPorts = window.__WILLUMP_INITIAL_STATE__?.ports ?? [];
const initialMode = window.__WILLUMP_INITIAL_STATE__?.portScanMode ?? 'listening';
const ports = ref<PortInfo[]>(initialPorts);
const scanMode = ref<PortScanMode>(initialMode);
const keyword = ref('');
const isRefreshing = ref(false);
const isKilling = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const pendingKill = ref<PortInfo | null>(null);
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
		[item.port, item.pid, item.command, item.type].some(field => field.toLowerCase().includes(value))
	);
});

const hasKeyword = computed(() => keyword.value.trim().length > 0);
const tableRows = computed(() =>
	filteredPorts.value.map(item => ({
		...item,
		rowId: `${item.type}-${item.port}-${item.pid}-${item.command}`
	}))
);

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
	ports.value = [];
	refreshPorts();
}

function handleScanModeChange(value: string | number | boolean) {
	if (value === 'listening' || value === 'all') {
		changeScanMode(value);
	}
}

function openKillConfirm(item: PortInfo) {
	errorMessage.value = '';
	successMessage.value = '';
	pendingKill.value = item;
}

function closeKillConfirm() {
	if (isKilling.value) {
		return;
	}

	pendingKill.value = null;
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
				<span class="summary-label">{{ t('ports.occupiedCount') }}</span>
				<strong>{{ ports.length }}</strong>
			</div>
			<div>
				<span class="summary-label">{{ t('ports.filterCount') }}</span>
				<strong>{{ filteredPorts.length }}</strong>
			</div>
			<a-radio-group :model-value="scanMode" type="button" @change="handleScanModeChange">
				<a-radio value="listening">{{ t('ports.listening') }}</a-radio>
				<a-radio value="all">{{ t('ports.allConnections') }}</a-radio>
			</a-radio-group>
			<a-input-search v-model="keyword" class="search" allow-clear :placeholder="t('ports.searchPlaceholder')" />
		</a-card>

		<a-alert v-if="successMessage" type="success" :content="successMessage" />
		<a-alert v-if="errorMessage" type="error" :content="errorMessage" />

		<a-table
			:data="tableRows"
			:loading="isRefreshing"
			:pagination="false"
			:bordered="{ cell: false }"
			:scroll="{ x: 620 }"
			row-key="rowId"
		>
			<template #columns>
				<a-table-column :title="t('ports.port')" data-index="port" :width="110" />
				<a-table-column :title="t('ports.type')" data-index="type" :width="160" />
				<a-table-column :title="t('ports.pid')" data-index="pid" :width="120" />
				<a-table-column :title="t('ports.command')" data-index="command" />
				<a-table-column :title="t('ports.action')" :width="96" align="right">
					<template #cell="{ record }">
						<a-button type="text" status="danger" size="small" :disabled="isKilling" @click="openKillConfirm(record)">
							{{ t('ports.kill') }}
						</a-button>
					</template>
				</a-table-column>
			</template>
			<template #empty>
				<a-empty :description="hasKeyword ? t('ports.noMatch') : t('ports.empty')" />
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
	</main>
</template>
