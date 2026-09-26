import React, { useEffect, useState } from 'react';
import { List, Avatar, Typography, Button, Mentions, message, Popconfirm } from 'antd';
import { DeleteOutlined, EditOutlined, UserOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

export interface CommentThreadUser {
  id: number;
  full_name: string;
  username?: string;
}

export interface CommentRow {
  id: number;
  entity_type: 'task' | 'project';
  entity_id: number;
  user_id: number;
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface CommentsThreadProps {
  entityType: 'task' | 'project';
  entityId: number;
}

export function renderContentWithMentions(content: string): React.ReactNode {
  const parts = content.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, index) =>
    /^@[a-zA-Z0-9_]+$/.test(part)
      ? <Text key={index} strong style={{ color: '#1677ff' }}>{part}</Text>
      : <React.Fragment key={index}>{part}</React.Fragment>
  );
}

export const CommentsThread: React.FC<CommentsThreadProps> = ({ entityType, entityId }) => {
  const { user: currentUser } = useAuthStore();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [mentionableUsers, setMentionableUsers] = useState<CommentThreadUser[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService.getComments(entityType, entityId)
      .then((data) => { if (!cancelled) setComments(data); })
      .catch(() => { if (!cancelled) message.error('Error al cargar comentarios'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  useEffect(() => {
    let cancelled = false;
    apiService.getMentionableUsers(entityType, entityId)
      .then((data) => { if (!cancelled) setMentionableUsers(data); })
      .catch(() => { if (!cancelled) setMentionableUsers([]); });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const mentionOptions = mentionableUsers
    .filter((u) => !!u.username)
    .map((u) => ({ value: u.username as string, label: u.full_name }));

  const handlePost = async () => {
    const content = newContent.trim();
    if (!content) return;

    try {
      setPosting(true);
      const created = await apiService.createComment(entityType, entityId, content);
      setComments((prev) => [...prev, created]);
      setNewContent('');
    } catch (error) {
      message.error('Error al publicar el comentario');
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (comment: CommentRow) => {
    setEditingId(comment.id);
    setEditingContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (commentId: number) => {
    const content = editingContent.trim();
    if (!content) return;

    try {
      const updated = await apiService.updateComment(entityType, entityId, commentId, content);
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      cancelEdit();
    } catch (error) {
      message.error('Error al editar el comentario');
    }
  };

  const handleDelete = async (commentId: number) => {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await apiService.deleteComment(entityType, entityId, commentId);
    } catch (error) {
      message.error('Error al eliminar el comentario');
      setComments(previous);
    }
  };

  return (
    <div>
      <Text strong>
        Comentarios{comments.length > 0 ? ` (${comments.length})` : ''}
      </Text>
      <List
        size="small"
        loading={loading}
        dataSource={comments}
        locale={{ emptyText: 'Sin comentarios todavía' }}
        style={{ margin: '8px 0' }}
        renderItem={(comment) => (
          <List.Item
            actions={
              comment.user_id === currentUser?.id
                ? [
                    <Button
                      key="edit"
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      aria-label="Editar comentario"
                      onClick={() => startEdit(comment)}
                    />,
                    <Popconfirm
                      key="delete"
                      title="¿Eliminar este comentario?"
                      okText="Eliminar"
                      cancelText="Cancelar"
                      onConfirm={() => handleDelete(comment.id)}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="Eliminar comentario"
                      />
                    </Popconfirm>
                  ]
                : []
            }
          >
            <List.Item.Meta
              avatar={<Avatar size="small" icon={<UserOutlined />} />}
              title={
                <Text>
                  {comment.author_name}{' '}
                  <Text type="secondary" style={{ fontWeight: 'normal' }}>
                    {dayjs(comment.created_at).fromNow()}
                  </Text>
                </Text>
              }
              description={
                editingId === comment.id ? (
                  <div>
                    <Mentions
                      value={editingContent}
                      options={mentionOptions}
                      onChange={setEditingContent}
                      autoSize
                    />
                    <div style={{ marginTop: 4 }}>
                      <Button size="small" type="primary" onClick={() => handleSaveEdit(comment.id)}>
                        Guardar
                      </Button>{' '}
                      <Button size="small" onClick={cancelEdit}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Text>{renderContentWithMentions(comment.content)}</Text>
                )
              }
            />
          </List.Item>
        )}
      />
      <Mentions
        placeholder="Escribí un comentario... usá @ para mencionar"
        value={newContent}
        options={mentionOptions}
        onChange={setNewContent}
        autoSize
      />
      <Button type="primary" onClick={handlePost} loading={posting} style={{ marginTop: 8 }}>
        Comentar
      </Button>
    </div>
  );
};
