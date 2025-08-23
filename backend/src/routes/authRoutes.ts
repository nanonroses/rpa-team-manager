import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate, rateLimit } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/login', rateLimit(5, 15 * 60 * 1000), authController.login);
router.post('/reset-password', rateLimit(3, 60 * 60 * 1000), authController.resetPassword);
router.get('/health', authController.health);

// Temporary setup route (remove in production)
router.post('/setup-test-users', authController.setupTestUsers);
router.get('/debug-user', authController.debugUser);

// Protected routes (require authentication)
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.get('/users', authenticate, authController.getUsers);
router.post('/change-password', authenticate, authController.changePassword);
router.get('/sessions', authenticate, authController.getSessions);
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);

// Admin routes (team_lead only)
router.post('/admin/users', authenticate, authController.createUser);
router.put('/admin/users/:id', authenticate, authController.updateUser);
router.delete('/admin/users/:id', authenticate, authController.deleteUser);
router.post('/admin/users/:id/reset-password', authenticate, authController.resetUserPassword);

export default router;