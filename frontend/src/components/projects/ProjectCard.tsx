import React from 'react';
import { Button, Card, Dropdown, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { CalendarOutlined, MoreOutlined, EditOutlined, DeleteOutlined, EyeOutlined, UserOutlined, ApartmentOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Project, ProjectStatusLabels, PriorityLabels } from '@/types/project';
import { ProjectHealth } from '@/types/projectHealth';
import { useAuthStore } from '@/store/authStore';
import { getProjectStatusColor, getPriorityColor } from '@/utils';

const { Text, Title } = Typography;
interface ProjectCardProps { project: Project; health?: ProjectHealth; onEdit?: (project: Project) => void; onDelete?: (project: Project) => void; onView?: (project: Project) => void; onClick?: (project: Project) => void; }

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, health, onEdit, onDelete, onView, onClick }) => {
  const { user, hasPermission } = useAuthStore();
  const canEdit = user?.role === 'team_lead' || hasPermission('projects:update') || hasPermission('projects:*') || (user?.role === 'rpa_developer' && project.assigned_to === user.id);
  const canDelete = user?.role === 'team_lead' || hasPermission('projects:delete') || hasPermission('projects:*');
  const menuItems: MenuProps['items'] = [
    { key: 'view', icon: <EyeOutlined />, label: 'Ver ficha del proyecto', onClick: () => onView?.(project) },
    ...(canEdit ? [{ key: 'edit', icon: <EditOutlined />, label: 'Editar proyecto', onClick: () => onEdit?.(project) }] : []),
    ...(canDelete ? [{ type: 'divider' as const }, { key: 'delete', icon: <DeleteOutlined />, label: 'Eliminar proyecto', danger: true, onClick: () => onDelete?.(project) }] : [])
  ];
  const isOverdue = Boolean(project.end_date && dayjs(project.end_date).isBefore(dayjs(), 'day') && project.status !== 'completed');
  const stageLabel = ({ quoting: 'En cotización', approved: 'Aprobado', lost: 'Oportunidad perdida' } as Record<string, string>)[project.commercial_stage || 'approved'];
  const statusLabel = ({ active: 'En ejecución', on_hold: 'En pausa', completed: 'Completado', cancelled: 'Cancelado' } as Record<string, string>)[project.status] || ProjectStatusLabels[project.status];
  const healthLabels: Record<ProjectHealth['semaphore'], string> = { green: 'En curso', yellow: 'En riesgo', red: 'Desviado', gray: 'Datos insuficientes' };
  const healthColors: Record<ProjectHealth['semaphore'], string> = { green: 'green', yellow: 'orange', red: 'red', gray: 'default' };
  const progress = Math.max(0, Math.min(100, Number(project.progress_percentage) || 0));

  return <Card hoverable className={`project-card ${isOverdue ? 'overdue' : ''}`} onClick={() => onClick?.(project)} extra={<Dropdown menu={{ items: menuItems }} trigger={['click']}><Button aria-label={`Acciones para ${project.name}`} type="text" icon={<MoreOutlined />} size="small" onClick={(event) => event.stopPropagation()} /></Dropdown>}>
    <div className="project-card-heading"><div><Title level={5}>{project.name}</Title><Text type="secondary">{project.description?.trim() || 'Sin descripción registrada'}</Text></div></div>
    <div className="project-card-tags">
      <Tag color={getProjectStatusColor(project.status)}>{statusLabel}</Tag>
      {project.status === 'completed' && (
        project.financial_closed_at
          ? <Tag color="cyan">Cierre financiero OK</Tag>
          : <Tag color="gold">Cobranza pendiente</Tag>
      )}
      <Tag color={project.commercial_stage === 'quoting' ? 'gold' : project.commercial_stage === 'lost' ? 'default' : 'green'}>{stageLabel}</Tag>
      <Tag color={getPriorityColor(project.priority)}>{PriorityLabels[project.priority]}</Tag>
    </div>
    {health && <div className="project-card-health"><Text type="secondary">Salud PMO</Text><Tag color={healthColors[health.semaphore]}>{healthLabels[health.semaphore]}</Tag></div>}
    {project.client_name && <div className="project-card-meta"><ApartmentOutlined /><Text ellipsis>{project.client_name}</Text></div>}
    <div className="project-card-meta"><UserOutlined /><Text ellipsis>{project.assigned_to_name || 'Sin responsable asignado'}</Text></div>
    <div className="project-card-progress"><div><Text>Avance de tareas</Text><Text strong>{progress}% <span>({project.completed_tasks || 0}/{project.total_tasks || 0})</span></Text></div><Progress percent={progress} size="small" showInfo={false} status={progress === 100 ? 'success' : 'normal'} /></div>
    <div className="project-card-dates"><CalendarOutlined /><Text>{project.start_date ? dayjs(project.start_date).format('DD MMM YYYY') : 'Inicio sin definir'} <span>→</span> {project.end_date ? dayjs(project.end_date).format('DD MMM YYYY') : 'Término sin definir'}</Text>{isOverdue && <Tooltip title="La fecha de término ya pasó"><Tag color="error">Atrasado</Tag></Tooltip>}</div>
    {user?.role === 'team_lead' && project.total_hours_logged !== undefined && <Space className="project-card-hours"><Text type="secondary">Horas aprobadas: {Number(project.total_hours_logged).toFixed(1)} h</Text></Space>}
  </Card>;
};
