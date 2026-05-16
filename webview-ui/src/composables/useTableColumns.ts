import { shallowRef } from 'vue';

export default function useTableColumns<T extends string>(initial: T[], minVisible = 1) {
  const visibleKeys = shallowRef<T[]>([...initial]);

  function isColumnVisible(key: T) {
    return visibleKeys.value.includes(key);
  }

  function toggleColumn(key: T, checked: string | number | boolean) {
    const enabled = Boolean(checked);
    if (enabled) {
      visibleKeys.value = Array.from(new Set([...visibleKeys.value, key]));
      return;
    }

    if (visibleKeys.value.length <= minVisible) {
      return;
    }

    visibleKeys.value = visibleKeys.value.filter(k => k !== key);
  }

  return { visibleKeys, toggleColumn, isColumnVisible };
}
