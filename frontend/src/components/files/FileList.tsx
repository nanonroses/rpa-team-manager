import React, { useState, useEffect } from 'react';
import {
  List,
  Card,
  Typography,
  Space,
  Button,
  Tag,
  Avatar,
  Tooltip,
  Popconfirm,
  Input,
  Select,
  Empty,
  Spin,
  message,
  Modal,
  Descriptions,
  Divider
} from 'antd';
import {
  FileOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileZipOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { fileService, FileRecord, FileFilters } from '@/services/fileService';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;
const { Search } = Input;
const { Option } = Select;

export interface FileListProps {
  // Filters
  entity_type?: 'project' | 'task' | 'idea' | 'user';
  entity_id?: number;
  association_type?: string;
  
  // Display options
  showFilters?: boolean;
  showActions?: boolean;
  showAssociations?: boolean;
  title?: string;
  
  // Callbacks
  onFileSelect?: (file: FileRecord) => void;
  onFileDelete?: (fileId: number) => void;
  
  // Styling
  style?: React.CSSProperties;
  className?: string;
}

export const FileList: React.FC<FileListProps> = ({
  entity_type,
  entity_id,
  association_type,
  showFilters = true,
  showActions = true,
  showAssociations = true,
  title = 'Files',
  onFileSelect,
  onFileDelete,
  style,
  className
}) => {
  const { user } = useAuthStore();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedAssociationType, setSelectedAssociationType] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [entity_type, entity_id, association_type]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const filters: FileFilters = {
        entity_type,
        entity_id,
        association_type: association_type || selectedAssociationType || undefined,
        search: searchQuery.trim() || undefined,
        category: selectedCategory || undefined,
        limit: 100
      };

      const data = await fileService.getFiles(filters);
      setFiles(data);
    } catch (error) {
      console.error('Failed to load files:', error);
      message.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    // Debounce search
    const timer = setTimeout(() => {
      loadFiles();
    }, 500);
    return () => clearTimeout(timer);
  };

  const handleFilterChange = () => {
    loadFiles();
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      const blob = await fileService.downloadFile(file.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('File downloaded successfully');
    } catch (error) {
      console.error('Download failed:', error);
      message.error('Failed to download file');
    }
  };

  const handleDelete = async (file: FileRecord) => {
    try {
      await fileService.deleteFile(file.id);
      message.success('File deleted successfully');
      onFileDelete?.(file.id);
      loadFiles();
    } catch (error) {
      console.error('Delete failed:', error);
      message.error('Failed to delete file');
    }
  };

  const showFileDetails = (file: FileRecord) => {
    setSelectedFile(file);
    setDetailModalVisible(true);
  };

  const getFileIcon = (file: FileRecord) => {
    const iconName = fileService.getFileIcon(file.mime_type, file.file_extension);
    const iconProps = { style: { fontSize: 24, color: file.category_color || '#1890ff' } };
    
    switch (iconName) {
      case 'FileImageOutlined':
        return <FileImageOutlined {...iconProps} />;
      case 'FilePdfOutlined':
        return <FilePdfOutlined {...iconProps} />;
      case 'FileWordOutlined':
        return <FileWordOutlined {...iconProps} />;
      case 'FileExcelOutlined':
        return <FileExcelOutlined {...iconProps} />;
      case 'FileZipOutlined':
        return <FileZipOutlined {...iconProps} />;
      default:
        return <FileOutlined {...iconProps} />;
    }
  };

  const canDeleteFile = (file: FileRecord) => {
    return file.uploaded_by === user?.id || user?.role === 'team_lead';
  };

  const renderFileActions = (file: FileRecord) => {
    if (!showActions) return [];

    const actions = [
      <Tooltip title="Download">
        <Button 
          type="text" 
          size="small"
          icon={<DownloadOutlined />} 
          onClick={() => handleDownload(file)}
        />
      </Tooltip>,
      <Tooltip title="View Details">
        <Button 
          type="text" 
          size="small"
          icon={<EyeOutlined />} 
          onClick={() => showFileDetails(file)}
        />
      </Tooltip>
    ];

    if (canDeleteFile(file)) {
      actions.push(
        <Popconfirm
          title="Delete file"
          description="Are you sure you want to delete this file?"
          onConfirm={() => handleDelete(file)}
          okText="Yes"
          cancelText="No"
        >
          <Tooltip title="Delete">
            <Button 
              type="text" 
              size="small"
              icon={<DeleteOutlined />} 
              danger
            />
          </Tooltip>
        </Popconfirm>
      );
    }

    return actions;
  };

  const associationTypes = [
    'attachment', 'evidence', 'documentation', 'screenshot', 
    'diagram', 'report', 'presentation', 'code', 'config', 'log', 'other'
  ];

  return (
    <div style={style} className={className}>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>{title}</Title>
            <Button type="text" icon={<FilterOutlined />} onClick={loadFiles}>
              Refresh
            </Button>
          </div>

          {showFilters && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Search
                placeholder="Search files by name or description..."
                allowClear
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={handleSearch}
                style={{ width: '100%' }}
              />
              
              <Space wrap>
                <Select
                  placeholder="Filter by category"
                  style={{ minWidth: 150 }}
                  value={selectedCategory}
                  onChange={(value) => {
                    setSelectedCategory(value);
                    handleFilterChange();
                  }}
                  allowClear
                >
                  <Option value="documents">Documents</Option>
                  <Option value="images">Images</Option>
                  <Option value="presentations">Presentations</Option>
                  <Option value="spreadsheets">Spreadsheets</Option>
                  <Option value="code">Code</Option>
                  <Option value="archives">Archives</Option>
                  <Option value="videos">Videos</Option>
                  <Option value="audio">Audio</Option>
                  <Option value="other">Other</Option>
                </Select>
                
                {!association_type && (
                  <Select
                    placeholder="Filter by type"
                    style={{ minWidth: 150 }}
                    value={selectedAssociationType}
                    onChange={(value) => {
                      setSelectedAssociationType(value);
                      handleFilterChange();
                    }}
                    allowClear
                  >
                    {associationTypes.map(type => (
                      <Option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Option>
                    ))}
                  </Select>
                )}
              </Space>
            </Space>
          )}
        </div>

        <Spin spinning={loading}>
          {files.length === 0 ? (
            <Empty 
              description="No files found"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={files}
              renderItem={(file) => (
                <List.Item
                  actions={renderFileActions(file)}
                  style={{ cursor: onFileSelect ? 'pointer' : 'default' }}
                  onClick={() => onFileSelect?.(file)}
                >
                  <List.Item.Meta
                    avatar={getFileIcon(file)}
                    title={
                      <Space>
                        <Text strong>{file.original_filename}</Text>
                        {file.category_name && (
                          <Tag color={file.category_color}>
                            {file.category_name}
                          </Tag>
                        )}
                        {file.is_public && (
                          <Tag color="blue">Public</Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <Space wrap>
                            <Text type="secondary">
                              {fileService.formatFileSize(file.file_size)}
                            </Text>
                            <Text type="secondary">•</Text>
                            <Text type="secondary">
                              {dayjs(file.upload_date).fromNow()}
                            </Text>
                            <Text type="secondary">•</Text>
                            <Text type="secondary">
                              by {file.uploaded_by_name}
                            </Text>
                          </Space>
                          
                          {file.description && (
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {file.description}
                            </Text>
                          )}

                          {showAssociations && file.associations && file.associations.length > 0 && (
                            <Space wrap size="small">
                              <LinkOutlined style={{ color: '#8c8c8c', fontSize: '12px' }} />
                              {file.associations.map(assoc => (
                                <Tag key={assoc.id} color="processing">
                                  {assoc.entity_type}: {assoc.entity_name}
                                </Tag>
                              ))}
                            </Space>
                          )}
                        </Space>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Card>

      {/* File Details Modal */}
      <Modal
        title="File Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => selectedFile && handleDownload(selectedFile)}>
            Download
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {selectedFile && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="File Name" span={2}>
                {selectedFile.original_filename}
              </Descriptions.Item>
              <Descriptions.Item label="Size">
                {fileService.formatFileSize(selectedFile.file_size)}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                {selectedFile.mime_type}
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                {selectedFile.category_name ? (
                  <Tag color={selectedFile.category_color}>
                    {selectedFile.category_name}
                  </Tag>
                ) : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Visibility">
                <Tag color={selectedFile.is_public ? 'blue' : 'default'}>
                  {selectedFile.is_public ? 'Public' : 'Private'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Uploaded By">
                {selectedFile.uploaded_by_name}
              </Descriptions.Item>
              <Descriptions.Item label="Upload Date">
                {dayjs(selectedFile.upload_date).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {selectedFile.description && (
                <Descriptions.Item label="Description" span={2}>
                  {selectedFile.description}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedFile.associations && selectedFile.associations.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Divider />
                <Title level={5}>Associations</Title>
                <List
                  size="small"
                  dataSource={selectedFile.associations}
                  renderItem={(assoc) => (
                    <List.Item>
                      <Space>
                        <Tag color="processing">
                          {assoc.entity_type}
                        </Tag>
                        <Text>{assoc.entity_name}</Text>
                        <Text type="secondary">({assoc.association_type})</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </div>
            )}

            {selectedFile.versions && selectedFile.versions.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <Divider />
                <Title level={5}>Version History</Title>
                <List
                  size="small"
                  dataSource={selectedFile.versions}
                  renderItem={(version) => (
                    <List.Item>
                      <List.Item.Meta
                        title={`Version ${version.version_number}`}
                        description={
                          <Space>
                            <Text type="secondary">
                              {fileService.formatFileSize(version.file_size)}
                            </Text>
                            <Text type="secondary">•</Text>
                            <Text type="secondary">
                              {dayjs(version.created_at).format('YYYY-MM-DD HH:mm')}
                            </Text>
                            <Text type="secondary">•</Text>
                            <Text type="secondary">
                              by {version.uploaded_by_name}
                            </Text>
                            {version.version_notes && (
                              <>
                                <Text type="secondary">•</Text>
                                <Text type="secondary">{version.version_notes}</Text>
                              </>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FileList;