import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as os from 'os';
import { promisify } from 'util';

export interface SystemCpuUsageInfo {
	usagePercent: number;
	idlePercent: number;
	cores: SystemCpuCoreUsageInfo[];
	collectedAt: string;
}

export interface SystemCpuCoreUsageInfo {
	index: number;
	usagePercent: number;
	idlePercent: number;
}

export interface SystemMemoryInfo {
	totalBytes: number;
	freeBytes: number;
	usedBytes: number;
	usagePercent: number;
	collectedAt: string;
}

const execFileAsync = promisify(childProcess.execFile);
const PUBLIC_IP_TIMEOUT_MS = 4500;

export type DeviceFormFactor = 'laptop' | 'desktop' | 'unknown';
export type GpuType = 'integrated' | 'discrete' | 'unknown';
export type NetworkAddressFamily = 'IPv4' | 'IPv6';
export type SystemArchitecture = ReturnType<typeof os.arch>;
export type SystemPlatform = ReturnType<typeof os.platform>;

type KnownDeviceFormFactor = Exclude<DeviceFormFactor, 'unknown'>;

export interface SystemDeviceInfo {
	formFactor: DeviceFormFactor;
	manufacturer?: string;
	model?: string;
	chassis?: string;
}

export interface SystemCpuInfo {
	model: string;
	cores: number;
	speedMHz: number;
	architecture: SystemArchitecture;
	usage: SystemCpuUsageInfo;
}

export interface SystemGpuInfo {
	name: string;
	type: GpuType;
	memoryBytes?: number;
	memory?: string;
	driverVersion?: string;
	vendor?: string;
	deviceId?: string;
}

export interface SystemNetworkAddress {
	id: string;
	interfaceName: string;
	address: string;
	family: NetworkAddressFamily;
	cidr?: string | null;
	netmask?: string;
	mac?: string;
	scopeid?: number;
}

export interface PublicIpInfo {
	address: string;
	available: boolean;
	error?: string;
}

export interface SystemNetworkInfo {
	localIpv4: SystemNetworkAddress[];
	localIpv6: SystemNetworkAddress[];
	publicIpv4: PublicIpInfo;
	publicIpv6: PublicIpInfo;
	ipv6Enabled: boolean;
	ipv6PublicReachable: boolean;
}

export interface SystemInfo {
	hostname: string;
	platform: SystemPlatform;
	release: string;
	arch: SystemArchitecture;
	uptimeSeconds: number;
	device: SystemDeviceInfo;
	cpu: SystemCpuInfo;
	memory: SystemMemoryInfo;
	gpus: SystemGpuInfo[];
	network: SystemNetworkInfo;
	collectedAt: string;
}

type JsonListInput<T> = string | T | T[] | null | undefined;

interface WindowsDeviceInfoPayload {
	Manufacturer?: unknown;
	Model?: unknown;
	PCSystemType?: unknown;
	PCSystemTypeEx?: unknown;
	ChassisTypes?: unknown;
	HasBattery?: unknown;
}

interface WindowsGpuSourcePayload {
	[key: string]: unknown;
}

interface WindowsGpuControllerPayload extends WindowsGpuSourcePayload {
	Name?: unknown;
	AdapterRAM?: unknown;
	DriverVersion?: unknown;
	Vendor?: unknown;
}

interface WindowsGpuDriverPayload extends WindowsGpuSourcePayload {
	Name?: unknown;
	Vendor?: unknown;
	DriverVersion?: unknown;
	DeviceId?: unknown;
}

interface WindowsGpuPnpDevicePayload extends WindowsGpuSourcePayload {
	Name?: unknown;
	Vendor?: unknown;
	Status?: unknown;
	DeviceId?: unknown;
}

interface WindowsGpuPnpUtilDevicePayload extends WindowsGpuSourcePayload {
	'Device Description'?: unknown;
	'Manufacturer Name'?: unknown;
	'Driver Name'?: unknown;
	'Instance ID'?: unknown;
}

interface WindowsGpuRegistryPayload extends WindowsGpuSourcePayload {
	Name?: unknown;
	DriverDesc?: unknown;
	Vendor?: unknown;
	DriverVersion?: unknown;
	MemoryBytes?: unknown;
}

interface WindowsGpuInfoPayload {
	Controllers?: JsonListInput<WindowsGpuControllerPayload>;
	PnpDrivers?: JsonListInput<WindowsGpuDriverPayload>;
	PnpDevices?: JsonListInput<WindowsGpuPnpDevicePayload>;
	PnputilDevices?: JsonListInput<WindowsGpuPnpUtilDevicePayload>;
	Registry?: JsonListInput<WindowsGpuRegistryPayload>;
}

