import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
    createPaymentMilestoneSchema, updatePaymentMilestoneSchema,
    createInvoiceSchema, createPaymentSchema
} from '../validation/schemas';
import { BillingController } from '../controllers/billingController';

const router = Router();
const billingController = new BillingController();

router.use(authenticate);

// Lectura de dashboard y listas: mismo nivel que PMO
const billingReadRoles = authorize(['team_lead']);
// Gestión de hitos y facturas
const billingWriteRoles = authorize(['team_lead']);
// Registrar cobros: acción financiera irreversible, solo team_lead
const billingPaymentRoles = authorize(['team_lead']);

// ========================================
// DASHBOARD DE COBRANZA
// ========================================
router.get('/dashboard', billingReadRoles, billingController.getDashboard);
router.post('/evaluate', authorize(['team_lead']), billingController.evaluate);

// ========================================
// HITOS DE PAGO
// ========================================
router.get('/payment-milestones', billingReadRoles, billingController.getPaymentMilestones);
router.post('/payment-milestones', billingWriteRoles, validate({ body: createPaymentMilestoneSchema }), billingController.createPaymentMilestone);
router.put('/payment-milestones/:id', billingWriteRoles, validate({ body: updatePaymentMilestoneSchema }), billingController.updatePaymentMilestone);
router.delete('/payment-milestones/:id', billingWriteRoles, billingController.deletePaymentMilestone);

// ========================================
// FACTURAS
// ========================================
router.get('/invoices', billingReadRoles, billingController.getInvoices);
router.post('/invoices', billingWriteRoles, validate({ body: createInvoiceSchema }), billingController.createInvoice);

// ========================================
// PAGOS
// ========================================
router.post('/invoices/:id/payments', billingPaymentRoles, validate({ body: createPaymentSchema }), billingController.recordPayment);

// ========================================
// ESTADO DE PAGO (PDF)
// ========================================
router.get('/projects/:projectId/payment-statement', billingReadRoles, billingController.getPaymentStatement);

export default router;
