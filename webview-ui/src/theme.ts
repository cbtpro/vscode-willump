import { computed, ref } from 'vue';
import { t } from './i18n';
import { getVsCodeApi } from './vscode';

export type ThemeMode = 'auto' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

const vscode = getVsCodeApi();
const savedState = vscode?.getState() as { themeMode?: ThemeMode } | undefined;
const themeMode = ref<ThemeMode>(savedState?.themeMode ?? getStoredThemeMode());
const systemTheme = ref<ResolvedTheme>(detectVsCodeTheme());

export const themeOptions = computed(() => [
	{ label: t('common.auto'), value: 'auto' },
	{ label: t('common.light'), value: 'light' },
	{ label: t('common.dark'), value: 'dark' }
]);

export const currentThemeMode = computed(() => themeMode.value);
export const resolvedTheme = computed<ResolvedTheme>(() => (themeMode.value === 'auto' ? systemTheme.value : themeMode.value));

export function setThemeMode(mode: ThemeMode) {
	themeMode.value = mode;
	localStorage.setItem('willump.themeMode', mode);
	const state = vscode?.getState() as Record<string, unknown> | undefined;
	vscode?.setState({ ...state, themeMode: mode });
	applyTheme();
}

export function installThemeController() {
	applyTheme();

	const observer = new MutationObserver(() => {
		systemTheme.value = detectVsCodeTheme();
		applyTheme();
	});

	observer.observe(document.body, {
		attributeFilter: ['class'],
		attributes: true
	});
}

function applyTheme() {
	const theme = resolvedTheme.value;
	document.documentElement.dataset.theme = theme;
	document.body.classList.toggle('arco-theme-dark', theme === 'dark');
}

function getStoredThemeMode(): ThemeMode {
	const value = localStorage.getItem('willump.themeMode');
	return value === 'light' || value === 'dark' || value === 'auto' ? value : 'auto';
}

function detectVsCodeTheme(): ResolvedTheme {
	if (document.body.classList.contains('vscode-light')) {
		return 'light';
	}

	if (document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast')) {
		return 'dark';
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
