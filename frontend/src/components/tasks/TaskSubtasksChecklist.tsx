import React, { useEffect, useState } from 'react';
import { List, Checkbox, Input, Button, Typography, Space, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';

const { Text } = Typography;

export interface TaskSubtask {
  id: number;
  task_id: number;
  title: string;
  is_done: boolean | number;
}

interface TaskSubtasksChecklistProps {
  taskId: number;
  onChange?: () => void;
}

export const TaskSubtasksChecklist: React.FC<TaskSubtasksChecklistProps> = ({ taskId, onChange }) => {
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService.getTaskSubtasks(taskId)
      .then((data) => { if (!cancelled) setSubtasks(data); })
      .catch(() => { if (!cancelled) message.error('Error al cargar subtareas'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;

    try {
      setAdding(true);
      const created = await apiService.createTaskSubtask(taskId, title);
      setSubtasks((prev) => [...prev, created]);
      setNewTitle('');
      onChange?.();
    } catch (error) {
      message.error('Error al crear la subtarea');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (subtask: TaskSubtask, checked: boolean) => {
    const previous = subtask.is_done;
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, is_done: checked } : s)));
    try {
      await apiService.updateTaskSubtask(taskId, subtask.id, { is_done: checked });
      onChange?.();
    } catch (error) {
      message.error('Error al actualizar la subtarea');
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, is_done: previous } : s)));
    }
  };

  const handleDelete = async (subtaskId: number) => {
    const previous = subtasks;
    setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    try {
      await apiService.deleteTaskSubtask(taskId, subtaskId);
      onChange?.();
    } catch (error) {
      message.error('Error al eliminar la subtarea');
      setSubtasks(previous);
    }
  };

  const doneCount = subtasks.filter((s) => !!s.is_done).length;

  return (
    <div>
      <Text strong>
        Subtareas{subtasks.length > 0 ? ` (${doneCount}/${subtasks.length})` : ''}
      </Text>
      <List
        size="small"
        loading={loading}
        dataSource={subtasks}
        locale={{ emptyText: 'Sin subtareas todavía' }}
        style={{ margin: '8px 0' }}
        renderItem={(subtask) => (
          <List.Item
            actions={[
              <Button
                key="delete"
                type="text"
                size="small"
                danger
                aria-label="Eliminar subtarea"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(subtask.id)}
              />
            ]}
          >
            <Checkbox
              checked={!!subtask.is_done}
              onChange={(e) => handleToggle(subtask, e.target.checked)}
            >
              <Text delete={!!subtask.is_done}>{subtask.title}</Text>
            </Checkbox>
          </List.Item>
        )}
      />
      <Space.Compact style={{ width: '100%' }}>
        <Input
          placeholder="Agregar subtarea..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onPressEnter={(e) => { e.preventDefault(); handleAdd(); }}
        />
        <Button icon={<PlusOutlined />} onClick={handleAdd} loading={adding}>
          Agregar
        </Button>
      </Space.Compact>
    </div>
  );
};
