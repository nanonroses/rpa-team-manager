# Development Setup Guide

## Overview

This guide will help you set up the RPA Team Manager development environment on your local machine. The system is designed to run on a laptop/notebook with minimal configuration requirements.

## Prerequisites

### System Requirements
- **Operating System**: Windows 10/11, macOS, or Linux
- **CPU**: Intel i5 8th gen or equivalent
- **RAM**: 16GB (application uses ~1GB)
- **Storage**: 15GB free space
- **Network**: Internet connection for npm packages

### Required Software
- **Node.js**: Version 18 or higher
- **npm**: Version 9 or higher (comes with Node.js)
- **Git**: Latest version
- **Code Editor**: VS Code (recommended) or your preferred editor

### Optional Software
- **Docker**: For containerized deployment
- **SQLite Browser**: For database inspection
- **Postman**: For API testing

## Quick Setup

### 1. Clone the Repository
```bash
# Navigate to your development directory
cd C:\Users\nanon\OneDrive\Documentos\GitHub

# Clone the project (if not already cloned)
git clone https://github.com/your-repo/rpa-team-manager.git
cd rpa-team-manager
```

### 2. Install Dependencies
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit the .env file if needed (optional for development)
```

### 4. Database Setup
```bash
# Run database migrations
cd backend
npm run db:migrate

# Optional: Create test users
curl -X POST http://localhost:5001/api/auth/setup-test-users
```

### 5. Start Development Servers
```bash
# Terminal 1 - Backend server
cd backend
npm run dev

# Terminal 2 - Frontend server
cd frontend  
npm run dev
```

### 6. Verify Installation
- **Frontend**: http://localhost:3000
- **Backend Health**: http://localhost:5001/health
- **Login**: admin@rpa.com / admin123

## Detailed Setup Instructions

### Node.js Installation

#### Windows
1. Download from https://nodejs.org
2. Run installer with default options
3. Verify installation:
```cmd
node --version
npm --version
```

#### macOS
```bash
# Using Homebrew (recommended)
brew install node

# Or download from nodejs.org
```

#### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Git Configuration
```bash
# Configure Git (first time only)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### VS Code Extensions (Recommended)
Install these extensions for better development experience:
- **TypeScript**: Official TypeScript support
- **ES7+ React/Redux**: React snippets
- **Auto Rename Tag**: HTML/JSX tag renaming
- **Prettier**: Code formatting
- **ESLint**: Code linting
- **Thunder Client**: API testing (Postman alternative)
- **SQLite Viewer**: Database inspection

## Project Structure

```
rpa-team-manager/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── controllers/     # API route handlers
│   │   ├── routes/         # Express route definitions
│   │   ├── database/       # Database schema and migrations
│   │   ├── middleware/     # Authentication, validation
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Helper functions
│   ├── data/               # SQLite database files
│   ├── uploads/            # File upload storage
│   ├── package.json        # Backend dependencies
│   └── tsconfig.json       # TypeScript configuration
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page-level components
│   │   ├── services/       # API service layer
│   │   ├── store/          # State management
│   │   ├── types/          # TypeScript interfaces
│   │   ├── styles/         # CSS and styling
│   │   └── utils/          # Helper functions
│   ├── public/             # Static assets
│   ├── package.json        # Frontend dependencies
│   └── vite.config.ts      # Vite configuration
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── docker-compose.yml      # Docker configuration
└── README.md              # Project overview
```

## Development Commands

### Backend Commands
```bash
cd backend

# Development server (auto-restart)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database operations
npm run db:migrate          # Apply migrations
npm run db:reset           # Reset database (dev only)

# Testing
npm test
npm run test:coverage

# Linting
npm run lint
npm run lint:fix
```

### Frontend Commands
```bash
cd frontend

# Development server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Testing
npm test

# Linting
npm run lint
```

## Database Management

### SQLite Database
The application uses SQLite stored in `backend/data/database.sqlite`.

#### Database Tools
1. **Command Line**:
```bash
# Access SQLite CLI
cd backend/data
sqlite3 database.sqlite

# Common commands
.tables          # List tables
.schema users    # Show table schema
.quit           # Exit
```

2. **GUI Tools**:
- **DB Browser for SQLite** (free)
- **SQLite Studio** (free)
- **VS Code SQLite Viewer** extension

#### Migration System
```bash
# Check migration status
cd backend
npm run db:status

# Apply pending migrations
npm run db:migrate

# Create new migration
npm run db:create-migration add_new_feature

# Rollback last migration (dev only)
npm run db:rollback
```

### Sample Data
```bash
# Create test users and data
curl -X POST http://localhost:5001/api/auth/setup-test-users

# Reset to clean state (development only)
cd backend
npm run db:reset
npm run db:migrate
```

