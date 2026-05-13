import { computed, ref } from 'vue';
import GitConfigPage from '../pages/GitConfigPage.vue';
import PortsPage from '../pages/PortsPage.vue';

export const routes = [
	{
		path: '/ports',
		label: '端口占用',
		component: PortsPage
	},
	{
		path: '/dev-config/git',
		label: 'Git 开发配置',
		component: GitConfigPage
	}
] as const;

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
