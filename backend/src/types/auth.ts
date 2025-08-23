export interface User {
    id: number;
    username: string;
    email: string;
    password_hash?: string;
    role: UserRole;
    full_name: string;
    avatar_url?: string;
    is_active: boolean;
    last_login?: Date;
    created_at: Date;
    updated_at: Date;
}

export type UserRole = 'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support';

export interface AuthRequest extends Request {
    user?: User;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    user: Omit<User, 'password_hash'>;
    token: string;
    expires_in: string;
}

export interface JWTPayload {
    userId: number;
    email: string;
    role: UserRole;
    iat: number;
    exp: number;
}

export interface UserSession {
    id: number;
    user_id: number;
    token_hash: string;
    expires_at: Date;
    ip_address?: string;
    user_agent?: string;
    is_active: boolean;
    created_at: Date;
}

// Role-based permissions
export const RolePermissions: Record<UserRole, string[]> = {
    team_lead: [
        // Full system access
        'users:read', 'users:create', 'users:update', 'users:delete',
        'projects:read', 'projects:create', 'projects:update', 'projects:delete',
        'tasks:read', 'tasks:create', 'tasks:update', 'tasks:delete',
        'time:read', 'time:create', 'time:update', 'time:delete',
        'issues:read', 'issues:create', 'issues:update', 'issues:delete',
        'ideas:read', 'ideas:create', 'ideas:update', 'ideas:delete',
        'financials:read', 'financials:update',
        'reports:read', 'reports:create',
        'system:configure', 'system:backup'
    ],
    rpa_developer: [
        // Own tasks and time tracking
        'users:read:basic',
        'projects:read:assigned',
        'tasks:read', 'tasks:create:own', 'tasks:update:own',
        'time:read:own', 'time:create:own', 'time:update:own',
        'issues:read:assigned', 'issues:create', 'issues:update:own',
        'ideas:read', 'ideas:create:own', 'ideas:update:own',
        'files:upload', 'files:read:own'
    ],
    rpa_operations: [
        // Monitoring and coordination
        'users:read:basic',
        'projects:read', 'projects:update:status',
        'tasks:read', 'tasks:update:status',
        'time:read',
        'issues:read', 'issues:create', 'issues:update',
        'ideas:read', 'ideas:create:own',
        'reports:read:operational',
        'files:read'
    ],
    it_support: [
        // System maintenance and user support
        'users:read', 'users:update:support',
        'projects:read',
        'tasks:read',
        'time:read',
        'issues:read', 'issues:create', 'issues:update:technical',
        'system:backup', 'system:health', 'system:logs',
        'files:read'
    ]
};

export interface PasswordPolicy {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    preventCommonPasswords: boolean;
}

export const defaultPasswordPolicy: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true
};