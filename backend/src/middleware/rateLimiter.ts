import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// General API rate limiting - Increased for development/small teams
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 requests per windowMs (increased for small teams)
    message: {
        error: {
            message: 'Too many requests from this IP, please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Lenient rate limiting for common authenticated endpoints like /api/projects and /api/auth/users
export const commonEndpointsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute (reduced window for development)
    max: 500, // Significantly increased for development and small teams
    message: {
        error: {
            message: 'Rate limit exceeded for common endpoints. Please wait before making more requests.',
            code: 'COMMON_ENDPOINTS_RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiting for authentication routes
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login requests per windowMs
    skipSuccessfulRequests: true,
    message: {
        error: {
            message: 'Too many login attempts from this IP, please try again after 15 minutes.',
            code: 'LOGIN_RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Relaxed rate limiting for data-heavy endpoints (PMO analytics, reports) - Development Mode
export const analyticsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute (reduced window)
    max: 100, // Significantly increased for development and small teams
    message: {
        error: {
            message: 'Analytics endpoint rate limit exceeded. Please wait before making more requests.',
            code: 'ANALYTICS_RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Create account rate limiting - very strict
export const createAccountLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 account creation requests per hour
    message: {
        error: {
            message: 'Too many account creation attempts. Please try again later.',
            code: 'ACCOUNT_CREATION_RATE_LIMIT_EXCEEDED',
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});