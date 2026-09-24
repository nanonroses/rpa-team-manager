import React, { useEffect, useState } from 'react';
import { Tag, Select, Typography, Space, message } from 'antd';
import { apiService } from '@/services/api';

const { Text } = Typography;
const { Option } = Select;

export interface TaskCollaborator {
  id: number;
  task_id: number;
  user_id: number;
  full_name: string;
  avatar_url?: string;
}

interface SimpleUser {
  id: number;
  full_name: string;
}

interface TaskCollaboratorsEditorProps {
  taskId: number;
  users: SimpleUser[];
  onChange?: () => void;
}

export const TaskCollaboratorsEditor: React.FC<TaskCollaboratorsEditorProps> = ({ taskId, users, onChange }) => {
  const [collaborators, setCollaborators] = useState<TaskCollaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService.getTaskCollaborators(taskId)
      .then((data) => { if (!cancelled) setCollaborators(data); })
      .catch(() => { if (!cancelled) message.error('Error al cargar colaboradores'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  const handleAdd = async (userId: number) => {
    try {
      setAdding(true);
      const created = await apiService.addTaskCollaborator(taskId, userId);
      setCollaborators((prev) => [...prev, created]);
      onChange?.();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al agregar colaborador');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (collaboratorId: number) => {
    const previous = collaborators;
    setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
    try {
      await apiService.removeTaskCollaborator(taskId, collaboratorId);
      onChange?.();
    } catch (error) {
      message.error('Error al quitar colaborador');
      setCollaborators(previous);
    }
  };

  const availableUsers = users.filter((u) => !collaborators.some((c) => c.user_id === u.id));

  return (
    <div>
      <Text strong>Colaboradores adicionales</Text>
      <div style={{ margin: '8px 0' }}>
        {loading && <Text type="secondary">Cargando...</Text>}
        {!loading && collaborators.length === 0 && <Text type="secondary">Sin colaboradores adicionales</Text>}
        <Space wrap size="small">
          {collaborators.map((c) => (
            <Tag key={c.id} closable onClose={(e) => { e.preventDefault(); handleRemove(c.id); }}>
              {c.full_name}
            </Tag>
          ))}
        </Space>
      </div>
      <Select
        showSearch
        placeholder="Agregar colaborador..."
        style={{ width: '100%' }}
        value={undefined}
        loading={adding}
        disabled={adding}
        onChange={handleAdd}
        optionFilterProp="children"
      >
        {availableUsers.map((u) => (
          <Option key={u.id} value={u.id}>{u.full_name}</Option>
        ))}
      </Select>
    </div>
  );
};
