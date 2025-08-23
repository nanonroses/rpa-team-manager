import React from 'react';
import { Typography, Space } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { FileManager } from '@/components/files';

const { Title, Text } = Typography;

export const FilesPage: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <FolderOpenOutlined style={{ marginRight: 8 }} />
          File Manager
        </Title>
        <Text type="secondary">
          Upload, organize and manage files for your projects and tasks.
        </Text>
      </div>

      <FileManager
        title="All Files"
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