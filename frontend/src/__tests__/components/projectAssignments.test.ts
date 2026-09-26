import { describe, it, expect } from 'vitest';
import { buildUserAssignments } from '@/components/projects/projectAssignments';

describe('buildUserAssignments', () => {
  it('el primer seleccionado es lead y el resto contributor (nunca "member", que la BD rechaza)', () => {
    expect(buildUserAssignments([7, 3, 9], 60)).toEqual([
      { user_id: 7, allocation_percentage: 60, role: 'lead' },
      { user_id: 3, allocation_percentage: 60, role: 'contributor' },
      { user_id: 9, allocation_percentage: 60, role: 'contributor' }
    ]);
  });

  it('usa 100% de dedicación si no se indica', () => {
    expect(buildUserAssignments([5])).toEqual([{ user_id: 5, allocation_percentage: 100, role: 'lead' }]);
  });
});
