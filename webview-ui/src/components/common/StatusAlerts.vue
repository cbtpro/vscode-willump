<script setup lang="ts">
defineProps<{
	successMessage?: string;
	errorMessage?: string;
}>();
</script>

<template>
	<a-alert v-if="successMessage" type="success">{{ successMessage }}</a-alert>
	<a-alert v-if="errorMessage" type="error">{{ errorMessage }}</a-alert>
</template>
