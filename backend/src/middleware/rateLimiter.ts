import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// General API rate limiting
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
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

// Moderate rate limiting for data-heavy endpoints (PMO analytics, reports)
export const analyticsLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // limit each IP to 10 requests per 5 minutes for heavy queries
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