import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Tabs, 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Statistic, 
  Row, 
  Col, 
  Modal, 
  Form, 
  Input, 
  Select, 
  InputNumber, 
  DatePicker, 
  Progress, 
  Typography, 
  Alert,
  Tooltip,
  Divider,
  Checkbox
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  CustomerServiceOutlined,
  DollarCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ImportOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import ExcelImportModal from '@/components/support/ExcelImportModal';

const { Content } = Layout;
const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

// Types
interface SupportCompany {
  id: number;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  contracted_hours_monthly: number;
  hourly_rate: number;
  hourly_rate_extra: number;
  hourly_rate_currency: string;
  status: string;
  current_month_consumed_hours: number;
  current_month_remaining_hours: number;
  total_tickets: number;
  open_tickets: number;
  contract_start_date?: string;
  contract_end_date?: string;
  address?: string;
  notes?: string;
}

interface SupportTicket {
  id_ticket: string;
  company_id: number;
  company_name: string;
  client_name: string;
  ticket_type: string;
  attention_method: string;
  rpa_process: string;
  requester: string;
  resolver_id: number;
  resolver_name: string;
  description: string;
  solution: string;
  status: string;
  priority: string;
  open_date: string;
  close_date: string;
  time_invested_minutes: number;
  hours_calculated: number;
  customer_satisfaction: number;
}

interface DashboardData {
  summary: {
    totalCompanies: number;
    totalActiveTickets: number;
    thisMonthTickets: number;
    thisMonthResolved: number;
  };
  topCompanies: Array<{
    company_name: string;
    contracted_hours_monthly: number;
    consumed_hours: number;
    remaining_hours: number;
    status: string;
  }>;
  recentTickets: SupportTicket[];
  billing?: {
    totalToInvoice: number;
    baseHours: number;
    extraHours: number;
    total_companies: number;
  };
}

