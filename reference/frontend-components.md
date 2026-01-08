# Guía de Componentes Frontend

## Stack Frontend

- **React 18** con TypeScript
- **Ant Design** para componentes UI
- **Vite** para build/dev
- **React Query** para data fetching
- **Zustand** para state management
- **React Router** para navegación

## Estructura de Páginas

```typescript
// frontend/src/pages/[modulo]/[Modulo]Page.tsx
import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../../services/api';

const ModuloPage: React.FC = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/endpoint');
      setData(response.data);
    } catch (error) {
      message.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Card title="Título del Módulo" extra={
        <Button type="primary" icon={<PlusOutlined />}>
          Nuevo
        </Button>
      }>
        <Table
          dataSource={data}
          loading={loading}
          rowKey="id"
          columns={columns}
        />
      </Card>
    </div>
  );
};

export default ModuloPage;
```

## Estructura de Componentes

```typescript
// frontend/src/components/[categoria]/[Componente].tsx
import React from 'react';

interface ComponenteProps {
  titulo: string;
  onAction: () => void;
  isLoading?: boolean;
}

export const Componente: React.FC<ComponenteProps> = ({
  titulo,
  onAction,
  isLoading = false,
}) => {
  return (
    <div className="componente">
      <h3>{titulo}</h3>
      <button onClick={onAction} disabled={isLoading}>
        {isLoading ? 'Cargando...' : 'Acción'}
      </button>
    </div>
  );
};
```

## Componentes Ant Design Comunes

```tsx
import {
  // Layout
  Layout, Card, Space, Divider,
  // Data Display
  Table, List, Descriptions, Tag, Badge, Avatar,
  // Data Entry
  Form, Input, Select, DatePicker, InputNumber, Switch, Upload,
  // Feedback
  Modal, message, notification, Spin, Alert,
  // Navigation
  Menu, Breadcrumb, Tabs,
  // Actions
  Button, Dropdown, Popconfirm,
} from 'antd';

// Icons
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, DownloadOutlined, UploadOutlined,
  CheckOutlined, CloseOutlined, WarningOutlined,
} from '@ant-design/icons';
```

## Formularios con Ant Design

```tsx
import { Form, Input, Select, DatePicker, Button, message } from 'antd';

const FormularioEjemplo: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      await api.post('/endpoint', values);
      message.success('Guardado exitosamente');
      form.resetFields();
    } catch (error) {
      message.error('Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        name="nombre"
        label="Nombre"
        rules={[{ required: true, message: 'Campo requerido' }]}
      >
        <Input placeholder="Ingrese nombre" />
      </Form.Item>

      <Form.Item
        name="estado"
        label="Estado"
        initialValue="active"
      >
        <Select>
          <Select.Option value="active">Activo</Select.Option>
          <Select.Option value="inactive">Inactivo</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          Guardar
        </Button>
      </Form.Item>
    </Form>
  );
};
```

## Tablas con Acciones

```tsx
const columns = [
  {
    title: 'Nombre',
    dataIndex: 'name',
    key: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
  },
  {
    title: 'Estado',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <Tag color={status === 'active' ? 'green' : 'red'}>
        {status === 'active' ? 'Activo' : 'Inactivo'}
      </Tag>
    ),
    filters: [
      { text: 'Activo', value: 'active' },
      { text: 'Inactivo', value: 'inactive' },
    ],
    onFilter: (value, record) => record.status === value,
  },
  {
    title: 'Acciones',
    key: 'actions',
    render: (_, record) => (
      <Space>
        <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
        <Popconfirm
          title="¿Eliminar este registro?"
          onConfirm={() => handleDelete(record.id)}
          okText="Sí"
          cancelText="No"
        >
          <Button danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  },
];
```

## Modales

```tsx
const [modalVisible, setModalVisible] = useState(false);
const [editingItem, setEditingItem] = useState(null);

const handleEdit = (item) => {
  setEditingItem(item);
  form.setFieldsValue(item);
  setModalVisible(true);
};

<Modal
  title={editingItem ? 'Editar' : 'Nuevo'}
  open={modalVisible}
  onCancel={() => setModalVisible(false)}
  footer={null}
  destroyOnClose
>
  <FormularioEjemplo />
</Modal>
```

## API Service

```typescript
// frontend/src/services/api.ts ya tiene métodos configurados
import { api } from '../services/api';

// GET
const data = await api.get('/projects');

// POST
await api.post('/projects', { name: 'Nuevo' });

// PUT
await api.put(`/projects/${id}`, { name: 'Actualizado' });

// DELETE
await api.delete(`/projects/${id}`);
```

## React Router

```tsx
// Agregar nueva ruta en App.tsx
<Route path="/nueva-pagina" element={
  <ProtectedRoute>
    <NuevaPagina />
  </ProtectedRoute>
} />
```

## Archivos Relacionados

- Páginas: `frontend/src/pages/`
- Componentes: `frontend/src/components/`
- Services: `frontend/src/services/`
- Stores: `frontend/src/store/`
- Estilos: `frontend/src/styles/`
