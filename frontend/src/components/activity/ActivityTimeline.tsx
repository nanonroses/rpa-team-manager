import React, { useEffect, useState, useCallback } from 'react';
import { Card, Timeline, Typography, message } from 'antd';
import { apiService } from '@/services/api';
import { ActivityLogEntry } from '@/types/activity';

const { Text } = Typography;

const ACTION_LABEL: Record<string, string> = {
  created: 'creó',
  updated: 'actualizó',
  deleted: 'eliminó',
  moved: 'movió',
  board_created: 'creó un tablero nuevo',
  tasks_batch_created: 'creó varias tareas en lote',
  tasks_batch_deleted: 'eliminó varias tareas en lote',
  task_deleted: 'eliminó una tarea de',
  created_from_quote: 'creó desde cotización',
  milestone_created: 'agregó un hito técnico nuevo',
  milestone_updated: 'cambió el estado o la fecha de un hito técnico',
  milestone_deleted: 'eliminó un hito técnico',
  log_entry_created: 'agregó una entrada a la bitácora del proyecto'
};

// Acciones cuyo label es autocontenido (no se les debe anexar el sufijo de entidad).
const SELF_CONTAINED_ACTIONS = new Set([
  'board_created', 'tasks_batch_created', 'tasks_batch_deleted',
  'milestone_created', 'milestone_updated', 'milestone_deleted', 'log_entry_created'
]);

function summarizeValues(values: Record<string, any> | null | undefined): string | null {
  if (!values) return null;

  const fields = Object.keys(values);
  if (fields.length === 0) return null;

  return fields
    .map((field) => `${field}: ${values[field] ?? '—'}`)
    .join(', ');
}

function renderDiffSummary(entry: ActivityLogEntry): string | null {
  if (entry.new_values) {
    const fields = Object.keys(entry.new_values);
    if (fields.length === 0) return null;

    return fields
      .map((field) => {
        const newValue = entry.new_values?.[field];
        const oldValue = entry.old_values?.[field];
        if (oldValue !== undefined && oldValue !== newValue) {
          return `${field}: ${oldValue ?? '—'} → ${newValue ?? '—'}`;
        }
        return `${field}: ${newValue ?? '—'}`;
      })
      .join(', ');
  }

  // Sin new_values (p.ej. acciones de borrado): usar old_values como resumen identificatorio.
  return summarizeValues(entry.old_values);
}

interface ActivityTimelineProps {
  projectId: number;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ projectId }) => {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjectActivity(projectId, { limit: 50, offset: 0 });
      setEntries(data);
    } catch (error) {
      message.error('No se pudo cargar el historial de actividad');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  if (loading) {
    return <Card loading title="Actividad" />;
  }

  return (
    <Card title="Actividad" size="small">
      {entries.length === 0 ? (
        <Text type="secondary">Sin actividad registrada todavía.</Text>
      ) : (
        <Timeline
          items={entries.map((entry) => ({
            key: entry.id,
            children: (
              <div>
                <Text strong>{entry.user_name || 'Usuario desconocido'}</Text>
                {' '}
                <Text>{ACTION_LABEL[entry.action] || entry.action}</Text>
                {!SELF_CONTAINED_ACTIONS.has(entry.action) && (
                  <>
                    {' '}
                    <Text type="secondary">
                      {entry.entity_type === 'task' ? 'una tarea' : 'el proyecto'}
                    </Text>
                  </>
                )}
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(entry.created_at).toLocaleString('es-CL')}
                </Text>
                {renderDiffSummary(entry) && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {renderDiffSummary(entry)}
                    </Text>
                  </div>
                )}
              </div>
            )
          }))}
        />
      )}
    </Card>
  );
};