interface MacDisplayPayload {
	sppci_model?: unknown;
	_name?: unknown;
	spdisplays_vendor?: unknown;
	spdisplays_vram?: unknown;
	spdisplays_vram_shared?: unknown;
}

interface MacGpuInfoPayload {
	SPDisplaysDataType?: JsonListInput<MacDisplayPayload>;
}

let cachedGpuInfo: SystemGpuInfo[] | undefined;
let cachedDeviceInfo: SystemDeviceInfo | undefined;
let cachedPublicIpv4: PublicIpInfo | undefined;
let cachedPublicIpv6: PublicIpInfo | undefined;

function buildMemoryInfo(): SystemMemoryInfo {
	const totalBytes = os.totalmem();
	const freeBytes = os.freemem();
	const usedBytes = Math.max(totalBytes - freeBytes, 0);

	return {
		totalBytes,
		freeBytes,
		usedBytes,
		usagePercent: totalBytes ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
		collectedAt: new Date().toISOString()
	};
}

function buildCpuUsageInfo(): SystemCpuUsageInfo {
	const cpuList = os.cpus();
	const cores = cpuList.map((cpu, index) => ({
		index,
		usagePercent: 0,
		idlePercent: 100
	}));

	return {
		usagePercent: 0,
		idlePercent: 100,
		cores,
		collectedAt: new Date().toISOString()
	};
}

export async function getSystemInfo(): Promise<SystemInfo> {
	const cpuList = os.cpus();
	const firstCpu = cpuList[0];
	const cpuUsage = buildCpuUsageInfo();
	const memory = buildMemoryInfo();
	const network = readNetworkAddresses();

	const [device, gpus, publicIpv4, publicIpv6] = await Promise.all([
		readDeviceInfo(),
		readGpuInfo(),
		readPublicIp(4),
		readPublicIp(6)
	]);

	return {
		hostname: os.hostname(),
		platform: os.platform(),
		release: os.release(),
		arch: os.arch(),
		uptimeSeconds: os.uptime(),
		device: inferDeviceInfo(device, gpus),
		cpu: {
			model: firstCpu?.model?.trim() ?? '',
			cores: cpuList.length,
			speedMHz: firstCpu?.speed ?? 0,
			architecture: os.arch(),
			usage: cpuUsage
		},
		memory,
		gpus,
		network: {
			localIpv4: network.localIpv4,
			localIpv6: network.localIpv6,
			publicIpv4,
			publicIpv6,
			ipv6Enabled: network.localIpv6.length > 0,
			ipv6PublicReachable: publicIpv6.available
		},
		collectedAt: new Date().toISOString()
	};
}

async function readDeviceInfo(): Promise<SystemDeviceInfo> {
	if (cachedDeviceInfo) {
		return cachedDeviceInfo;
	}

	let result: SystemDeviceInfo;

	if (process.platform === 'win32') {
		result = await readWindowsDeviceInfo();
	} else if (process.platform === 'darwin') {
		result = await readMacDeviceInfo();
	} else {
		result = await readLinuxDeviceInfo();
	}

	cachedDeviceInfo = result;
	return result;
}

async function readWindowsDeviceInfo(): Promise<SystemDeviceInfo> {
	try {
		const { stdout } = await execFileAsync(
			'powershell.exe',
			[
				'-NoProfile',
				'-ExecutionPolicy',
				'Bypass',
				'-Command',
				[
					'$cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue',
					'$enclosure = Get-CimInstance Win32_SystemEnclosure -ErrorAction SilentlyContinue | Select-Object -First 1',
					'$battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1',
					'$bios = Get-ItemProperty -Path "HKLM:\\HARDWARE\\DESCRIPTION\\System\\BIOS" -ErrorAction SilentlyContinue',
					'$systemInfo = Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SystemInformation" -ErrorAction SilentlyContinue',
					'$manufacturer = $cs.Manufacturer; if (-not $manufacturer) { $manufacturer = $bios.SystemManufacturer }; if (-not $manufacturer) { $manufacturer = $systemInfo.SystemManufacturer }',
					'$model = $cs.Model; if (-not $model) { $model = $bios.SystemProductName }; if (-not $model) { $model = $systemInfo.SystemProductName }',
					'$hasBattery = [bool]$battery -or (Test-Path "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\ACPI\\PNP0C0A")',
					'[pscustomobject]@{ Manufacturer = $manufacturer; Model = $model; PCSystemType = $cs.PCSystemType; PCSystemTypeEx = $cs.PCSystemTypeEx; ChassisTypes = @($enclosure.ChassisTypes); HasBattery = $hasBattery } | ConvertTo-Json -Compress'
				].join('; ')
			],
			{ encoding: 'utf8', timeout: 8000 }
		);
		const parsed = parseJson<WindowsDeviceInfoPayload>(stdout);
		const chassisTypes = toNumberList(parsed.ChassisTypes);

		return {
			formFactor: getWindowsFormFactor(chassisTypes, toFiniteNumber(parsed.PCSystemTypeEx) ?? toFiniteNumber(parsed.PCSystemType), parsed.HasBattery === true),
			manufacturer: toOptionalString(parsed.Manufacturer),
			model: toOptionalString(parsed.Model),
			chassis: chassisTypes.map(String).join(', ') || undefined
		};
	} catch (err) {
		return { formFactor: 'unknown' };
	}
}

