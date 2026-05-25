import { computed, defineAsyncComponent, ref } from 'vue';

export const routes = [
	{
		path: '/ports',
		labelKey: 'nav.ports',
		icon: 'ports',
		component: defineAsyncComponent(() => import('../pages/PortsPage.vue'))
	},
	{
		path: '/system-info',
		labelKey: 'nav.systemInfo',
		icon: 'system',
		component: defineAsyncComponent(() => import('../pages/SystemInfoPage.vue'))
	},
	{
		path: '/dev-config/git',
		labelKey: 'nav.gitConfig',
		icon: 'git',
		component: defineAsyncComponent(() => import('../pages/GitConfigPage.vue'))
	}
] as const;

export type RoutePath = (typeof routes)[number]['path'];
export type WillumpRoute = (typeof routes)[number];

const initialRoute = window.__WILLUMP_INITIAL_STATE__?.route ?? '/ports';
const currentPath = ref(normalizeRoute(initialRoute));

export const currentRoute = computed(() => routes.find(route => route.path === currentPath.value) ?? routes[0]);

export function navigateTo(path: string) {
	currentPath.value = normalizeRoute(path);
	window.location.hash = currentPath.value;
}

export function installHashRouter() {
	const syncRoute = () => {
		currentPath.value = normalizeRoute(window.location.hash.replace(/^#/, '') || initialRoute);
	};

	window.addEventListener('hashchange', syncRoute);

	if (!window.location.hash) {
		window.location.hash = currentPath.value;
	} else {
		syncRoute();
	}
}

function normalizeRoute(path: string): string {
	return routes.some(route => route.path === path) ? path : '/ports';
}
