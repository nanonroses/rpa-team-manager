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
  WarningOutlined
} from '@ant-design/icons';
import type { UploadProps } from 'antd/es/upload';
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
      message.error("Primero selecciona un archivo");
      return;
    }

    try {
      setLoading(true);
      const data = await apiService.previewExcelImport(uploadedFile);
      setPreviewData(data);
      setFieldMappings(data.suggestedMappings);
      setCurrentStep(1);
      message.success("Previsualización lista");
    } catch (error: any) {
      message.error(error.response?.data?.error || "No se pudo previsualizar el archivo");
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
        message.success(`Se importaron ${result.successCount} registros`);
      } else {
        message.warning(`Se importaron ${result.successCount} registros con ${result.errorCount} errores`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || "No se pudo importar el archivo");
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
      title: "Columna de Excel",
      dataIndex: 'excelHeader',
      key: 'excelHeader',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: "Datos de ejemplo",
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
      title: "Asignar al campo",
      dataIndex: 'mapping',
      key: 'mapping',
      render: (_: any, record: any) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Selecciona un campo"
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
                {field.required && <Tag color="red">Obligatorio</Tag>}
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

  const { missing: missingRequired } = getRequiredFieldsStatus();

  return (
    <Modal
      title="Importar archivo Excel"
      open={visible}
      onCancel={handleCancel}
      width={900}
      footer={null}
    >
      <Steps current={currentStep} style={{ marginBottom: '24px' }}>
        <Step title="Subir archivo" icon={<UploadOutlined />} />
        <Step title="Asignar campos" icon={<FileExcelOutlined />} />
        <Step title="Resultados de importación" icon={<CheckCircleOutlined />} />
      </Steps>

      {/* Step 1: File Upload */}
      {currentStep === 0 && (
        <div>
          <Alert
            message="Formatos admitidos"
            description="Puedes subir archivos Excel (.xlsx, .xls) o CSV. Tamaño máximo: 10 MB."
            type="info"
            style={{ marginBottom: '16px' }}
          />

          <Upload.Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined style={{ fontSize: '48px', color: 'var(--color-info)' }} />
            </p>
            <p className="ant-upload-text">Haz clic o arrastra un archivo Excel aquí</p>
            <p className="ant-upload-hint">
              
              Se admiten archivos Excel (.xlsx, .xls) y CSV
            </p>
          </Upload.Dragger>

          {uploadedFile && (
            <Card style={{ marginTop: '16px' }}>
              <Space>
                <FileExcelOutlined style={{ color: 'var(--color-success)' }} />
                <Text strong>{uploadedFile.name}</Text>
                <Text type="secondary">({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)</Text>
              </Space>
            </Card>
          )}

          <div style={{ marginTop: '24px', textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCancel}>Cancelar</Button>
              <Button 
                type="primary" 
                onClick={previewFile}
                disabled={!uploadedFile}
                loading={loading}
              >
                
                Previsualizar archivo
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* Step 2: Field Mapping */}
      {currentStep === 1 && previewData && (
        <div>
          <Alert
            message="Relaciona las columnas de Excel con los campos de destino"
            description={`Se encontraron ${previewData.totalRows} filas. Relaciona cada columna de Excel con su campo de destino.`}
            type="info"
            style={{ marginBottom: '16px' }}
          />

          {missingRequired.length > 0 && (
            <Alert
              message="Faltan campos obligatorios"
              description={
                <div>
                  
                  Los siguientes campos obligatorios no están asignados: {' '}
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

          <Divider>Opciones de importación</Divider>

          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>Crear automáticamente las empresas que falten</Text>
              <Switch 
                checked={importOptions.createMissingCompanies}
                onChange={(checked) => setImportOptions(prev => ({ ...prev, createMissingCompanies: checked }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>Crear automáticamente los procesos RPA que falten</Text>
              <Switch 
                checked={importOptions.createMissingProcesses}
                onChange={(checked) => setImportOptions(prev => ({ ...prev, createMissingProcesses: checked }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>Omitir filas vacías</Text>
              <Switch 
                checked={importOptions.skipEmptyRows}
                onChange={(checked) => setImportOptions(prev => ({ ...prev, skipEmptyRows: checked }))}
              />
            </div>
          </Space>

          <div style={{ marginTop: '24px', textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCurrentStep(0)}>Volver</Button>
              <Button 
                type="primary" 
                onClick={executeImport}
                disabled={missingRequired.length > 0}
                loading={loading}
              >
                
                Importar datos ({previewData.totalRows}  filas)
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
                color: importResult.errorCount === 0 ? 'var(--color-success)' : 'var(--color-warning)' 
              }} 
            />
            <Title level={3} style={{ marginTop: '16px' }}>
              
              Importación {importResult.errorCount === 0 ? "Completada" : "Completada con advertencias"}
            </Title>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <Progress
              percent={Math.round((importResult.successCount / importResult.totalRows) * 100)}
              strokeColor={importResult.errorCount === 0 ? 'var(--color-success)' : 'var(--color-warning)'}
              format={() => `${importResult.successCount}/${importResult.totalRows}`}
            />
          </div>

          <Alert
            message="Resumen de importación"
            description={
              <div>
                <Text>Filas procesadas: <Text strong>{importResult.totalRows}</Text></Text><br/>
                <Text>Importadas correctamente: <Text strong style={{ color: 'var(--color-success)' }}>{importResult.successCount}</Text></Text><br/>
                <Text>Errores: <Text strong style={{ color: 'var(--color-error)' }}>{importResult.errorCount}</Text></Text><br/>
                <Text>Advertencias: <Text strong style={{ color: 'var(--color-warning)' }}>{importResult.warnings.length}</Text></Text>
              </div>
            }
            type={importResult.errorCount === 0 ? 'success' : 'warning'}
            style={{ marginBottom: '16px' }}
          />

          {importResult.warnings.length > 0 && (
            <Card title={<><WarningOutlined style={{ color: 'var(--color-warning)' }} />  Advertencias</>} size="small" style={{ marginBottom: '16px' }}>
              <List
                size="small"
                dataSource={importResult.warnings.slice(0, 10)}
                renderItem={(warning) => (
                  <List.Item>
                    <Text type="secondary">Fila {warning.row}:</Text> {warning.warning}
                  </List.Item>
                )}
              />
              {importResult.warnings.length > 10 && (
                <Text type="secondary">... y {importResult.warnings.length - 10}  advertencias más</Text>
              )}
            </Card>
          )}

          {importResult.errors.length > 0 && (
            <Card title={<><ExclamationCircleOutlined style={{ color: 'var(--color-error)' }} />  Errores</>} size="small" style={{ marginBottom: '16px' }}>
              <List
                size="small"
                dataSource={importResult.errors.slice(0, 10)}
                renderItem={(error) => (
                  <List.Item>
                    <Text type="secondary">Fila {error.row}:</Text> <Text type="danger">{error.error}</Text>
                  </List.Item>
                )}
              />
              {importResult.errors.length > 10 && (
                <Text type="secondary">... y {importResult.errors.length - 10}  errores más</Text>
              )}
            </Card>
          )}

          <div style={{ textAlign: 'right' }}>
            <Button type="primary" onClick={handleFinish}>
              
              Finalizar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ExcelImportModal;