function inferDeviceInfo(device: SystemDeviceInfo, gpus: SystemGpuInfo[]): SystemDeviceInfo {
	if (device.formFactor !== 'unknown') {
		return device;
	}

	if (gpus.some(item => /\b(laptop|mobile)\b/i.test(item.name))) {
		return {
			...device,
			formFactor: 'laptop'
		};
	}

	return device;
}

async function readMacDeviceInfo(): Promise<SystemDeviceInfo> {
	try {
		const { stdout } = await execFileAsync('sysctl', ['-n', 'hw.model'], { encoding: 'utf8', timeout: 5000 });
		const model = stdout.trim();

		return {
			formFactor: model.startsWith('MacBook') ? 'laptop' : model ? 'desktop' : 'unknown',
			manufacturer: 'Apple',
			model
		};
	} catch (err) {
		return { formFactor: 'unknown' };
	}
}

async function readLinuxDeviceInfo(): Promise<SystemDeviceInfo> {
	const [chassisType, manufacturer, model] = await Promise.all([
		readLinuxDmiValue('/sys/class/dmi/id/chassis_type'),
		readLinuxDmiValue('/sys/class/dmi/id/sys_vendor'),
		readLinuxDmiValue('/sys/class/dmi/id/product_name')
	]);
	const chassisCode = Number(chassisType);

	return {
		formFactor: getChassisFormFactor(Number.isFinite(chassisCode) ? chassisCode : undefined),
		manufacturer: manufacturer || undefined,
		model: model || undefined,
		chassis: chassisType || undefined
	};
}

async function readLinuxDmiValue(filePath: string): Promise<string> {
	try {
		return (await fs.readFile(filePath, 'utf8')).trim();
	} catch (err) {
		return '';
	}
}

function getWindowsFormFactor(chassisTypes: number[], pcSystemType?: number, hasBattery?: boolean): DeviceFormFactor {
	const chassisFormFactor = chassisTypes.map(getChassisFormFactor).find(isKnownDeviceFormFactor);

	if (chassisFormFactor) {
		return chassisFormFactor;
	}

	if (pcSystemType === 2) {
		return 'laptop';
	}

	if (hasBattery) {
		return 'laptop';
	}

	if (pcSystemType === 1 || pcSystemType === 3) {
		return 'desktop';
	}

	return 'unknown';
}

function getChassisFormFactor(chassisType?: number): DeviceFormFactor {
	if (!chassisType) {
		return 'unknown';
	}

	if ([8, 9, 10, 11, 12, 14, 30, 31, 32].includes(chassisType)) {
		return 'laptop';
	}

	if ([3, 4, 5, 6, 7, 13, 15, 16, 35, 36].includes(chassisType)) {
		return 'desktop';
	}

	return 'unknown';
}

function isKnownDeviceFormFactor(value: DeviceFormFactor): value is KnownDeviceFormFactor {
	return value !== 'unknown';
}

function readNetworkAddresses(): Pick<SystemNetworkInfo, 'localIpv4' | 'localIpv6'> {
	const localIpv4: SystemNetworkAddress[] = [];
	const localIpv6: SystemNetworkAddress[] = [];
	const interfaces = os.networkInterfaces();

	for (const [interfaceName, addresses] of Object.entries(interfaces)) {
		for (const item of addresses ?? []) {
			const family = String(item.family);

			if (item.internal || !isNetworkAddressFamily(family)) {
				continue;
			}

			const address: SystemNetworkAddress = {
				id: `${interfaceName}-${family}-${item.address}`,
				interfaceName,
				address: item.address,
				family,
				cidr: item.cidr,
				netmask: item.netmask,
				mac: item.mac,
				scopeid: family === 'IPv6' ? item.scopeid : undefined
			};

			if (family === 'IPv4') {
				localIpv4.push(address);
			} else {
				localIpv6.push(address);
			}
		}
	}

	return { localIpv4, localIpv6 };
}

async function readGpuInfo(): Promise<SystemGpuInfo[]> {
	if (cachedGpuInfo) {
		return cachedGpuInfo;
	}

	let result: SystemGpuInfo[];

	if (process.platform === 'win32') {
		result = await readWindowsGpuInfo();
	} else if (process.platform === 'darwin') {
		result = await readMacGpuInfo();
	} else if (process.platform === 'linux') {
		result = await readLinuxGpuInfo();
	} else if (['freebsd', 'openbsd'].includes(process.platform)) {
		result = await readBsdGpuInfo();
	} else {
		result = [];
	}

	cachedGpuInfo = result;
	return result;
}

