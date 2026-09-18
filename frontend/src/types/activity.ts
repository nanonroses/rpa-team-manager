export interface ActivityLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  entity_type: string;
  entity_id: number;
  action: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
}
