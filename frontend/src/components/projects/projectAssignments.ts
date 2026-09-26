export interface UserAssignmentPayload {
  user_id: number;
  allocation_percentage: number;
  role: 'lead' | 'contributor';
}

export const buildUserAssignments = (userIds: number[], allocation?: number): UserAssignmentPayload[] =>
  userIds.map((userId, index) => ({
    user_id: userId,
    allocation_percentage: allocation ?? 100,
    role: index === 0 ? 'lead' : 'contributor'
  }));