async function readWindowsGpuInfo(): Promise<SystemGpuInfo[]> {
	const registryGpus = await readWindowsGpuRegistryInfo();

	if (registryGpus.length) {
		return registryGpus;
	}

	try {
		const { stdout } = await execFileAsync(
			'powershell.exe',
			[
				'-NoProfile',
				'-ExecutionPolicy',
				'Bypass',
				'-Command',
				[
					'function Convert-RegString($Value) { if ($null -eq $Value) { return "" }; if ($Value -is [byte[]]) { return ([System.Text.Encoding]::Unicode.GetString($Value)).Trim([char]0).Trim() }; return [string]$Value }',
					'$controllers = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ Name = $_.Name; AdapterRAM = $_.AdapterRAM; DriverVersion = $_.DriverVersion; Vendor = $_.AdapterCompatibility } })',
					'$pnpDrivers = @(Get-CimInstance Win32_PnPSignedDriver -Filter "DeviceClass = \'DISPLAY\'" -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ Name = $_.DeviceName; Vendor = $_.Manufacturer; DriverVersion = $_.DriverVersion; DeviceId = $_.DeviceID } })',
					'$pnpDevices = @(Get-PnpDevice -Class Display -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ Name = $_.FriendlyName; Vendor = $_.Manufacturer; Status = $_.Status; DeviceId = $_.InstanceId } })',
					'$pnputilDevices = @(); $pnputilOutput = @(pnputil /enum-devices /class Display 2>$null); $current = @{}; foreach ($line in $pnputilOutput) { if (-not $line.Trim()) { if ($current.Count) { $pnputilDevices += [pscustomobject]$current; $current = @{} }; continue }; if ($line -match "^\\s*([^:]+):\\s*(.*)$") { $current[$matches[1].Trim()] = $matches[2].Trim() } }; if ($current.Count) { $pnputilDevices += [pscustomobject]$current }',
					'$registry = @(Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Video\\*\\*" -ErrorAction SilentlyContinue | ForEach-Object { $memory = $_."HardwareInformation.qwMemorySize"; if ($null -eq $memory) { $memory = $_."HardwareInformation.MemorySize" }; [pscustomobject]@{ Name = Convert-RegString $_."HardwareInformation.AdapterString"; DriverDesc = $_.DriverDesc; Vendor = $_.ProviderName; DriverVersion = $_.DriverVersion; MemoryBytes = $memory } } | Where-Object { $_.Name -or $_.DriverDesc -or $_.MemoryBytes })',
					'[pscustomobject]@{ Controllers = $controllers; PnpDrivers = $pnpDrivers; PnpDevices = $pnpDevices; PnputilDevices = $pnputilDevices; Registry = $registry } | ConvertTo-Json -Depth 5 -Compress'
				].join('; ')
			],
			{ encoding: 'utf8', timeout: 8000 }
		);
		const parsed = parseJson<WindowsGpuInfoPayload>(stdout);
		const controllers = parseJsonList<WindowsGpuControllerPayload>(parsed.Controllers);
		const pnpDrivers = parseJsonList<WindowsGpuDriverPayload>(parsed.PnpDrivers);
		const pnpDevices = parseJsonList<WindowsGpuPnpDevicePayload>(parsed.PnpDevices);
		const pnputilDevices = parseJsonList<WindowsGpuPnpUtilDevicePayload>(parsed.PnputilDevices);
		const registry = parseJsonList<WindowsGpuRegistryPayload>(parsed.Registry);
		const gpus: SystemGpuInfo[] = [
			...controllers.map(item => {
				const name = toOptionalString(item.Name) ?? '';
				const registryItem = findMatchingWindowsGpuRegistryItem(name, registry);
				const registryMemoryBytes = toPositiveNumber(registryItem?.MemoryBytes);
				const adapterMemoryBytes = toPositiveNumber(item.AdapterRAM);
				const memoryBytes = registryMemoryBytes ?? adapterMemoryBytes;

				return {
					name,
					type: inferGpuType(name, toOptionalString(item.Vendor) ?? toOptionalString(registryItem?.Vendor) ?? ''),
					memoryBytes,
					driverVersion: toOptionalString(item.DriverVersion) ?? toOptionalString(registryItem?.DriverVersion),
					vendor: toOptionalString(item.Vendor) ?? toOptionalString(registryItem?.Vendor)
				};
			}),
			...pnpDrivers.map(item => createWindowsGpuFromSource(item, 'Name', 'Vendor', 'DriverVersion', 'DeviceId', registry)),
			...pnpDevices.map(item => createWindowsGpuFromSource(item, 'Name', 'Vendor', undefined, 'DeviceId', registry)),
			...pnputilDevices.map(item => createWindowsGpuFromSource(item, 'Device Description', 'Manufacturer Name', 'Driver Name', 'Instance ID', registry)),
			...registry.map(createWindowsGpuFromRegistryItem)
		];

		return mergeGpuInfo(gpus.filter(hasGpuName));
	} catch (err) {
		return [];
	}
}

