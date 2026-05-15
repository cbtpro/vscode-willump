<script setup lang="ts">
defineProps<{
	title: string;
	subtitle: string;
	actionLabel?: string;
	loading?: boolean;
}>();

const emit = defineEmits<{
	action: [];
}>();
</script>

<template>
	<header class="toolbar">
		<div>
			<h1>{{ title }}</h1>
			<p>{{ subtitle }}</p>
		</div>
		<a-button v-if="actionLabel" type="primary" :loading="loading" @click="emit('action')">{{ actionLabel }}</a-button>
	</header>
</template>
