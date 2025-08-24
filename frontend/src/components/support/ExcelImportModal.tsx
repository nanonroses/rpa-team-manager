import React, { useState } from 'react';
import {
  Modal,
  Button,
  Upload,
  Table,
  Select,
  Space,
  Alert,
  Typography,
  Steps,
  Progress,
  Divider,
  Tag,
  Switch,
  message,
  List,
  Card
} from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import { apiService } from '@/services/api';

const { Title, Text } = Typography;
const { Step } = Steps;

interface ExcelImportModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

interface PreviewData {
  headers: string[];
  sampleData: any[][];
  availableFields: Array<{
    key: string;
    label: string;
    required: boolean;
  }>;
  suggestedMappings: { [key: string]: string };
  totalRows: number;
}

interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; error: string }>;
  warnings: Array<{ row: number; warning: string }>;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [fieldMappings, setFieldMappings] = useState<{ [key: string]: string }>({});
  const [importOptions, setImportOptions] = useState({
    createMissingCompanies: true,
    createMissingProcesses: true,
    skipEmptyRows: true
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const resetModal = () => {
    setCurrentStep(0);
    setUploadedFile(null);
    setPreviewData(null);
    setFieldMappings({});
    setImportResult(null);
  };

  const handleCancel = () => {
    resetModal();
    onCancel();
  };

  const handleFileUpload: UploadProps['onChange'] = (info) => {
    const file = info.file.originFileObj || (info.file as unknown as File);
    if (file) {
      setUploadedFile(file);
      console.log('File uploaded:', file.name, file.size);
    }
  };

  const previewFile = async () => {
    if (!uploadedFile) {
      message.error('Please select a file first');
      return;
    }

    try {
      setLoading(true);
      const data = await apiService.previewExcelImport(uploadedFile);
      setPreviewData(data);
      setFieldMappings(data.suggestedMappings);
      setCurrentStep(1);
      message.success('File previewed successfully');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to preview file');
    } finally {
      setLoading(false);
    }
  };

  const executeImport = async () => {
    if (!uploadedFile || !previewData) return;

    try {
      setLoading(true);
      const result = await apiService.executeExcelImport(uploadedFile, fieldMappings, importOptions);
      setImportResult(result);
      setCurrentStep(2);
      
      if (result.errorCount === 0) {
        message.success(`Successfully imported ${result.successCount} records`);
      } else {
        message.warning(`Imported ${result.successCount} records with ${result.errorCount} errors`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to import file');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    onSuccess();
    resetModal();
  };

  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls,.csv',
    beforeUpload: () => false, // Prevent automatic upload
    onChange: handleFileUpload,
    maxCount: 1,
    showUploadList: {
      showDownloadIcon: false,
      showRemoveIcon: true
    }
  };

  const mappingColumns = [
    {
      title: 'Excel Column',
      dataIndex: 'excelHeader',
      key: 'excelHeader',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Sample Data',
      dataIndex: 'sampleData',
      key: 'sampleData',
      render: (data: any[]) => (
        <Text type="secondary">
          {data.slice(0, 3).join(', ')}
          {data.length > 3 && '...'}
        </Text>
      )
    },
    {
      title: 'Map to Field',
      dataIndex: 'mapping',
      key: 'mapping',
      render: (_: any, record: any) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Select field"
          value={fieldMappings[record.excelHeader]}
          onChange={(value) => {
            setFieldMappings(prev => ({
              ...prev,
              [record.excelHeader]: value
            }));
          }}
          allowClear
        >
          {previewData?.availableFields.map(field => (
            <Select.Option key={field.key} value={field.key}>
              <Space>
                {field.label}
                {field.required && <Tag color="red" size="small">Required</Tag>}
              </Space>
            </Select.Option>
          ))}
        </Select>
      )
    }
  ];

  const getMappingTableData = () => {
    if (!previewData) return [];
    
    return previewData.headers.map((header, index) => ({
      key: header,
      excelHeader: header,
      sampleData: previewData.sampleData.map(row => row[index]).filter(Boolean),
      mapping: fieldMappings[header]
    }));
  };

  const getRequiredFieldsStatus = () => {
    if (!previewData) return { missing: [], mapped: [] };
    
    const requiredFields = previewData.availableFields.filter(f => f.required);
    const mappedFields = Object.values(fieldMappings).filter(Boolean);
    
    const missing = requiredFields.filter(field => !mappedFields.includes(field.key));
    const mapped = requiredFields.filter(field => mappedFields.includes(field.key));
    
    return { missing, mapped };
  };

  const { missing: missingRequired, mapped: mappedRequired } = getRequiredFieldsStatus();

  return (
    <Modal
      title="Import Excel File"
      open={visible}
      onCancel={handleCancel}
      width={900}
      footer={null}
    >
      <Steps current={currentStep} style={{ marginBottom: '24px' }}>
        <Step title="Upload File" icon={<UploadOutlined />} />
        <Step title="Map Fields" icon={<FileExcelOutlined />} />
        <Step title="Import Results" icon={<CheckCircleOutlined />} />
      </Steps>

      {/* Step 1: File Upload */}
      {currentStep === 0 && (
        <div>
          <Alert
            message="Supported File Formats"
            description="You can upload Excel files (.xlsx, .xls) or CSV files. Maximum file size: 10MB."
            type="info"
            style={{ marginBottom: '16px' }}
          />

          <Upload.Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">Click or drag Excel file to this area to upload</p>
            <p className="ant-upload-hint">
              Support for Excel (.xlsx, .xls) and CSV files
            </p>
          </Upload.Dragger>

          {uploadedFile && (
            <Card style={{ marginTop: '16px' }}>
              <Space>
                <FileExcelOutlined style={{ color: '#52c41a' }} />
                <Text strong>{uploadedFile.name}</Text>
                <Text type="secondary">({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)</Text>
              </Space>
            </Card>
          )}

          <div style={{ marginTop: '24px', textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button 
                type="primary" 
                onClick={previewFile}
                disabled={!uploadedFile}
                loading={loading}
              >
                Preview File
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* Step 2: Field Mapping */}
      {currentStep === 1 && previewData && (
        <div>
          <Alert
            message="Map Excel Columns to Database Fields"
            description={`Found ${previewData.totalRows} rows in the Excel file. Map each Excel column to the corresponding database field.`}
            type="info"
            style={{ marginBottom: '16px' }}
          />

          {missingRequired.length > 0 && (
            <Alert
              message="Missing Required Fields"
              description={
                <div>
                  The following required fields are not mapped: {' '}
                  {missingRequired.map(field => (
                    <Tag key={field.key} color="red">{field.label}</Tag>
                  ))}
                </div>
              }
              type="warning"
              style={{ marginBottom: '16px' }}
            />
          )}

          <Table
            columns={mappingColumns}
            dataSource={getMappingTableData()}
            pagination={false}
            size="small"
            style={{ marginBottom: '16px' }}
          />

          <Divider>Import Options</Divider>

          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>Create missing companies automatically</Text>
              <Switch 
                checked={importOptions.createMissingCompanies}
                onChange={(checked) => setImportOptions(prev => ({ ...prev, createMissingCompanies: checked }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>Create missing RPA processes automatically</Text>
              <Switch 
                checked={importOptions.createMissingProcesses}
                onChange={(checked) => setImportOptions(prev => ({ ...prev, createMissingProcesses: checked }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>Skip empty rows</Text>
              <Switch 
                checked={importOptions.skipEmptyRows}
                onChange={(checked) => setImportOptions(prev => ({ ...prev, skipEmptyRows: checked }))}
              />
            </div>
          </Space>

          <div style={{ marginTop: '24px', textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCurrentStep(0)}>Back</Button>
              <Button 
                type="primary" 
                onClick={executeImport}
                disabled={missingRequired.length > 0}
                loading={loading}
              >
                Import Data ({previewData.totalRows} rows)
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* Step 3: Import Results */}
      {currentStep === 2 && importResult && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <CheckCircleOutlined 
              style={{ 
                fontSize: '48px', 
                color: importResult.errorCount === 0 ? '#52c41a' : '#faad14' 
              }} 
            />
            <Title level={3} style={{ marginTop: '16px' }}>
              Import {importResult.errorCount === 0 ? 'Completed' : 'Completed with Warnings'}
            </Title>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <Progress
              percent={Math.round((importResult.successCount / importResult.totalRows) * 100)}
              strokeColor={importResult.errorCount === 0 ? '#52c41a' : '#faad14'}
              format={() => `${importResult.successCount}/${importResult.totalRows}`}
            />
          </div>

          <Alert
            message="Import Summary"
            description={
              <div>
                <Text>Total rows processed: <Text strong>{importResult.totalRows}</Text></Text><br/>
                <Text>Successfully imported: <Text strong style={{ color: '#52c41a' }}>{importResult.successCount}</Text></Text><br/>
                <Text>Errors: <Text strong style={{ color: '#ff4d4f' }}>{importResult.errorCount}</Text></Text><br/>
                <Text>Warnings: <Text strong style={{ color: '#faad14' }}>{importResult.warnings.length}</Text></Text>
              </div>
            }
            type={importResult.errorCount === 0 ? 'success' : 'warning'}
            style={{ marginBottom: '16px' }}
          />

          {importResult.warnings.length > 0 && (
            <Card title={<><WarningOutlined style={{ color: '#faad14' }} /> Warnings</>} size="small" style={{ marginBottom: '16px' }}>
              <List
                size="small"
                dataSource={importResult.warnings.slice(0, 10)}
                renderItem={(warning) => (
                  <List.Item>
                    <Text type="secondary">Row {warning.row}:</Text> {warning.warning}
                  </List.Item>
                )}
              />
              {importResult.warnings.length > 10 && (
                <Text type="secondary">... and {importResult.warnings.length - 10} more warnings</Text>
              )}
            </Card>
          )}

          {importResult.errors.length > 0 && (
            <Card title={<><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> Errors</>} size="small" style={{ marginBottom: '16px' }}>
              <List
                size="small"
                dataSource={importResult.errors.slice(0, 10)}
                renderItem={(error) => (
                  <List.Item>
                    <Text type="secondary">Row {error.row}:</Text> <Text type="danger">{error.error}</Text>
                  </List.Item>
                )}
              />
              {importResult.errors.length > 10 && (
                <Text type="secondary">... and {importResult.errors.length - 10} more errors</Text>
              )}
            </Card>
          )}

          <div style={{ textAlign: 'right' }}>
            <Button type="primary" onClick={handleFinish}>
              Finish
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ExcelImportModal;