async function readWindowsGpuRegistryInfo(): Promise<SystemGpuInfo[]> {
	const registry = await readWindowsGpuRegistryItems();

	return mergeGpuInfo(registry.map(createWindowsGpuFromRegistryItem).filter(hasGpuName));
}

async function readWindowsGpuRegistryItems(): Promise<WindowsGpuRegistryPayload[]> {
	try {
		const { stdout } = await execFileAsync(
			'powershell.exe',
			[
				'-NoProfile',
				'-ExecutionPolicy',
				'Bypass',
				'-Command',
				[
					'function Convert-RegString($Value) { if ($null -eq $Value) { return "" }; if ($Value -is [byte[]]) { return ([System.Text.Encoding]::Unicode.GetString($Value)).Trim([char]0).Trim() }; return [string]$Value }',
					'$registry = @(Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Video\\*\\*" -ErrorAction SilentlyContinue | ForEach-Object { $memory = $_."HardwareInformation.qwMemorySize"; if ($null -eq $memory) { $memory = $_."HardwareInformation.MemorySize" }; [pscustomobject]@{ Name = Convert-RegString $_."HardwareInformation.AdapterString"; DriverDesc = $_.DriverDesc; Vendor = $_.ProviderName; DriverVersion = $_.DriverVersion; MemoryBytes = $memory } } | Where-Object { $_.Name -or $_.DriverDesc -or $_.MemoryBytes })',
					'$registry | ConvertTo-Json -Depth 5 -Compress'
				].join('; ')
			],
			{ encoding: 'utf8', timeout: 5000 }
		);
		const parsed = parseJson<JsonListInput<WindowsGpuRegistryPayload>>(stdout);

		return parseJsonList<WindowsGpuRegistryPayload>(parsed);
	} catch (err) {
		return [];
	}
}

function createWindowsGpuFromRegistryItem(item: WindowsGpuRegistryPayload): SystemGpuInfo {
	const memoryBytes = toPositiveNumber(item.MemoryBytes);
	const name = toOptionalString(item.Name) ?? toOptionalString(item.DriverDesc) ?? '';
	const vendor = toOptionalString(item.Vendor) ?? '';

	return {
		name,
		type: inferGpuType(name, vendor),
		memoryBytes,
		driverVersion: toOptionalString(item.DriverVersion),
		vendor: vendor || undefined
	};
}

function createWindowsGpuFromSource(
	item: WindowsGpuSourcePayload,
	nameKey: string,
	vendorKey: string,
	driverVersionKey: string | undefined,
	deviceIdKey: string,
	registryItems: WindowsGpuRegistryPayload[]
): SystemGpuInfo {
	const name = toOptionalString(item[nameKey]) ?? '';
	const vendor = toOptionalString(item[vendorKey]) ?? '';
	const registryItem = findMatchingWindowsGpuRegistryItem(name, registryItems);
	const memoryBytes = toPositiveNumber(registryItem?.MemoryBytes);

	return {
		name,
		type: inferGpuType(name, vendor),
		memoryBytes,
		driverVersion: toOptionalString(driverVersionKey ? item[driverVersionKey] : undefined) ?? toOptionalString(registryItem?.DriverVersion),
		vendor: vendor || toOptionalString(registryItem?.Vendor),
		deviceId: toOptionalString(item[deviceIdKey])
	};
}

function mergeGpuInfo(items: SystemGpuInfo[]): SystemGpuInfo[] {
	const result: SystemGpuInfo[] = [];

	for (const item of items) {
		const existing = result.find(candidate => areSameGpu(candidate, item));

		if (!existing) {
			result.push(item);
			continue;
		}

		existing.type = existing.type !== 'unknown' ? existing.type : item.type;
		existing.memoryBytes = Math.max(existing.memoryBytes ?? 0, item.memoryBytes ?? 0) || existing.memoryBytes || item.memoryBytes;
		existing.memory ||= item.memory;
		existing.driverVersion ||= item.driverVersion;
		existing.vendor ||= item.vendor;
		existing.deviceId ||= item.deviceId;
	}

	return result;
}

