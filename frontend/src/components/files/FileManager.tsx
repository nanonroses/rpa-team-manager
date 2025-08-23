import React, { useState, Suspense } from 'react';
import { Tabs, Card, Typography, Space, Button, Modal, Spin } from 'antd';
import { 
  UploadOutlined, 
  FileOutlined, 
  FolderOpenOutlined,
  PlusOutlined
} from '@ant-design/icons';
import FileUpload from './FileUpload';
import FileList from './FileList';
import FileErrorBoundary from './FileErrorBoundary';
import { FileRecord, UploadResult } from '@/services/fileService';

const { Title } = Typography;

export interface FileManagerProps {
  // Entity context (optional)
  entity_type?: 'project' | 'task' | 'idea' | 'user';
  entity_id?: number;
  
  // Display options
  title?: string;
  showUploadTab?: boolean;
  defaultTab?: string;
  
  // Upload configuration
  multiple?: boolean;
  maxFiles?: number;
  association_type?: string;
  
  // Callbacks
  onFileUploaded?: (results: UploadResult[]) => void;
  onFileSelected?: (file: FileRecord) => void;
  
  // Styling
  style?: React.CSSProperties;
  className?: string;
}

export const FileManager: React.FC<FileManagerProps> = ({
  entity_type,
  entity_id,
  title = 'File Manager',
  showUploadTab = true,
  defaultTab = 'files',
  multiple = true,
  maxFiles = 10,
  association_type = 'attachment',
  onFileUploaded,
  onFileSelected,
  style,
  className
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = (results: UploadResult[]) => {
    onFileUploaded?.(results);
    // Trigger refresh of file list
    setRefreshTrigger(prev => prev + 1);
    // Switch to files tab to see uploaded files
    if (activeTab === 'upload') {
      setActiveTab('files');
    }
    // Close upload modal if it was open
    setUploadModalVisible(false);
  };

  const handleFileDelete = () => {
    // Trigger refresh of file list
    setRefreshTrigger(prev => prev + 1);
  };

  const showUploadModal = () => {
    setUploadModalVisible(true);
  };

  const tabItems = [
    {
      key: 'files',
      label: (
        <span>
          <FileOutlined />
          Files
        </span>
      ),
      children: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text type="secondary">
              {entity_type && entity_id 
                ? `Files associated with this ${entity_type}`
                : 'All files you have access to'
              }
            </Typography.Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={showUploadModal}
            >
              Upload Files
            </Button>
          </div>
          
          <FileList
            key={refreshTrigger} // Force refresh when files are uploaded/deleted
            entity_type={entity_type}
            entity_id={entity_id}
            association_type={association_type}
            showFilters={true}
            showActions={true}
            showAssociations={true}
            title=""
            onFileSelect={onFileSelected}
            onFileDelete={handleFileDelete}
          />
        </div>
      )
    }
  ];

  // Add upload tab if enabled
  if (showUploadTab) {
    tabItems.push({
      key: 'upload',
      label: (
        <span>
          <UploadOutlined />
          Upload
        </span>
      ),
      children: (
        <div style={{ padding: '8px 0' }}>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Upload files {entity_type && entity_id ? `and associate them with this ${entity_type}` : ''}
          </Typography.Text>
          
          <FileErrorBoundary>
            <Suspense fallback={<Spin size="large" style={{ display: 'block', textAlign: 'center', padding: '50px' }} />}>
              <FileUpload
                entity_type={entity_type}
                entity_id={entity_id}
                association_type={association_type}
                multiple={multiple}
                maxFiles={maxFiles}
                showPreview={true}
                showDescription={true}
                showPublicOption={!entity_type} // Only show public option when not associated with entity
                onUploadComplete={handleUploadComplete}
              />
            </Suspense>
          </FileErrorBoundary>
        </div>
      )
    });
  }

  return (
    <div style={style} className={className}>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <FolderOpenOutlined style={{ marginRight: 8 }} />
            {title}
          </Title>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="small"
        />
      </Card>

      {/* Upload Modal */}
      <Modal
        title={
          <Space>
            <UploadOutlined />
            Upload Files
            {entity_type && entity_id && (
              <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                (will be associated with this {entity_type})
              </Typography.Text>
            )}
          </Space>
        }
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <FileErrorBoundary>
          <Suspense fallback={<Spin size="large" style={{ display: 'block', textAlign: 'center', padding: '50px' }} />}>
            <FileUpload
              entity_type={entity_type}
              entity_id={entity_id}
              association_type={association_type}
              multiple={multiple}
              maxFiles={maxFiles}
              showPreview={true}
              showDescription={true}
              showPublicOption={!entity_type}
              onUploadComplete={handleUploadComplete}
            />
          </Suspense>
        </FileErrorBoundary>
      </Modal>
    </div>
  );
};

export default FileManager;