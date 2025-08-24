# Support Module User Guide

## Overview

The Support Module is a comprehensive customer support management system that handles client companies, support tickets, and monthly billing calculations. This guide will help you navigate and use all features effectively.

## Getting Started

### Accessing the Support Module
**URL**: `http://localhost:3000/support`

**Requirements**: You need to be logged in with any valid user role. All authenticated users can access support features.

### Main Navigation
The Support page includes:
- **Dashboard Summary**: Overview of current month statistics
- **Monthly Billing**: "Total a Cobrar en el Mes" (Total to Bill This Month)
- **Company List**: All support companies with current status
- **Quick Actions**: Create tickets, manage companies

## Dashboard Overview

### Summary Statistics
At the top of the page, you'll see key metrics:

```
┌─────────────────────────────────────────┐
│ Support Dashboard - August 2024         │
├─────────────────────────────────────────┤
│ Total Companies: 25                     │
│ Active Companies: 22                    │
│ This Month's Tickets: 45                │
│ This Month's Resolved: 38               │
└─────────────────────────────────────────┘
```

### Monthly Billing Summary
The billing section shows the total amount to invoice for the selected month:

```
┌─────────────────────────────────────────┐
│ Total a Cobrar en el Mes               │
│ 15,750,000 CLP                         │
├─────────────────────────────────────────┤
│ Base Hours: 12,000,000 CLP            │
│ Extra Hours: 3,750,000 CLP            │
│ Companies Billed: 5                    │
└─────────────────────────────────────────┘
```

**Note**: All amounts are automatically converted to Chilean Pesos (CLP) for unified reporting.

## Company Management

### Company List View
The main company list shows:

| Company Name | Contract Hours | Consumed Hours | Status | Monthly Billing (CLP) |
|--------------|----------------|----------------|--------|----------------------|
| Tech Solutions Inc | 40 | 45.5 | Exceeded | 3,163,500 |
| Digital Corp | 30 | 25.2 | Normal | 2,025,000 |
| Innovation Labs | 20 | 8.5 | Normal | 1,350,000 |

### Company Status Indicators
- **Normal**: Consuming under 80% of contracted hours (Green)
- **Near Limit**: Consuming 80-100% of contracted hours (Yellow)
- **Exceeded**: Consuming over 100% of contracted hours (Red)

### Creating a New Company

1. **Click "New Company" button**
2. **Fill in basic information**:
   - Company Name (required)
   - Contact Person
   - Email and Phone
   - Address

3. **Configure contract terms**:
   - **Contracted Hours Monthly**: e.g., 10, 20, 40, 50
   - **Hourly Rate**: Base rate per hour
   - **Currency**: USD, CLP, or UF
   - **Extra Hours Rate**: Premium rate for overtime
   - **Contract Start/End Dates**

4. **Set status**: Active, Inactive, Suspended, or Terminated
5. **Click "Create Company"**

### Editing Company Information

1. **Click on company name** in the list
2. **Use "Edit" button** to modify:
   - Contact information
   - Contract terms
   - Hourly rates
   - Contract dates
3. **Save changes**

**Important**: Rate changes apply from the modification date forward.

### Managing Company Contacts

Each company can have multiple contacts:

1. **Access company detail page**
2. **Go to "Contacts" section**
3. **Add new contacts**:
   - Contact Name (required)
   - Email and Phone
   - Job Position
   - Mark as Primary Contact if needed

## Ticket Management

### Creating Support Tickets

1. **Click "New Ticket" button**
2. **Select company** from dropdown
3. **Fill in ticket details**:

#### Basic Information
- **Ticket ID**: Auto-generated (SUP-YYYY-NNN) or custom
- **Client Name**: Person requesting support
- **Ticket Type**: bug_fix, enhancement, consultation, maintenance, etc.
- **Attention Method**: email, phone, remote, on-site, chat

#### Technical Details
- **RPA Process**: Select from company's process list
- **Description**: Detailed problem description (required)
- **Priority**: critical, high, medium, low
- **Requester**: Person who requested support

#### Time Tracking
- **Work Date**: Date work was performed
- **Time Invested**: Minutes spent on the ticket
- **Resolver**: Assign to team member

4. **Save ticket**

### Updating Ticket Status

Tickets progress through these statuses:
- **Open**: New ticket, awaiting attention
- **In Progress**: Currently being worked on
- **Pending Client**: Waiting for client response
- **Resolved**: Solution provided
- **Closed**: Ticket complete
- **Cancelled**: Ticket cancelled

