<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
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
			successMessage.value = `已终止端口 ${message.port} 的进程 ${message.pid}`;
			pendingKill.value = null;
			return;
		}

		errorMessage.value = message.message ?? '终止进程失败';
		return;
	}

	if (message.type === 'error') {
		errorMessage.value = message.message ?? '获取端口数据失败';
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
				<h1>端口占用</h1>
				<p>查看当前系统端口、PID 和占用程序。</p>
			</div>
			<button class="refresh-button" type="button" :disabled="isRefreshing" @click="refreshPorts">
				{{ isRefreshing ? '刷新中' : '刷新' }}
			</button>
		</header>

		<section class="summary">
			<div>
				<span class="summary-label">占用端口</span>
				<strong>{{ ports.length }}</strong>
			</div>
			<div>
				<span class="summary-label">筛选结果</span>
				<strong>{{ filteredPorts.length }}</strong>
			</div>
			<div class="mode-switch" role="group" aria-label="扫描模式">
				<button type="button" :class="{ active: scanMode === 'listening' }" @click="changeScanMode('listening')">监听端口</button>
				<button type="button" :class="{ active: scanMode === 'all' }" @click="changeScanMode('all')">全部连接</button>
			</div>
			<label class="search">
				<span>搜索</span>
				<input v-model="keyword" type="search" placeholder="输入端口号精确筛选" />
			</label>
		</section>

		<p v-if="successMessage" class="success-message">{{ successMessage }}</p>
		<p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

		<section class="table-wrap">
			<table v-if="filteredPorts.length">
				<thead>
					<tr>
						<th>端口</th>
						<th>类型</th>
						<th>PID</th>
						<th>程序</th>
						<th class="action-column">操作</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="item in filteredPorts" :key="`${item.type}-${item.port}-${item.pid}-${item.command}`">
						<td>{{ item.port }}</td>
						<td>{{ item.type }}</td>
						<td>{{ item.pid }}</td>
						<td>{{ item.command }}</td>
						<td class="action-column">
							<button class="danger-button" type="button" :disabled="isKilling" @click="openKillConfirm(item)">
								终止
							</button>
						</td>
					</tr>
				</tbody>
			</table>
			<div v-else class="empty">
				<strong>{{ hasKeyword ? '没有匹配的端口' : '暂无端口数据' }}</strong>
				<span>{{ hasKeyword ? '请尝试更换搜索条件，或点击刷新重新读取。' : '可以点击刷新重新读取当前系统端口占用情况。' }}</span>
			</div>
		</section>

		<div v-if="pendingKill" class="modal-mask" role="presentation" @click.self="closeKillConfirm">
			<section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
				<header>
					<h2 id="confirm-title">确认终止进程</h2>
					<p>该操作会强制结束占用端口的进程，请确认它不是重要服务。</p>
				</header>

				<dl class="process-detail">
					<div>
						<dt>端口</dt>
						<dd>{{ pendingKill.port }}</dd>
					</div>
					<div>
						<dt>PID</dt>
						<dd>{{ pendingKill.pid }}</dd>
					</div>
					<div>
						<dt>程序</dt>
						<dd>{{ pendingKill.command }}</dd>
					</div>
				</dl>

				<footer class="dialog-actions">
					<button class="secondary-button" type="button" :disabled="isKilling" @click="closeKillConfirm">取消</button>
					<button class="danger-button" type="button" :disabled="isKilling" @click="confirmKillPort">
						{{ isKilling ? '处理中' : '确认终止' }}
					</button>
				</footer>
			</section>
		</div>
	</main>
</template>
