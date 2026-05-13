<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { currentLocaleMode, languageOptions, setLocaleMode, t } from './i18n';
import { currentRoute, installHashRouter, navigateTo, routes } from './router/routes';
import { currentThemeMode, installThemeController, setThemeMode, themeOptions } from './theme';

interface AppMessage {
	type?: 'navigate';
	route?: string;
}

installHashRouter();
installThemeController();

function handleThemeChange(value: string | number | boolean) {
	if (value === 'auto' || value === 'light' || value === 'dark') {
		setThemeMode(value);
	}
}

function handleLanguageChange(value: string | number | boolean) {
	if (value === 'auto' || value === 'zh-CN' || value === 'en-US') {
		setLocaleMode(value);
	}
}

function handleMessage(event: MessageEvent<AppMessage>) {
	const message = event.data;

	if (message.type === 'navigate' && message.route) {
		navigateTo(message.route);
	}
}

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
			<a-tabs class="route-tabs" :active-key="currentRoute.path" @change="path => navigateTo(String(path))">
				<a-tab-pane v-for="route in routes" :key="route.path" :title="t(route.labelKey)" />
			</a-tabs>
			<div class="app-controls">
				<a-radio-group class="theme-control" :model-value="currentLocaleMode" type="button" size="small" @change="handleLanguageChange">
					<a-radio v-for="option in languageOptions" :key="option.value" :value="option.value">
						{{ option.label }}
					</a-radio>
				</a-radio-group>
				<a-radio-group class="theme-control" :model-value="currentThemeMode" type="button" size="small" @change="handleThemeChange">
					<a-radio v-for="option in themeOptions" :key="option.value" :value="option.value">
						{{ option.label }}
					</a-radio>
				</a-radio-group>
			</div>
		</header>
		<keep-alive>
			<component :is="currentRoute.component" />
		</keep-alive>
	</main>
</template>