const SupportPage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [companies, setCompanies] = useState<SupportCompany[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs()); // Mes actual por defecto
  
  // Data for dropdowns
  const [rpaProcesses, setRpaProcesses] = useState<any[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  
  // Modal states
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [rpaProcessModalVisible, setRPAProcessModalVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState<SupportCompany | null>(null);
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);
  
  // Forms
  const [companyForm] = Form.useForm();
  const [ticketForm] = Form.useForm();
  const [rpaProcessForm] = Form.useForm();
  const [contactForm] = Form.useForm();

  // Load initial data
  useEffect(() => {
    loadDropdownData();
  }, []);

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    } else if (activeTab === 'companies') {
      loadCompanies();
    } else if (activeTab === 'tickets') {
      loadTickets();
    }
  }, [activeTab]);

  // Reload dashboard when month changes
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [selectedMonth]);

  const loadDropdownData = async () => {
    try {
      // Load all contacts
      const contactsData = await apiService.getAllContacts();
      setAllContacts(contactsData.data || []);

      // Load team members
      const usersData = await apiService.getUsers();
      setTeamMembers(usersData.filter((user: any) => user.role !== 'team_lead'));
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  };

  // Load RPA processes for specific company
  const loadRPAProcesses = async (companyId: number) => {
    try {
      const processesData = await apiService.getRPAProcesses(companyId);
      setRpaProcesses(processesData.data || []);
    } catch (error) {
      console.error('Error loading RPA processes:', error);
      setRpaProcesses([]);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const monthParam = selectedMonth.format('YYYY-MM');
      const data = await apiService.getSupportDashboard(monthParam);
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Fallback to mock data if API fails
      setDashboardData({
        summary: {
          totalCompanies: 8,
          totalActiveTickets: 12,
          thisMonthTickets: 35,
          thisMonthResolved: 28
        },
        topCompanies: [
          {
            company_name: 'Empresa ABC',
            contracted_hours_monthly: 30,
            consumed_hours: 28,
            remaining_hours: 2,
            status: 'near_limit'
          },
          {
            company_name: 'Corporación XYZ',
            contracted_hours_monthly: 50,
            consumed_hours: 35,
            remaining_hours: 15,
            status: 'normal'
          }
        ],
        recentTickets: []
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const response = await apiService.getSupportCompanies();
      setCompanies(response.data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
      // Fallback to mock data if API fails
      setCompanies([
        {
          id: 1,
          company_name: 'Empresa ABC',
          contact_person: 'Juan Pérez',
          email: 'juan@empresaabc.com',
          phone: '+56912345678',
          contracted_hours_monthly: 30,
          hourly_rate: 65000,
          hourly_rate_currency: 'CLP',
          status: 'active',
          current_month_consumed_hours: 28,
          current_month_remaining_hours: 2,
          total_tickets: 45,
          open_tickets: 3
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await apiService.getSupportTickets();
      setTickets(response.data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
      // Fallback to mock data if API fails
      setTickets([
        {
          id_ticket: 'SUP-2025-001',
          company_name: 'Empresa ABC',
          client_name: 'María González',
          ticket_type: 'Bug',
          attention_method: 'Remote',
          rpa_process: 'Facturación Automática',
          requester: 'María González',
          resolver_name: 'Carlos López',
          description: 'El proceso de facturación se detiene en el paso 3',
          solution: '',
          status: 'in_progress',
          priority: 'high',
          open_date: '2025-01-20T10:30:00Z',
          close_date: '',
          hours_calculated: 2.5,
          customer_satisfaction: 0
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Company Modal Functions
  const openCompanyModal = (company?: SupportCompany) => {
    setEditingCompany(company || null);
    if (company) {
      companyForm.setFieldsValue({
        ...company,
        contract_start_date: company.contract_start_date ? dayjs(company.contract_start_date) : null,
        contract_end_date: company.contract_end_date ? dayjs(company.contract_end_date) : null
      });
    } else {
      companyForm.resetFields();
    }
    setCompanyModalVisible(true);
  };

  const handleCompanySubmit = async (values: any) => {
    try {
      if (editingCompany) {
        await apiService.updateSupportCompany(editingCompany.id, values);
      } else {
        await apiService.createSupportCompany(values);
      }
      setCompanyModalVisible(false);
      loadCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
    }
  };

  // Ticket Modal Functions
  const openTicketModal = (ticket?: SupportTicket) => {
    setEditingTicket(ticket || null);
    if (ticket) {
      setSelectedCompanyId(ticket.company_id);
      loadRPAProcesses(ticket.company_id);
      ticketForm.setFieldsValue({
        ...ticket,
        open_date: ticket.open_date ? dayjs(ticket.open_date) : null,
        close_date: ticket.close_date ? dayjs(ticket.close_date) : null,
        rpa_process: ticket.rpa_process ? [ticket.rpa_process] : [],
        client_name: ticket.client_name ? [ticket.client_name] : []
      });
    } else {
      setSelectedCompanyId(null);
      setRpaProcesses([]);
      ticketForm.resetFields();
      // Set default values for new ticket
      ticketForm.setFieldsValue({
        status: 'open',
        priority: 'medium',
        attention_method: 'FreshDesk'
      });
    }
    setTicketModalVisible(true);
  };

  // Search handlers
  const handleRPAProcessSearch = (value: string) => {
    // This will be called when user types in the search
  };

  const handleContactSearch = (value: string) => {
    // This will be called when user types in the search
  };

  // Handle creating new RPA Process
  const handleCreateRPAProcess = async (values: any) => {
    try {
      if (!selectedCompanyId) {
        console.error('No company selected');
        return;
      }
      
      await apiService.createRPAProcess({
        company_id: selectedCompanyId,
        process_name: values.process_name,
        process_description: values.process_description
      });
      setRPAProcessModalVisible(false);
      rpaProcessForm.resetFields();
      loadRPAProcesses(selectedCompanyId); // Reload processes for this company
    } catch (error) {
      console.error('Error creating RPA process:', error);
    }
  };

  // Handle creating new Contact
  const handleCreateContact = async (values: any) => {
    try {
      if (!values.company_id) {
        console.error('Company ID is required');
        return;
      }
      await apiService.createCompanyContact(values.company_id, {
        contact_name: values.contact_name,
        contact_email: values.contact_email,
        contact_phone: values.contact_phone,
        position: values.position,
        is_primary: values.is_primary || false
      });
      setContactModalVisible(false);
      contactForm.resetFields();
      loadDropdownData(); // Reload contacts
    } catch (error) {
      console.error('Error creating contact:', error);
    }
  };

  const handleTicketSubmit = async (values: any) => {
    try {
      // Process form values
      const processedValues = {
        ...values,
        // Handle date formatting - solo fecha sin hora
        work_date: values.work_date ? values.work_date.format('YYYY-MM-DD') : null,
        completion_date: values.completion_date ? values.completion_date.format('YYYY-MM-DD') : null,
        // Handle tags mode for RPA process and client name
        rpa_process: Array.isArray(values.rpa_process) ? values.rpa_process[0] : values.rpa_process,
        client_name: Array.isArray(values.client_name) ? values.client_name[0] : values.client_name,
        // Set requester same as client_name for compatibility
        requester: Array.isArray(values.client_name) ? values.client_name[0] : values.client_name
      };

      if (editingTicket) {
        await apiService.updateSupportTicket(editingTicket.id_ticket, processedValues);
      } else {
        await apiService.createSupportTicket(processedValues);
      }
      setTicketModalVisible(false);
      loadTickets();
    } catch (error) {
      console.error('Error saving ticket:', error);
    }
  };

  // Company view/delete functions
  const handleViewCompany = (company: SupportCompany) => {
    Modal.info({
      title: `${company.company_name} - Información Detallada`,
      width: 600,
      content: (
        <div style={{ marginTop: '16px' }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Contacto:</Text><br />
              <Text>{company.contact_person || 'N/A'}</Text><br />
              <Text type="secondary">{company.email}</Text><br />
              <Text type="secondary">{company.phone}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Contrato:</Text><br />
              <Text>{company.contracted_hours_monthly}h mensuales</Text><br />
              <Text>{company.hourly_rate_currency} ${company.hourly_rate.toLocaleString()}/hora base</Text><br />
              {company.hourly_rate_extra > 0 && (
                <>
                  <Text type="secondary">${company.hourly_rate_extra.toLocaleString()}/hora extra</Text><br />
                </>
              )}
              <Tag color={getStatusColor(company.status)}>
                {company.status === 'active' ? 'Activo' : company.status === 'inactive' ? 'Inactivo' : 'Suspendido'}
              </Tag>
            </Col>
            <Col span={24}>
              <Divider />
              <Text strong>Consumo Actual:</Text><br />
              <Progress 
                percent={Math.min((company.current_month_consumed_hours / company.contracted_hours_monthly) * 100, 100)} 
                status={getConsumptionStatus(company.current_month_consumed_hours, company.contracted_hours_monthly).status as any}
              />
              <Text>{company.current_month_consumed_hours}h consumidas de {company.contracted_hours_monthly}h contratadas</Text>
            </Col>
            <Col span={24}>
              <Text strong>Tickets:</Text><br />
              <Text>Total: {company.total_tickets}</Text><br />
              <Text>Abiertos: {company.open_tickets}</Text>
            </Col>
          </Row>
        </div>
      ),
    });
  };

  const handleDeleteCompany = (company: SupportCompany) => {
    const isAdmin = user?.role === 'team_lead';
    const hasTickets = company.total_tickets > 0;
    
    let title = '¿Eliminar Empresa?';
    let content: React.ReactNode;
    
    if (hasTickets && isAdmin) {
      content = (
        <div>
          <Alert
            message="⚠️ Eliminación en Cascada"
            description={`Esta empresa tiene ${company.total_tickets} tickets asociados. Como administrador, puedes eliminar la empresa Y todos sus tickets.`}
            type="warning"
            style={{ marginBottom: '16px' }}
          />
          <Text strong>¿Continuar con la eliminación completa de "{company.company_name}"?</Text>
          <br />
          <Text type="secondary">Esta acción eliminará:</Text>
          <ul>
            <li>La empresa</li>
            <li>Todos sus {company.total_tickets} tickets</li>
            <li>Comentarios de tickets</li>
            <li>Resúmenes mensuales</li>
          </ul>
          <Text type="danger">Esta acción no se puede deshacer.</Text>
        </div>
      );
    } else if (hasTickets && !isAdmin) {
      Modal.error({
        title: 'No se puede eliminar',
        content: `Esta empresa tiene ${company.total_tickets} tickets asociados. Solo los administradores pueden eliminar empresas con tickets existentes.`,
      });
      return;
    } else {
      content = `¿Estás seguro de que quieres eliminar "${company.company_name}"? Esta acción no se puede deshacer.`;
    }

    Modal.confirm({
      title,
      content,
      okText: hasTickets ? 'Eliminar Todo' : 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      width: hasTickets ? 600 : 416,
      onOk: async () => {
        try {
          const response = await apiService.deleteSupportCompany(company.id);
          
          if (response.deletedTickets > 0) {
            Modal.success({
              title: 'Eliminación Completada',
              content: `Se eliminó la empresa "${company.company_name}" y ${response.deletedTickets} tickets asociados.`,
            });
          }
          
          loadCompanies();
        } catch (error: any) {
          console.error('Error deleting company:', error);
          
          const errorMessage = error.response?.data?.error || 'No se pudo eliminar la empresa. Inténtalo de nuevo.';
          Modal.error({
            title: 'Error',
            content: errorMessage,
          });
        }
      },
    });
  };

  // Ticket view function
  const handleViewTicket = (ticket: SupportTicket) => {
    Modal.info({
      title: `${ticket.id_ticket} - Detalles del Ticket`,
      width: 700,
      content: (
        <div style={{ marginTop: '16px' }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Empresa:</Text><br />
              <Text>{ticket.company_name}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Cliente:</Text><br />
              <Text>{ticket.client_name}</Text>
            </Col>
            <Col span={8}>
              <Text strong>Tipo:</Text><br />
              <Tag color="blue">{ticket.ticket_type}</Tag>
            </Col>
            <Col span={8}>
              <Text strong>Prioridad:</Text><br />
              <Tag color={getPriorityColor(ticket.priority)}>{ticket.priority.toUpperCase()}</Tag>
            </Col>
            <Col span={8}>
              <Text strong>Estado:</Text><br />
              <Tag color={getTicketStatusColor(ticket.status)}>
                {ticket.status === 'open' ? 'Abierto' :
                 ticket.status === 'in_progress' ? 'En Progreso' :
                 ticket.status === 'resolved' ? 'Resuelto' :
                 ticket.status === 'closed' ? 'Cerrado' : ticket.status}
              </Tag>
            </Col>
            <Col span={12}>
              <Text strong>Método de Atención:</Text><br />
              <Text>{ticket.attention_method}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Proceso RPA:</Text><br />
              <Text>{ticket.rpa_process || 'N/A'}</Text>
            </Col>
            <Col span={24}>
              <Text strong>Descripción:</Text><br />
              <Text>{ticket.description}</Text>
            </Col>
            {ticket.solution && (
              <Col span={24}>
                <Text strong>Solución:</Text><br />
                <Text>{ticket.solution}</Text>
              </Col>
            )}
            <Col span={12}>
              <Text strong>Asignado a:</Text><br />
              <Text>{ticket.resolver_name || 'Sin asignar'}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Tiempo Invertido:</Text><br />
              <Text>{ticket.time_invested_minutes || 0} minutos</Text>
            </Col>
            <Col span={12}>
              <Text strong>Fecha Apertura:</Text><br />
              <Text>{dayjs(ticket.open_date).format('DD/MM/YYYY HH:mm')}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Fecha Cierre:</Text><br />
              <Text>{ticket.close_date ? dayjs(ticket.close_date).format('DD/MM/YYYY HH:mm') : 'Abierto'}</Text>
            </Col>
          </Row>
        </div>
      ),
    });
  };

  // Utility functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'inactive': return 'red';
      case 'suspended': return 'orange';
      default: return 'default';
    }
  };

  const getTicketStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'blue';
      case 'in_progress': return 'orange';
      case 'resolved': return 'green';
      case 'closed': return 'gray';
      case 'cancelled': return 'red';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'blue';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const getConsumptionStatus = (consumed: number, contracted: number) => {
    const percentage = (consumed / contracted) * 100;
    if (percentage > 100) return { status: 'exception', text: 'Excedido' };
    if (percentage > 80) return { status: 'warning', text: 'Cerca del límite' };
    return { status: 'success', text: 'Normal' };
  };

  // Table columns
  const companyColumns: ColumnsType<SupportCompany> = [
    {
      title: 'Empresa',
      dataIndex: 'company_name',
      key: 'company_name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.contact_person} • {record.email}
          </div>
        </div>
      )
    },
    {
      title: 'Horas Contratadas',
      key: 'hours_info',
      render: (_, record) => {
        const consumption = getConsumptionStatus(
          record.current_month_consumed_hours, 
          record.contracted_hours_monthly
        );
        const percentage = (record.current_month_consumed_hours / record.contracted_hours_monthly) * 100;
        
        return (
          <div>
            <Progress 
              percent={Math.min(percentage, 100)} 
              status={consumption.status as any}
              size="small"
              showInfo={false}
            />
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              {record.current_month_consumed_hours}h / {record.contracted_hours_monthly}h
              {percentage > 100 && (
                <Text type="danger"> (+{(record.current_month_consumed_hours - record.contracted_hours_monthly).toFixed(1)}h)</Text>
              )}
            </div>
          </div>
        );
      }
    },
    {
      title: 'Valor/Hora',
      key: 'hourly_rate',
      render: (_, record) => (
        <div>
          <div>
            <Text strong>{record.hourly_rate_currency} ${record.hourly_rate.toLocaleString()}</Text>
            <Text type="secondary"> (base)</Text>
          </div>
          {record.hourly_rate_extra > 0 && (
            <div style={{ fontSize: '12px' }}>
              <Text type="secondary">${record.hourly_rate_extra.toLocaleString()} extra</Text>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Tickets',
      key: 'tickets',
      render: (_, record) => (
        <div>
          <div>Total: {record.total_tickets}</div>
          {record.open_tickets > 0 && (
            <Tag color="orange">{record.open_tickets} abiertos</Tag>
          )}
        </div>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status === 'active' ? 'Activo' : status === 'inactive' ? 'Inactivo' : 'Suspendido'}
        </Tag>
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => {
        const isAdmin = user?.role === 'team_lead';
        const hasTickets = record.total_tickets > 0;
        const canDelete = !hasTickets || isAdmin;
        
        return (
          <Space>
            <Tooltip title="Ver detalles">
              <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewCompany(record)} />
            </Tooltip>
            <Tooltip title="Editar empresa">
              <Button icon={<EditOutlined />} size="small" onClick={() => openCompanyModal(record)} />
            </Tooltip>
            {canDelete ? (
              <Tooltip title={hasTickets && isAdmin ? "Eliminar empresa y todos sus tickets" : "Eliminar empresa"}>
                <Button 
                  icon={<DeleteOutlined />} 
                  size="small" 
                  danger 
                  onClick={() => handleDeleteCompany(record)} 
                />
              </Tooltip>
            ) : (
              <Tooltip title="Solo administradores pueden eliminar empresas con tickets">
                <Button 
                  icon={<DeleteOutlined />} 
                  size="small" 
                  danger 
                  disabled
                />
              </Tooltip>
            )}
          </Space>
        );
      }
    }
  ];

  const ticketColumns: ColumnsType<SupportTicket> = [
    {
      title: 'Ticket',
      dataIndex: 'id_ticket',
      key: 'id_ticket',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.company_name}
          </div>
        </div>
      )
    },
    {
      title: 'Cliente/Tipo',
      key: 'client_info',
      render: (_, record) => (
        <div>
          <div>{record.client_name}</div>
          <Tag color="blue" style={{ fontSize: '10px' }}>{record.ticket_type}</Tag>
        </div>
      )
    },
    {
      title: 'Prioridad',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag color={getPriorityColor(priority)}>
          {priority.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getTicketStatusColor(status)}>
          {status === 'open' ? 'Abierto' :
           status === 'in_progress' ? 'En Progreso' :
           status === 'resolved' ? 'Resuelto' :
           status === 'closed' ? 'Cerrado' : status}
        </Tag>
      )
    },
    {
      title: 'Tiempo (min)',
      dataIndex: 'time_invested_minutes',
      key: 'time_invested_minutes',
      render: (minutes) => (
        <div>
          <ClockCircleOutlined /> {minutes || 0}min
        </div>
      )
    },
    {
      title: 'Asignado',
      dataIndex: 'resolver_name',
      key: 'resolver_name',
      render: (name) => name || '-'
    },
    {
      title: 'Fecha',
      dataIndex: 'open_date',
      key: 'open_date',
      render: (date) => dayjs(date).format('DD/MM/YYYY')
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Ver detalles del ticket">
            <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewTicket(record)} />
          </Tooltip>
          <Tooltip title="Editar ticket">
            <Button icon={<EditOutlined />} size="small" onClick={() => openTicketModal(record)} />
          </Tooltip>
        </Space>
      )
    }
  ];

  // Dashboard Component
  const Dashboard = () => (
    <div>
      {/* Month Selector */}
      <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
        <Col span={24}>
          <Card size="small">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Text strong>📅 Mes de Soporte:</Text>
                <DatePicker
                  picker="month"
                  value={selectedMonth}
                  onChange={(date) => date && setSelectedMonth(date)}
                  format="MMMM YYYY"
                  allowClear={false}
                  style={{ width: '200px' }}
                />
              </div>
              <Text type="secondary">
                Mostrando datos de: {selectedMonth.format('MMMM YYYY')}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>
      
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Empresas Activas"
              value={dashboardData?.summary.totalCompanies || 0}
              prefix={<CustomerServiceOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tickets del Mes"
              value={dashboardData?.summary.thisMonthTickets || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tickets Resueltos"
              value={dashboardData?.summary.thisMonthResolved || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Horas Facturadas"
              value={dashboardData?.billing?.totalToInvoice ? `$${(dashboardData.billing.totalToInvoice / 1000000).toFixed(1)}M` : '$0'}
              prefix={<DollarCircleOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="Estado de Consumo por Empresa" size="small">
            {dashboardData?.topCompanies.map((company, index) => {
              const percentage = (company.consumed_hours / company.contracted_hours_monthly) * 100;
              const status = getConsumptionStatus(company.consumed_hours, company.contracted_hours_monthly);
              
              return (
                <div key={index} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <Text strong>{company.company_name}</Text>
                    <Text>{company.consumed_hours}h / {company.contracted_hours_monthly}h</Text>
                  </div>
                  <Progress 
                    percent={Math.min(percentage, 100)} 
                    status={status.status as any}
                    size="small"
                  />
                  {percentage > 100 && (
                    <Alert
                      message={`Excedido en ${(company.consumed_hours - company.contracted_hours_monthly).toFixed(1)} horas`}
                      type="warning"
                      size="small"
                      style={{ marginTop: '4px' }}
                    />
                  )}
                </div>
              );
            })}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Facturación Estimada Este Mes" size="small">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Statistic
                title="Total a Facturar"
                value={dashboardData?.billing?.totalToInvoice || 0}
                prefix="CLP $"
                precision={0}
                valueStyle={{ color: '#3f8600' }}
              />
              <Divider />
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Horas Base"
                    value={dashboardData?.billing?.baseHours || 0}
                    prefix="$"
                    size="small"
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Horas Extra"
                    value={dashboardData?.billing?.extraHours || 0}
                    prefix="$"
                    size="small"
                  />
                </Col>
              </Row>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <CustomerServiceOutlined /> Gestión de Soporte
        </Title>
        <Text type="secondary">
          Administra empresas clientes, tickets de soporte y facturación por horas de soporte técnico
        </Text>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={[
          {
            key: 'dashboard',
            label: 'Dashboard',
            children: <Dashboard />
          },
          {
            key: 'companies',
            label: 'Empresas',
            children: (
              <Card>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                  <Title level={4}>Empresas Clientes</Title>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button 
                      icon={<ImportOutlined />}
                      onClick={() => setImportModalVisible(true)}
                    >
                      Importar Excel
                    </Button>
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />}
                      onClick={() => openCompanyModal()}
                    >
                      Nueva Empresa
                    </Button>
                  </div>
                </div>
                <Table
                  columns={companyColumns}
                  dataSource={companies}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          },
          {
            key: 'tickets',
            label: 'Tickets',
            children: (
              <Card>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                  <Title level={4}>Tickets de Soporte</Title>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button 
                      icon={<ImportOutlined />}
                      onClick={() => setImportModalVisible(true)}
                    >
                      Importar Excel
                    </Button>
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />}
                      onClick={() => openTicketModal()}
                    >
                      Nuevo Ticket
                    </Button>
                  </div>
                </div>
                <Table
                  columns={ticketColumns}
                  dataSource={tickets}
                  rowKey="id_ticket"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          }
        ]}
      />

      {/* Company Modal */}
      <Modal
        title={editingCompany ? 'Editar Empresa' : 'Nueva Empresa'}
        open={companyModalVisible}
        onCancel={() => setCompanyModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={companyForm}
          layout="vertical"
          onFinish={handleCompanySubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="company_name"
                label="Nombre de la Empresa"
                rules={[{ required: true, message: 'Ingrese el nombre de la empresa' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contact_person"
                label="Persona de Contacto"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: 'email', message: 'Ingrese un email válido' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Teléfono"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                name="contracted_hours_monthly"
                label="Horas Contratadas (Mensuales)"
                rules={[{ required: true, message: 'Ingrese las horas contratadas' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="hourly_rate"
                label="Valor por Hora Base"
                rules={[{ required: true, message: 'Ingrese el valor por hora base' }]}
              >
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="hourly_rate_extra"
                label="Valor Hora Extra"
                tooltip="Tarifa para horas que excedan las contratadas mensualmente"
                initialValue={0}
              >
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="0 = usar tarifa base" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="hourly_rate_currency"
                label="Moneda"
                initialValue="CLP"
              >
                <Select>
                  <Option value="CLP">CLP</Option>
                  <Option value="USD">USD</Option>
                  <Option value="UF">UF</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address"
            label="Dirección"
          >
            <TextArea rows={2} />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Notas"
          >
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingCompany ? 'Actualizar' : 'Crear'}
              </Button>
              <Button onClick={() => setCompanyModalVisible(false)}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Ticket Modal */}
      <Modal
        title={editingTicket ? 'Editar Ticket' : 'Nuevo Ticket'}
        open={ticketModalVisible}
        onCancel={() => setTicketModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={ticketForm}
          layout="vertical"
          onFinish={handleTicketSubmit}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="id_ticket"
                label="ID Ticket"
                rules={[{ required: true, message: 'Ingrese el ID del ticket' }]}
              >
                <Input placeholder="Copie y pegue desde el sistema externo" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="company_id"
                label="Cliente (Empresa)"
                rules={[{ required: true, message: 'Seleccione la empresa' }]}
              >
                <Select 
                  placeholder="Seleccione empresa" 
                  disabled={!!editingTicket}
                  onChange={(companyId) => {
                    setSelectedCompanyId(companyId);
                    loadRPAProcesses(companyId);
                    // Clear RPA process field when company changes
                    ticketForm.setFieldsValue({ rpa_process: undefined });
                  }}
                >
                  {companies.map(company => (
                    <Option key={company.id} value={company.id}>
                      {company.company_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="ticket_type"
                label="Tipo"
                rules={[{ required: true, message: 'Seleccione el tipo' }]}
              >
                <Select>
                  <Option value="Bug">Bug</Option>
                  <Option value="Enhancement">Mejora</Option>
                  <Option value="Consultation">Consulta</Option>
                  <Option value="Maintenance">Mantenimiento</Option>
                  <Option value="Training">Capacitación</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="attention_method"
                label="Método de Atención"
                rules={[{ required: true, message: 'Seleccione el método' }]}
                initialValue="FreshDesk"
              >
                <Select>
                  <Option value="FreshDesk">FreshDesk</Option>
                  <Option value="Remote">Remoto</Option>
                  <Option value="Email">Email</Option>
                  <Option value="Phone">Teléfono</Option>
                  <Option value="On-site">Presencial</Option>
                  <Option value="Chat">Chat</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="priority"
                label="Prioridad"
                initialValue="medium"
              >
                <Select>
                  <Option value="low">Baja</Option>
                  <Option value="medium">Media</Option>
                  <Option value="high">Alta</Option>
                  <Option value="critical">Crítica</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="rpa_process"
                label="Proceso RPA"
              >
                <Select 
                  placeholder="Seleccione proceso RPA o escriba uno nuevo"
                  showSearch
                  allowClear
                  mode="tags"
                  maxCount={1}
                  onSearch={handleRPAProcessSearch}
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <div style={{ padding: '8px', borderTop: '1px solid #d9d9d9' }}>
                        <Button
                          type="text"
                          icon={<PlusOutlined />}
                          onClick={() => setRPAProcessModalVisible(true)}
                          style={{ width: '100%', textAlign: 'left' }}
                          disabled={!selectedCompanyId}
                        >
                          {selectedCompanyId ? 'Crear nuevo proceso RPA' : 'Seleccione empresa primero'}
                        </Button>
                      </div>
                    </>
                  )}
                >
                  {rpaProcesses.map(process => (
                    <Option key={process.id} value={process.process_name}>
                      {process.process_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="client_name"
                label="Solicitante"
                rules={[{ required: true, message: 'Ingrese el solicitante' }]}
              >
                <Select 
                  placeholder="Seleccione solicitante o escriba uno nuevo"
                  showSearch
                  allowClear
                  mode="tags"
                  maxCount={1}
                  onSearch={handleContactSearch}
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <div style={{ padding: '8px', borderTop: '1px solid #d9d9d9' }}>
                        <Button
                          type="text"
                          icon={<PlusOutlined />}
                          onClick={() => setContactModalVisible(true)}
                          style={{ width: '100%', textAlign: 'left' }}
                        >
                          Crear nuevo solicitante
                        </Button>
                      </div>
                    </>
                  )}
                >
                  {allContacts.map(contact => (
                    <Option key={contact.id} value={contact.contact_name}>
                      {contact.contact_name} ({contact.company_name})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Descripción del Problema"
            rules={[{ required: true, message: 'Ingrese la descripción' }]}
          >
            <TextArea rows={4} placeholder="Describe detalladamente el problema..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="resolver_id"
                label="Resolutor (Ingeniero)"
              >
                <Select placeholder="Seleccione ingeniero asignado">
                  {teamMembers.map(member => (
                    <Option key={member.id} value={member.id}>
                      {member.full_name} - {member.role}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Estado"
                initialValue="open"
              >
                <Select>
                  <Option value="open">Abierto</Option>
                  <Option value="in_progress">En Progreso</Option>
                  <Option value="pending_client">⏳ Esperando Cliente</Option>
                  <Option value="resolved">Resuelto</Option>
                  <Option value="closed">Cerrado</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="open_date"
                label="Fecha Apertura"
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="close_date"
                label="Fecha Cierre"
              >
                <DatePicker 
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="time_invested_minutes"
                label="Tiempo Invertido (min)"
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="Minutos trabajados" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="solution"
            label="Solución"
          >
            <TextArea rows={3} placeholder="Describe la solución aplicada (opcional)" />
          </Form.Item>
          
          <Form.Item
            name="customer_satisfaction"
            label="Satisfacción Cliente (1-5)"
          >
            <InputNumber min={1} max={5} style={{ width: '200px' }} placeholder="Opcional" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingTicket ? 'Actualizar' : 'Crear'}
              </Button>
              <Button onClick={() => setTicketModalVisible(false)}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* RPA Process Modal */}
      <Modal
        title="Crear Nuevo Proceso RPA"
        open={rpaProcessModalVisible}
        onCancel={() => {
          setRPAProcessModalVisible(false);
          rpaProcessForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={rpaProcessForm}
          layout="vertical"
          onFinish={handleCreateRPAProcess}
        >
          <Form.Item
            name="process_name"
            label="Nombre del Proceso"
            rules={[{ required: true, message: 'Ingrese el nombre del proceso' }]}
          >
            <Input placeholder="Ej: Facturación Automática" />
          </Form.Item>
          
          <Form.Item
            name="process_description"
            label="Descripción (Opcional)"
          >
            <TextArea rows={3} placeholder="Describe el proceso RPA..." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Crear Proceso
              </Button>
              <Button onClick={() => {
                setRPAProcessModalVisible(false);
                rpaProcessForm.resetFields();
              }}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Contact Modal */}
      <Modal
        title="Crear Nuevo Solicitante"
        open={contactModalVisible}
        onCancel={() => {
          setContactModalVisible(false);
          contactForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={contactForm}
          layout="vertical"
          onFinish={handleCreateContact}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="company_id"
                label="Empresa"
                rules={[{ required: true, message: 'Seleccione la empresa' }]}
              >
                <Select placeholder="Seleccione empresa">
                  {companies.map(company => (
                    <Option key={company.id} value={company.id}>
                      {company.company_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contact_name"
                label="Nombre del Solicitante"
                rules={[{ required: true, message: 'Ingrese el nombre' }]}
              >
                <Input placeholder="Ej: María González" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contact_email"
                label="Email"
                rules={[{ type: 'email', message: 'Ingrese un email válido' }]}
              >
                <Input placeholder="maria@empresa.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contact_phone"
                label="Teléfono"
              >
                <Input placeholder="+56912345678" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="position"
                label="Cargo"
              >
                <Input placeholder="Ej: Analista de Sistemas" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="is_primary"
                valuePropName="checked"
                label="Contacto Principal"
              >
                <Checkbox>Es el contacto principal de la empresa</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Crear Solicitante
              </Button>
              <Button onClick={() => {
                setContactModalVisible(false);
                contactForm.resetFields();
              }}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Excel Import Modal */}
      <ExcelImportModal
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onSuccess={() => {
          setImportModalVisible(false);
          loadSupportData();
          message.success('Excel importado exitosamente');
        }}
      />
    </Content>
  );
};

export default SupportPage;