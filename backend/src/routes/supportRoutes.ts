import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { SupportController } from '../controllers/supportController';

const router = Router();
const supportController = new SupportController();

// All routes require authentication
router.use(authenticate);

// ========================================
// SUPPORT COMPANIES ROUTES
// ========================================

// GET /api/support/companies - Get all support companies
router.get('/companies', supportController.getSupportCompanies);

// GET /api/support/companies/:id - Get single support company
router.get('/companies/:id', supportController.getSupportCompany);

// POST /api/support/companies - Create new support company
router.post('/companies', supportController.createSupportCompany);

// PUT /api/support/companies/:id - Update support company
router.put('/companies/:id', supportController.updateSupportCompany);

// DELETE /api/support/companies/:id - Delete support company
router.delete('/companies/:id', supportController.deleteSupportCompany);

// GET /api/support/companies/:id/billing - Get billing data for specific company
router.get('/companies/:id/billing', supportController.getCompanyBilling);

// ========================================
// SUPPORT TICKETS ROUTES
// ========================================

// GET /api/support/tickets - Get all support tickets
router.get('/tickets', supportController.getSupportTickets);

// POST /api/support/tickets - Create new support ticket
router.post('/tickets', supportController.createSupportTicket);

// PUT /api/support/tickets/:id - Update support ticket
router.put('/tickets/:id', supportController.updateSupportTicket);

// ========================================
// DASHBOARD & REPORTS ROUTES
// ========================================

// GET /api/support/dashboard - Get support dashboard data
router.get('/dashboard', supportController.getSupportDashboard);

// ========================================
// RPA PROCESSES ROUTES
// ========================================

// GET /api/support/rpa-processes - Get all RPA processes
router.get('/rpa-processes', supportController.getRPAProcesses);

// POST /api/support/rpa-processes - Create new RPA process
router.post('/rpa-processes', supportController.createRPAProcess);

// ========================================
// CONTACTS ROUTES
// ========================================

// GET /api/support/contacts - Get all contacts for dropdown
router.get('/contacts', supportController.getAllContacts);

// GET /api/support/companies/:id/contacts - Get contacts for specific company
router.get('/companies/:id/contacts', supportController.getCompanyContacts);

// POST /api/support/companies/:id/contacts - Create contact for specific company
router.post('/companies/:id/contacts', supportController.createCompanyContact);

// ========================================
// EXCEL IMPORT ROUTES
// ========================================

// POST /api/support/import/preview - Preview Excel file for import
router.post('/import/preview', supportController.getUploadMiddleware(), supportController.previewExcelImport);

// POST /api/support/import/execute - Execute Excel import
router.post('/import/execute', supportController.getUploadMiddleware(), supportController.executeExcelImport);

export default router;