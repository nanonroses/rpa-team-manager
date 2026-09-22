export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string | null;
  type: 'info' | 'success' | 'warning' | 'error';
  entity_type: string | null;
  entity_id: number | null;
  sender_id: number | null;
  sender_name: string | null;
  link: string | null;
  event_key: string;
  is_read: boolean;
  created_at: string;
}
