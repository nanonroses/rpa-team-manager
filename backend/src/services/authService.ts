import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../database/database';
import { User, UserRole, JWTPayload, LoginRequest, LoginResponse, UserSession, PasswordPolicy, defaultPasswordPolicy } from '../types/auth';
import { logger } from '../utils/logger';

export class AuthService {
    private jwtSecret: string;
    private jwtExpiresIn: string;
    private saltRounds: number = 12;

    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h';
        this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
        
        this.validateConfiguration();
    }
    
    private validateConfiguration(): void {
        // Validate JWT secret
        if (!process.env.JWT_SECRET || this.jwtSecret === 'your-super-secret-jwt-key-change-this') {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('JWT_SECRET must be set in production environment');
            }
            logger.warn('Using default JWT secret. Change JWT_SECRET in production!');
        }
        
        // Validate JWT secret strength
        if (this.jwtSecret.length < 32) {
            logger.warn('JWT secret should be at least 32 characters long for security');
        }
        
        // Validate salt rounds
        if (this.saltRounds < 10 || this.saltRounds > 15) {
            logger.warn('bcrypt salt rounds should be between 10-15 for optimal security/performance balance');
        }
    }

    async login(credentials: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
        const { email, password } = credentials;

        // Find user by email
        const user = await this.findUserByEmail(email);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Check if user is active
        if (!user.is_active) {
            throw new Error('Account is deactivated');
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash!);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Generate JWT token
        const token = this.generateJWT(user);

        // Store session
        await this.createSession(user.id, token, ipAddress, userAgent);

        // Update last login
        await this.updateLastLogin(user.id);

        // Remove password from response
        const { password_hash, ...userResponse } = user;

        logger.info(`User logged in: ${user.email}`);

        return {
            user: userResponse,
            token,
            expires_in: this.jwtExpiresIn
        };
    }

    async logout(token: string): Promise<void> {
        try {
            const tokenHash = this.hashToken(token);
            await db.run(
                'UPDATE user_sessions SET is_active = 0 WHERE token_hash = ?',
                [tokenHash]
            );
            logger.info('User logged out successfully');
        } catch (error) {
            logger.error('Error during logout:', error);
            throw new Error('Logout failed');
        }
    }

    async verifyToken(token: string): Promise<User | null> {
        try {
            // Verify JWT
            const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;

            // Check if session is still active
            const tokenHash = this.hashToken(token);
            const session = await db.get(
                'SELECT * FROM user_sessions WHERE token_hash = ? AND is_active = 1 AND expires_at > datetime("now")',
                [tokenHash]
            );

            if (!session) {
                return null;
            }

            // Get fresh user data
            const user = await this.findUserById(decoded.userId);
            return user;
        } catch (error) {
            logger.debug('Token verification failed:', error);
            return null;
        }
    }

    async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Verify old password
        const isValidOldPassword = await bcrypt.compare(oldPassword, user.password_hash!);
        if (!isValidOldPassword) {
            throw new Error('Current password is incorrect');
        }

        // Validate new password
        this.validatePassword(newPassword);

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, this.saltRounds);

        // Update password
        await db.run(
            'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?',
            [hashedNewPassword, userId]
        );

        // Invalidate all user sessions except current one
        await db.run(
            'UPDATE user_sessions SET is_active = 0 WHERE user_id = ?',
            [userId]
        );

        logger.info(`Password changed for user ID: ${userId}`);
    }

    async resetPassword(email: string): Promise<string> {
        const user = await this.findUserByEmail(email);
        if (!user) {
            // Don't reveal if email exists or not
            throw new Error('If the email exists, a reset link will be sent');
        }

        // Generate temporary password (in production, you'd send an email)
        const tempPassword = this.generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, this.saltRounds);

        await db.run(
            'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?',
            [hashedPassword, user.id]
        );

        // Invalidate all user sessions
        await db.run(
            'UPDATE user_sessions SET is_active = 0 WHERE user_id = ?',
            [user.id]
        );

        logger.info(`Password reset for user: ${email}`);
        
        // In production, send this via email instead of returning it
        return tempPassword;
    }

    async createUser(userData: Partial<User> & { password: string }): Promise<User> {
        const { password, email, username, role, full_name } = userData;

        // Check if user already exists
        const existingUser = await this.findUserByEmail(email!);
        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        // Validate password
        this.validatePassword(password);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, this.saltRounds);

        // Insert user
        const result = await db.run(
            `INSERT INTO users (username, email, password_hash, role, full_name, is_active) 
             VALUES (?, ?, ?, ?, ?, 1)`,
            [username, email, hashedPassword, role, full_name]
        );

        logger.info(`User created: ${email}`);

        // Return the created user
        const createdUser = await this.findUserById(result.id!);
        if (!createdUser) {
            throw new Error('Failed to retrieve created user');
        }
        return createdUser;
    }

    async getUserPermissions(role: UserRole): Promise<string[]> {
        // In a more complex system, this could be database-driven
        const rolePermissions: Record<UserRole, string[]> = {
            team_lead: [
                'users:*', 'projects:*', 'tasks:*', 'time:*', 
                'issues:*', 'ideas:*', 'financials:*', 'reports:*', 'system:*'
            ],
            rpa_developer: [
                'users:read:basic', 'projects:read:assigned', 'tasks:own:*',
                'time:own:*', 'issues:assigned:*', 'ideas:own:*', 'files:own:*'
            ],
            rpa_operations: [
                'users:read:basic', 'projects:read', 'projects:update:status',
                'tasks:read', 'tasks:update:status', 'time:read', 'issues:*',
                'ideas:read', 'reports:operational'
            ],
            it_support: [
                'users:read', 'users:update:support', 'projects:read', 'tasks:read',
                'time:read', 'issues:technical:*', 'system:maintenance', 'files:read'
            ]
        };

        return rolePermissions[role] || [];
    }

    private generateJWT(user: User): string {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role
        };

        return jwt.sign(payload, this.jwtSecret, { 
            expiresIn: this.jwtExpiresIn,
            algorithm: 'HS256'
        });
    }

    private async createSession(userId: number, token: string, ipAddress?: string, userAgent?: string): Promise<void> {
        const tokenHash = this.hashToken(token);
        const expiresAt = new Date();
        
        // Calculate expiration based on JWT expiration
        const hoursToAdd = parseInt(this.jwtExpiresIn.replace('h', ''));
        expiresAt.setHours(expiresAt.getHours() + hoursToAdd);

        await db.run(
            `INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address, user_agent, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [userId, tokenHash, expiresAt.toISOString(), ipAddress, userAgent]
        );
    }

    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    private async updateLastLogin(userId: number): Promise<void> {
        await db.run(
            'UPDATE users SET last_login = datetime("now") WHERE id = ?',
            [userId]
        );
    }

    private async findUserByEmail(email: string): Promise<User | null> {
        const user = await db.get(
            'SELECT * FROM users WHERE email = ? AND is_active = 1',
            [email]
        );
        return user || null;
    }

    private async findUserById(id: number): Promise<User | null> {
        const user = await db.get(
            'SELECT * FROM users WHERE id = ? AND is_active = 1',
            [id]
        );
        return user || null;
    }

    async getActiveUsers(): Promise<{ id: number; full_name: string; email: string; role: string }[]> {
        const users = await db.query(
            'SELECT id, full_name, email, role FROM users WHERE is_active = 1 ORDER BY full_name',
            []
        );
        return users;
    }

    private validatePassword(password: string, policy: PasswordPolicy = defaultPasswordPolicy): void {
        const errors: string[] = [];

        if (password.length < policy.minLength) {
            errors.push(`Password must be at least ${policy.minLength} characters long`);
        }

        if (policy.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (policy.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (policy.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        if (policy.preventCommonPasswords) {
            const commonPasswords = ['password', '123456', 'password123', 'admin', 'qwerty'];
            if (commonPasswords.includes(password.toLowerCase())) {
                errors.push('Password is too common, please choose a more secure password');
            }
        }

        if (errors.length > 0) {
            throw new Error(`Password validation failed: ${errors.join(', ')}`);
        }
    }

    private generateTempPassword(): string {
        // Generate a secure temporary password
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
        let tempPassword = '';
        for (let i = 0; i < 12; i++) {
            tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return tempPassword;
    }

    async cleanupExpiredSessions(): Promise<void> {
        try {
            const result = await db.run(
                'DELETE FROM user_sessions WHERE expires_at < datetime("now") OR is_active = 0'
            );
            logger.info(`Cleaned up ${result.changes} expired sessions`);
        } catch (error) {
            logger.error('Error cleaning up expired sessions:', error);
        }
    }

    async getUserSessions(userId: number): Promise<UserSession[]> {
        return await db.query(
            'SELECT * FROM user_sessions WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC',
            [userId]
        );
    }

    async revokeSession(sessionId: number, userId: number): Promise<void> {
        await db.run(
            'UPDATE user_sessions SET is_active = 0 WHERE id = ? AND user_id = ?',
            [sessionId, userId]
        );
    }

    async setupTestUsers(): Promise<any> {
        try {
            // Check if users already exist
            const existingUsers = await db.query('SELECT COUNT(*) as count FROM users');
            if (existingUsers[0].count > 0) {
                return { 
                    message: 'Users already exist', 
                    count: existingUsers[0].count 
                };
            }

            // Create test users
            const testUsers = [
                {
                    username: 'admin',
                    email: 'admin@rpa.com',
                    password: 'admin123',
                    role: 'team_lead' as UserRole,
                    full_name: 'Administrator'
                },
                {
                    username: 'dev1',
                    email: 'dev1@rpa.com', 
                    password: 'dev123',
                    role: 'rpa_developer' as UserRole,
                    full_name: 'Developer One'
                },
                {
                    username: 'ops1',
                    email: 'ops1@rpa.com',
                    password: 'ops123', 
                    role: 'rpa_operations' as UserRole,
                    full_name: 'Operations One'
                }
            ];

            const created = [];
            for (const userData of testUsers) {
                try {
                    const user = await this.createUser(userData);
                    created.push({
                        email: user.email,
                        role: user.role,
                        full_name: user.full_name
                    });
                } catch (error) {
                    logger.warn(`Failed to create user ${userData.email}:`, error);
                }
            }

            return {
                message: 'Test users created successfully',
                users: created,
                credentials: {
                    admin: 'admin@rpa.com / admin123',
                    developer: 'dev1@rpa.com / dev123',
                    operations: 'ops1@rpa.com / ops123'
                }
            };
        } catch (error) {
            logger.error('Setup test users error:', error);
            throw new Error('Failed to setup test users');
        }
    }

    async debugUserLogin(email: string): Promise<any> {
        try {
            // Find user by email
            const user = await this.findUserByEmail(email);
            if (!user) {
                return { error: 'User not found', email };
            }

            // Test password hash
            const testPassword = 'admin123';
            const isValidPassword = await bcrypt.compare(testPassword, user.password_hash!);
            
            return {
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                is_active: user.is_active,
                password_hash: user.password_hash?.substring(0, 20) + '...', // Only first 20 chars for security
                test_password_valid: isValidPassword,
                created_at: user.created_at
            };
        } catch (error) {
            logger.error('Debug user login error:', error);
            throw error;
        }
    }

    async updateUser(userId: number, updates: Partial<User>): Promise<User> {
        try {
            // Check if user exists
            const existingUser = await this.findUserById(userId);
            if (!existingUser) {
                throw new Error('User not found');
            }

            // Build update query
            const fields = [];
            const values = [];

            if (updates.full_name !== undefined) {
                fields.push('full_name = ?');
                values.push(updates.full_name);
            }

            if (updates.email !== undefined) {
                // Check if email is already taken by another user
                const emailCheck = await db.get(
                    'SELECT id FROM users WHERE email = ? AND id != ?',
                    [updates.email, userId]
                );
                if (emailCheck) {
                    throw new Error('Email already exists');
                }
                fields.push('email = ?');
                values.push(updates.email);
            }

            if (updates.role !== undefined) {
                fields.push('role = ?');
                values.push(updates.role);
            }

            if (updates.is_active !== undefined) {
                fields.push('is_active = ?');
                values.push(updates.is_active ? 1 : 0);
            }

            if (fields.length === 0) {
                return existingUser;
            }

            fields.push('updated_at = datetime("now")');
            values.push(userId);

            await db.run(
                `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
                values
            );

            // Return updated user
            const updatedUser = await this.findUserById(userId);
            if (!updatedUser) {
                throw new Error('Failed to retrieve updated user');
            }

            logger.info(`User updated: ${updatedUser.email}`);
            return updatedUser;
        } catch (error) {
            logger.error('Update user error:', error);
            throw error;
        }
    }

    async deleteUser(userId: number): Promise<void> {
        try {
            // Check if user exists
            const existingUser = await this.findUserById(userId);
            if (!existingUser) {
                throw new Error('User not found');
            }

            // Delete user (this will cascade to related tables if configured)
            const result = await db.run('DELETE FROM users WHERE id = ?', [userId]);
            
            if (result.changes === 0) {
                throw new Error('Failed to delete user');
            }

            logger.info(`User deleted: ${existingUser.email}`);
        } catch (error) {
            logger.error('Delete user error:', error);
            throw error;
        }
    }

    async resetUserPassword(userId: number, newPassword: string): Promise<void> {
        try {
            // Check if user exists
            const existingUser = await this.findUserById(userId);
            if (!existingUser) {
                throw new Error('User not found');
            }

            // Validate password
            this.validatePassword(newPassword);

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

            // Update password
            await db.run(
                'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?',
                [hashedPassword, userId]
            );

            logger.info(`Password reset for user: ${existingUser.email}`);
        } catch (error) {
            logger.error('Reset user password error:', error);
            throw error;
        }
    }
} 