# Support API Documentation

## Overview

The Support API provides comprehensive support ticket management, company billing tracking, and RPA process management capabilities. This API includes the new billing feature "Total a Cobrar en el Mes" (Monthly Billing Total) with multi-currency support and automatic calculations.

## Base URL

All Support endpoints are prefixed with:
```
http://localhost:5001/api/support
```

## Authentication

All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your-token>
```

## Table of Contents

1. [Company Management](#company-management)
2. [Ticket Management](#ticket-management)
3. [Billing & Financial](#billing--financial)
4. [Dashboard & Reports](#dashboard--reports)
5. [RPA Process Management](#rpa-process-management)
6. [Contact Management](#contact-management)
7. [Excel Import](#excel-import)
8. [Response Schemas](#response-schemas)
9. [Error Handling](#error-handling)

---

## Company Management

### GET /companies

Retrieves support companies with billing information for a specific month.

**Request:**
```http
GET /api/support/companies?status=active&month=2024-08
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): Filter by status (active, inactive)
- `search` (optional): Search by company name, contact person, or email
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `month` (optional): Month for billing calculations (YYYY-MM format, default: current month)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "company_name": "Tech Solutions Inc",
      "contact_person": "John Smith",
      "email": "john@techsolutions.com",
      "phone": "+1-555-0123",
      "contracted_hours_monthly": 40,
      "hourly_rate": 75.50,
      "hourly_rate_currency": "USD",
      "hourly_rate_extra": 90.00,
      "address": "123 Business St",
      "notes": "Premium support contract",
      "contract_start_date": "2024-01-01",
      "contract_end_date": "2024-12-31",
      "status": "active",
      "total_tickets": 25,
      "open_tickets": 3,
      "current_month_consumed_hours": 45.5,
      "current_month_remaining_hours": -5.5,
      "monthly_billing": {
        "total_to_invoice_clp": 3825000,
        "base_hours_value_clp": 2700000,
        "extra_hours_value_clp": 1125000,
        "consumed_hours": 45.5,
        "base_hours": 40,
        "extra_hours": 5.5,
        "selected_month": "2024-08"
      },
      "created_by": 1,
      "created_at": "2024-01-01T10:00:00Z",
      "updated_at": "2024-08-20T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "pages": 1
  }
}
```

### POST /companies

Creates a new support company.

**Request:**
```http
POST /api/support/companies
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_name": "New Client Corp",
  "contact_person": "Jane Doe",
  "email": "jane@newclient.com",
  "phone": "+1-555-0456",
  "contracted_hours_monthly": 30,
  "hourly_rate": 80.00,
  "hourly_rate_currency": "USD",
  "hourly_rate_extra": 100.00,
  "address": "456 Corporate Ave",
  "notes": "Standard support contract",
  "contract_start_date": "2024-09-01",
  "contract_end_date": "2025-08-31",
  "status": "active"
}
```

### GET /companies/:id

Retrieves a specific support company with current metrics.

**Request:**
```http
GET /api/support/companies/1
Authorization: Bearer <token>
```

### PUT /companies/:id

Updates support company information.

**Request:**
```http
PUT /api/support/companies/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "hourly_rate": 85.00,
  "contracted_hours_monthly": 45,
  "status": "active"
}
```

### DELETE /companies/:id

Deletes a support company. Only team leads can perform cascade deletion.

**Request:**
```http
DELETE /api/support/companies/1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Support company deleted successfully",
  "deletedTickets": 15
}
```

---

## Ticket Management

### GET /tickets

Retrieves support tickets with filtering options.

**Request:**
```http
GET /api/support/tickets?company_id=1&status=open&priority=high
Authorization: Bearer <token>
```

**Query Parameters:**
- `company_id` (optional): Filter by company ID
- `status` (optional): Filter by status (open, in_progress, pending_client, resolved, closed, cancelled)
- `priority` (optional): Filter by priority (critical, high, medium, low)
- `ticket_type` (optional): Filter by ticket type
- `resolver_id` (optional): Filter by resolver user ID
- `search` (optional): Search in ticket ID, client name, or description
- `date_from` (optional): Start date filter (YYYY-MM-DD)
- `date_to` (optional): End date filter (YYYY-MM-DD)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "id_ticket": "SUP-2024-001",
      "company_id": 1,
      "company_name": "Tech Solutions Inc",
      "client_name": "John Smith",
      "ticket_type": "bug_fix",
      "attention_method": "email",
      "rpa_process": "Invoice Processing",
      "requester": "John Smith",
      "resolver_id": 2,
      "resolver_name": "Jane Developer",
      "description": "RPA process stops working after update",
      "solution": "Updated configuration files",
      "status": "resolved",
      "priority": "high",
      "open_date": "2024-08-20T09:00:00Z",
      "close_date": "2024-08-21T15:30:00Z",
      "time_invested_minutes": 180,
      "hours_calculated": 3.00,
      "customer_satisfaction": 4,
      "created_by": 1,
      "created_at": "2024-08-20T09:00:00Z",
      "updated_at": "2024-08-21T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "pages": 1
  }
}
```