function areSameGpu(left: SystemGpuInfo, right: SystemGpuInfo): boolean {
	const leftId = normalizeDeviceId(left.deviceId ?? '');
	const rightId = normalizeDeviceId(right.deviceId ?? '');

	if (leftId && rightId && leftId === rightId) {
		return true;
	}

	const leftName = normalizeGpuName(left.name);
	const rightName = normalizeGpuName(right.name);

	return Boolean(leftName && rightName && (leftName.includes(rightName) || rightName.includes(leftName)));
}

function findMatchingWindowsGpuRegistryItem(name: string, registryItems: WindowsGpuRegistryPayload[]): WindowsGpuRegistryPayload | undefined {
	const normalizedName = normalizeGpuName(name);

	return registryItems.find(item => {
		const registryName = normalizeGpuName(toOptionalString(item.Name) ?? toOptionalString(item.DriverDesc) ?? '');
		return Boolean(registryName && normalizedName && (registryName.includes(normalizedName) || normalizedName.includes(registryName)));
	});
}

function normalizeGpuName(value: string): string {
	return value
		.toLowerCase()
		.replace(/\([^)]+\)/g, '')
		.replace(/\b(nvidia|amd|radeon|intel|graphics|display|adapter|gpu|tm|r)\b/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function parseVramStringToBytes(vramStr?: string): number | undefined {
	if (!vramStr) {
		return undefined;
	}

	const match = vramStr.match(/^([\d.]+)\s*(GB|MB|KB|TB|B)\s*$/i);
	if (!match) {
		return undefined;
	}

	const value = Number(match[1]);
	const unit = match[2].toUpperCase();
	const multipliers: Record<string, number> = {
		B: 1,
		KB: 1024,
		MB: 1024 * 1024,
		GB: 1024 * 1024 * 1024,
		TB: 1024 * 1024 * 1024 * 1024
	};

	const result = value * (multipliers[unit] ?? 0);
	return result > 0 ? result : undefined;
}

function formatBytesReadable(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function readMacGpuInfo(): Promise<SystemGpuInfo[]> {
	try {
		const { stdout } = await execFileAsync('system_profiler', ['SPDisplaysDataType', '-json'], {
			encoding: 'utf8',
			timeout: 10000
		});
		const parsed = parseJson<MacGpuInfoPayload>(stdout);

		const displays = parseJsonList<MacDisplayPayload>(parsed.SPDisplaysDataType);
		const isAppleSilicon = os.arch() === 'arm64';
		const totalMemoryBytes = await getMacTotalMemoryBytes();

		return displays
			.map(item => {
				const name = toOptionalString(item.sppci_model) ?? toOptionalString(item._name) ?? '';
				const rawVendor = toOptionalString(item.spdisplays_vendor);
				const vendor = normalizeMacVendorName(rawVendor);
				const vramText = toOptionalString(item.spdisplays_vram) ?? toOptionalString(item.spdisplays_vram_shared);
				const vramBytes = parseVramStringToBytes(vramText);

				let memoryBytes: number | undefined;
				let memory: string | undefined;

				if (vramBytes && vramBytes > 0) {
					memoryBytes = vramBytes;
					memory = vramText;
				} else if (isAppleSilicon && totalMemoryBytes > 0) {
					memoryBytes = totalMemoryBytes;
					memory = formatBytesReadable(totalMemoryBytes) + ' (Unified)';
				}

				return {
					name,
					type: inferGpuType(name, vendor),
					memoryBytes,
					memory,
					vendor
				};
			})
			.filter(hasGpuName);
	} catch (err) {
		return [];
	}
}

async function getMacTotalMemoryBytes(): Promise<number> {
	try {
		const { stdout } = await execFileAsync('sysctl', ['-n', 'hw.memsize'], {
			encoding: 'utf8',
			timeout: 3000
		});
		const value = Number(stdout.trim());
		return Number.isFinite(value) && value > 0 ? value : os.totalmem();
	} catch {
		return os.totalmem();
	}
}

function normalizeMacVendorName(vendor?: string): string {
	if (!vendor) {
		return '';
	}

	const mappings: Record<string, string> = {
		'sppci_vendor_Apple': 'Apple',
		'sppci_vendor_Intel': 'Intel',
		'sppci_vendor_NVIDIA': 'NVIDIA',
		'sppci_vendor_AMD': 'AMD'
	};

	return mappings[vendor] ?? vendor;
}

async function readLinuxGpuInfo(): Promise<SystemGpuInfo[]> {
	try {
		const { stdout } = await execFileAsync(
			'sh',
			['-lc', "command -v lspci >/dev/null 2>&1 && lspci -mm | grep -Ei 'VGA|3D|Display' || true"],
			{ encoding: 'utf8', timeout: 8000 }
		);
		const lspciItems = stdout
			.split(/\r?\n/)
			.map(line => line.trim())
			.filter(Boolean)
			.map(parseLspciGpuLine)
			.filter(hasGpuName);

		if (lspciItems.length) {
			return mergeGpuInfo(lspciItems);
		}

		return readLinuxSysfsGpuInfo();
	} catch (err) {
		return readLinuxSysfsGpuInfo();
	}
}

async function readLinuxSysfsGpuInfo(): Promise<SystemGpuInfo[]> {
	try {
		const deviceDirs = await fs.readdir('/sys/bus/pci/devices');
		const items = await Promise.all(
			deviceDirs.map(async (deviceDir): Promise<SystemGpuInfo | undefined> => {
				const basePath = `/sys/bus/pci/devices/${deviceDir}`;
				const classValue = await readLinuxDmiValue(`${basePath}/class`);

				if (!classValue.toLowerCase().startsWith('0x03')) {
					return undefined;
				}

				const [vendorCode, deviceCode] = await Promise.all([
					readLinuxDmiValue(`${basePath}/vendor`),
					readLinuxDmiValue(`${basePath}/device`)
				]);
				const vendor = getPciVendorName(vendorCode);
				const name = [vendor, deviceCode ? `GPU ${deviceCode}` : 'GPU'].filter(Boolean).join(' ');

				return {
					name,
					type: inferGpuType(name, vendor),
					vendor: vendor || undefined,
					deviceId: `${vendorCode}:${deviceCode}`
				};
			})
		);

		return mergeGpuInfo(items.filter(hasGpuName));
	} catch (err) {
		return [];
	}
}

async function readBsdGpuInfo(): Promise<SystemGpuInfo[]> {
	try {
		const { stdout } = await execFileAsync(
			'sh',
			['-lc', 'command -v pciconf >/dev/null 2>&1 && pciconf -lv || true'],
			{ encoding: 'utf8', timeout: 8000 }
		);

		return mergeGpuInfo(stdout
			.split(/\n(?=\\S+@pci)/)
			.map(parsePciconfGpuBlock)
			.filter(hasGpuName));
	} catch (err) {
		return [];
	}
}

function parsePciconfGpuBlock(block: string): SystemGpuInfo | undefined {
	if (!/class\s*=\s*display/i.test(block)) {
		return undefined;
	}

	const vendor = block.match(/vendor\s*=\s*'([^']+)'/i)?.[1] ?? '';
	const device = block.match(/device\s*=\s*'([^']+)'/i)?.[1] ?? '';
	const chip = block.match(/chip\s*=\s*0x([a-f0-9]+)/i)?.[1] ?? '';
	const name = [vendor, device || (chip ? `GPU 0x${chip}` : '')].filter(Boolean).join(' ').trim();

	return name
		? {
			name,
			type: inferGpuType(name, vendor),
			vendor: vendor || undefined,
			deviceId: chip ? `0x${chip}` : undefined
		}
		: undefined;
}

