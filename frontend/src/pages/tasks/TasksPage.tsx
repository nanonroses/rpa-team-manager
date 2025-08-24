import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Select, 
  Typography, 
  Space, 
  Row, 
  Col, 
  Tag, 
  Avatar,
  Modal,
  Form,
  Input,
  DatePicker,
  message,
  Empty,
  Tooltip,
  Badge,
  Dropdown,
  Menu,
  Spin
} from 'antd';
import { 
  PlusOutlined, 
  ProjectOutlined,
  UserOutlined,
  CalendarOutlined,
  FlagOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { apiService } from '@/services/api';
import { getPriorityColor } from '@/utils';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface Project {
  id: number;
  name: string;
}

interface User {
  id: number;
  full_name: string;
  avatar_url?: string;
}

interface TaskColumn {
  id: number;
  board_id: number;
  name: string;
  position: number;
  color: string;
  is_done_column: boolean;
}

interface Task {
  id: number;
  board_id: number;
  column_id: number;
  title: string;
  description?: string;
  task_type: 'task' | 'bug' | 'feature' | 'research' | 'documentation';
  status: 'todo' | 'in_progress' | 'review' | 'testing' | 'done' | 'blocked';
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignee_id?: number;
  assignee_name?: string;
  assignee_avatar?: string;
  reporter_name?: string;
  estimated_hours?: number;
  story_points?: number;
  due_date?: string;
  position: number;
  total_hours?: number;
  total_value?: number;
  created_at: string;
  updated_at: string;
}

interface Board {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  board_type: string;
  project_name: string;
  columns: TaskColumn[];
  tasks: Task[];
}

export const TasksPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  
  // Modal states
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  
  const [form] = Form.useForm();
  const [boardForm] = Form.useForm();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadBoards();
    }
  }, [selectedProject]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [projectsData, usersData] = await Promise.all([
        apiService.getProjects(),
        apiService.get('/auth/users')
      ]);
      
      setProjects(projectsData);
      setUsers(usersData || []);
      
      // Auto-select first project if available
      if (projectsData.length > 0) {
        setSelectedProject(projectsData[0].id);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      message.error('Error al cargar datos iniciales');
    } finally {
      setLoading(false);
    }
  };

  const loadBoards = async () => {
    if (!selectedProject) return;
    
    try {
      setBoardLoading(true);
      const boardsData = await apiService.get(`/tasks/boards?project_id=${selectedProject}`);
      setBoards(boardsData || []);
      
      // Auto-select first board if available
      if (boardsData.length > 0) {
        loadBoard(boardsData[0].id);
      } else {
        setSelectedBoard(null);
      }
    } catch (error) {
      console.error('Error loading boards:', error);
      message.error('Error al cargar boards');
    } finally {
      setBoardLoading(false);
    }
  };

  const loadBoard = async (boardId: number) => {
    try {
      setBoardLoading(true);
      const board = await apiService.get(`/tasks/boards/${boardId}`);
      setSelectedBoard(board);
    } catch (error) {
      console.error('Error loading board:', error);
      message.error('Error al cargar board');
    } finally {
      setBoardLoading(false);
    }
  };

  const handleCreateBoard = async (values: any) => {
    try {
      const newBoard = await apiService.post('/tasks/boards', {
        ...values,
        project_id: selectedProject
      });
      
      message.success('Board creado exitosamente');
      setIsCreateBoardModalOpen(false);
      boardForm.resetFields();
      loadBoards();
    } catch (error: any) {
      console.error('Error creating board:', error);
      message.error(error.response?.data?.error || 'Error al crear board');
    }
  };

  const handleCreateTask = async (values: any) => {
    try {
      const taskData = {
        ...values,
        board_id: selectedBoard?.id,
        column_id: selectedColumn || selectedBoard?.columns[0]?.id,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
      };

      await apiService.post('/tasks', taskData);
      
      message.success('Tarea creada exitosamente');
      setIsCreateTaskModalOpen(false);
      setSelectedColumn(null);
      form.resetFields();
      
      if (selectedBoard) {
        loadBoard(selectedBoard.id);
      }
    } catch (error: any) {
      console.error('Error creating task:', error);
      message.error(error.response?.data?.error || 'Error al crear tarea');
    }
  };

  const handleUpdateTask = async (values: any) => {
    if (!editingTask) return;
    
    try {
      const taskData = {
        ...values,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
      };

      await apiService.put(`/tasks/${editingTask.id}`, taskData);
      
      message.success('Tarea actualizada exitosamente');
      setEditingTask(null);
      form.resetFields();
      
      if (selectedBoard) {
        loadBoard(selectedBoard.id);
      }
    } catch (error: any) {
      console.error('Error updating task:', error);
      message.error(error.response?.data?.error || 'Error al actualizar tarea');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await apiService.delete(`/tasks/${taskId}`);
      message.success('Tarea eliminada exitosamente');
      
      if (selectedBoard) {
        loadBoard(selectedBoard.id);
      }
    } catch (error: any) {
      console.error('Error deleting task:', error);
      message.error(error.response?.data?.error || 'Error al eliminar tarea');
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !selectedBoard) return;

    const { source, destination, draggableId } = result;
    const taskId = parseInt(draggableId);

    // If dropped in same position, do nothing
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceColumnId = parseInt(source.droppableId);
    const destColumnId = parseInt(destination.droppableId);
    
    // Optimistic update: immediately update the UI
    const updatedBoard = { ...selectedBoard };
    const updatedTasks = [...updatedBoard.tasks];
    
    // Find the task being moved
    const taskIndex = updatedTasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      const movedTask = { ...updatedTasks[taskIndex] };
      movedTask.column_id = destColumnId;
      
      // Remove task from its current position
      updatedTasks.splice(taskIndex, 1);
      
      // Get tasks in destination column (after removing the moved task)
      const destColumnTasks = updatedTasks.filter(t => t.column_id === destColumnId);
      
      // Find the correct insertion index in the full array
      let insertIndex;
      if (destColumnTasks.length === 0) {
        // If destination column is empty, append to end
        insertIndex = updatedTasks.length;
      } else if (destination.index >= destColumnTasks.length) {
        // If dropping at the end of the column
        const lastTaskIndex = updatedTasks.findIndex(t => t.id === destColumnTasks[destColumnTasks.length - 1].id);
        insertIndex = lastTaskIndex + 1;
      } else {
        // If dropping in the middle, find the task at destination index
        const targetTask = destColumnTasks[destination.index];
        insertIndex = updatedTasks.findIndex(t => t.id === targetTask.id);
      }
      
      // Insert at correct position
      updatedTasks.splice(insertIndex, 0, movedTask);
      
      updatedBoard.tasks = updatedTasks;
      setSelectedBoard(updatedBoard);
    }

    try {
      await apiService.post(`/tasks/${taskId}/move`, {
        column_id: destColumnId,
        position: destination.index + 1
      });

      // Reload board to get the accurate state from server
      setTimeout(() => loadBoard(selectedBoard.id), 100);
    } catch (error: any) {
      console.error('Error moving task:', error);
      message.error(error.response?.data?.error || 'Error al mover tarea');
      // Revert optimistic update on error
      loadBoard(selectedBoard.id);
    }
  };

  const openCreateTaskModal = (columnId?: number) => {
    setSelectedColumn(columnId || null);
    setIsCreateTaskModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    form.setFieldsValue({
      title: task.title,
      description: task.description,
      task_type: task.task_type,
      priority: task.priority,
      assignee_id: task.assignee_id,
      estimated_hours: task.estimated_hours,
      story_points: task.story_points,
      due_date: task.due_date ? dayjs(task.due_date) : null,
      column_id: task.column_id
    });
  };


  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return '🐛';
      case 'feature': return '✨';
      case 'research': return '🔍';
      case 'documentation': return '📄';
      default: return '📋';
    }
  };

  const renderTaskCard = (task: Task, index: number) => (
    <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={{
            ...provided.draggableProps.style,
            marginBottom: 8
          }}
        >
          <Card
            size="small"
            style={{
              backgroundColor: snapshot.isDragging ? '#f0f0f0' : 'white',
              boxShadow: snapshot.isDragging ? '0 4px 8px rgba(0,0,0,0.2)' : undefined,
              cursor: snapshot.isDragging ? 'grabbing' : 'grab'
            }}
          >
            {/* Drag handle area */}
            <div {...provided.dragHandleProps} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ marginRight: 8 }}>{getTaskTypeIcon(task.task_type)}</span>
                <Text strong style={{ flex: 1 }}>{task.title}</Text>
                <Tag color={getPriorityColor(task.priority)} size="small">
                  {task.priority.toUpperCase()}
                </Tag>
              </div>
              
              {task.description && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  {task.description.substring(0, 100)}
                  {task.description.length > 100 ? '...' : ''}
                </Text>
              )}
              
              <Space wrap size="small">
                {task.assignee_name && (
                  <Tooltip title={task.assignee_name}>
                    <Avatar size="small" icon={<UserOutlined />} />
                  </Tooltip>
                )}
                
                {task.due_date && (
                  <Tooltip title={`Vence: ${dayjs(task.due_date).format('DD/MM/YYYY')}`}>
                    <Tag icon={<CalendarOutlined />} size="small">
                      {dayjs(task.due_date).format('DD/MM')}
                    </Tag>
                  </Tooltip>
                )}
                
                {task.estimated_hours && (
                  <Tooltip title={`Estimado: ${task.estimated_hours}h`}>
                    <Tag icon={<ClockCircleOutlined />} size="small">
                      {task.estimated_hours}h
                    </Tag>
                  </Tooltip>
                )}
                
                {task.total_hours && (
                  <Tooltip title={`Trabajado: ${task.total_hours}h - $${task.total_value?.toLocaleString()}`}>
                    <Tag icon={<DollarOutlined />} color="green" size="small">
                      ${task.total_value?.toLocaleString()}
                    </Tag>
                  </Tooltip>
                )}
              </Space>
            </div>

            {/* Action buttons - outside drag handle */}
            <div 
              style={{ 
                marginTop: 8, 
                paddingTop: 8, 
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 4
              }}
            >
              <Tooltip title="Editar">
                <Button 
                  size="small"
                  type="text" 
                  icon={<EditOutlined />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditTaskModal(task);
                  }}
                />
              </Tooltip>
              <Tooltip title="Eliminar">
                <Button 
                  size="small"
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    Modal.confirm({
                      title: '¿Eliminar tarea?',
                      content: 'Esta acción no se puede deshacer.',
                      okText: 'Eliminar',
                      okType: 'danger',
                      cancelText: 'Cancelar',
                      onOk: () => handleDeleteTask(task.id)
                    });
                  }}
                />
              </Tooltip>
            </div>
          </Card>
        </div>
      )}
    </Draggable>
  );

  const renderColumn = (column: TaskColumn) => {
    const columnTasks = selectedBoard?.tasks.filter(task => task.column_id === column.id) || [];
    
    return (
      <Col key={column.id} xs={24} sm={12} lg={6} style={{ marginBottom: 16 }}>
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge count={columnTasks.length} showZero>
                <Text strong>{column.name}</Text>
              </Badge>
              <Button
                type="text"
                icon={<PlusOutlined />}
                size="small"
                onClick={() => openCreateTaskModal(column.id)}
              />
            </div>
          }
          style={{ 
            backgroundColor: column.color,
            height: '600px',
            overflow: 'auto'
          }}
          bodyStyle={{ padding: 8 }}
        >
          <Droppable droppableId={column.id.toString()}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                style={{
                  minHeight: 500,
                  backgroundColor: snapshot.isDraggingOver ? '#f0f9ff' : 'transparent',
                  padding: 4,
                  borderRadius: 4
                }}
              >
                {columnTasks.map((task, index) => renderTaskCard(task, index))}
                {provided.placeholder}
                
                {columnTasks.length === 0 && (
                  <Empty 
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No hay tareas"
                    style={{ marginTop: 50 }}
                  />
                )}
              </div>
            )}
          </Droppable>
        </Card>
      </Col>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Cargando...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>📋 Tasks Management</Title>
        <Text type="secondary">
          Gestiona tareas con boards Kanban y seguimiento de tiempo
        </Text>
      </div>

      {/* Project and Board Selection */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8}>
            <Space>
              <Text strong>Proyecto:</Text>
              <Select
                style={{ minWidth: 200 }}
                value={selectedProject}
                onChange={setSelectedProject}
                placeholder="Seleccionar proyecto"
              >
                {projects.map(project => (
                  <Option key={project.id} value={project.id}>
                    {project.name}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          
          <Col xs={24} sm={8}>
            <Space>
              <Text strong>Board:</Text>
              <Select
                style={{ minWidth: 200 }}
                value={selectedBoard?.id}
                onChange={loadBoard}
                placeholder="Seleccionar board"
                loading={boardLoading}
              >
                {boards.map(board => (
                  <Option key={board.id} value={board.id}>
                    {board.name}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          
          <Col xs={24} sm={8}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsCreateBoardModalOpen(true)}
                disabled={!selectedProject}
              >
                Nuevo Board
              </Button>
              
              <Button
                icon={<PlusOutlined />}
                onClick={() => openCreateTaskModal()}
                disabled={!selectedBoard}
              >
                Nueva Tarea
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Kanban Board */}
      {selectedBoard ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          {boardLoading ? (
            <div style={{ textAlign: 'center', padding: 50 }}>
              <Spin size="large" />
            </div>
          ) : (
            <Row gutter={16}>
              {selectedBoard.columns.map(column => renderColumn(column))}
            </Row>
          )}
        </DragDropContext>
      ) : (
        <Card style={{ textAlign: 'center', padding: 50 }}>
          <Empty
            description={
              selectedProject 
                ? "No hay boards disponibles. Crea uno para comenzar."
                : "Selecciona un proyecto para ver los boards"
            }
          />
          {selectedProject && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsCreateBoardModalOpen(true)}
              style={{ marginTop: 16 }}
            >
              Crear Primer Board
            </Button>
          )}
        </Card>
      )}

      {/* Create Board Modal */}
      <Modal
        title="Crear Nuevo Board"
        open={isCreateBoardModalOpen}
        onCancel={() => {
          setIsCreateBoardModalOpen(false);
          boardForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={boardForm}
          layout="vertical"
          onFinish={handleCreateBoard}
        >
          <Form.Item
            name="name"
            label="Nombre del Board"
            rules={[{ required: true, message: 'Ingrese el nombre del board' }]}
          >
            <Input placeholder="Ej: Sprint 1, Desarrollo, Testing..." />
          </Form.Item>
          
          <Form.Item name="description" label="Descripción">
            <TextArea rows={3} placeholder="Descripción opcional del board..." />
          </Form.Item>
          
          <Form.Item name="board_type" label="Tipo de Board" initialValue="kanban">
            <Select>
              <Option value="kanban">Kanban</Option>
              <Option value="scrum">Scrum</Option>
              <Option value="custom">Personalizado</Option>
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Crear Board
              </Button>
              <Button onClick={() => {
                setIsCreateBoardModalOpen(false);
                boardForm.resetFields();
              }}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Create/Edit Task Modal */}
      <Modal
        title={editingTask ? 'Editar Tarea' : 'Nueva Tarea'}
        open={isCreateTaskModalOpen || !!editingTask}
        onCancel={() => {
          setIsCreateTaskModalOpen(false);
          setEditingTask(null);
          setSelectedColumn(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingTask ? handleUpdateTask : handleCreateTask}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="title"
                label="Título"
                rules={[{ required: true, message: 'Ingrese el título de la tarea' }]}
              >
                <Input placeholder="Título de la tarea..." />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="task_type" label="Tipo" initialValue="task">
                <Select>
                  <Option value="task">📋 Tarea</Option>
                  <Option value="bug">🐛 Bug</Option>
                  <Option value="feature">✨ Feature</Option>
                  <Option value="research">🔍 Investigación</Option>
                  <Option value="documentation">📄 Documentación</Option>
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={8}>
              <Form.Item name="priority" label="Prioridad" initialValue="medium">
                <Select>
                  <Option value="critical">🔴 Crítica</Option>
                  <Option value="high">🟠 Alta</Option>
                  <Option value="medium">🔵 Media</Option>
                  <Option value="low">🟢 Baja</Option>
                </Select>
              </Form.Item>
            </Col>

            {editingTask && (
              <Col span={8}>
                <Form.Item name="column_id" label="Columna">
                  <Select>
                    {selectedBoard?.columns.map(column => (
                      <Option key={column.id} value={column.id}>
                        {column.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
          </Row>
          
          <Form.Item name="description" label="Descripción">
            <TextArea rows={4} placeholder="Describe la tarea..." />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assignee_id" label="Asignado a">
                <Select placeholder="Seleccionar usuario" allowClear>
                  {users.map(user => (
                    <Option key={user.id} value={user.id}>
                      {user.full_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item name="due_date" label="Fecha límite">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="estimated_hours" label="Horas estimadas">
                <Input type="number" step="0.5" placeholder="Ej: 8" />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item name="story_points" label="Story Points">
                <Input type="number" placeholder="Ej: 5" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingTask ? 'Actualizar' : 'Crear'} Tarea
              </Button>
              <Button onClick={() => {
                setIsCreateTaskModalOpen(false);
                setEditingTask(null);
                setSelectedColumn(null);
                form.resetFields();
              }}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};