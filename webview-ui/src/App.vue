<script setup lang="ts">
import IconDesktop from '@arco-design/web-vue/es/icon/icon-desktop';
import IconComputer from '@arco-design/web-vue/es/icon/icon-computer';
import IconLanguage from '@arco-design/web-vue/es/icon/icon-language';
import IconLink from '@arco-design/web-vue/es/icon/icon-link';
import IconMoon from '@arco-design/web-vue/es/icon/icon-moon';
import IconSettings from '@arco-design/web-vue/es/icon/icon-settings';
import IconSun from '@arco-design/web-vue/es/icon/icon-sun';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { currentLocaleMode, languageOptions, setLocaleMode, t } from './i18n';
import { currentRoute, installHashRouter, navigateTo, routes, type RoutePath, type WillumpRoute } from './router/routes';
import { currentThemeMode, installThemeController, setThemeMode, themeOptions } from './theme';

interface AppMessage {
	type?: 'navigate';
	route?: string;
}

installHashRouter();
installThemeController();

const openedTabs = ref<WillumpRoute[]>([currentRoute.value]);
const openedTabPaths = computed(() => new Set(openedTabs.value.map(route => route.path)));

function handleThemeChange(value: string | number | boolean | Record<string, unknown> | Array<unknown>) {
	if (value === 'auto' || value === 'light' || value === 'dark') {
		setThemeMode(value);
	}
}

function handleLanguageChange(value: string | number | boolean | Record<string, unknown> | Array<unknown>) {
	if (value === 'auto' || value === 'zh-CN' || value === 'en-US') {
		setLocaleMode(value);
	}
}

function handleMessage(event: MessageEvent<AppMessage>) {
	const message = event.data;

	if (message.type === 'navigate' && message.route) {
		openRoute(message.route);
	}
}

function getThemeIcon(value: string) {
	return value === 'auto' ? IconDesktop : value === 'dark' ? IconMoon : IconSun;
}

function getRouteIcon(icon: string) {
	return icon === 'git' ? IconSettings : icon === 'system' ? IconComputer : IconLink;
}

function openRoute(path: string) {
	const route = routes.find(item => item.path === path) ?? routes[0];

	if (!openedTabPaths.value.has(route.path)) {
		openedTabs.value = [...openedTabs.value, route];
	}

	navigateTo(route.path);
}

function closeTab(path: string | number) {
	const routePath = String(path) as RoutePath;

	if (openedTabs.value.length <= 1) {
		return;
	}

	const closingIndex = openedTabs.value.findIndex(route => route.path === routePath);

	if (closingIndex === -1) {
		return;
	}

	const nextTabs = openedTabs.value.filter(route => route.path !== routePath);
	openedTabs.value = nextTabs;

	if (currentRoute.value.path !== routePath) {
		return;
	}

	const nextRoute = nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? routes[0];
	navigateTo(nextRoute.path);
}

watch(
	currentRoute,
	route => {
		if (!openedTabPaths.value.has(route.path)) {
			openedTabs.value = [...openedTabs.value, route];
		}
	},
	{ immediate: true }
);

onMounted(() => {
	window.addEventListener('message', handleMessage);
});

onUnmounted(() => {
	window.removeEventListener('message', handleMessage);
});
</script>

<template>
		<main class="app-shell">
			<header class="app-nav">
				<a-tabs
					class="route-tabs"
					type="card"
					editable
					lazy-load
					hide-content
					:show-add-button="false"
					:active-key="currentRoute.path"
					scroll-position="auto"
					@change="path => openRoute(String(path))"
					@delete="path => closeTab(path)"
				>
					<a-tab-pane v-for="route in openedTabs" :key="route.path" :closable="openedTabs.length > 1">
						<template #title>
							<span class="route-tab-title">
								<component :is="getRouteIcon(route.icon)" />
								{{ t(route.labelKey) }}
							</span>
						</template>
					</a-tab-pane>
				</a-tabs>
			<div class="app-controls">
				<a-select class="nav-select" :model-value="currentLocaleMode" size="small" @change="handleLanguageChange">
					<template #prefix>
						<IconLanguage />
					</template>
					<a-option v-for="option in languageOptions" :key="option.value" :value="option.value">
						{{ option.label }}
					</a-option>
				</a-select>
				<a-select class="nav-select" :model-value="currentThemeMode" size="small" @change="handleThemeChange">
					<template #prefix>
						<component :is="getThemeIcon(currentThemeMode)" />
					</template>
					<a-option v-for="option in themeOptions" :key="option.value" :value="option.value">
						<span class="select-option">
							<IconDesktop v-if="option.value === 'auto'" />
							<IconSun v-else-if="option.value === 'light'" />
							<IconMoon v-else />
							{{ option.label }}
						</span>
					</a-option>
				</a-select>
			</div>
		</header>
		<keep-alive>
			<component :is="currentRoute.component" />
		</keep-alive>
	</main>
</template>
