import { computed, onMounted, onUnmounted, ref } from 'vue';
import { t } from '../i18n';
import { getVsCodeApi, type PortInfo, type PortScanMode } from '../vscode';
import type {
KillTarget,
NetworkProcessRow,
PortColumnKey,
PortConnectionRow,
PortTableColumn,
PortTableRow,
PortViewMode,
ProcessColumnKey,
SortDirection
} from '../components/ports/ports.types';

export default function usePorts() {
const vscode = getVsCodeApi();
const initialPorts = (window as any).__WILLUMP_INITIAL_STATE__?.ports ?? [];
const initialMode = (window as any).__WILLUMP_INITIAL_STATE__?.portScanMode ?? 'listening';
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
const visibleColumnKeys = ref<PortColumnKey[]>(['port', 'type', 'localAddress', 'listenAddress', 'pid', 'command']);
const visibleProcessColumnKeys = ref<ProcessColumnKey[]>(['command', 'pid', 'ports', 'protocols', 'connectionCount']);
const sortState = ref<{ key: PortColumnKey; direction: SortDirection }>({ key: 'port', direction: '' });
const processSortState = ref<{ key: ProcessColumnKey; direction: SortDirection }>({ key: 'connectionCount', direction: 'desc' });

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
const portColumns = computed<Array<PortTableColumn & { key: PortColumnKey }>>(() => [
{ key: 'port', title: t('ports.port'), width: 110 },
{ key: 'type', title: t('ports.type'), width: 160 },
{ key: 'localAddress', title: t('ports.localAddress'), width: 220 },
{ key: 'listenAddress', title: t('ports.listenAddress'), width: 180 },
{ key: 'pid', title: t('ports.pid'), width: 120 },
{ key: 'command', title: t('ports.command') },
{ key: 'processPath', title: t('ports.processPath'), width: 260 },
{ key: 'commandFull', title: t('ports.startCommand'), width: 420 }
]);
const processColumns = computed<Array<PortTableColumn & { key: ProcessColumnKey }>>(() => [
{ key: 'command', title: t('ports.command') },
{ key: 'pid', title: t('ports.pid'), width: 120 },
{ key: 'ports', title: t('ports.ports'), width: 220 },
{ key: 'protocols', title: t('ports.protocols'), width: 180 },
{ key: 'connectionCount', title: t('ports.connectionCount'), width: 140 },
{ key: 'processPath', title: t('ports.processPath'), width: 260 },
{ key: 'commandFull', title: t('ports.startCommand'), width: 420 }
]);
const visiblePortColumns = computed(() => portColumns.value.filter(column => visibleColumnKeys.value.includes(column.key)));
const visibleProcessColumns = computed(() => processColumns.value.filter(column => visibleProcessColumnKeys.value.includes(column.key)));
const tableRows = computed<PortConnectionRow[]>(() =>
sortPorts(filteredPorts.value).map(item => ({
...item,
rowId: `${item.type}-${item.localAddress}-${item.port}-${item.pid}-${item.command}`
}))
);
const processTableRows = computed(() => sortProcessRows(filteredProcessRows.value));
const activeRows = computed<PortTableRow[]>(() => (viewMode.value === 'processes' ? processTableRows.value : tableRows.value));
const activeColumns = computed(() => (viewMode.value === 'processes' ? visibleProcessColumns.value : visiblePortColumns.value));
const activeAllColumns = computed(() => (viewMode.value === 'processes' ? processColumns.value : portColumns.value));
const activeSortKey = computed(() => (viewMode.value === 'processes' ? processSortState.value.key : sortState.value.key));
const activeSortDirection = computed(() => (viewMode.value === 'processes' ? processSortState.value.direction : sortState.value.direction));

function sortPorts(items: PortInfo[]) {
if (!sortState.value.direction) {
return items;
}

return [...items].sort((left, right) => {
const result = compareColumnValue(left[sortState.value.key] ?? '', right[sortState.value.key] ?? '', sortState.value.key);
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

function toggleSort(key: string) {
if (viewMode.value === 'processes') {
toggleProcessSort(key as ProcessColumnKey);
return;
}

togglePortSort(key as PortColumnKey);
}

function togglePortSort(key: PortColumnKey) {
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

function toggleVisibleColumn(key: string, checked: string | number | boolean) {
if (viewMode.value === 'processes') {
toggleProcessColumnVisible(key as ProcessColumnKey, checked);
return;
}

toggleColumnVisible(key as PortColumnKey, checked);
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

function handleKill(record: PortTableRow) {
openKillConfirm({
port: 'ports' in record ? record.ports || '-' : record.port,
pid: record.pid,
command: record.command
});
}

function closeKillConfirm() {
if (isKilling.value) {
return;
}

pendingKill.value = null;
}

function openFullCommand(command?: string) {
fullCommandText.value = command ?? '';
isFullCommandVisible.value = true;
}

function handleFullCommandVisibleChange(visible: boolean) {
isFullCommandVisible.value = visible;
if (!visible) {
fullCommandText.value = '';
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

function handleMessage(event: MessageEvent) {
const message = event.data as any;

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
successMessage.value = t('ports.killSuccess', { port: message.port ?? '', pid: message.pid ?? '' });
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

return {
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
sortPorts,
sortProcessRows,
compareColumnValue,
aggregateNetworkProcesses,
getProtocol,
sortPortValues,
refreshPorts,
changeScanMode,
handleScanModeChange,
changeViewMode,
handleViewModeChange,
toggleSort,
togglePortSort,
toggleProcessSort,
toggleVisibleColumn,
toggleColumnVisible,
toggleProcessColumnVisible,
openKillConfirm,
handleKill,
closeKillConfirm,
openFullCommand,
handleFullCommandVisibleChange,
confirmKillPort,
handleMessage
};
}
