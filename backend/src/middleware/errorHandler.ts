import { Request, Response, NextFunction } from 'express';
import { APIError, formatError, isOperationalError, DatabaseError } from '../utils/errors';
import { logger } from '../utils/logger';

// Global error handler middleware
export const globalErrorHandler = (
    error: Error | APIError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let apiError: APIError;
    
    // Convert unknown errors to APIError
    if (error instanceof APIError) {
        apiError = error;
    } else {
        // Handle specific error types
        if (error.message && error.message.includes('SQLITE_')) {
            apiError = new DatabaseError(error.message, error);
        } else {
            // Generic server error for unknown errors
            apiError = new APIError(
                process.env.NODE_ENV === 'production' 
                    ? 'Internal server error' 
                    : error.message || 'An unexpected error occurred',
                500,
                'INTERNAL_ERROR',
                false // Not operational - programming error
            );
        }
    }

    // Log the error with context
    const errorLog = {
        message: apiError.message,
        code: apiError.code,
        statusCode: apiError.statusCode,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: (req as any).user?.id,
        timestamp: apiError.timestamp,
        stack: apiError.stack
    };

    // Log based on error severity
    if (apiError.statusCode >= 500) {
        logger.error('Server error:', errorLog);
    } else if (apiError.statusCode >= 400) {
        logger.warn('Client error:', errorLog);
    } else {
        logger.info('API error:', errorLog);
    }

    // Send error response
    const includeStack = process.env.NODE_ENV === 'development' && !isOperationalError(apiError);
    const formattedError = formatError(apiError, includeStack);
    
    res.status(apiError.statusCode).json(formattedError);
};

// Async error wrapper - catches async errors and passes them to error handler
export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
    const error = new APIError(
        `Route ${req.method} ${req.originalUrl} not found`,
        404,
        'ROUTE_NOT_FOUND'
    );
    
    next(error);
};

// Handle uncaught exceptions and unhandled rejections
export const setupGlobalErrorHandlers = (): void => {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
        logger.error('Uncaught exception:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // Graceful shutdown
        process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
        logger.error('Unhandled promise rejection:', {
            reason: reason?.message || reason,
            stack: reason?.stack,
            timestamp: new Date().toISOString()
        });

        // Graceful shutdown
        process.exit(1);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        logger.info('SIGTERM received. Starting graceful shutdown...');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        logger.info('SIGINT received. Starting graceful shutdown...');
        process.exit(0);
    });
};

// Security error handler for suspicious requests
export const securityErrorHandler = (req: Request, res: Response, next: NextFunction) => {
    // Check for common attack patterns
    const suspiciousPatterns = [
        /(<script|javascript:|on\w+\s*=)/i, // XSS attempts
        /(union\s+select|drop\s+table|insert\s+into)/i, // SQL injection
        /(\.\.\/|\.\.\\)/g, // Path traversal
        /(%00|%0a|%0d)/i, // Null byte injection
    ];

    const checkValue = (value: any): boolean => {
        if (typeof value === 'string') {
            return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
            return Object.values(value).some(checkValue);
        }
        return false;
    };

    const isSuspicious = checkValue(req.body) || 
                        checkValue(req.query) || 
                        checkValue(req.params);

    if (isSuspicious) {
        logger.warn('Suspicious request detected:', {
            ip: req.ip,
            url: req.url,
            method: req.method,
            userAgent: req.get('User-Agent'),
            body: req.body,
            query: req.query,
            params: req.params,
            timestamp: new Date().toISOString()
        });

        const error = new APIError(
            'Request blocked for security reasons',
            400,
            'SECURITY_VIOLATION'
        );
        
        return next(error);
    }

    next();
};