## Environment Configuration

### Development Environment Variables
```env
# .env file (backend)
NODE_ENV=development
PORT=5001
JWT_SECRET=your-development-jwt-secret-minimum-32-characters
CORS_ORIGIN=http://localhost:3000

# Database
DATABASE_PATH=./data/database.sqlite

# File uploads
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# Rate limiting (development)
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=10
```

### Frontend Environment Variables
```env
# .env file (frontend)
VITE_API_URL=http://localhost:5001
```

## Development Workflow

### 1. Daily Development
```bash
# Start development (two terminals)
cd backend && npm run dev
cd frontend && npm run dev

# Make changes to code
# Servers auto-restart/reload on file changes
```

### 2. Database Changes
```bash
# When schema changes are needed
cd backend
npm run db:create-migration my_new_feature

# Edit migration file in src/database/migrations/
# Apply migration
npm run db:migrate
```

### 3. API Testing
```bash
# Health check
curl http://localhost:5001/health

# Login test
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rpa.com","password":"admin123"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/projects
```

### 4. Code Quality
```bash
# Before committing
cd backend
npm run lint
npm run test

cd ../frontend
npm run lint
npm run build  # Check for build errors
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Windows - Find and kill process
netstat -ano | findstr :3000
taskkill /F /PID <process-id>

# macOS/Linux
lsof -ti:3000 | xargs kill
```

#### 2. Database Locked
```bash
# Stop backend server with Ctrl+C (don't use taskkill)
# Wait 5 seconds
# Restart backend
cd backend && npm run dev
```

#### 3. Node Modules Issues
```bash
# Clear npm cache and reinstall
cd backend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

#### 4. TypeScript Errors
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Clear TypeScript cache (VS Code)
# Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

#### 5. Migration Errors
```bash
# Check migration status
npm run db:status

# Manual migration (development only)
cd backend
rm data/database.sqlite*
npm run db:migrate
npm run setup-test-users
```

### Performance Issues

#### Slow Development Server
```bash
# Clear all caches
npm cache clean --force
rm -rf node_modules/.cache

# Restart VS Code and terminals
```

#### Database Performance
```bash
# Vacuum database (periodically)
cd backend/data
sqlite3 database.sqlite "VACUUM;"
```

## Testing

### Unit Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests  
cd frontend
npm test
```

### Integration Tests
```bash
# Test with actual database
cd backend
npm run test:integration
```

### Manual Testing
1. **Authentication**: Login/logout flows
2. **CRUD Operations**: Create, read, update, delete
3. **File Uploads**: Test file upload functionality
4. **API Endpoints**: Use Postman/Thunder Client
5. **UI Components**: Test responsive design

## Deployment Preparation

### Build for Production
```bash
# Frontend build
cd frontend
npm run build

# Backend build
cd backend
npm run build
```

### Docker Setup
```bash
# Build and run with Docker
docker-compose up --build

# Background mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Preparation
1. **Production Environment Variables**
2. **Database Backup Strategy**
3. **SSL Certificate Setup**
4. **Security Configuration**
5. **Monitoring Setup**

## Best Practices

### Code Style
- **TypeScript**: Use strict mode
- **ESLint**: Follow configured rules
- **Prettier**: Auto-format code
- **Comments**: Document complex logic
- **Naming**: Use descriptive variable names

### Git Workflow
```bash
# Feature branch workflow
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
# Create pull request
```

### Database Best Practices
- **Migrations**: Always use migrations for schema changes
- **Backups**: Regular database backups
- **Indexing**: Add indexes for performance
- **Constraints**: Use foreign keys and constraints

### Security Considerations
- **Environment Variables**: Never commit secrets
- **Input Validation**: Validate all user inputs
- **Authentication**: Test auth flows thoroughly
- **Dependencies**: Keep dependencies updated

## Getting Help

### Resources
- **Project Documentation**: `/docs` folder
- **API Documentation**: `/docs/api-*.md`
- **Database Schema**: `/docs/database-schema.md`
- **User Guides**: `/docs/user-guide-*.md`

### Debugging Tools
- **Browser DevTools**: Network, Console tabs
- **VS Code Debugger**: Set breakpoints
- **Node.js Inspector**: Debug backend code
- **React DevTools**: Component inspection

### Community Support
- **GitHub Issues**: Report bugs and request features
- **Stack Overflow**: General programming questions
- **TypeScript Documentation**: https://www.typescriptlang.org/docs/
- **React Documentation**: https://react.dev/

This setup guide provides everything needed to start developing with the RPA Team Manager. The system is designed to be developer-friendly with minimal configuration required.