### POST /tickets

Creates a new support ticket.

**Request:**
```http
POST /api/support/tickets
Authorization: Bearer <token>
Content-Type: application/json

{
  "id_ticket": "SUP-2024-002",
  "company_id": 1,
  "client_name": "John Smith",
  "ticket_type": "enhancement",
  "attention_method": "phone",
  "rpa_process": "Data Entry Automation",
  "description": "Need to add validation to existing process",
  "solution": "",
  "priority": "medium",
  "requester": "John Smith",
  "work_date": "2024-08-24",
  "completion_date": null,
  "time_invested_minutes": 0
}
```

### PUT /tickets/:id

Updates a support ticket.

**Request:**
```http
PUT /api/support/tickets/SUP-2024-002
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "resolved",
  "solution": "Added validation rules to the process",
  "time_invested_minutes": 120,
  "resolver_id": 2,
  "customer_satisfaction": 5
}
```

---

## Billing & Financial

### GET /dashboard

Retrieves support dashboard with billing information for the selected month.

**Request:**
```http
GET /api/support/dashboard?month=2024-08
Authorization: Bearer <token>
```

**Query Parameters:**
- `company_id` (optional): Get specific company data
- `month` (optional): Month for calculations (YYYY-MM format, default: current month)

**Response:**
```json
{
  "summary": {
    "totalCompanies": 25,
    "activeCompanies": 22,
    "thisMonthTickets": 45,
    "thisMonthResolved": 38
  },
  "topCompanies": [
    {
      "id": 1,
      "company_name": "Tech Solutions Inc",
      "contracted_hours_monthly": 40,
      "hourly_rate": 75.50,
      "hourly_rate_extra": 90.00,
      "hourly_rate_currency": "USD",
      "status": "active",
      "consumed_hours": 45.5,
      "remaining_hours": -5.5,
      "hour_status": "exceeded"
    }
  ],
  "recentTickets": [
    {
      "id": 1,
      "id_ticket": "SUP-2024-001",
      "company_name": "Tech Solutions Inc",
      "client_name": "John Smith",
      "status": "resolved",
      "priority": "high",
      "open_date": "2024-08-20T09:00:00Z",
      "hours_calculated": 3.00,
      "resolver_name": "Jane Developer"
    }
  ],
  "billing": {
    "totalToInvoice": 15750000,
    "baseHours": 12000000,
    "extraHours": 3750000,
    "total_companies": 5
  },
  "selected_company_id": null
}
```

### GET /companies/:id/billing

Retrieves detailed billing information for a specific company.

**Request:**
```http
GET /api/support/companies/1/billing
Authorization: Bearer <token>
```

**Response:**
```json
{
  "company_name": "Tech Solutions Inc",
  "contracted_hours_monthly": 40,
  "consumed_hours": 45.5,
  "remaining_hours": 0,
  "base_hours": 40,
  "extra_hours": 5.5,
  "hourly_rate": 75.50,
  "hourly_rate_extra": 90.00,
  "currency": "USD",
  "base_charges": 2700000,
  "extra_charges": 445500,
  "total_to_invoice": 3145500
}
```

### Monthly Billing Calculation Logic

The billing system implements a **Fixed Monthly Contract** model:

1. **Base Billing**: Always bill the full contracted monthly hours
2. **Extra Hours**: Bill additional hours beyond the contract at the extra rate
3. **Currency Conversion**: Convert all amounts to CLP using current exchange rates
4. **Monthly Reset**: Hours reset each month

