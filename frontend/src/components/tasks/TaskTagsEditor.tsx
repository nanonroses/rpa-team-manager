import React, { useEffect, useState } from 'react';
import { Tag, Input, Typography, Space, message } from 'antd';
import { apiService } from '@/services/api';

const { Text } = Typography;

export interface TaskTag {
  id: number;
  task_id: number;
  tag: string;
}

interface TaskTagsEditorProps {
  taskId: number;
  onChange?: () => void;
}

export const TaskTagsEditor: React.FC<TaskTagsEditorProps> = ({ taskId, onChange }) => {
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService.getTaskTags(taskId)
      .then((data) => { if (!cancelled) setTags(data); })
      .catch(() => { if (!cancelled) message.error('Error al cargar etiquetas'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  const handleAdd = async () => {
    const tag = newTag.trim();
    if (!tag) return;

    try {
      setAdding(true);
      const created = await apiService.createTaskTag(taskId, tag);
      setTags((prev) => [...prev, created]);
      setNewTag('');
      onChange?.();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al crear la etiqueta');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (tagId: number) => {
    const previous = tags;
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    try {
      await apiService.deleteTaskTag(taskId, tagId);
      onChange?.();
    } catch (error) {
      message.error('Error al eliminar la etiqueta');
      setTags(previous);
    }
  };

  return (
    <div>
      <Text strong>Etiquetas</Text>
      <div style={{ margin: '8px 0' }}>
        {loading && <Text type="secondary">Cargando...</Text>}
        {!loading && tags.length === 0 && <Text type="secondary">Sin etiquetas todavía</Text>}
        <Space wrap size="small">
          {tags.map((t) => (
            <Tag key={t.id} closable onClose={(e) => { e.preventDefault(); handleDelete(t.id); }}>
              {t.tag}
            </Tag>
          ))}
        </Space>
      </div>
      <Input
        placeholder="Agregar etiqueta y presionar Enter..."
        value={newTag}
        maxLength={50}
        disabled={adding}
        onChange={(e) => setNewTag(e.target.value)}
        onPressEnter={(e) => { e.preventDefault(); handleAdd(); }}
      />
    </div>
  );
};
