<script setup lang="ts">
import { currentRoute, installHashRouter, navigateTo, routes } from './router/routes';

installHashRouter();
</script>

<template>
	<main>
		<nav class="route-tabs" aria-label="Willump 功能导航">
			<button
				v-for="route in routes"
				:key="route.path"
				class="route-tab"
				:class="{ active: currentRoute.path === route.path }"
				type="button"
				@click="navigateTo(route.path)"
			>
				{{ route.label }}
			</button>
		</nav>
		<component :is="currentRoute.component" />
	</main>
</template>
