# Support Billing Feature Guide

## Overview

The **Support Billing** feature ("Total a Cobrar en el Mes") is a comprehensive billing system that automatically calculates monthly charges for support clients based on contracted hours, actual consumption, and multi-currency rates. This feature implements a **Fixed Monthly Contract** model with automatic CLP conversion for unified reporting.

## Access

**URL**: `http://localhost:3000/support`

**Required Role**: Any authenticated user can view support data, but billing calculations are available to all users.

## Key Features

### 1. Monthly Billing Calculation
- **Fixed Contract Hours**: Always bills the full monthly contracted hours
- **Extra Hours**: Additional hours beyond the contract at premium rates  
- **Multi-Currency Support**: Handles USD, CLP, and UF with automatic conversion
- **Real-Time Updates**: Calculations update as tickets are resolved

### 2. Currency Management
- **Base Currencies**: USD, CLP, UF
- **Automatic Conversion**: All amounts converted to CLP for reporting
- **Exchange Rate Configuration**: Configurable rates in system settings
- **Rate Display**: Shows original currency and CLP equivalent

### 3. Company Management
- **Contract Terms**: Monthly hour quotas and rates
- **Contact Management**: Multiple contacts per company
- **Status Tracking**: Active/inactive company management
- **Historical Data**: Month-by-month consumption tracking

### 4. Reporting & Analytics
- **Monthly Summaries**: Aggregated billing data per company
- **Consumption Analytics**: Hours consumed vs. contracted
- **Revenue Tracking**: Total billing amounts and trends
- **Export Capabilities**: Data export for invoicing

## How It Works

### Billing Logic

The system implements a **Fixed Monthly Contract** model:

1. **Base Billing**: Company pays for full contracted hours regardless of usage
2. **Extra Hours**: Additional hours charged at premium rate when exceeded
3. **Monthly Reset**: Hours and billing reset each month
4. **Prorated Billing**: Not implemented - bills full contracted amount

### Example Calculation

**Company**: Tech Solutions Inc.
- **Contracted Hours**: 40 hours/month
- **Base Rate**: $75.50 USD/hour  
- **Extra Rate**: $90.00 USD/hour
- **Hours Consumed**: 45.5 hours
- **Exchange Rate**: 900 CLP/USD

```
Base Hours Billing = 40 hours × $75.50 × 900 CLP = 2,718,000 CLP
Extra Hours = 45.5 - 40 = 5.5 hours
Extra Hours Billing = 5.5 hours × $90.00 × 900 CLP = 445,500 CLP
Total Monthly Billing = 2,718,000 + 445,500 = 3,163,500 CLP
```

### Currency Conversion

The system automatically converts all billing to CLP using configurable exchange rates:

- **USD to CLP**: Default 900 (configurable in global settings)
- **UF to CLP**: Default 35,000 (configurable in global settings)
- **CLP**: No conversion needed

## User Interface

### Support Dashboard

The main support page displays:

#### Summary Statistics
- **Total Companies**: Count of all registered companies
- **Active Companies**: Companies with active contracts
- **This Month's Tickets**: Tickets opened in current month
- **This Month's Resolved**: Tickets resolved in current month

#### Monthly Billing Summary
```
Total a Cobrar en el Mes: 15,750,000 CLP
├── Base Hours: 12,000,000 CLP
├── Extra Hours: 3,750,000 CLP  
└── Companies Billed: 5
```

#### Company List with Billing
Each company shows:
- **Company Name** and contact information
- **Monthly Contract**: Hours and rates
- **Consumed Hours**: Actual usage for selected month
- **Hour Status**: Normal, near_limit, or exceeded
- **Monthly Billing**: Detailed breakdown in CLP

### Monthly Selection

Users can select different months to view historical billing:
- **Date Selector**: YYYY-MM format picker
- **Current Month**: Default selection
- **Historical Data**: Previous months' consumption and billing

### Company Detail View

Individual company pages show:
- **Contract Details**: Terms, rates, and duration
- **Current Month Usage**: Hours consumed and remaining
- **Billing Breakdown**: Base and extra charges
- **Ticket History**: Recent support requests
- **RPA Processes**: Associated automation processes

## API Integration

### Key Endpoints

#### Get Companies with Billing
```http
GET /api/support/companies?month=2024-08
```

Returns companies with calculated monthly billing for the specified month.

#### Get Dashboard Data
```http
GET /api/support/dashboard?month=2024-08
```

Returns summary statistics and global billing totals.

#### Get Company Billing Detail
```http
GET /api/support/companies/{id}/billing
```

