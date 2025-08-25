import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

// Import security middleware
import { apiLimiter, authLimiter, analyticsLimiter } from './middleware/rateLimiter';
import { globalErrorHandler, notFoundHandler, setupGlobalErrorHandlers, securityErrorHandler } from './middleware/errorHandler';
import { sanitizeInput, securityHeaders } from './middleware/validation';
import path from 'path';

// Import routes
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import financialRoutes from './routes/financialRoutes';
import settingsRoutes from './routes/settingsRoutes';
import { timeRoutes } from './routes/timeRoutes';
import { taskRoutes } from './routes/taskRoutes';
import ideaRoutes from './routes/ideaRoutes';
import fileRoutes from './routes/fileRoutes';
import supportRoutes from './routes/supportRoutes';
import pmoRoutes from './routes/pmoRoutes';
import aiRoutes from './routes/aiRoutes';

// Import database and logger
import { db } from './database/database';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

class RPATeamManagerServer {
    private app: express.Application;
    private port: number;

    constructor() {
        this.app = express();
        this.port = parseInt(process.env.PORT || '5001');
        
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private initializeMiddleware(): void {
        // Setup global error handlers
        setupGlobalErrorHandlers();
        
        // Security middleware (order matters!)
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
        }));
        
        // Custom security headers
        this.app.use(securityHeaders);
        
        // Input sanitization (before parsing)
        this.app.use(sanitizeInput);
        
        // Security pattern detection
        this.app.use(securityErrorHandler);

        // CORS configuration
        this.app.use(cors({
            origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
            credentials: true,
            optionsSuccessStatus: 200
        }));

        // Rate limiting middleware - apply to all API routes
        this.app.use('/api', apiLimiter);

        // Compression middleware
        this.app.use(compression());

        // Body parsing middleware with UTF-8 encoding
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Set charset to UTF-8 for all responses
        this.app.use((req, res, next) => {
            res.charset = 'utf-8';
            next();
        });

        // Request logging
        this.app.use((req, res, next) => {
            logger.http(`${req.method} ${req.url} - ${req.ip}`);
            next();
        });

        // Static file serving for uploads
        const uploadsPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads');
        this.app.use('/uploads', express.static(uploadsPath));
    }

    private initializeRoutes(): void {
        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            try {
                const dbHealth = await db.healthCheck();
                const health = {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    database: dbHealth,
                    version: process.env.npm_package_version || '1.0.0'
                };
                res.json(health);
            } catch (error) {
                logger.error('Health check failed:', error);
                res.status(503).json({
                    status: 'unhealthy',
                    timestamp: new Date().toISOString(),
                    error: (error as Error).message
                });
            }
        });

        // API routes with specific rate limiting
        this.app.use('/api/auth', authLimiter, authRoutes);
        this.app.use('/api/projects', projectRoutes);
        this.app.use('/api/financial', financialRoutes);
        this.app.use('/api/settings', settingsRoutes);
        this.app.use('/api', timeRoutes);
        this.app.use('/api', taskRoutes);
        this.app.use('/api/ideas', ideaRoutes);
        this.app.use('/api/files', fileRoutes);
        this.app.use('/api/support', supportRoutes);
        this.app.use('/api/pmo', analyticsLimiter, pmoRoutes);
        this.app.use('/api/ai', aiRoutes);

        // API documentation route
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'RPA Team Manager API',
                version: '1.0.0',
                description: 'API for RPA team management and collaboration',
                endpoints: {
                    auth: {
                        'POST /api/auth/login': 'User login',
                        'POST /api/auth/logout': 'User logout',
                        'GET /api/auth/me': 'Get current user profile',
                        'POST /api/auth/change-password': 'Change user password',
                        'POST /api/auth/reset-password': 'Reset user password',
                        'GET /api/auth/sessions': 'Get user sessions',
                        'DELETE /api/auth/sessions/:id': 'Revoke user session'
                    },
                    projects: {
                        'GET /api/projects': 'Get all projects',
                        'GET /api/projects/:id': 'Get specific project',
                        'POST /api/projects': 'Create new project',
                        'PUT /api/projects/:id': 'Update project',
                        'DELETE /api/projects/:id': 'Delete project',
                        'GET /api/projects/:id/gantt': 'Get project Gantt data'
                    },
                    financial: {
                        'GET /api/financial/user-costs': 'Get team member costs (team_lead only)',
                        'POST /api/financial/user-costs': 'Create user cost rate (team_lead only)',
                        'PUT /api/financial/user-costs/:id': 'Update user cost rate (team_lead only)',
                        'GET /api/financial/project-roi/:projectId': 'Get project ROI analysis',
                        'POST /api/financial/project-financial': 'Update project financial data',
                        'GET /api/financial/dashboard': 'Get ROI dashboard and analytics'
                    },
                    time: {
                        'GET /api/time-entries': 'Get user time entries with filters',
                        'POST /api/time-entries': 'Create new time entry',
                        'PUT /api/time-entries/:id': 'Update time entry',
                        'DELETE /api/time-entries/:id': 'Delete time entry',
                        'GET /api/time-entries/active': 'Get active timer for user',
                        'POST /api/time-entries/start-timer': 'Start new timer',
                        'POST /api/time-entries/stop-timer': 'Stop active timer',
                        'GET /api/time-entries/dashboard': 'Get time dashboard data'
                    },
                    tasks: {
                        'GET /api/tasks/boards': 'Get task boards for user projects',
                        'GET /api/tasks/boards/:id': 'Get board with columns and tasks',
                        'POST /api/tasks/boards': 'Create new task board',
                        'GET /api/tasks': 'Get tasks with filters',
                        'POST /api/tasks': 'Create new task',
                        'PUT /api/tasks/:id': 'Update task',
                        'DELETE /api/tasks/:id': 'Delete task',
                        'POST /api/tasks/:id/move': 'Move task to different column/position',
                        'GET /api/tasks/my-tasks': 'Get current user assigned tasks'
                    },
                    ideas: {
                        'GET /api/ideas': 'Get ideas with filters',
                        'GET /api/ideas/:id': 'Get specific idea',
                        'POST /api/ideas': 'Create new idea',
                        'PUT /api/ideas/:id': 'Update idea (creator or team_lead only)',
                        'DELETE /api/ideas/:id': 'Delete idea (creator or team_lead only)',
                        'POST /api/ideas/:id/vote': 'Vote on idea (up/down)',
                        'GET /api/ideas/:id/comments': 'Get idea comments',
                        'POST /api/ideas/:id/comments': 'Add comment to idea',
                        'GET /api/ideas/stats': 'Get idea statistics'
                    },
                    files: {
                        'POST /api/files/upload': 'Upload files with optional entity association',
                        'GET /api/files': 'Get files with filters and search',
                        'GET /api/files/categories': 'Get available file categories',
                        'GET /api/files/:id': 'Get file details with associations and versions',
                        'GET /api/files/:id/download': 'Download file',
                        'POST /api/files/:id/associate': 'Associate file with entity',
                        'DELETE /api/files/:id': 'Delete file (soft delete)'
                    },
                    support: {
                        'GET /api/support/companies': 'Get all support companies with pagination',
                        'GET /api/support/companies/:id': 'Get specific support company with metrics',
                        'POST /api/support/companies': 'Create new support company',
                        'PUT /api/support/companies/:id': 'Update support company',
                        'DELETE /api/support/companies/:id': 'Delete support company',
                        'GET /api/support/companies/:id/metrics': 'Get historical support metrics for company',
                        'GET /api/support/tickets': 'Get all support tickets with filters',
                        'GET /api/support/tickets/:id': 'Get specific support ticket with comments',
                        'POST /api/support/tickets': 'Create new support ticket',
                        'PUT /api/support/tickets/:id': 'Update support ticket',
                        'POST /api/support/tickets/:id/comments': 'Add comment/update to support ticket',
                        'GET /api/support/dashboard': 'Get support dashboard and summary statistics',
                        'GET /api/support/billing-report': 'Get monthly billing report for all companies'
                    },
                    ai: {
                        'GET /api/ai/health': 'Get ML service health status',
                        'GET /api/ai/models': 'Get available ML models information',
                        'POST /api/ai/predict/completion-time': 'Predict project completion time',
                        'POST /api/ai/predict/budget-variance': 'Predict budget variance and cost overruns',
                        'POST /api/ai/predict/risk-score': 'Predict project risk score (0-100)',
                        'POST /api/ai/predict/batch': 'Batch predictions for multiple projects',
                        'POST /api/ai/explain': 'Get SHAP explanation for predictions',
                        'GET /api/ai/projects/:id/analytics': 'Get comprehensive project analytics',
                        'POST /api/ai/models/validate': 'Validate models against ground truth',
                        'GET /api/ai/monitoring/drift': 'Check for data drift',
                        'GET /api/ai/monitoring/metrics': 'Get model performance metrics',
                        'POST /api/ai/models/retrain': 'Trigger model retraining (admin only)',
                        'GET /api/ai/dashboard': 'Get ML dashboard data'
                    }
                }
            });
        });

        // Remove old catch-all route - will be handled by notFoundHandler
    }

    private initializeErrorHandling(): void {
        // 404 handler for unmatched routes
        this.app.use(notFoundHandler);
        
        // Global error handler (must be last middleware)
        this.app.use(globalErrorHandler);

        // Global error handlers are already set up in setupGlobalErrorHandlers()

        // Graceful shutdown
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    }

    private async gracefulShutdown(signal: string): Promise<void> {
        logger.info(`Received ${signal}. Starting graceful shutdown...`);

        try {
            // Close database connection
            await db.close();
            logger.info('Database connection closed');

            // Close server
            process.exit(0);
        } catch (error) {
            logger.error('Error during graceful shutdown:', error);
            process.exit(1);
        }
    }

    public async start(): Promise<void> {
        try {
            // Initialize database
            logger.info('Initializing database...');
            await db.connect();
            await db.initializeSchema();

            // Check if database is empty and seed initial data
            const userCount = await db.get('SELECT COUNT(*) as count FROM users');
            logger.info(`Found ${userCount.count} users in database`);
            
            if (userCount.count === 0) {
                logger.info('Database is empty, seeding initial data...');
                await db.seedInitialData();
                logger.info('Initial data seeding completed');
            } else {
                logger.info('Database already has data, skipping seeding');
            }

            // Start server
            this.app.listen(this.port, () => {
                logger.info(`🚀 RPA Team Manager API started on port ${this.port}`);
                logger.info(`📋 API Documentation: http://localhost:${this.port}/api`);
                logger.info(`💚 Health Check: http://localhost:${this.port}/health`);
                logger.info(`🔒 Authentication: http://localhost:${this.port}/api/auth`);
                
                if (process.env.NODE_ENV === 'development') {
                    logger.info(`👨‍💻 Development mode - Database browser: http://localhost:8080`);
                }
            });

        } catch (error) {
            logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }
}

// Start the server
const server = new RPATeamManagerServer();
server.start().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
});