function parseLspciGpuLine(line: string): SystemGpuInfo | undefined {
	const parts = Array.from(line.matchAll(/"([^"]+)"/g)).map(match => match[1]);
	const vendor = parts[1] ?? '';
	const device = parts[2] ?? parts[0] ?? '';
	const name = [vendor, device].filter(Boolean).join(' ').trim() || line;

	return name ? { name, type: inferGpuType(name, vendor), vendor: vendor || undefined } : undefined;
}

function getPciVendorName(vendorCode: string): string {
	const vendors: Record<string, string> = {
		'0x1002': 'AMD',
		'0x10de': 'NVIDIA',
		'0x8086': 'Intel',
		'0x106b': 'Apple'
	};

	return vendors[vendorCode.toLowerCase()] ?? vendorCode;
}

function inferGpuType(name: string, vendor = ''): GpuType {
	const value = `${vendor} ${name}`.toLowerCase();

	if (/\b(intel|iris|uhd graphics|hd graphics|apple)\b/.test(value)) {
		return 'integrated';
	}

	if (/\b(nvidia|geforce|quadro|rtx|gtx)\b/.test(value)) {
		return 'discrete';
	}

	if (/\b(apu|integrated|radeon graphics)\b/.test(value)) {
		return 'integrated';
	}

	if (/\b(radeon pro|radeon rx|firepro|instinct|workstation)\b/.test(value)) {
		return 'discrete';
	}

	return 'unknown';
}

function normalizeDeviceId(value: string): string {
	return value
		.toLowerCase()
		.replace(/\\+/g, '\\')
		.trim();
}

function parseJsonList<T>(value: JsonListInput<T>): T[] {
	if (value === undefined || value === null) {
		return [];
	}

	if (Array.isArray(value)) {
		return value;
	}

	if (typeof value !== 'string') {
		return [value];
	}

	const trimmed = value.trim();

	if (!trimmed) {
		return [];
	}

	const parsed = JSON.parse(trimmed) as T | T[];
	return Array.isArray(parsed) ? parsed : [parsed];
}

