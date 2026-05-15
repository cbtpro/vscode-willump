<script setup lang="ts">
import IconSettings from '@arco-design/web-vue/es/icon/icon-settings';
import { t } from '../../i18n';
import type { PortTableColumn } from './ports.types';

const props = defineProps<{
  allColumns: PortTableColumn[];
  currentColumns: PortTableColumn[];
}>();

const emit = defineEmits<{
  'toggle-column': [key: string, checked: string | number | boolean];
}>();

function isColumnVisible(key: string) {
  return props.currentColumns.some(c => c.key === key);
}
</script>

<template>
  <a-dropdown trigger="click" position="br">
    <a-button type="text" size="small" :title="t('ports.columnSettings')">
      <IconSettings />
    </a-button>

    <template #content>
      <div class="column-menu">
        <a-checkbox
          v-for="column in allColumns"
          :key="column.key"
          :model-value="isColumnVisible(column.key)"
          @change="checked => emit('toggle-column', column.key, checked)"
        >
          {{ column.title }}
        </a-checkbox>
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped>
.column-menu {
  max-height: 320px;
  overflow: auto;
  padding: 8px;
}
</style>