To update a ticket:
1. **Open ticket detail page**
2. **Change status** in the status dropdown
3. **Add solution description** when resolving
4. **Update time invested** if additional work performed
5. **Save changes**

### Time Tracking

Accurate time tracking is crucial for billing:

1. **Log time in minutes** when working on tickets
2. **System automatically converts** to hours for billing
3. **Time is counted toward company's monthly quota** when ticket is resolved
4. **Extra hours are billed at premium rate**

### Adding Ticket Comments

1. **Open ticket detail page**
2. **Scroll to comments section**
3. **Add comment with**:
   - Comment text
   - Time spent (if applicable)
   - Mark as internal (not visible to client) if needed
4. **Save comment**

## Billing and Financial Management

### Understanding the Billing Model

The system uses a **Fixed Monthly Contract** model:

1. **Base Billing**: Companies pay for full contracted hours regardless of usage
2. **Extra Hours**: Additional hours are charged at premium rate
3. **Monthly Reset**: Hours reset on the 1st of each month
4. **Currency Conversion**: All billing converted to CLP using current rates

### Monthly Billing Calculation Example

**Company**: Tech Solutions Inc
- **Contracted**: 40 hours/month at $75.50 USD
- **Consumed**: 45.5 hours in August 2024
- **Extra Rate**: $90.00 USD
- **Exchange Rate**: 900 CLP/USD

```
Base Hours: 40 × $75.50 × 900 = 2,718,000 CLP
Extra Hours: 5.5 × $90.00 × 900 = 445,500 CLP
Total Billing: 3,163,500 CLP
```

### Viewing Monthly Billing

1. **Use month selector** at top of page to choose month
2. **View "Total a Cobrar en el Mes"** for overall billing
3. **Check individual company billing** in the company list
4. **Click company name** for detailed billing breakdown

### Generating Billing Reports

1. **Select target month** using date picker
2. **Review billing calculations** for accuracy
3. **Export data** (if available) for accounting system
4. **Use billing amounts** to generate client invoices

## RPA Process Management

### Company-Specific Processes

Each company can have their own RPA process catalog:

1. **Go to company detail page**
2. **Navigate to "RPA Processes" section**
3. **Add new process**:
   - Process Name (required)
   - Process Description
   - Mark as Active

4. **Manage existing processes**:
   - Edit process details
   - Activate/deactivate processes
   - View usage in tickets

### Using Processes in Tickets

When creating tickets:
1. **Select company first** - this loads their process list
2. **Choose relevant RPA process** from dropdown
3. **Process helps categorize** the support request
4. **Used for reporting and analysis**

## Month Selection and Historical Data

### Changing Month View

1. **Use the month selector** at the top of the dashboard
2. **Select format**: YYYY-MM (e.g., 2024-08)
3. **Dashboard updates** to show data for selected month
4. **All billing calculations** recalculate for the new month

### Historical Analysis

- **Compare months**: Switch between months to see trends
- **Track consumption patterns**: See how companies use their hours
- **Budget planning**: Use historical data for forecasting
- **Client analysis**: Identify high-usage vs. low-usage clients

## Common Workflows

### 1. Monthly Billing Process

**Steps for end-of-month billing**:

1. **Navigate to Support module**
2. **Ensure current month is selected**
3. **Review "Total a Cobrar en el Mes"** for accuracy
4. **Check individual company billings**:
   - Verify consumed hours are reasonable
   - Check for any companies with "Exceeded" status
   - Review exchange rates used
5. **Export billing data** for accounting
6. **Generate client invoices** using calculated amounts
7. **Update exchange rates** if needed for next month

### 2. New Client Onboarding

**Steps to add a new support client**:

1. **Create company record**:
   - Enter company details
   - Set contract terms (hours, rates, currency)
   - Add primary contact

2. **Set up RPA processes**:
   - Add company's automation processes
   - Configure process descriptions

3. **Create initial contacts**:
   - Add key personnel
   - Mark primary contact

4. **Begin support activities**:
   - Create first support tickets
   - Start time tracking

### 3. Monthly Usage Monitoring

**Steps to monitor client usage**:

1. **Review dashboard daily/weekly**
2. **Check status indicators**:
   - Green (Normal): No action needed
   - Yellow (Near Limit): Consider alerting client
   - Red (Exceeded): Expect extra billing
