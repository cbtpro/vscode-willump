import { describe, it, expect } from 'vitest';
import useTableColumns from '../src/composables/useTableColumns';

describe('useTableColumns', () => {
  it('initializes with keys and toggles correctly', () => {
    const initial = ['a', 'b'] as const;
    const { visibleKeys, toggleColumn, isColumnVisible } = useTableColumns(initial);

    expect(visibleKeys.value).toEqual(['a', 'b']);

    toggleColumn('c' as any, true);
    expect(visibleKeys.value).toContain('c');

    toggleColumn('a' as any, false);
    expect(isColumnVisible('a' as any)).toBe(false);
  });
});