Returns detailed billing breakdown for a specific company.

### Response Format

```json
{
  "id": 1,
  "company_name": "Tech Solutions Inc",
  "contracted_hours_monthly": 40,
  "hourly_rate": 75.50,
  "hourly_rate_currency": "USD",
  "hourly_rate_extra": 90.00,
  "current_month_consumed_hours": 45.5,
  "monthly_billing": {
    "total_to_invoice_clp": 3163500,
    "base_hours_value_clp": 2718000,
    "extra_hours_value_clp": 445500,
    "consumed_hours": 45.5,
    "base_hours": 40,
    "extra_hours": 5.5,
    "selected_month": "2024-08"
  }
}
```

## Configuration

### Exchange Rates

Configure currency conversion rates in the global settings:

1. **Access Settings**: Admin users can modify exchange rates
2. **USD to CLP**: Set current USD exchange rate
3. **UF to CLP**: Set current UF rate (Unidad de Fomento)
4. **Update Frequency**: Rates should be updated regularly

### Company Setup

For each support company, configure:

#### Basic Information
- **Company Name**: Client company name
- **Contact Person**: Primary contact
- **Email & Phone**: Contact information
- **Address**: Company address

#### Contract Terms  
- **Contracted Hours**: Monthly support hours (e.g., 10, 20, 40, 50)
- **Hourly Rate**: Base rate per hour
- **Currency**: Rate currency (USD, CLP, UF)
- **Extra Hours Rate**: Premium rate for overtime
- **Contract Dates**: Start and end dates

#### Status Management
- **Active**: Currently receiving support
- **Inactive**: Contract paused
- **Suspended**: Temporary suspension
- **Terminated**: Contract ended

## Business Rules

### Billing Rules

1. **Fixed Monthly Charge**: Always bill contracted hours, even if unused
2. **Extra Hours Premium**: Charge premium rate for hours over contract
3. **No Proration**: Full month charges regardless of start/end dates within month
4. **Currency Consistency**: All contracts in single currency per company
5. **Rate Changes**: New rates apply from effective date forward

### Hour Tracking Rules

1. **Ticket-Based**: Hours tracked through support tickets
2. **Resolution Basis**: Hours counted when tickets are resolved
3. **Monthly Reset**: Hour counters reset on first day of each month
4. **Carry-Over**: No unused hour carry-over between months

### Invoicing Rules

1. **Monthly Generation**: Invoices generated monthly
2. **CLP Amounts**: All invoices in Chilean Pesos
3. **Rate Documentation**: Include exchange rates used
4. **Audit Trail**: Complete calculation transparency

## Reporting Features

### Monthly Billing Report

Access comprehensive billing reports showing:

#### Company Summary
- **Total Companies Serviced**: Count of active companies
- **Total Hours Contracted**: Sum of all contracted hours
- **Total Hours Consumed**: Actual usage across all companies
- **Total Revenue (CLP)**: Complete billing amounts

#### Detailed Breakdown
- **Per-Company Analysis**: Individual billing calculations
- **Currency Distribution**: Revenue by original currency
- **Usage Patterns**: Over/under consumption analysis
- **Trend Analysis**: Month-over-month comparisons

### Export Options

1. **Excel Export**: Detailed billing data for accounting
2. **PDF Reports**: Executive summaries and client statements  
3. **CSV Data**: Raw data for external analysis
4. **API Access**: Programmatic data extraction

## Common Use Cases

### 1. Monthly Invoicing Process

**Scenario**: Generate monthly invoices for all clients

**Steps**:
1. Navigate to Support module (`http://localhost:3000/support`)
2. Select target month from date picker
3. Review "Total a Cobrar en el Mes" summary
4. Verify individual company billings
5. Export detailed reports for accounting
6. Generate client invoices using billing data

### 2. Contract Monitoring

**Scenario**: Monitor client hour consumption

**Steps**:
1. Access Support dashboard
2. Review "Hour Status" indicators:
   - **Normal**: Under 80% of contracted hours
   - **Near Limit**: 80-100% of contracted hours  
   - **Exceeded**: Over 100% of contracted hours
3. Contact clients approaching limits
4. Manage resource allocation

### 3. Revenue Analysis

**Scenario**: Analyze support revenue trends

**Steps**:
1. Use month selector to view historical data
2. Compare monthly billing totals
3. Analyze base vs. extra hours revenue
4. Identify high-consumption clients
5. Plan capacity and pricing adjustments

### 4. Client Onboarding

**Scenario**: Add new support client

