import React from 'react';
import { Button, Space, Typography } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { FileManager } from '@/components/files';

const { Title, Text } = Typography;

export const FilesPage: React.FC = () => {
  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <FolderOpenOutlined style={{ marginRight: 8 }} />
          Archivos y evidencias
        </Title>
        <Text type="secondary">
          Busca documentos y evidencias asociados a proyectos, tareas e ideas. Abre una asociación para volver a su origen.
        </Text>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Button><Link to="/projects">Ir a proyectos</Link></Button>
        <Button><Link to="/tasks">Ir a tareas</Link></Button>
      </Space>

      <FileManager
        title="Todos los archivos"
        showUploadTab={true}
        defaultTab="files"
        multiple={true}
        maxFiles={20}
        association_type="attachment"
      />
    </div>
  );
};

export default FilesPage;
