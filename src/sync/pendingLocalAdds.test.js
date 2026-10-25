import { beforeEach, describe, it, expect } from 'vitest';
import {
  isPendingLocalAdd, markPendingLocalAdds, presentIds, resetPendingLocalAdds, settlePendingLocalAdds,
} from './pendingLocalAdds.js';

beforeEach(() => resetPendingLocalAdds());

describe('pendingLocalAdds', () => {
  it('an entry stays pending until a merged result carries it', () => {
    markPendingLocalAdds(['a', 'b']);
    settlePendingLocalAdds(new Set(['b', 'x']));
    expect(isPendingLocalAdd({ id: 'a' })).toBe(true);
    expect(isPendingLocalAdd({ id: 'b' })).toBe(false);
    settlePendingLocalAdds(new Set(['a']));
    expect(isPendingLocalAdd({ id: 'a' })).toBe(false);
  });

  it('nothing else is pending', () => {
    expect(isPendingLocalAdd({ id: 'a' })).toBe(false);
    expect(isPendingLocalAdd(null)).toBe(false);
  });
});

describe('presentIds', () => {
  it('keeps the wanted ids the list has', () => {
    expect(presentIds([{ id: 'a' }, { id: 'b' }], ['b', 'c'])).toEqual(['b']);
    expect(presentIds(undefined, ['a'])).toEqual([]);
  });
});