**Example Calculation:**
- Contracted Hours: 40 hours/month at $75.50 USD
- Extra Rate: $90.00 USD per hour
- Consumed Hours: 45.5 hours
- Exchange Rate: 900 CLP per USD

```
Base Amount = 40 hours × $75.50 × 900 = 2,718,000 CLP
Extra Amount = 5.5 hours × $90.00 × 900 = 445,500 CLP
Total to Invoice = 3,163,500 CLP
```

---

## Dashboard & Reports

### GET /billing-report

Retrieves comprehensive billing report.

**Request:**
```http
GET /api/support/billing-report?year=2024&month=8
Authorization: Bearer <token>
```

**Response:**
```json
{
  "period": "2024-08",
  "summary": {
    "total_companies": 22,
    "active_contracts": 20,
    "total_hours_contracted": 800,
    "total_hours_consumed": 765.5,
    "total_base_billing_clp": 65000000,
    "total_extra_billing_clp": 3500000,
    "total_billing_clp": 68500000
  },
  "companies": [
    {
      "company_name": "Tech Solutions Inc",
      "contracted_hours": 40,
      "consumed_hours": 45.5,
      "base_billing_clp": 2718000,
      "extra_billing_clp": 445500,
      "total_billing_clp": 3163500,
      "currency": "USD",
      "tickets_count": 8
    }
  ]
}
```

---

## RPA Process Management

### GET /rpa-processes

Retrieves RPA processes for a company.

**Request:**
```http
GET /api/support/rpa-processes?company_id=1
Authorization: Bearer <token>
```

### POST /rpa-processes

Creates a new RPA process for a company.

**Request:**
```http
POST /api/support/rpa-processes
Authorization: Bearer <token>
Content-Type: application/json

{
  "company_id": 1,
  "process_name": "Invoice Processing v2",
  "process_description": "Enhanced invoice processing with validation"
}
```

---

## Contact Management

### GET /companies/:id/contacts

Retrieves contacts for a specific company.

**Request:**
```http
GET /api/support/companies/1/contacts
Authorization: Bearer <token>
```

### POST /companies/:id/contacts

Creates a new contact for a company.

**Request:**
```http
POST /api/support/companies/1/contacts
Authorization: Bearer <token>
Content-Type: application/json

{
  "contact_name": "Sarah Johnson",
  "contact_email": "sarah@techsolutions.com",
  "contact_phone": "+1-555-0789",
  "position": "IT Manager",
  "is_primary": true
}
```

### GET /contacts

Retrieves all active contacts across companies.

**Request:**
```http
GET /api/support/contacts
Authorization: Bearer <token>
```

---

## Excel Import

### POST /import/preview

Previews an Excel file for import with field mapping suggestions.

**Request:**
```http
POST /api/support/import/preview
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: [Excel file]
```

**Response:**
```json
{
  "headers": ["ID Ticket", "Cliente", "Tipo", "Descripción", "Horas"],
  "sampleData": [
    ["SUP-001", "Tech Solutions", "Bug Fix", "Process error", "3"],
    ["SUP-002", "Client Corp", "Enhancement", "Add validation", "2"]
  ],
  "availableFields": [
    {
      "key": "id_ticket",
      "label": "ID Ticket",
      "required": false
    },
    {
      "key": "company_name",
      "label": "Cliente",
      "required": true
    }
  ],
  "suggestedMappings": {
    "ID Ticket": "id_ticket",
    "Cliente": "company_name",
    "Tipo": "ticket_type",
    "Descripción": "description",
    "Horas": "hours"
  },
  "totalRows": 150
}
```

### POST /import/execute

Executes Excel import with field mappings.

**Request:**
```http
POST /api/support/import/execute
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: [Excel file]
mappings: {"ID Ticket": "id_ticket", "Cliente": "company_name"}
options: {"createMissingCompanies": true, "createMissingProcesses": true}
```

**Response:**
```json
{
  "totalRows": 150,
  "successCount": 142,
  "errorCount": 8,
  "errors": [
    {
      "row": 15,
      "error": "Empresa no encontrada: Invalid Corp"
    }
  ],
  "warnings": [
    {
      "row": 23,
      "warning": "Empresa creada automáticamente: New Company"
    }
  ]
}
```

---

