# Database Schema Documentation

## Overview

The RPA Team Manager uses SQLite as its primary database with a comprehensive schema designed for team project management, PMO analytics, support ticket management, and financial tracking. The database supports multi-currency operations and complex relationship tracking.

## Database Structure

- **Database Engine**: SQLite 3
- **Character Set**: UTF-8
- **Foreign Key Constraints**: Enabled
- **Triggers**: Automated timestamp updates and business logic
- **Indexes**: Optimized for performance

## Core Modules

1. [User Management](#user-management)
2. [Project Management](#project-management)
3. [Task & Kanban System](#task--kanban-system)
4. [File Management](#file-management)
5. [PMO Analytics](#pmo-analytics)
6. [Support Module](#support-module)
7. [Financial Tracking](#financial-tracking)
8. [Ideas Management](#ideas-management)

---

## User Management

### users
Core user authentication and profile information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Unique user identifier |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Login username |
| `email` | VARCHAR(100) | UNIQUE, NOT NULL | User email address |
| `password_hash` | VARCHAR(255) | NOT NULL | Hashed password |
| `role` | VARCHAR(20) | NOT NULL | User role (team_lead, rpa_developer, rpa_operations, it_support) |
| `full_name` | VARCHAR(100) | NOT NULL | Display name |
| `avatar_url` | VARCHAR(255) | NULL | Profile picture URL |
| `is_active` | BOOLEAN | DEFAULT 1 | Account status |
| `last_login` | DATETIME | NULL | Last login timestamp |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Account creation date |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Business Rules:**
- Roles are strictly enforced: team_lead, rpa_developer, rpa_operations, it_support
- Email addresses must be unique across all users
- Soft delete via `is_active` flag

### user_sessions
JWT token management and session tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Session identifier |
| `user_id` | INTEGER | FK(users.id), NOT NULL | User reference |
| `token_hash` | VARCHAR(255) | NOT NULL | Hashed JWT token |
| `expires_at` | DATETIME | NOT NULL | Token expiration |
| `ip_address` | VARCHAR(45) | NULL | Client IP address |
| `user_agent` | TEXT | NULL | Client browser info |
| `is_active` | BOOLEAN | DEFAULT 1 | Session status |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Session start |

### user_cost_rates
Employee cost tracking (team_lead access only).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Rate record identifier |
| `user_id` | INTEGER | FK(users.id), NOT NULL | Employee reference |
| `monthly_cost` | DECIMAL(10,2) | NOT NULL | Monthly cost |
| `monthly_cost_currency` | VARCHAR(3) | DEFAULT 'CLP' | Cost currency |
| `hourly_rate` | DECIMAL(8,2) | NOT NULL | Hourly rate |
| `hourly_rate_currency` | VARCHAR(3) | DEFAULT 'CLP' | Rate currency |
| `effective_from` | DATE | NOT NULL | Rate start date |
| `effective_to` | DATE | NULL | Rate end date (NULL = current) |
| `is_active` | BOOLEAN | DEFAULT 1 | Rate status |
| `created_by` | INTEGER | FK(users.id), NOT NULL | Creator (team_lead only) |

**Supported Currencies**: USD, CLP, UF

---

## Project Management

### projects
Main project entities with lifecycle management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Project identifier |
| `name` | VARCHAR(200) | NOT NULL | Project name |
| `description` | TEXT | NULL | Project description |
| `status` | VARCHAR(20) | DEFAULT 'planning' | Project status |
| `priority` | VARCHAR(10) | DEFAULT 'medium' | Priority level |
| `budget` | DECIMAL(12,2) | NULL | Project budget |
| `start_date` | DATE | NULL | Planned start date |
| `end_date` | DATE | NULL | Planned end date |
| `actual_start_date` | DATE | NULL | Actual start date |
| `actual_end_date` | DATE | NULL | Actual end date |
| `progress_percentage` | INTEGER | DEFAULT 0 | Completion percentage (0-100) |
| `created_by` | INTEGER | FK(users.id), NOT NULL | Project creator |
| `assigned_to` | INTEGER | FK(users.id), NULL | Project manager |

**Status Values**: planning, active, on_hold, completed, cancelled
**Priority Values**: critical, high, medium, low

### project_financials
Financial tracking and ROI calculations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Financial record identifier |
| `project_id` | INTEGER | FK(projects.id), NOT NULL | Project reference |
| `budget_allocated` | DECIMAL(12,2) | NULL | Allocated budget |
| `budget_spent` | DECIMAL(12,2) | DEFAULT 0 | Spent amount |
| `hours_budgeted` | DECIMAL(8,2) | NULL | Budgeted hours |
| `hours_spent` | DECIMAL(8,2) | DEFAULT 0 | Actual hours |
| `sale_price` | DECIMAL(12,2) | NULL | Project sale price |
| `sale_price_currency` | VARCHAR(3) | DEFAULT 'CLP' | Sale price currency |
| `hourly_rate` | DECIMAL(10,2) | NULL | Client hourly rate |
| `hourly_rate_currency` | VARCHAR(3) | DEFAULT 'CLP' | Rate currency |
| `actual_cost` | DECIMAL(12,2) | DEFAULT 0 | Actual project cost |
| `roi_percentage` | DECIMAL(5,2) | DEFAULT 0 | ROI calculation |
| `profit_margin` | DECIMAL(12,2) | DEFAULT 0 | Profit margin |
| `delay_cost` | DECIMAL(10,2) | DEFAULT 0 | Delay penalties |
| `penalty_cost` | DECIMAL(10,2) | DEFAULT 0 | Contract penalties |
| `delay_days` | INTEGER | DEFAULT 0 | Days delayed |
| `efficiency_percentage` | DECIMAL(5,2) | DEFAULT 0 | Efficiency metric |
| `cost_per_hour` | DECIMAL(8,2) | DEFAULT 0 | Average cost per hour |

---

## Task & Kanban System

### task_boards
Kanban board definitions per project.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Board identifier |
| `project_id` | INTEGER | FK(projects.id), NOT NULL | Project reference |
| `name` | VARCHAR(255) | NOT NULL | Board name |
| `description` | TEXT | NULL | Board description |
| `board_type` | VARCHAR(20) | DEFAULT 'kanban' | Board type |
| `is_default` | BOOLEAN | DEFAULT 0 | Default board flag |

**Board Types**: kanban, scrum, custom

### task_columns
Kanban columns with workflow definition.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Column identifier |
| `board_id` | INTEGER | FK(task_boards.id), NOT NULL | Board reference |
| `name` | VARCHAR(100) | NOT NULL | Column name |
| `position` | INTEGER | NOT NULL | Display order |
| `color` | VARCHAR(7) | DEFAULT '#gray' | Column color (hex) |
| `is_done_column` | BOOLEAN | DEFAULT 0 | Completion status |
| `wip_limit` | INTEGER | NULL | Work-in-progress limit |

### tasks
Individual work items with full lifecycle tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Task identifier |
| `board_id` | INTEGER | FK(task_boards.id), NOT NULL | Board reference |
| `column_id` | INTEGER | FK(task_columns.id), NOT NULL | Current column |
| `title` | VARCHAR(255) | NOT NULL | Task title |
| `description` | TEXT | NULL | Task description |
| `task_type` | VARCHAR(20) | DEFAULT 'task' | Task type |
| `status` | VARCHAR(20) | DEFAULT 'todo' | Task status |
| `priority` | VARCHAR(10) | DEFAULT 'medium' | Priority level |
| `assignee_id` | INTEGER | FK(users.id), NULL | Assigned user |
| `reporter_id` | INTEGER | FK(users.id), NOT NULL | Task creator |
| `story_points` | INTEGER | NULL | Estimation points |
| `estimated_hours` | DECIMAL(5,2) | NULL | Time estimate |
| `actual_hours` | DECIMAL(5,2) | DEFAULT 0 | Actual time spent |
| `start_date` | DATETIME | NULL | Task start |
| `due_date` | DATETIME | NULL | Task deadline |
| `completed_date` | DATETIME | NULL | Completion date |
| `position` | INTEGER | DEFAULT 0 | Position in column |
| `tags` | TEXT | NULL | JSON array of tags |
| `labels` | TEXT | NULL | JSON array of labels |

**Task Types**: task, bug, feature, research, documentation
**Status Values**: todo, in_progress, review, testing, done, blocked

### task_dependencies
Task relationships for Gantt chart functionality.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Dependency identifier |
| `predecessor_id` | INTEGER | FK(tasks.id), NOT NULL | Predecessor task |
| `successor_id` | INTEGER | FK(tasks.id), NOT NULL | Successor task |
| `dependency_type` | VARCHAR(20) | DEFAULT 'finish_to_start' | Dependency type |
| `lag_days` | INTEGER | DEFAULT 0 | Lag time in days |

**Dependency Types**: finish_to_start, start_to_start, finish_to_finish, start_to_finish

---

## PMO Analytics

### project_milestones
Key project delivery points and deadlines.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Milestone identifier |
| `project_id` | INTEGER | FK(projects.id), NOT NULL | Project reference |
| `name` | VARCHAR(200) | NOT NULL | Milestone name |
| `description` | TEXT | NULL | Milestone description |
| `milestone_type` | VARCHAR(50) | DEFAULT 'delivery' | Milestone type |
| `planned_date` | DATE | NOT NULL | Planned completion |
| `actual_date` | DATE | NULL | Actual completion |
| `status` | VARCHAR(20) | DEFAULT 'pending' | Milestone status |
| `priority` | VARCHAR(10) | DEFAULT 'medium' | Priority level |
| `responsible_user_id` | INTEGER | FK(users.id), NULL | Responsible person |
| `completion_percentage` | INTEGER | DEFAULT 0 | Progress (0-100) |
| `impact_on_timeline` | INTEGER | DEFAULT 0 | Timeline impact (days) |
| `responsibility` | VARCHAR(20) | DEFAULT 'internal' | Responsibility type |
| `blocking_reason` | TEXT | NULL | Blocking description |
| `delay_justification` | TEXT | NULL | Delay justification |
| `external_contact` | VARCHAR(200) | NULL | External contact info |
| `estimated_delay_days` | INTEGER | DEFAULT 0 | Estimated delay |
| `financial_impact` | DECIMAL(10,2) | DEFAULT 0 | Financial impact |
| `created_by` | INTEGER | FK(users.id), NOT NULL | Creator |

**Milestone Types**: delivery, demo, review, go_live, checkpoint, deadline
**Status Values**: pending, in_progress, completed, delayed, cancelled
**Responsibility Types**: internal, client, external, shared

### project_pmo_metrics
Comprehensive PMO tracking data per project.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Metrics identifier |
| `project_id` | INTEGER | FK(projects.id), UNIQUE, NOT NULL | Project reference |
| `planned_hours` | DECIMAL(8,2) | DEFAULT 0 | Planned work hours |
| `planned_start_date` | DATE | NULL | Planned start |
| `planned_end_date` | DATE | NULL | Planned end |
| `planned_budget` | DECIMAL(12,2) | DEFAULT 0 | Planned budget |
| `actual_hours` | DECIMAL(8,2) | DEFAULT 0 | Actual work hours |
| `actual_start_date` | DATE | NULL | Actual start |
| `actual_end_date` | DATE | NULL | Actual end |
| `actual_cost` | DECIMAL(12,2) | DEFAULT 0 | Actual cost |
| `completion_percentage` | INTEGER | DEFAULT 0 | Progress (0-100) |
| `completed_tasks` | INTEGER | DEFAULT 0 | Tasks completed |
| `total_tasks` | INTEGER | DEFAULT 0 | Total tasks |
| `schedule_variance_days` | INTEGER | DEFAULT 0 | Schedule variance |
| `cost_variance_percentage` | DECIMAL(5,2) | DEFAULT 0 | Cost variance |
| `scope_variance_percentage` | DECIMAL(5,2) | DEFAULT 0 | Scope variance |
| `risk_level` | VARCHAR(10) | DEFAULT 'low' | Risk assessment |
| `risk_factors` | TEXT | NULL | JSON risk descriptions |
| `bugs_found` | INTEGER | DEFAULT 0 | Quality: bugs found |
| `bugs_resolved` | INTEGER | DEFAULT 0 | Quality: bugs resolved |
| `client_satisfaction_score` | INTEGER | CHECK (1 <= client_satisfaction_score <= 10) | Satisfaction (1-10) |
| `team_velocity` | DECIMAL(5,2) | DEFAULT 0 | Tasks per week |
| `last_updated` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update |
| `updated_by` | INTEGER | FK(users.id) | Last updater |

**Risk Levels**: low, medium, high, critical

### project_dependencies
Inter-project dependencies for portfolio management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Dependency identifier |
| `source_project_id` | INTEGER | FK(projects.id), NOT NULL | Source project |
| `dependent_project_id` | INTEGER | FK(projects.id), NOT NULL | Dependent project |
| `dependency_type` | VARCHAR(30) | DEFAULT 'finish_to_start' | Dependency type |
| `description` | TEXT | NULL | Dependency description |
| `is_critical` | BOOLEAN | DEFAULT 0 | Critical flag |

---

## Support Module

### support_companies
Client companies receiving support services.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Company identifier |
| `company_name` | VARCHAR(200) | NOT NULL | Company name |
| `contact_person` | VARCHAR(100) | NULL | Primary contact |
| `email` | VARCHAR(100) | NULL | Contact email |
| `phone` | VARCHAR(50) | NULL | Contact phone |
| `address` | TEXT | NULL | Company address |
| `contracted_hours_monthly` | INTEGER | DEFAULT 0 | Monthly contract hours |
| `hourly_rate` | DECIMAL(10,2) | DEFAULT 0 | Base hourly rate |
| `hourly_rate_currency` | VARCHAR(3) | DEFAULT 'CLP' | Rate currency |
| `hourly_rate_extra` | DECIMAL(10,2) | DEFAULT 0 | Extra hours rate |
| `contract_start_date` | DATE | NULL | Contract start |
| `contract_end_date` | DATE | NULL | Contract end |
| `status` | VARCHAR(20) | DEFAULT 'active' | Company status |
| `notes` | TEXT | NULL | Additional notes |
| `timezone` | VARCHAR(50) | DEFAULT 'America/Santiago' | Client timezone |
| `preferred_language` | VARCHAR(10) | DEFAULT 'es' | Language preference |
| `created_by` | INTEGER | FK(users.id), NOT NULL | Creator |

**Status Values**: active, inactive, suspended, terminated
**Currencies**: USD, CLP, UF

### support_tickets
Individual support requests with time tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id_ticket` | VARCHAR(20) | PK | Custom ticket ID (SUP-YYYY-NNN) |
| `id` | INTEGER | UNIQUE, NOT NULL | Auto-increment internal ID |
| `company_id` | INTEGER | FK(support_companies.id), NOT NULL | Company reference |
| `client_name` | VARCHAR(100) | NOT NULL | Requesting person |
| `ticket_type` | VARCHAR(50) | NOT NULL | Support type |
| `attention_method` | VARCHAR(30) | NOT NULL | Service method |
| `rpa_process` | VARCHAR(200) | NULL | Affected RPA process |
| `requester` | VARCHAR(100) | NOT NULL | Support requester |
| `resolver_id` | INTEGER | FK(users.id), NULL | Assigned resolver |
| `description` | TEXT | NOT NULL | Problem description |
| `solution` | TEXT | NULL | Solution provided |
| `status` | VARCHAR(20) | DEFAULT 'open' | Ticket status |
| `priority` | VARCHAR(10) | DEFAULT 'medium' | Priority level |
| `open_date` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Open timestamp |
| `close_date` | DATETIME | NULL | Close timestamp |
| `time_invested_minutes` | INTEGER | DEFAULT 0 | Time invested |
| `hours_calculated` | DECIMAL(5,2) | DEFAULT 0 | Calculated hours |
| `billable_hours` | DECIMAL(5,2) | DEFAULT 0 | Billable hours |
| `internal_cost` | DECIMAL(10,2) | DEFAULT 0 | Internal cost |
| `client_charge` | DECIMAL(10,2) | DEFAULT 0 | Client charge |
| `urgency_level` | VARCHAR(20) | DEFAULT 'normal' | Urgency level |
| `customer_satisfaction` | INTEGER | CHECK (1 <= customer_satisfaction <= 5) | Satisfaction (1-5) |
| `tags` | TEXT | NULL | JSON tag array |
| `created_by` | INTEGER | FK(users.id), NOT NULL | Creator |

**Status Values**: open, in_progress, pending_client, resolved, closed, cancelled
**Priority Values**: critical, high, medium, low
**Urgency Levels**: low, normal, high, urgent
**Attention Methods**: email, phone, remote, on-site, chat

### support_monthly_summaries
Aggregated monthly billing data per company.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Summary identifier |
| `company_id` | INTEGER | FK(support_companies.id), NOT NULL | Company reference |
| `year` | INTEGER | NOT NULL | Summary year |
| `month` | INTEGER | NOT NULL, CHECK (1 <= month <= 12) | Summary month |
| `contracted_hours` | INTEGER | NOT NULL | Contract hours |
| `consumed_hours` | DECIMAL(5,2) | DEFAULT 0 | Hours consumed |
| `remaining_hours` | DECIMAL(5,2) | DEFAULT 0 | Hours remaining |
| `exceeded_hours` | DECIMAL(5,2) | DEFAULT 0 | Overage hours |
| `total_tickets` | INTEGER | DEFAULT 0 | Total tickets |
| `resolved_tickets` | INTEGER | DEFAULT 0 | Resolved tickets |
| `open_tickets` | INTEGER | DEFAULT 0 | Open tickets |
| `base_monthly_cost` | DECIMAL(12,2) | DEFAULT 0 | Base cost |
| `additional_hours_cost` | DECIMAL(12,2) | DEFAULT 0 | Extra cost |
| `total_monthly_charge` | DECIMAL(12,2) | DEFAULT 0 | Total billing |
| `is_finalized` | BOOLEAN | DEFAULT 0 | Billing finalized |
| `invoice_generated` | BOOLEAN | DEFAULT 0 | Invoice status |
| `invoice_number` | VARCHAR(50) | NULL | Invoice reference |

**Unique Constraint**: (company_id, year, month)

### support_rpa_processes
Company-specific RPA process catalog.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Process identifier |
| `company_id` | INTEGER | FK(support_companies.id), NOT NULL | Company reference |
| `process_name` | VARCHAR(200) | NOT NULL | Process name |
| `process_description` | TEXT | NULL | Process description |
| `is_active` | BOOLEAN | DEFAULT 1 | Process status |

**Unique Constraint**: (company_id, process_name)

### support_company_contacts
Multiple contacts per support company.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Contact identifier |
| `company_id` | INTEGER | FK(support_companies.id), NOT NULL | Company reference |
| `contact_name` | VARCHAR(100) | NOT NULL | Contact name |
| `contact_email` | VARCHAR(100) | NULL | Contact email |
| `contact_phone` | VARCHAR(50) | NULL | Contact phone |
| `position` | VARCHAR(100) | NULL | Job position |
| `is_primary` | BOOLEAN | DEFAULT 0 | Primary contact flag |
| `is_active` | BOOLEAN | DEFAULT 1 | Contact status |

**Unique Constraint**: (company_id, contact_name)

---

## File Management

### files
Central file storage with deduplication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | File identifier |
| `filename` | VARCHAR(255) | NOT NULL | System filename |
| `original_filename` | VARCHAR(255) | NOT NULL | Original filename |
| `file_path` | VARCHAR(500) | NOT NULL | Storage path |
| `file_size` | INTEGER | NOT NULL | File size (bytes) |
| `mime_type` | VARCHAR(100) | NOT NULL | MIME type |
| `file_extension` | VARCHAR(10) | NOT NULL | File extension |
| `file_hash` | VARCHAR(64) | UNIQUE | SHA-256 hash |
| `uploaded_by` | INTEGER | FK(users.id), NOT NULL | Uploader |
| `upload_date` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Upload timestamp |
| `description` | TEXT | NULL | File description |
| `is_public` | BOOLEAN | DEFAULT 0 | Public access flag |
| `is_deleted` | BOOLEAN | DEFAULT 0 | Soft delete flag |

### file_associations
Links files to entities (projects, tasks, ideas).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Association identifier |
| `file_id` | INTEGER | FK(files.id), NOT NULL | File reference |
| `entity_type` | VARCHAR(20) | NOT NULL | Entity type |
| `entity_id` | INTEGER | NOT NULL | Entity ID |
| `association_type` | VARCHAR(30) | DEFAULT 'attachment' | Association type |
| `created_by` | INTEGER | FK(users.id), NOT NULL | Creator |

**Entity Types**: project, task, idea, user
**Association Types**: attachment, evidence, documentation, screenshot, diagram, report, presentation, code, config, log, other

### file_categories
File categorization system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Category identifier |
| `name` | VARCHAR(50) | UNIQUE, NOT NULL | Category name |
| `description` | TEXT | NULL | Category description |
| `icon` | VARCHAR(20) | NULL | UI icon |
| `color` | VARCHAR(7) | NULL | UI color (hex) |
| `allowed_extensions` | TEXT | NULL | JSON extension array |
| `max_file_size` | INTEGER | NULL | Max size (bytes) |
| `is_active` | BOOLEAN | DEFAULT 1 | Category status |

**Default Categories**: documents, images, presentations, spreadsheets, code, archives, videos, audio, other

---

## Ideas Management

### ideas
Innovation and improvement suggestions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Idea identifier |
| `title` | VARCHAR(255) | NOT NULL | Idea title |
| `description` | TEXT | NOT NULL | Idea description |
| `category` | VARCHAR(50) | DEFAULT 'general' | Idea category |
| `status` | VARCHAR(20) | DEFAULT 'draft' | Idea status |
| `impact_score` | INTEGER | DEFAULT 3, CHECK (1 <= impact_score <= 5) | Impact rating |
| `effort_score` | INTEGER | DEFAULT 3, CHECK (1 <= effort_score <= 5) | Effort rating |
| `priority_score` | DECIMAL(3,2) | DEFAULT 1.0 | Calculated priority |
| `votes_count` | INTEGER | DEFAULT 0 | Net votes |
| `created_by` | INTEGER | FK(users.id), NOT NULL | Creator |
| `assigned_to` | INTEGER | FK(users.id), NULL | Assignee |

**Categories**: automation, process_improvement, tool_enhancement, cost_reduction, productivity, general
**Status Values**: draft, under_review, approved, in_progress, done, rejected

### idea_votes
Voting system for idea prioritization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Vote identifier |
| `idea_id` | INTEGER | FK(ideas.id), NOT NULL | Idea reference |
| `user_id` | INTEGER | FK(users.id), NOT NULL | Voter |
| `vote_type` | VARCHAR(10) | NOT NULL | Vote type |

**Vote Types**: up, down
**Unique Constraint**: (idea_id, user_id)

---

## Additional Tables

### time_entries
Time tracking across projects and tasks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Entry identifier |
| `user_id` | INTEGER | FK(users.id), NOT NULL | User reference |
| `task_id` | INTEGER | FK(tasks.id), NULL | Task reference |
| `project_id` | INTEGER | FK(projects.id), NULL | Project reference |
| `description` | TEXT | NULL | Work description |
| `hours` | DECIMAL(5,2) | NOT NULL, CHECK (hours >= 0) | Hours worked |
| `date` | DATE | NOT NULL | Work date |
| `start_time` | TIME | NULL | Start time |
| `end_time` | TIME | NULL | End time |
| `is_billable` | BOOLEAN | DEFAULT 1 | Billable flag |
| `hourly_rate` | DECIMAL(8,2) | NULL | Hourly rate |

### global_settings
System-wide configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Setting identifier |
| `setting_key` | VARCHAR(50) | UNIQUE, NOT NULL | Setting key |
| `setting_value` | VARCHAR(255) | NOT NULL | Setting value |
| `setting_type` | VARCHAR(20) | DEFAULT 'string' | Value type |
| `description` | TEXT | NULL | Setting description |
| `updated_by` | INTEGER | FK(users.id) | Last updater |

**Setting Types**: string, number, decimal, boolean

**Key Settings**:
- `usd_to_clp`: USD to CLP exchange rate
- `uf_to_clp`: UF to CLP exchange rate
- `default_hourly_rate`: Default billing rate
- `company_name`: Company name
- `smtp_settings`: Email configuration

### notifications
User notification system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO_INCREMENT | Notification identifier |
| `user_id` | INTEGER | FK(users.id), NOT NULL | Recipient |
| `title` | VARCHAR(255) | NOT NULL | Notification title |
| `message` | TEXT | NULL | Notification message |
| `type` | VARCHAR(20) | DEFAULT 'info' | Notification type |
| `entity_type` | VARCHAR(20) | NULL | Related entity type |
| `entity_id` | INTEGER | NULL | Related entity ID |
| `is_read` | BOOLEAN | DEFAULT 0 | Read status |

**Notification Types**: info, success, warning, error

---

## Database Triggers

### Automatic Timestamp Updates
All tables with `updated_at` columns have triggers that automatically update the timestamp on record modification.

### Business Logic Triggers

#### Ideas System
- **Priority Calculation**: Automatically calculates `priority_score = impact_score / effort_score`
- **Vote Counting**: Updates `votes_count` when votes are added/removed/changed

#### Support System
- **Ticket ID Generation**: Auto-generates formatted ticket IDs (SUP-YYYY-NNN)
- **Hours Calculation**: Converts `time_invested_minutes` to `hours_calculated`
- **Monthly Summaries**: Updates aggregated billing data when tickets are resolved

---

## Indexes for Performance

### Core Indexes
```sql
-- User authentication
idx_users_email, idx_users_username

-- Task management  
idx_tasks_assignee, idx_tasks_board, idx_tasks_status
idx_time_entries_user_date, idx_time_entries_task

-- Project tracking
idx_issues_responsibility, idx_issues_project
idx_project_financials_project

-- PMO analytics
idx_roi_alerts_project, idx_roi_alerts_type

-- Support system
idx_support_tickets_company, idx_support_tickets_resolver
idx_support_tickets_status, idx_support_tickets_priority
idx_support_monthly_company_date

-- File management
idx_attachments_entity, idx_comments_entity

-- Ideas system
idx_ideas_status, idx_ideas_category, idx_ideas_priority
```

---

## Data Integrity

### Foreign Key Constraints
All relationships are enforced with proper foreign key constraints, with appropriate CASCADE and RESTRICT policies.

### Check Constraints
- Percentage fields: 0-100 range
- Rating fields: 1-5 or 1-10 range
- Enum fields: Specific value validation
- Currency fields: USD, CLP, UF validation

### Unique Constraints
- Email addresses
- Usernames  
- Ticket IDs
- Company-specific process names
- Company-specific contact names

---

## Backup and Migration Strategy

### Backup Considerations
- SQLite database file: `backend/data/database.sqlite`
- File uploads: `backend/uploads/` directory
- Configuration: Environment variables and settings

### Migration System
- Located in: `backend/src/database/migrations/`
- Tracked in: `migration_list.ts`
- Applied via: `migrate.ts` script

### Data Validation
- Foreign key constraints enabled
- Transaction support for data consistency  
- Automatic rollback on constraint violations

This schema supports the full feature set including PMO analytics, support billing with multi-currency support, file management, and comprehensive project tracking with time and cost analytics.