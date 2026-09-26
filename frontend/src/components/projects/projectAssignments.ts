export interface UserAssignmentPayload {
  user_id: number;
  allocation_percentage: number;
  role: 'lead' | 'contributor';
  budgeted_hours?: number;
  start_date?: string;
  end_date?: string;
}

export const buildUserAssignments = (userIds: number[], allocation?: number, hoursPerPerson?: number, startDate?: string, endDate?: string): UserAssignmentPayload[] =>
  userIds.map((userId, index) => ({
    user_id: userId,
    allocation_percentage: allocation ?? 100,
    role: index === 0 ? 'lead' : 'contributor',
    ...(hoursPerPerson === undefined ? {} : { budgeted_hours: hoursPerPerson }),
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {})
  }));
