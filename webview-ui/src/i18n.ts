import { computed, ref } from 'vue';
import enUS from './locales/en-US.json';
import zhCN from './locales/zh-CN.json';
import { getVsCodeApi } from './vscode';

export type LocaleMode = 'auto' | 'zh-CN' | 'en-US';
type Locale = 'zh-CN' | 'en-US';
type LocaleMessages = Record<string, unknown>;

const messages: Record<Locale, LocaleMessages> = {
	'zh-CN': zhCN,
	'en-US': enUS
};

const vscode = getVsCodeApi();
const savedState = vscode?.getState() as { localeMode?: LocaleMode } | undefined;
const localeMode = ref<LocaleMode>(savedState?.localeMode ?? getStoredLocaleMode());
const detectedLocale = ref<Locale>(detectLocale());

export const languageOptions = computed(() => [
	{ label: t('common.auto'), value: 'auto' },
	{ label: t('language.chinese'), value: 'zh-CN' },
	{ label: t('language.english'), value: 'en-US' }
]);
export const currentLocaleMode = computed(() => localeMode.value);
export const resolvedLocale = computed<Locale>(() => (localeMode.value === 'auto' ? detectedLocale.value : localeMode.value));

export function setLocaleMode(mode: LocaleMode) {
	localeMode.value = mode;
	localStorage.setItem('willump.localeMode', mode);
	const state = vscode?.getState() as Record<string, unknown> | undefined;
	vscode?.setState({ ...state, localeMode: mode });
}

export function t(key: string, params: Record<string, string | number> = {}): string {
	const template = getMessage(messages[resolvedLocale.value], key) ?? getMessage(messages['en-US'], key) ?? key;
	return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
}

function getMessage(localeMessages: LocaleMessages, key: string): string | undefined {
	const value = key.split('.').reduce<unknown>((target, part) => {
		if (!target || typeof target !== 'object') {
			return undefined;
		}

		return (target as Record<string, unknown>)[part];
	}, localeMessages);

	return typeof value === 'string' ? value : undefined;
}

function getStoredLocaleMode(): LocaleMode {
	const value = localStorage.getItem('willump.localeMode');
	return value === 'zh-CN' || value === 'en-US' || value === 'auto' ? value : 'auto';
}

function detectLocale(): Locale {
	const language = window.__WILLUMP_INITIAL_STATE__?.language ?? navigator.language;
	return language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}
