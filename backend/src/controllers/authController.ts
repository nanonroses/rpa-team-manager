import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    // POST /api/auth/login
    login = async (req: Request, res: Response): Promise<void> => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({ error: 'Email and password are required' });
                return;
            }

            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');

            const result = await this.authService.login(
                { email, password },
                ipAddress,
                userAgent
            );

            res.json(result);
        } catch (error) {
            logger.error('Login error:', error);
            res.status(401).json({ error: (error as Error).message });
        }
    };

    // POST /api/auth/logout
    logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '') || '';
            await this.authService.logout(token);
            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            logger.error('Logout error:', error);
            res.status(500).json({ error: 'Logout failed' });
        }
    };

    // GET /api/auth/me
    me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { password_hash, ...user } = req.user;
            const permissions = await this.authService.getUserPermissions(req.user.role);

            res.json({
                user,
                permissions
            });
        } catch (error) {
            logger.error('Get user profile error:', error);
            res.status(500).json({ error: 'Failed to get user profile' });
        }
    };

    // GET /api/auth/users
    getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const users = await this.authService.getActiveUsers();
            res.json(users);
        } catch (error) {
            logger.error('Get users error:', error);
            res.status(500).json({ error: 'Failed to get users' });
        }
    };

    // POST /api/auth/change-password
    changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { oldPassword, newPassword } = req.body;

            if (!oldPassword || !newPassword) {
                res.status(400).json({ error: 'Old password and new password are required' });
                return;
            }

            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            await this.authService.changePassword(req.user.id, oldPassword, newPassword);
            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            logger.error('Change password error:', error);
            res.status(400).json({ error: (error as Error).message });
        }
    };

    // POST /api/auth/reset-password
    resetPassword = async (req: Request, res: Response): Promise<void> => {
        try {
            const { email } = req.body;

            if (!email) {
                res.status(400).json({ error: 'Email is required' });
                return;
            }

            const tempPassword = await this.authService.resetPassword(email);
            
            // In production, you wouldn't return the password but send it via email
            res.json({ 
                message: 'Password reset successfully',
                tempPassword: tempPassword // Remove this in production
            });
        } catch (error) {
            logger.error('Reset password error:', error);
            res.status(400).json({ error: (error as Error).message });
        }
    };

    // GET /api/auth/sessions
    getSessions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const sessions = await this.authService.getUserSessions(req.user.id);
            res.json(sessions);
        } catch (error) {
            logger.error('Get sessions error:', error);
            res.status(500).json({ error: 'Failed to get user sessions' });
        }
    };

    // DELETE /api/auth/sessions/:sessionId
    revokeSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { sessionId } = req.params;

            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            await this.authService.revokeSession(parseInt(sessionId), req.user.id);
            res.json({ message: 'Session revoked successfully' });
        } catch (error) {
            logger.error('Revoke session error:', error);
            res.status(500).json({ error: 'Failed to revoke session' });
        }
    };

    // GET /api/auth/health
    health = async (req: Request, res: Response): Promise<void> => {
        try {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'auth'
            });
        } catch (error) {
            res.status(500).json({ 
                status: 'unhealthy', 
                error: (error as Error).message 
            });
        }
    };

    // POST /api/auth/setup-test-users (temporary method)
    setupTestUsers = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.authService.setupTestUsers();
            res.json(result);
        } catch (error) {
            logger.error('Setup test users error:', error);
            res.status(500).json({ error: 'Failed to setup test users' });
        }
    };

    // GET /api/auth/debug-user (temporary debugging method)
    debugUser = async (req: Request, res: Response): Promise<void> => {
        try {
            const { email } = req.query;
            if (!email) {
                res.status(400).json({ error: 'Email query parameter required' });
                return;
            }
            const result = await this.authService.debugUserLogin(email as string);
            res.json(result);
        } catch (error) {
            logger.error('Debug user error:', error);
            res.status(500).json({ error: 'Debug failed' });
        }
    };

    // POST /api/auth/admin/users - Create new user (team_lead only)
    createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can create users' });
                return;
            }

            const { full_name, email, role, password } = req.body;

            if (!full_name || !email || !role || !password) {
                res.status(400).json({ error: 'Full name, email, role, and password are required' });
                return;
            }

            const validRoles = ['team_lead', 'rpa_developer', 'rpa_operations', 'it_support'];
            if (!validRoles.includes(role)) {
                res.status(400).json({ error: 'Invalid role' });
                return;
            }

            const result = await this.authService.createUser({
                full_name,
                email,
                role,
                password
            });

            logger.info(`User created: ${email} by ${req.user.email}`);
            res.status(201).json(result);
        } catch (error) {
            logger.error('Create user error:', error);
            res.status(400).json({ error: (error as Error).message });
        }
    };

    // PUT /api/auth/admin/users/:id - Update user (team_lead only)
    updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can update users' });
                return;
            }

            const { id } = req.params;
            const { full_name, email, role, is_active } = req.body;

            if (!id) {
                res.status(400).json({ error: 'User ID is required' });
                return;
            }

            const updates: any = {};
            if (full_name !== undefined) updates.full_name = full_name;
            if (email !== undefined) updates.email = email;
            if (role !== undefined) {
                const validRoles = ['team_lead', 'rpa_developer', 'rpa_operations', 'it_support'];
                if (!validRoles.includes(role)) {
                    res.status(400).json({ error: 'Invalid role' });
                    return;
                }
                updates.role = role;
            }
            if (is_active !== undefined) updates.is_active = is_active;

            const result = await this.authService.updateUser(parseInt(id), updates);

            logger.info(`User updated: ${id} by ${req.user.email}`);
            res.json(result);
        } catch (error) {
            logger.error('Update user error:', error);
            res.status(400).json({ error: (error as Error).message });
        }
    };

    // DELETE /api/auth/admin/users/:id - Delete user (team_lead only)
    deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can delete users' });
                return;
            }

            const { id } = req.params;

            if (!id) {
                res.status(400).json({ error: 'User ID is required' });
                return;
            }

            // Prevent self-deletion
            if (parseInt(id) === req.user.id) {
                res.status(400).json({ error: 'Cannot delete your own account' });
                return;
            }

            await this.authService.deleteUser(parseInt(id));

            logger.info(`User deleted: ${id} by ${req.user.email}`);
            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            logger.error('Delete user error:', error);
            res.status(400).json({ error: (error as Error).message });
        }
    };

    // POST /api/auth/admin/users/:id/reset-password - Reset user password (team_lead only)
    resetUserPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can reset passwords' });
                return;
            }

            const { id } = req.params;
            const { newPassword } = req.body;

            if (!id) {
                res.status(400).json({ error: 'User ID is required' });
                return;
            }

            if (!newPassword) {
                res.status(400).json({ error: 'New password is required' });
                return;
            }

            await this.authService.resetUserPassword(parseInt(id), newPassword);

            logger.info(`Password reset for user: ${id} by ${req.user.email}`);
            res.json({ message: 'Password reset successfully' });
        } catch (error) {
            logger.error('Reset password error:', error);
            res.status(400).json({ error: (error as Error).message });
        }
    };
}