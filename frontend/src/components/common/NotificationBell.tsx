import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Button, Dropdown, List, Typography, Empty, Spin } from 'antd';
import { NotificationOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import { NotificationItem } from '@/types/notification';

const { Text } = Typography;

const POLL_INTERVAL_MS = 60000;

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    try {
      const { count } = await apiService.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      // silencioso: el badge simplemente no se actualiza en este ciclo de polling
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getNotifications({ limit: 10, offset: 0 });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      loadList();
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      await apiService.markNotificationRead(item.id);
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const handleMarkAllRead = async () => {
    await apiService.markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      open={open}
      onOpenChange={handleOpenChange}
      dropdownRender={() => (
        <div style={{ width: 340, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
            <Text strong>Notificaciones</Text>
            <Button type="link" size="small" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
              Marcar todas leídas
            </Button>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center' }}><Spin size="small" /></div>
          ) : items.length === 0 ? (
            <div style={{ padding: 24 }}><Empty description="Sin notificaciones" image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>
          ) : (
            <List
              size="small"
              dataSource={items}
              style={{ maxHeight: 400, overflowY: 'auto' }}
              renderItem={(item) => (
                <List.Item
                  onClick={() => handleItemClick(item)}
                  style={{ padding: '8px 16px', cursor: 'pointer', background: item.is_read ? 'transparent' : '#e6f4ff' }}
                >
                  <div>
                    <Text strong={!item.is_read}>{item.title}</Text>
                    {item.message && (
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{item.message}</Text></div>
                    )}
                    <div><Text type="secondary" style={{ fontSize: 11 }}>{new Date(item.created_at).toLocaleString('es-CL')}</Text></div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </div>
      )}
    >
      <Badge count={unreadCount} size="small">
        <Button type="text" icon={<NotificationOutlined />} style={{ fontSize: '16px' }} />
      </Badge>
    </Dropdown>
  );
};
