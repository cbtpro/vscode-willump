import IconSort from '@arco-design/web-vue/es/icon/icon-sort';
import IconSortAscending from '@arco-design/web-vue/es/icon/icon-sort-ascending';
import IconSortDescending from '@arco-design/web-vue/es/icon/icon-sort-descending';
import type { Ref } from 'vue';

export default function useTableSort(sortKey: Ref<string>, sortDirection: Ref<string>) {
	function getSortIcon(key: string) {
		if (sortKey.value !== key || !sortDirection.value) {
			return IconSort;
		}

		return sortDirection.value === 'asc' ? IconSortAscending : IconSortDescending;
	}

	return { getSortIcon };
}
