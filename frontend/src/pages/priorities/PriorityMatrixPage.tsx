import React, { useEffect, useState } from 'react';
import { Typography, Tabs } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';
import { Project } from '@/types/project';
import ProjectPriorityMatrix from '@/components/projects/ProjectPriorityMatrix';
import TaskPriorityMatrix from '@/components/tasks/TaskPriorityMatrix';
import { EmptyState, LoadingState } from '@/components/common';

const { Title, Text } = Typography;

const PriorityMatrixPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, tasksData] = await Promise.all([
        apiService.getProjects(),
        apiService.getTasks({ limit: 300 })
      ]);
      setProjects(projectsData || []);
      const allTasks = Array.isArray(tasksData) ? tasksData : (tasksData?.tasks || []);
      setTasks(allTasks.filter((t: any) => t.status !== 'done'));
    } catch (error) {
      console.error('Error loading priority matrix data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Matrices de Prioridad
        </Title>
        <Text type="secondary">
          Herramientas de decisión estratégica para priorizar proyectos y tareas.
        </Text>
      </div>

      {loading ? (
        <LoadingState tip="Cargando matrices…" minHeight={220} />
      ) : (
        <Tabs
          defaultActiveKey="projects"
          items={[
            {
              key: 'projects',
              label: 'Proyectos (ROI vs Complejidad)',
              children: projects.length > 0
                ? <ProjectPriorityMatrix projects={projects} />
                : <EmptyState description="No hay proyectos para mostrar" />
            },
            {
              key: 'tasks',
              label: 'Tareas (Urgencia vs Impacto)',
              children: tasks.length > 0
                ? <TaskPriorityMatrix tasks={tasks} />
                : <EmptyState description="No hay tareas activas para mostrar" />
            }
          ]}
        />
      )}
    </div>
  );
};

export default PriorityMatrixPage;
