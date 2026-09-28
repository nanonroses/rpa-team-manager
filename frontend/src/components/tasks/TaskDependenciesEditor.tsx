import React, { useEffect, useState } from 'react';
import { List, Select, InputNumber, Button, Typography, Space, Tag, message, Card } from 'antd';
import { DeleteOutlined, PlusOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';

const { Text } = Typography;

export interface TaskDependencyItem {
  dependency_id: number;
  task_id: number;
  title: string;
  status: string;
  dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  lag_days: number;
}

export interface TaskDependenciesData {
  depends_on: TaskDependencyItem[];
  blocks: TaskDependencyItem[];
}

export interface AvailableTask {
  id: number;
  title: string;
  status?: string;
}

interface TaskDependenciesEditorProps {
  taskId: number;
  availableTasks?: AvailableTask[];
  onChange?: () => void;
}

export const formatDependencyType = (type: string): string => {
  switch (type) {
    case 'finish_to_start':
      return 'FS (Fin a Inicio)';
    case 'start_to_start':
      return 'SS (Inicio a Inicio)';
    case 'finish_to_finish':
      return 'FF (Fin a Fin)';
    case 'start_to_finish':
      return 'SF (Inicio a Fin)';
    default:
      return type || 'FS';
  }
};

const getStatusColor = (status?: string): string => {
  switch (status?.toLowerCase()) {
    case 'done':
    case 'completed':
      return 'success';
    case 'in_progress':
    case 'in progress':
      return 'processing';
    case 'review':
      return 'warning';
    case 'blocked':
      return 'error';
    default:
      return 'default';
  }
};

export const TaskDependenciesEditor: React.FC<TaskDependenciesEditorProps> = ({
  taskId,
  availableTasks = [],
  onChange
}) => {
  const [dependencies, setDependencies] = useState<TaskDependenciesData>({ depends_on: [], blocks: [] });
  const [loading, setLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [dependencyType, setDependencyType] = useState<string>('finish_to_start');
  const [lagDays, setLagDays] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadDependencies = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTaskDependencies(taskId);
      setDependencies(data || { depends_on: [], blocks: [] });
    } catch (error) {
      message.error('Error al cargar dependencias de la tarea');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, [taskId]);

  const handleCreate = async () => {
    if (!selectedTaskId) {
      message.warning('Seleccioná una tarea para vincular');
      return;
    }

    try {
      setSubmitting(true);
      await apiService.createTaskDependency(taskId, {
        depends_on_task_id: selectedTaskId,
        dependency_type: dependencyType,
        lag_days: Number(lagDays) || 0
      });
      message.success('Dependencia agregada con éxito');
      setSelectedTaskId(null);
      setDependencyType('finish_to_start');
      setLagDays(0);
      setShowAdvanced(false);
      await loadDependencies();
      onChange?.();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Error al crear la dependencia';
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (dependencyId: number) => {
    try {
      await apiService.deleteTaskDependency(taskId, dependencyId);
      message.success('Dependencia eliminada');
      await loadDependencies();
      onChange?.();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || 'Error al eliminar la dependencia';
      message.error(errorMsg);
    }
  };

  // Filter available candidate tasks:
  // Cannot depend on itself, and cannot depend on a task it already depends on
  const existingPredecessorIds = new Set(dependencies.depends_on.map((d) => d.task_id));
  const candidateTasks = availableTasks.filter(
    (t) => t.id !== taskId && !existingPredecessorIds.has(t.id)
  );

  const totalDeps = dependencies.depends_on.length + dependencies.blocks.length;

  return (
    <div data-testid="task-dependencies-editor">
      <Space align="center" style={{ marginBottom: 12 }}>
        <LinkOutlined />
        <Text strong>
          Dependencias {totalDeps > 0 ? `(${totalDeps})` : ''}
        </Text>
      </Space>

      {/* Formulario de vinculación */}
      <Card size="small" style={{ marginBottom: 16, background: 'rgba(0, 0, 0, 0.02)' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap style={{ width: '100%' }}>
            <Select
              showSearch
              placeholder="Seleccionar tarea predecesora..."
              value={selectedTaskId}
              onChange={(val) => setSelectedTaskId(val)}
              style={{ minWidth: 260, flex: 1 }}
              filterOption={(input, option) =>
                (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
              }
              options={candidateTasks.map((t) => ({
                value: t.id,
                label: `#${t.id} - ${t.title}`
              }))}
              notFoundContent={
                availableTasks.length <= 1
                  ? 'No hay otras tareas en el tablero'
                  : 'No hay más tareas disponibles para vincular'
              }
            />

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              loading={submitting}
              disabled={!selectedTaskId}
            >
              Vincular
            </Button>

            <Button
              type="dashed"
              size="middle"
              icon={<SettingOutlined />}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Ocultar opciones' : 'Avanzado'}
            </Button>
          </Space>

          {showAdvanced && (
            <div
              data-testid="advanced-dependency-options"
              style={{
                padding: '8px 12px',
                background: 'rgba(0, 0, 0, 0.03)',
                borderRadius: 4
              }}
            >
              <Space wrap size="middle">
                <div>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                    Tipo de dependencia:
                  </Text>
                  <Select
                    value={dependencyType}
                    onChange={(val) => setDependencyType(val)}
                    style={{ width: 190 }}
                    options={[
                      { value: 'finish_to_start', label: 'Fin a Inicio (FS)' },
                      { value: 'start_to_start', label: 'Inicio a Inicio (SS)' },
                      { value: 'finish_to_finish', label: 'Fin a Fin (FF)' },
                      { value: 'start_to_finish', label: 'Inicio a Fin (SF)' }
                    ]}
                  />
                </div>

                <div>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                    Días de desfase (lag):
                  </Text>
                  <InputNumber
                    min={0}
                    value={lagDays}
                    onChange={(val) => setLagDays(val || 0)}
                    addonAfter="días"
                    style={{ width: 130 }}
                  />
                </div>
              </Space>
            </div>
          )}
        </Space>
      </Card>

      {/* Sección 1: Depende de (Predecesoras) */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 13, color: '#595959' }}>
          Depende de ({dependencies.depends_on.length})
        </Text>
        <List
          size="small"
          loading={loading}
          dataSource={dependencies.depends_on}
          locale={{ emptyText: 'Esta tarea no depende de ninguna otra' }}
          style={{ marginTop: 6 }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="delete"
                  type="text"
                  size="small"
                  danger
                  aria-label="Eliminar dependencia"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(item.dependency_id)}
                />
              ]}
            >
              <Space wrap align="center">
                <Text style={{ fontWeight: 500 }}>#{item.task_id} {item.title}</Text>
                {item.status && <Tag color={getStatusColor(item.status)}>{item.status}</Tag>}
                <Tag color="blue">{formatDependencyType(item.dependency_type)}</Tag>
                {item.lag_days > 0 && <Tag color="orange">+{item.lag_days}d lag</Tag>}
              </Space>
            </List.Item>
          )}
        />
      </div>

      {/* Sección 2: Bloquea a (Sucesoras) */}
      <div>
        <Text strong style={{ fontSize: 13, color: '#595959' }}>
          Bloquea a ({dependencies.blocks.length})
        </Text>
        <List
          size="small"
          loading={loading}
          dataSource={dependencies.blocks}
          locale={{ emptyText: 'Esta tarea no bloquea ninguna otra' }}
          style={{ marginTop: 6 }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="delete"
                  type="text"
                  size="small"
                  danger
                  aria-label="Eliminar dependencia"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(item.dependency_id)}
                />
              ]}
            >
              <Space wrap align="center">
                <Text style={{ fontWeight: 500 }}>#{item.task_id} {item.title}</Text>
                {item.status && <Tag color={getStatusColor(item.status)}>{item.status}</Tag>}
                <Tag color="cyan">{formatDependencyType(item.dependency_type)}</Tag>
                {item.lag_days > 0 && <Tag color="orange">+{item.lag_days}d lag</Tag>}
              </Space>
            </List.Item>
          )}
        />
      </div>
    </div>
  );
};
