import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Timeline, Typography, Button, Select, Input, List, Empty, message, Space, Tag } from 'antd';
import { FundOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';
import { fileService } from '@/services/fileService';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

interface MilestoneSummary {
  id: number;
  name: string;
  status: string;
  planned_date: string;
}

interface LogEntry {
  id: number;
  entry_type: string;
  description: string;
  author_name: string;
  created_at: string;
  file_id: number | null;
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  technical_milestone: 'Hito técnico',
  client_approval: 'Aprobación del cliente',
  decision: 'Decisión',
  scope_change: 'Cambio de alcance',
  incident: 'Incidente'
};

const ENTRY_TYPE_OPTIONS = Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label }));

interface ProjectMilestonesAndLogProps {
  projectId: number;
  canWriteLog: boolean;
}

export const ProjectMilestonesAndLog: React.FC<ProjectMilestonesAndLogProps> = ({ projectId, canWriteLog }) => {
  const navigate = useNavigate();
  const [milestones, setMilestones] = useState<MilestoneSummary[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryType, setEntryType] = useState<string>('technical_milestone');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [pmoData, logEntries] = await Promise.all([
        apiService.getProjectPMOMetrics(projectId).catch(() => null),
        apiService.getProjectLogEntries(projectId)
      ]);
      setMilestones(pmoData?.milestones?.list ?? []);
      setEntries(logEntries);
    } catch (error) {
      message.error('No se pudo cargar la información de hitos y bitácora');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async (fileId: number) => {
    try {
      const [blob, fileInfo] = await Promise.all([
        fileService.downloadFile(fileId),
        fileService.getFile(fileId).catch(() => null)
      ]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileInfo?.original_filename || `adjunto-${fileId}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error('No se pudo descargar el adjunto');
    }
  };

  const handleCreateEntry = async () => {
    const trimmed = description.trim();
    if (!trimmed) return;

    try {
      setPosting(true);
      let fileId: number | null = null;
      if (file) {
        const uploadResult = await fileService.uploadFiles([file]);
        fileId = uploadResult.files[0]?.id ?? null;
      }

      const created = await apiService.createProjectLogEntry(projectId, {
        entry_type: entryType,
        description: trimmed,
        file_id: fileId
      });
      setEntries((prev) => [created, ...prev]);
      setDescription('');
      setFile(null);
    } catch (error) {
      message.error('No se pudo agregar la entrada a la bitácora');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <Card loading title="Hitos y bitácora" />;
  }

  return (
    <div>
      <Card
        size="small"
        title={
          <span>
            <FundOutlined /> Hitos técnicos
          </span>
        }
        extra={<Button size="small" onClick={() => navigate(`/pmo/gantt/${projectId}`)}>Ver cronograma completo</Button>}
        style={{ marginBottom: 16 }}
      >
        {milestones.length > 0 ? (
          <Timeline
            items={milestones.slice(0, 5).map((milestone) => ({
              key: milestone.id,
              children: (
                <div>
                  <Text strong>{milestone.name}</Text>{' '}
                  <Tag>{milestone.status}</Tag>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {milestone.planned_date ? dayjs(milestone.planned_date).format('DD/MM/YYYY') : 'Sin fecha'}
                  </Text>
                </div>
              )
            }))}
          />
        ) : (
          <Empty description="Sin hitos definidos" />
        )}
      </Card>

      <Card size="small" title="Bitácora del proyecto">
        {canWriteLog && (
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
            <Select
              value={entryType}
              onChange={setEntryType}
              options={ENTRY_TYPE_OPTIONS}
              style={{ width: 240 }}
            />
            <TextArea
              placeholder="Descripción de la entrada"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoSize={{ minRows: 2 }}
            />
            <input
              type="file"
              aria-label="Adjuntar archivo"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button type="primary" onClick={handleCreateEntry} loading={posting}>
              Agregar entrada
            </Button>
          </Space>
        )}

        <List
          size="small"
          dataSource={entries}
          locale={{ emptyText: 'Sin entradas en la bitácora todavía' }}
          renderItem={(entry) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Tag>{ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}</Tag>
                    <Text type="secondary" style={{ fontWeight: 'normal', fontSize: 12 }}>
                      {entry.author_name} · {dayjs(entry.created_at).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  </Space>
                }
                description={
                  <div>
                    <Text>{entry.description}</Text>
                    {entry.file_id && (
                      <div>
                        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => handleDownload(entry.file_id!)}>
                          Descargar adjunto
                        </Button>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};