3. **Contact clients approaching limits**
4. **Plan resource allocation** based on usage patterns

### 4. Ticket Resolution Workflow

**Standard ticket handling process**:

1. **Receive/Create ticket**
2. **Assign to resolver**
3. **Update status to "In Progress"**
4. **Work on resolution, logging time**
5. **Add comments with progress updates**
6. **Mark as "Resolved" with solution**
7. **Client confirms resolution**
8. **Close ticket**

## Troubleshooting

### Common Issues

#### 1. Billing Amounts Look Wrong

**Problem**: Monthly billing doesn't match expectations
**Check**:
- Verify company has correct contracted hours
- Ensure hourly rates are accurate
- Check currency settings (USD, CLP, UF)
- Confirm exchange rates in global settings
- Review tickets marked as resolved in the month
- Verify time tracking on tickets

#### 2. Company Not Showing in Billing

**Problem**: Active company missing from billing calculations
**Check**:
- Company status must be "Active"
- Company must have contracted hours > 0
- Company must have resolved tickets in selected month
- Verify contract dates include selected month

#### 3. Incorrect Hour Consumption

**Problem**: Company's consumed hours seem wrong
**Check**:
- Only resolved tickets count toward hours
- Verify `time_invested_minutes` on tickets
- Check that tickets are assigned to correct company
- Ensure tickets were resolved in the target month

#### 4. Cannot Create Tickets

**Problem**: Error when creating support tickets
**Check**:
- Company must be active
- All required fields must be filled
- User must be authenticated
- Check browser console for error messages

### Data Validation Tips

1. **Monthly reconciliation**: Cross-check total hours with individual tickets
2. **Exchange rate consistency**: Ensure rates match global settings
3. **Date boundaries**: Verify tickets counted in correct month
4. **Currency accuracy**: Check original currency vs. CLP conversion

## Advanced Features

### Excel Import (if available)

Some installations support Excel import for bulk ticket creation:

1. **Prepare Excel file** with proper columns
2. **Use "Import" feature** (if visible)
3. **Map columns** to ticket fields
4. **Review import results**
5. **Fix any import errors**

### Export Functionality

Export support data for external analysis:

1. **Select month/date range**
2. **Choose export format**: Excel, CSV, or PDF
3. **Download generated file**
4. **Use for reporting or accounting integration**

### API Access

For developers or system integrations:
- **API Documentation**: Available in `/docs/support-api.md`
- **Authentication**: Bearer token required
- **Rate Limits**: Standard API limits apply
- **Data Format**: JSON responses

## Best Practices

### 1. Time Tracking Accuracy
- **Log time immediately** when working on tickets
- **Be precise with minutes** - affects billing calculations
- **Include all work time** - research, communication, testing
- **Update time if returning** to a ticket

### 2. Ticket Management
- **Use clear descriptions** for better tracking
- **Update status promptly** to reflect current state
- **Add meaningful comments** for audit trail
- **Assign appropriate priority** levels

### 3. Client Communication
- **Keep clients informed** about high hour usage
- **Notify approaching limits** proactively
- **Explain billing model** clearly to new clients
- **Provide monthly usage summaries**

### 4. Data Quality
- **Verify company information** regularly
- **Update exchange rates** monthly or as needed
- **Review billing calculations** before invoicing
- **Maintain accurate contact lists**

## Security and Permissions

### Access Control
- **All authenticated users** can access support module
- **Data isolation**: Users see all company data (multi-tenant considerations for future)
- **Audit trail**: All changes logged with user and timestamp
- **Sensitive data**: Billing information requires careful handling

### Data Protection
- **Client confidentiality**: Protect company and contact information
- **Financial data**: Secure billing calculations and rates
- **Time tracking**: Accurate logging for billing integrity
- **Backup considerations**: Regular data backups recommended

## Getting Help

### Resources
1. **API Documentation**: `/docs/support-api.md`
2. **Feature Guide**: `/docs/feature-support-billing.md`
3. **Database Schema**: `/docs/database-schema.md`
4. **Development Setup**: `/docs/development-setup.md`

### Support Contacts
- **Technical Issues**: Check application logs
- **Billing Questions**: Verify global settings
- **Feature Requests**: Contact development team
- **Data Issues**: Review database integrity

The Support Module provides a complete solution for managing client support operations with accurate billing calculations and comprehensive ticket tracking. Following this guide will help you make the most of all available features.