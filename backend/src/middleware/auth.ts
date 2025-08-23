import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { User, UserRole } from '../types/auth';
import { logger } from '../utils/logger';

// Extend Express Request type to include user
export interface AuthenticatedRequest extends Request {
    user?: User;
}

export class AuthMiddleware {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    // Basic authentication middleware
    authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const token = this.extractToken(req);
            
            if (!token) {
                res.status(401).json({ error: 'Access token required' });
                return;
            }

            const user = await this.authService.verifyToken(token);
            
            if (!user) {
                res.status(401).json({ error: 'Invalid or expired token' });
                return;
            }

            // Attach user to request
            req.user = user;
            next();
        } catch (error) {
            logger.error('Authentication error:', error);
            res.status(401).json({ error: 'Authentication failed' });
        }
    };

    // Role-based authorization middleware
    authorize = (allowedRoles: UserRole[]) => {
        return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
            if (!req.user) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }

            if (!allowedRoles.includes(req.user.role)) {
                res.status(403).json({ 
                    error: 'Insufficient permissions',
                    required: allowedRoles,
                    current: req.user.role
                });
                return;
            }

            next();
        };
    };

    // Permission-based authorization middleware
    requirePermission = (permission: string) => {
        return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
            if (!req.user) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }

            try {
                const userPermissions = await this.authService.getUserPermissions(req.user.role);
                
                if (!this.hasPermission(userPermissions, permission)) {
                    res.status(403).json({ 
                        error: 'Permission denied',
                        required: permission,
                        role: req.user.role
                    });
                    return;
                }

                next();
            } catch (error) {
                logger.error('Permission check error:', error);
                res.status(500).json({ error: 'Permission check failed' });
            }
        };
    };

    // Resource ownership middleware
    requireOwnership = (resourceField: string = 'id') => {
        return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
            if (!req.user) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }

            // Team leads can access everything
            if (req.user.role === 'team_lead') {
                next();
                return;
            }

            const resourceId = req.params[resourceField] || req.body[resourceField];
            const userId = req.user.id;

            // For most resources, check if the user ID matches
            if (resourceField === 'userId' && parseInt(resourceId) !== userId) {
                res.status(403).json({ error: 'Access denied: not resource owner' });
                return;
            }

            // For other resources, we'll need to check ownership in the database
            // This is implemented in individual route handlers
            next();
        };
    };

    // Optional authentication (doesn't fail if no token)
    optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const token = this.extractToken(req);
            
            if (token) {
                const user = await this.authService.verifyToken(token);
                if (user) {
                    req.user = user;
                }
            }

            next();
        } catch (error) {
            // Don't fail on optional auth errors
            logger.debug('Optional auth error:', error);
            next();
        }
    };

    // Rate limiting for sensitive endpoints
    rateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
        const attempts = new Map<string, { count: number; resetTime: number }>();

        return (req: Request, res: Response, next: NextFunction): void => {
            const key = req.ip || 'unknown';
            const now = Date.now();

            const userAttempts = attempts.get(key);

            if (!userAttempts || now > userAttempts.resetTime) {
                attempts.set(key, { count: 1, resetTime: now + windowMs });
                next();
                return;
            }

            if (userAttempts.count >= maxAttempts) {
                res.status(429).json({ 
                    error: 'Too many attempts',
                    retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000)
                });
                return;
            }

            userAttempts.count++;
            next();
        };
    };

    private extractToken(req: Request): string | null {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return null;
        }

        // Support both "Bearer token" and just "token" formats
        if (authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        return authHeader;
    }

    private hasPermission(userPermissions: string[], requiredPermission: string): boolean {
        // Check for exact permission match
        if (userPermissions.includes(requiredPermission)) {
            return true;
        }

        // Check for wildcard permissions (e.g., "users:*" allows "users:read")
        const permissionParts = requiredPermission.split(':');
        
        for (const permission of userPermissions) {
            if (permission.endsWith(':*')) {
                const wildcardBase = permission.replace(':*', '');
                if (requiredPermission.startsWith(wildcardBase + ':')) {
                    return true;
                }
            }
            
            // Full wildcard
            if (permission === '*') {
                return true;
            }
        }

        return false;
    }
}

// Create singleton instance
export const authMiddleware = new AuthMiddleware();

// Export individual middleware functions for convenience
export const authenticate = authMiddleware.authenticate;
export const authorize = authMiddleware.authorize;
export const requirePermission = authMiddleware.requirePermission;
export const requireOwnership = authMiddleware.requireOwnership;
export const optionalAuth = authMiddleware.optionalAuth;
export const rateLimit = authMiddleware.rateLimit;