**Steps**:
1. Navigate to Companies management
2. Create new company record
3. Configure contract terms:
   - Set monthly hour quota
   - Define base and premium rates
   - Select currency
   - Set contract period
4. Add company contacts
5. Begin ticket tracking

## Troubleshooting

### Common Issues

#### 1. Incorrect Billing Amounts

**Problem**: Billing calculations appear incorrect
**Solution**: 
- Verify exchange rates in global settings
- Check company contract terms
- Ensure tickets are properly resolved with time tracking
- Review month selection in dashboard

#### 2. Missing Company Data

**Problem**: Company not appearing in billing
**Solution**:
- Check company status (must be "active")
- Verify contract dates include selected month
- Ensure company has contracted hours > 0
- Check ticket assignments to company

#### 3. Currency Conversion Errors

**Problem**: Wrong currency amounts displayed
**Solution**:
- Update exchange rates in global settings
- Verify company currency settings
- Check for mixing currencies within single company
- Restart application if rates recently changed

#### 4. Hour Tracking Discrepancies

**Problem**: Consumed hours don't match expectations
**Solution**:
- Verify tickets are marked as resolved
- Check time_invested_minutes values on tickets
- Ensure tickets are assigned to correct company
- Review month boundaries (tickets resolved in target month)

### Data Integrity Checks

#### Monthly Reconciliation
1. **Total Hours**: Sum of individual tickets should match company totals
2. **Currency Amounts**: Manual calculation verification
3. **Date Boundaries**: Ensure tickets counted in correct month
4. **Exchange Rates**: Verify rates used match global settings

#### Audit Trail
- All billing calculations logged
- Exchange rates timestamped
- Ticket modifications tracked
- Company changes audited

## Advanced Features

### 1. Multi-Month Analysis

Compare billing across multiple months:
```
Month          Total Billing    Companies    Avg per Company
2024-06        12,500,000 CLP      18         694,444 CLP
2024-07        14,200,000 CLP      20         710,000 CLP  
2024-08        15,750,000 CLP      22         715,909 CLP
```

### 2. Currency Impact Analysis

Understand exchange rate impact:
```
USD Contracts: 8,950,000 CLP (at 900 CLP/USD)
CLP Contracts: 4,200,000 CLP (no conversion)
UF Contracts:  2,600,000 CLP (at 35,000 CLP/UF)
Total:         15,750,000 CLP
```

### 3. Predictive Analytics

Forecast based on trends:
- **Hour Consumption**: Predict monthly usage
- **Revenue Projections**: Estimate future billing
- **Capacity Planning**: Resource allocation needs
- **Contract Renewals**: Identify upcoming expirations

## Integration Points

### 1. Accounting System Integration

Export billing data in formats compatible with:
- **ERP Systems**: Structured data feeds
- **Accounting Software**: Standard chart of accounts
- **Tax Systems**: Chilean tax compliance formats
- **Banking**: Payment processing integration

### 2. CRM Integration

Sync support data with customer relationship management:
- **Client Communications**: Usage alerts and reports
- **Contract Management**: Renewal notifications
- **Service Level Monitoring**: SLA compliance tracking
- **Relationship Insights**: Service utilization patterns

### 3. Time Tracking Integration

Connect with existing time tracking tools:
- **Ticket Systems**: Automated time capture
- **Developer Tools**: IDE time tracking
- **Project Management**: Cross-system consistency
- **Resource Planning**: Allocation optimization

## Security Considerations

### Access Control
- **Role-Based Access**: Different permissions for different user types
- **Billing Data**: Sensitive financial information protection
- **Client Confidentiality**: Multi-tenant data isolation
- **Audit Logging**: Complete access trail

### Data Protection
- **Currency Data**: Secure calculation and storage
- **Exchange Rates**: Authorized-only modification
- **Client Information**: GDPR/privacy compliance
- **Financial Records**: Immutable audit trails

## Future Enhancements

### Planned Features
1. **Automated Invoicing**: Direct invoice generation
2. **Rate Scheduling**: Automatic rate changes
3. **SLA Integration**: Service level monitoring
4. **Mobile App**: On-the-go billing access
5. **Real-Time Notifications**: Usage alerts

### API Enhancements
1. **Webhook Integration**: Real-time billing updates
2. **GraphQL Support**: Flexible data querying
3. **Batch Processing**: Bulk operations
4. **Rate Limiting**: Enhanced performance control

The Support Billing feature provides a complete solution for managing multi-currency support contracts with automatic billing calculations, ensuring accurate and transparent billing processes for all stakeholders.