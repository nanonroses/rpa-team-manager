export class APIError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;
    public readonly timestamp: string;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = 'INTERNAL_ERROR',
        isOperational: boolean = true
    ) {
        super(message);
        
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace(this, this.constructor);
    }
}

// Specific error classes for different types of errors
export class ValidationError extends APIError {
    constructor(message: string = 'Validation failed') {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

export class AuthenticationError extends APIError {
    constructor(message: string = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

export class AuthorizationError extends APIError {
    constructor(message: string = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

export class NotFoundError extends APIError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
    }
}

export class ConflictError extends APIError {
    constructor(message: string = 'Resource conflict') {
        super(message, 409, 'CONFLICT_ERROR');
    }
}

export class RateLimitError extends APIError {
    constructor(message: string = 'Rate limit exceeded') {
        super(message, 429, 'RATE_LIMIT_ERROR');
    }
}

export class DatabaseError extends APIError {
    constructor(message: string = 'Database operation failed', originalError?: Error) {
        super(message, 500, 'DATABASE_ERROR');
        
        if (originalError) {
            this.stack = originalError.stack;
        }
    }
}

export class ExternalServiceError extends APIError {
    constructor(service: string, message: string = 'External service error') {
        super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    }
}

// Error factory for common database errors
export const createDatabaseError = (error: any): DatabaseError => {
    const message = error.message || 'Database operation failed';
    
    // SQLite specific error handling
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return new ConflictError('Resource already exists');
    }
    
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return new ValidationError('Invalid reference to related resource');
    }
    
    if (error.code === 'SQLITE_CONSTRAINT_NOTNULL') {
        return new ValidationError('Required field missing');
    }
    
    return new DatabaseError(message, error);
};

// Error factory for authentication errors
export const createAuthError = (type: 'invalid_credentials' | 'token_expired' | 'invalid_token' | 'missing_token'): APIError => {
    switch (type) {
        case 'invalid_credentials':
            return new AuthenticationError('Invalid email or password');
        case 'token_expired':
            return new AuthenticationError('Token has expired');
        case 'invalid_token':
            return new AuthenticationError('Invalid token');
        case 'missing_token':
            return new AuthenticationError('Authentication token required');
        default:
            return new AuthenticationError();
    }
};

// Utility to check if error is operational (expected) vs programming error
export const isOperationalError = (error: any): boolean => {
    if (error instanceof APIError) {
        return error.isOperational;
    }
    return false;
};

// Utility to format error for API response
export interface FormattedError {
    error: {
        message: string;
        code: string;
        timestamp: string;
        details?: any;
    };
}

export const formatError = (error: APIError, includeStack: boolean = false): FormattedError => {
    const formatted: FormattedError = {
        error: {
            message: error.message,
            code: error.code,
            timestamp: error.timestamp
        }
    };

    // Include stack trace only in development
    if (includeStack && process.env.NODE_ENV === 'development') {
        formatted.error.details = {
            stack: error.stack
        };
    }

    return formatted;
};