## Response Schemas

### Support Company Schema
```json
{
  "id": "integer",
  "company_name": "string",
  "contact_person": "string",
  "email": "string",
  "phone": "string",
  "contracted_hours_monthly": "number",
  "hourly_rate": "number",
  "hourly_rate_currency": "string (CLP|USD|UF)",
  "hourly_rate_extra": "number",
  "address": "string",
  "notes": "string",
  "contract_start_date": "string (ISO date)",
  "contract_end_date": "string (ISO date)",
  "status": "string (active|inactive)",
  "total_tickets": "integer",
  "open_tickets": "integer",
  "current_month_consumed_hours": "number",
  "current_month_remaining_hours": "number",
  "monthly_billing": {
    "total_to_invoice_clp": "integer",
    "base_hours_value_clp": "integer",
    "extra_hours_value_clp": "integer",
    "consumed_hours": "number",
    "base_hours": "number",
    "extra_hours": "number",
    "selected_month": "string (YYYY-MM)"
  }
}
```

### Support Ticket Schema
```json
{
  "id": "integer",
  "id_ticket": "string",
  "company_id": "integer",
  "company_name": "string",
  "client_name": "string",
  "ticket_type": "string",
  "attention_method": "string (email|phone|chat|remote)",
  "rpa_process": "string",
  "requester": "string",
  "resolver_id": "integer",
  "resolver_name": "string",
  "description": "string",
  "solution": "string",
  "status": "string (open|in_progress|pending_client|resolved|closed|cancelled)",
  "priority": "string (critical|high|medium|low)",
  "open_date": "string (ISO datetime)",
  "close_date": "string (ISO datetime) | null",
  "time_invested_minutes": "integer",
  "hours_calculated": "number",
  "customer_satisfaction": "integer (1-5) | null"
}
```

---

## Error Handling

### HTTP Status Codes
- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Access denied
- **404 Not Found**: Resource not found
- **409 Conflict**: Unique constraint violation
- **500 Internal Server Error**: Server error

### Common Errors

1. **Missing required fields**:
   ```json
   {
     "error": "Missing required fields: company_id, client_name, ticket_type, attention_method, description"
   }
   ```

2. **Company not found**:
   ```json
   {
     "error": "Active support company not found"
   }
   ```

3. **Access denied for deletion**:
   ```json
   {
     "error": "Cannot delete company with existing tickets. Only administrators can perform cascade deletion."
   }
   ```

4. **File upload errors**:
   ```json
   {
     "error": "Only Excel and CSV files are allowed"
   }
   ```

---

## Currency Exchange Rates

The system supports automatic currency conversion to CLP:

- **USD**: Configurable rate (default: 900 CLP)
- **UF**: Configurable rate (default: 35,000 CLP)
- **CLP**: No conversion needed

Exchange rates are stored in `global_settings` table:
- `usd_to_clp`: USD to CLP conversion rate
- `uf_to_clp`: UF to CLP conversion rate

---

## Best Practices

1. **Billing Calculations**: Always use the current month parameter for accurate billing
2. **Currency Handling**: Ensure exchange rates are updated regularly
3. **File Imports**: Validate Excel files before import and handle errors gracefully
4. **Time Tracking**: Use minutes for precise time calculations
5. **Status Mapping**: Map ticket statuses correctly during imports

---

## Usage Examples

### Frontend Integration

```typescript
// Get companies with billing for current month
const companies = await apiService.getSupportCompanies({
  status: 'active',
  month: '2024-08'
});

// Get dashboard with billing totals
const dashboard = await apiService.getSupportDashboard('2024-08');

// Create a new ticket
const ticket = await apiService.createSupportTicket({
  company_id: 1,
  client_name: 'John Doe',
  ticket_type: 'support',
  attention_method: 'email',
  description: 'System not responding'
});
```

### Billing Report Generation

The system automatically calculates monthly billing using:
1. Fixed monthly contract hours (always billed)
2. Extra hours at premium rate
3. Currency conversion to CLP
4. Monthly summaries for reporting

Access billing via the Support page at: `http://localhost:3000/support`

---

## Support and Troubleshooting

For API issues or billing calculation questions, check:
1. Exchange rate configurations in global settings
2. Company contract terms and dates
3. Ticket time logging accuracy
4. Currency field consistency