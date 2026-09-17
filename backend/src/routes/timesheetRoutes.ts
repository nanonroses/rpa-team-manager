import express from 'express';
import { TimesheetController } from '../controllers/timesheetController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { saveWeekSchema, submitWeekSchema, rejectWeekSchema } from '../validation/schemas';

const router = express.Router();
const timesheetController = new TimesheetController();

router.use(authenticate);

// Semana propia (cualquier rol autenticado)
router.get('/week', timesheetController.getWeek);
router.put('/week', validate({ body: saveWeekSchema }), timesheetController.saveWeek);
router.post('/week/submit', validate({ body: submitWeekSchema }), timesheetController.submitWeek);
router.get('/reminders', timesheetController.getReminders);

// Aprobación (solo team_lead - acción financiera: bloquea horas y mueve el costo real del proyecto)
router.get('/pending-approvals', authorize(['team_lead']), timesheetController.getPendingApprovals);
router.post('/periods/:id/approve', authorize(['team_lead']), timesheetController.approveWeek);
router.post('/periods/:id/reject', authorize(['team_lead']), validate({ body: rejectWeekSchema }), timesheetController.rejectWeek);

// Efectividad (team_lead y rpa_operations, mismo grupo de solo-lectura que PMO/cobranza)
router.get('/effectiveness', authorize(['team_lead', 'rpa_operations']), timesheetController.getEffectiveness);

export default router;