function parseJson<T>(value: string): T {
	return JSON.parse(value.trim()) as T;
}

function toOptionalString(value: unknown): string | undefined {
	const result = String(value ?? '').trim();
	return result || undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}

	const result = Number(value);
	return Number.isFinite(result) ? result : undefined;
}

function toPositiveNumber(value: unknown): number | undefined {
	const result = toFiniteNumber(value);
	return result !== undefined && result > 0 ? result : undefined;
}

function toNumberList(value: unknown): number[] {
	const values = Array.isArray(value) ? value : [value];

	return values
		.map(toFiniteNumber)
		.filter((item): item is number => item !== undefined);
}

function isNetworkAddressFamily(value: string): value is NetworkAddressFamily {
	return value === 'IPv4' || value === 'IPv6';
}

function hasGpuName(item: SystemGpuInfo | undefined): item is SystemGpuInfo {
	return Boolean(item?.name);
}

function isValidIpAddress(address: string, version: 4 | 6): boolean {
	if (!address) {
		return false;
	}

	if (version === 4) {
		const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
		return ipv4Pattern.test(address);
	}

	const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^::1$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$/;
	return ipv6Pattern.test(address) || isCompressedIpv6(address);
}

function isCompressedIpv6(address: string): boolean {
	if (!address.includes('::')) {
		return false;
	}

	const groups = address.split('::');
	if (groups.length !== 2) {
		return false;
	}

	const leftGroups = groups[0] ? groups[0].split(':').length : 0;
	const rightGroups = groups[1] ? groups[1].split(':').length : 0;

	if (leftGroups + rightGroups > 7) {
		return false;
	}

	const allGroups = [...groups[0]?.split(':') ?? [], ...groups[1]?.split(':') ?? []];
	return allGroups.every(group => /^[0-9a-fA-F]{0,4}$/.test(group));
}

async function readPublicIp(version: 4 | 6): Promise<PublicIpInfo> {
	if (version === 4 && cachedPublicIpv4) {
		return cachedPublicIpv4;
	}

	if (version === 6 && cachedPublicIpv6) {
		return cachedPublicIpv6;
	}

	const services = getPublicIpServices(version);
	let lastError: string | undefined;

	for (const service of services) {
		try {
			const result = await fetchPublicIpFromService(service, version);
			if (result.available) {
				if (version === 4) {
					cachedPublicIpv4 = result;
				} else {
					cachedPublicIpv6 = result;
				}
				return result;
			}
			lastError = result.error;
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
		}
	}

	const fallbackResult: PublicIpInfo = {
		address: '',
		available: false,
		error: lastError
	};

	if (version === 4) {
		cachedPublicIpv4 = fallbackResult;
	} else {
		cachedPublicIpv6 = fallbackResult;
	}

	return fallbackResult;
}

interface PublicIpService {
	hostname: string;
	path: string;
}

function getPublicIpServices(version: 4 | 6): PublicIpService[] {
	if (version === 4) {
		return [
			{ hostname: 'api.ipify.org', path: '/?format=text' },
			{ hostname: 'ipv4.icanhazip.com', path: '/' },
			{ hostname: 'ifconfig.me', path: '/ip' },
			{ hostname: 'ipv4bot.whatismyipaddress.com', path: '/' }
		];
	}

	return [
		{ hostname: 'api6.ipify.org', path: '/?format=text' },
		{ hostname: 'ipv6.icanhazip.com', path: '/' },
		{ hostname: 'ipv6bot.whatismyipaddress.com', path: '/' }
	];
}

function fetchPublicIpFromService(service: PublicIpService, version: 4 | 6): Promise<PublicIpInfo> {
	return new Promise((resolve, reject) => {
		const request = https.get(
			{
				hostname: service.hostname,
				path: service.path,
				family: version,
				timeout: PUBLIC_IP_TIMEOUT_MS,
				headers: {
					'User-Agent': 'Willump VS Code Extension'
				}
			},
			response => {
				let body = '';
				response.setEncoding('utf8');
				response.on('data', chunk => {
					body += chunk;
				});
				response.on('end', () => {
					if (response.statusCode && response.statusCode >= 400) {
						resolve({
							address: '',
							available: false,
							error: `HTTP ${response.statusCode}`
						});
						return;
					}

					const address = body.trim();
					if (!address && response.statusCode === 200) {
						resolve({
							address: '',
							available: false,
							error: 'Empty response'
						});
						return;
					}

					if (!isValidIpAddress(address, version)) {
						resolve({
							address: '',
							available: false,
							error: `Invalid IPv${version} address`
						});
						return;
					}

					resolve({
						address,
						available: Boolean(address)
					});
				});
			}
		);

		request.on('timeout', () => {
			request.destroy(new Error('Request timed out'));
		});
		request.on('error', err => {
			reject(err);
		});
	});
}
