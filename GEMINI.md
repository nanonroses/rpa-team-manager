# GEMINI.md

## Project Overview

This is a full-stack web application designed for RPA (Robotic Process Automation) team management. It helps small teams (around 5 people) manage their projects, tasks, time tracking, and finances. The application is deployed using Docker.

**Main Technologies:**

*   **Frontend:** React 18, TypeScript, Vite, Ant Design
*   **Backend:** Node.js, Express, TypeScript, SQLite
*   **ML Service:** Python, FastAPI, scikit-learn, XGBoost, LightGBM
*   **Authentication:** JWT + bcrypt
*   **Deployment:** Docker Compose

**Architecture:**

The application is composed of three main services:

*   **`frontend`:** A React single-page application that provides the user interface.
*   **`backend`:** A Node.js/Express API that handles business logic and data persistence.
*   **`ml-service`:** A Python-based service for machine learning features.

The services are orchestrated using `docker-compose.yml`. The backend uses a SQLite database for data storage, and the data is persisted in a volume. There is also a backup service that creates daily backups of the database and uploads.

## Building and Running

### Development

**Prerequisites:**

*   Node.js (>=18.0.0)
*   npm (>=8.0.0)
*   Python (for the ML service)

**Instructions:**

1.  **Install dependencies for both frontend and backend:**
    ```bash
    cd backend && npm install
    cd ../frontend && npm install
    ```

2.  **Start the development servers:**
    *   **Backend:**
        ```bash
        cd backend
        npm run dev
        ```
    *   **Frontend:**
        ```bash
        cd frontend
        npm run dev
        ```
    *   **ML Service:**
        ```bash
        cd ml-service
        pip install -r requirements.txt
        python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8002 --reload
        ```

3.  **The application will be available at the following URLs:**
    *   **Frontend:** `http://localhost:3000`
    *   **Backend API:** `http://localhost:5001`
    *   **ML Service API:** `http://localhost:8002`

### Production (Docker)

**Prerequisites:**

*   Docker
*   Docker Compose

**Instructions:**

1.  **Create a `.env` file from the example:**
    ```bash
    cp .env.example .env
    ```
    *Note: Make sure to set a strong `JWT_SECRET` in the `.env` file.*

2.  **Build and start the services:**
    ```bash
    docker-compose up -d --build
    ```

3.  **The application will be available at the following URLs:**
    *   **Frontend:** `http://localhost:3000`
    *   **Backend API:** `http://localhost:3001`

### Key Scripts

*   `npm run dev`: Starts the development server with hot-reloading.
*   `npm run build`: Builds the application for production.
*   `npm run test`: Runs the tests.
*   `npm run lint`: Lints the code.
*   `npm run db:migrate`: Applies database migrations.

## Development Conventions

*   **Code Style:** The project uses ESLint and Prettier for code formatting and consistency.
*   **Commits:** Commit messages should follow the conventional commits specification (e.g., `feat:`, `fix:`, `docs:`).
*   **Testing:** The project uses Jest for testing.
*   **Database:** Database changes are managed through migrations. To create a new migration, use the `npm run db:create-migration <name>` command.

## ML Service

The ML Service provides predictive analytics and AI-powered insights for the RPA Team Manager application. It implements 3 core predictive models to enhance project management decision-making:

1.  **Project Completion Time Prediction**
2.  **Budget Variance Prediction**
3.  **Risk Scoring System**

For more details, see the `README.md` file in the `ml-service` directory.

## Database Schema

The database schema is defined in `backend/src/database/schema.sql`. It is a relational database with tables for users, projects, tasks, time entries, issues, and more. It also includes tables for the PMO and support modules, as well as a file management system. The schema makes extensive use of foreign keys, indexes, and triggers to ensure data integrity and performance.

## Backend Server

The backend server is the entry point for the backend application. It is responsible for:

*   Initializing the Express server.
*   Setting up middleware for security, CORS, rate limiting, compression, and body parsing.
*   Defining the API routes.
*   Handling errors.
*   Connecting to the database and seeding it with initial data if it's empty.

The server is well-structured and follows best practices for building a Node.js application. For more details, see the `backend/src/server.ts` file.

## Frontend Application

The frontend application is a single-page application built with React and TypeScript. It uses Vite for development and building. The application is responsible for:

*   Providing the user interface.
*   Interacting with the backend API to fetch and display data.
*   Handling user input and actions.

The application uses `react-router-dom` for routing and has a well-structured component hierarchy. It also uses Ant Design for UI components and React Query for data fetching and caching. For more details, see the `frontend/src/App.tsx` file.

## Frontend API Service

The frontend API service is defined in `frontend/src/services/api.ts`. It is a comprehensive service that handles all communication between the frontend and the backend API. It uses `axios` for making HTTP requests and includes interceptors for adding authentication tokens and handling errors. The service also implements request caching and rate limiting to improve performance and prevent abuse. The class is well-structured and provides a clean interface for interacting with the API.

## Database Manager

The database manager is defined in `backend/src/database/database.ts`. It is a singleton class that handles all aspects of the database connection. The class is responsible for:

*   Connecting to the SQLite database.
*   Setting up PRAGMAs for optimal performance and UTF-8 encoding.
*   Initializing the database schema using a migration manager.
*   Seeding the database with initial data.
*   Providing methods for querying the database, running SQL commands, and handling transactions.
*   Performing health checks on the database.
*   Gracefully shutting down the database connection.

The class is well-structured and follows best practices for managing a database connection in a Node.js application.

## Database Migrations

The database migrations are defined in `backend/src/database/migrationList.ts`. The migrations are well-documented and ordered by version. They cover the initial schema creation and subsequent modifications, such as adding new tables, columns, and indexes. This file provides a clear history of the database schema evolution.

## Frontend Entry Point

The frontend entry point is defined in `frontend/src/main.tsx`. It renders the `App` component to the DOM. It also includes a function to clear potentially corrupted authentication data from local storage before the application starts. This is a good practice to prevent issues with authentication.

## Frontend Build Configuration

The frontend build configuration is defined in `vite.config.ts`. It configures the Vite build tool for the frontend application. It defines the following:

*   **Plugins:** It uses the `@vitejs/plugin-react` plugin for React support. The PWA plugin is temporarily disabled.
*   **Resolve:** It sets up aliases for easier imports of modules from different directories.
*   **Server:** It configures the development server to run on port 3000 and proxies API requests to the backend server at `http://localhost:5001`.
*   **Build:** It configures the build process to output the production files to the `dist` directory, minify the code using Terser, and create manual chunks for vendor libraries to improve caching.
*   **Optimize Deps:** It includes `react`, `react-dom`, and `antd` in the optimized dependencies.

The configuration is well-structured and follows best practices for building a React application with Vite.

## TypeScript Configuration

The TypeScript configuration for both the frontend and backend is well-configured and follows best practices for TypeScript development. They both use strict mode and have paths configured for easier imports. The backend `tsconfig.json` is configured for a CommonJS module system, while the frontend `tsconfig.json` is configured for an ESNext module system.

## Git Ignore

The `.gitignore` file lists the files and directories that are ignored by Git. This includes the `node_modules` directory, build output directories (`dist`, `build`), cache directories (`.vite`, `.cache`), log files, SQLite database files, environment files, and coverage reports. This is a standard `.gitignore` file for a Node.js project.

## Project History

The `CHANGELOG.md` file provides a detailed history of the project's development. It's well-structured and follows the "Keep a Changelog" format. The changelog shows that the project has been actively developed, with a focus on adding new features, fixing bugs, and improving the overall user experience. It also highlights the implementation of a comprehensive testing framework and a critical UTF-8 platform solution in the latest version.

## Testing

The `TESTING_RESULTS.md` file provides a summary of the testing that has been done on the project. It includes a list of completed tasks, a list of found and fixed bugs, a list of modified files, and a list of created test data. The file shows that the project has been tested and that critical bugs have been fixed.

## Environment Variables

The `.env.example` file provides a list of environment variables used in the project. It includes variables for security, database configuration, server configuration, CORS configuration, file upload configuration, backup configuration, application configuration, team configuration, default admin user, notification settings, security settings, performance settings, development settings, and backup settings. This file is a good starting point for configuring the application.

## ML Service Dependencies

The `ml-service/requirements.txt` file lists the Python dependencies for the ML service. It includes a comprehensive set of libraries for machine learning, data processing, experiment tracking, API development, and more. This file provides a clear picture of the technologies used in the ML service.

## Python Project Configuration

The `ml-service/pyproject.toml` file is a standard Python project configuration file. It defines the project's metadata, dependencies, and tool configurations. It specifies the project's name, version, description, and other information. It also lists the project's dependencies, including the core dependencies and the optional dependencies for development and monitoring. The file also includes configurations for Black, pytest, and mypy.

## ML Service Configuration

The `ml-service/src/config/settings.py` file defines the configuration settings for the ML service. It uses Pydantic's `BaseSettings` to load settings from environment variables and a `.env` file. The file defines a `MLSettings` class that includes settings for the application, API, database, ML models, MLflow, feature engineering, model training, model performance thresholds, monitoring, security, logging, and performance. It also defines a `ModelConfig` class that includes model-specific configuration, such as feature lists and hyperparameter search spaces.

## Predictor Service

The `ml-service/src/models/predictor_service.py` file defines the `PredictorService` class, which is the core of the ML service. It orchestrates the different ML models, handles feature extraction, and manages the prediction and training workflows. The class is responsible for:

*   Loading the trained models from disk.
*   Training the models if they don't exist or if they need to be retrained.
*   Providing methods for making predictions for project completion time, budget variance, and risk score.
*   Providing a method for making batch predictions for multiple projects and models.
*   Providing a method for explaining predictions using SHAP.
*   Retraining the models with the latest data.
*   Saving the trained models to disk.
*   Providing information about the models and the service.

The class is well-structured and follows best practices for building a machine learning service.

## ML Service Data Access Layer

The `ml-service/src/data/database.py` file defines two classes: `DatabaseManager` and `FeatureExtractor`.

The `DatabaseManager` class is responsible for managing the connection to the SQLite database. It provides methods for getting a database connection, executing queries, and closing the connection.

The `FeatureExtractor` class is responsible for extracting features from the database for the ML models. It provides methods for getting features for project completion time prediction, budget variance prediction, and risk scoring. It also includes methods for engineering new features from the raw data.

The file is well-structured and follows good practices for interacting with a database in a Python application.

## ML Service Logging

The `ml-service/src/utils/logger.py` file defines the logging configuration for the ML service. It uses the `structlog` library to create a structured logger that outputs logs in JSON format. The file defines a `setup_logger` function that configures the logger with a console handler and a rotating file handler. It also defines an `MLLogger` class that provides a high-level interface for logging ML-specific events, such as training start and completion, prediction requests and responses, and model evaluation.

## MLflow Manager

The `ml-service/src/utils/mlflow_manager.py` file defines the `MLflowManager` class, which is responsible for managing the interaction with MLflow. It provides a high-level interface for logging experiments, registering models, and loading models from the registry. The class is responsible for:

*   Initializing the MLflow tracking URI and experiment name.
*   Starting and managing MLflow runs.
*   Logging model training sessions, including parameters, metrics, and artifacts.
*   Logging prediction batches for monitoring.
*   Registering models in the MLflow Model Registry.
*   Loading models from the registry.
*   Getting the best model based on a metric.
*   Comparing models across multiple metrics.
*   Logging model validation results.
*   Getting a summary of the experiment.
*   Cleaning up old runs.

The class is well-structured and follows best practices for using MLflow.

## ML Service Monitoring

The `ml-service/src/utils/monitoring.py` file defines the `ModelMonitor` class, which is responsible for monitoring the performance of the ML models and detecting drift. The class is responsible for:

*   Logging individual predictions and batch predictions for monitoring.
*   Checking for data drift in recent predictions.
*   Detecting drift in prediction values and input features.
*   Validating the models against recent ground truth data.
*   Calculating validation metrics, such as MAE, RMSE, and accuracy.
*   Generating recommendations based on the validation results.
*   Getting model performance metrics for the last N days.
*   Saving and loading the prediction history to and from a file.
*   Getting data for the monitoring dashboard.

The class is well-structured and provides a comprehensive set of tools for monitoring the ML models.

## ML Service API Schemas

The `ml-service/src/api/schemas.py` file defines the Pydantic schemas for the ML service API. It includes schemas for prediction requests and responses, batch prediction requests and responses, explanation requests and responses, model information, health checks, and training requests. It also includes schemas for the different types of predictions, such as completion time, budget variance, and risk score. The schemas are well-defined and provide a clear and consistent data model for the API.

## Completion Time Prediction Model

The `ml-service/src/models/completion_time_model.py` file defines the `CompletionTimePredictor` class, which is responsible for predicting the completion time of a project. It uses an ensemble of machine learning models, including Random Forest, XGBoost, and LightGBM, to make predictions. The class is responsible for:

*   Creating the individual models for the ensemble.
*   Training the model, including hyperparameter optimization using Optuna.
*   Making predictions with confidence intervals.
*   Getting the feature importance from the ensemble.
*   Explaining predictions using SHAP.
*   Evaluating the model's performance.
*   Saving and loading the trained model.
*   Getting information about the model.

The class is well-structured and follows best practices for building a machine learning model.

## Budget Variance Prediction Model

The `ml-service/src/models/budget_variance_model.py` file defines the `BudgetVariancePredictor` class, which is responsible for predicting the budget variance of a project. It uses an ensemble of machine learning models, including Random Forest, XGBoost, LightGBM, Ridge, and ElasticNet, to make predictions. The class is responsible for:

*   Creating the individual models for the ensemble.
*   Training the model, including hyperparameter optimization using Optuna.
*   Making predictions with confidence intervals and actionable insights.
*   Generating budget management recommendations based on the prediction.
*   Getting the feature importance from the ensemble.
*   Evaluating the model's performance.
*   Saving and loading the trained model.
*   Getting information about the model.

The class is well-structured and follows best practices for building a machine learning model.

## Risk Score Prediction Model

The `ml-service/src/models/risk_score_model.py` file defines the `RiskScorePredictor` class, which is responsible for predicting the risk score of a project. It uses a hybrid approach that combines a regression model for predicting a numerical risk score (0-100) and a classification model for predicting the risk category (Low, Medium, High, Critical). The class is responsible for:

*   Creating the individual regression and classification models for the ensembles.
*   Training the models, including hyperparameter optimization using Optuna.
*   Making predictions with confidence intervals and risk insights.
*   Identifying key risk factors from the project features.
*   Generating recommendations based on the risk assessment.
*   Getting the feature importance from the ensembles.
*   Evaluating the model's performance.
*   Saving and loading the trained model.
*   Getting information about the model.

The class is well-structured and follows best practices for building a machine learning model.

## Feature Engineering Pipeline

The `ml-service/src/features/feature_engineering.py` file defines the feature engineering pipelines for the ML models. It includes three classes: `CompletionTimeFeatureProcessor`, `BudgetVarianceFeatureProcessor`, and `RiskScoreFeatureProcessor`. Each class is responsible for:

*   Engineering new features from the raw data.
*   Handling missing values.
*   Removing highly correlated features.
*   Scaling the features.
*   Selecting the best features.

The file also defines a `FeatureStore` class that is responsible for saving and loading engineered features.

The file is well-structured and follows best practices for feature engineering.

## Model Utilities

The `ml-service/src/utils/model_utils.py` file defines several utility classes and functions for the ML service. It includes:

*   `ModelEvaluator`: A class for evaluating the performance of regression and classification models.
*   `ConfidenceIntervalEstimator`: A class for estimating confidence intervals for model predictions using different methods, such as quantile regression and bootstrapping.
*   `ModelVersionManager`: A class for managing model versions and deployment.
*   `PerformanceProfiler`: A class for profiling the performance and resource usage of the models.
*   `calculate_prediction_intervals_quantile`: A function for calculating prediction intervals using the quantile method.
*   `detect_prediction_drift`: A function for detecting drift in model predictions.

The file is well-structured and provides a comprehensive set of tools for working with the ML models.

## SHAP Explainer

The `ml-service/src/utils/shap_explainer.py` file defines the `SHAPExplainer` class, which is responsible for explaining the ML models using SHAP (SHapley Additive exPlanations). The class is responsible for:

*   Fitting a SHAP explainer to a trained model and background data.
*   Explaining a single instance or a batch of instances.
*   Providing a fallback explanation when SHAP is not available.
*   Getting a global feature importance summary from the SHAP values.
*   Saving and loading the fitted explainer.

The file also includes functions for creating SHAP summary plots and waterfall plots.

The class is well-structured and provides a comprehensive set of tools for explaining the ML models.

## Backup Script

The `scripts/backup.sh` script is a simple but effective script for creating backups of the application's data. It creates a compressed tarball of the SQLite database and the uploads directory. It also includes a retention policy to delete old backups. The script is well-commented and easy to understand.

## Restore Script

The `scripts/restore.sh` script is a well-structured script for restoring the application's data from a backup. It takes a backup file as an argument, validates it, and then restores the database and uploads. It also includes a safety feature to back up the current data before restoring. The script is well-commented and easy to understand.

## Development Workflow

The `CLAUDE.md` file provides some context on the development workflow. It mentions that the agent should automatically commit changes with descriptive messages, and that it should always run the linter and type checker before completing any task.

## Authentication Data Cleanup Utility

The `clear-auth-data.js` file is a utility script for clearing all authentication-related data from the browser's local storage and session storage. It's designed to be used in emergency situations where corrupted authentication data is causing login issues. The script is well-commented and provides clear instructions on how to use it.

## PMO Login Test Utility

The `test-pmo-login.js` file is a utility script for quickly logging in and testing the PMO page functionality. It clears any existing authentication data, logs in with admin credentials, and then redirects to the PMO page. The script is well-commented and provides clear instructions on how to use it.

## Nginx Configuration

The `frontend/nginx.conf` file configures the Nginx web server for the frontend application. It defines the following:

*   **Worker Processes:** It sets the number of worker processes to `auto`.
*   **Events:** It sets the number of worker connections to `1024`.
*   **HTTP:** It includes the mime types, defines the log format, enables gzip compression, and sets up the server.
*   **Server:** It listens on port 80, sets the server name to `localhost`, sets the root directory to `/usr/share/nginx/html`, and sets the index file to `index.html`.
*   **Security Headers:** It adds several security headers to the responses.
*   **React Router:** It configures the server to handle React Router's client-side routing.
*   **Static Assets:** It configures the server to cache static assets for one year.
*   **API Proxy:** It proxies API requests to the backend server at `http://backend:3001`.
*   **Health Check:** It defines a health check endpoint that returns a `200` status code and the text "healthy".
*   **Sensitive Files:** It denies access to sensitive files, such as `.ht` files.

The configuration is well-structured and follows best practices for serving a React application with Nginx.

## Authentication Store

The `frontend/src/store/authStore.ts` file defines the authentication store for the frontend application. It uses Zustand for state management and `zustand/middleware` for persisting the state to local storage. The store is responsible for:

*   Storing the user's authentication status, user object, token, and permissions.
*   Providing actions for logging in, logging out, getting the current user, changing the password, and resetting the password.
*   Providing a `hasPermission` action for checking if the user has a specific permission.

The store is well-structured and provides a clean interface for managing authentication state.

## Protected Route

The `frontend/src/components/auth/ProtectedRoute.tsx` file defines a `ProtectedRoute` component that is used to protect routes that require authentication. It checks if the user is authenticated and if they have the required roles and permissions to access the route. If the user is not authenticated, it redirects them to the login page. If the user is authenticated but does not have the required roles or permissions, it redirects them to an unauthorized page. The component also handles the case where the user has a token but no user data, in which case it fetches the user's profile.

## Application Layout

The `frontend/src/components/common/AppLayout.tsx` file defines the main layout of the application. It uses the `Layout` component from Ant Design to create a header, sider, and content area. The sider contains the main navigation menu, which is dynamically generated based on the user's role. The header contains the page title, a notification icon, and a user dropdown menu. The content area displays the page content.

## Dashboard Page

The `frontend/src/pages/dashboard/DashboardPage.tsx` file defines the dashboard page of the application. It displays a welcome message, a set of statistics cards, a table of recent projects, and a set of quick actions. The dashboard is personalized based on the user's role. For example, team leads can see the ROI dashboard, while developers and operations staff can see their tasks and log time. The page is well-structured and provides a good overview of the application's data.

## Projects Page

The `frontend/src/pages/projects/ProjectsPage.tsx` file defines the projects page of the application. It displays a list of projects, with options for searching, filtering, and creating new projects. The page also includes a set of statistics cards that provide an overview of the projects. The page is well-structured and provides a good user experience.

## Project Detail Page

The `frontend/src/pages/projects/ProjectDetailPage.tsx` file defines the project detail page of the application. It displays a detailed overview of a project, including its status, priority, progress, and tasks. The page also includes tabs for viewing the project's files, evidence gallery, AI analytics, and PMO analytics. The page is well-structured and provides a comprehensive view of a project.

## Tasks Page

The `frontend/src/pages/tasks/TasksPage.tsx` file defines the tasks page of the application. It displays a Kanban board with columns for each task status. Users can drag and drop tasks between columns to update their status. The page also includes options for creating new tasks, editing existing tasks, and filtering tasks by project. The page is well-structured and provides a good user experience for managing tasks.

## Time Tracking Page

The `frontend/src/pages/time/TimeTrackingPage.tsx` file defines the time tracking page of the application. It allows users to track their time by starting and stopping a timer, or by manually creating time entries. The page also displays a dashboard with statistics for the current day and week, as well as a table of time entries for the selected date. The page is well-structured and provides a good user experience for tracking time.

## Ideas Page

The `frontend/src/pages/ideas/IdeasPage.tsx` file defines the ideas page of the application. It displays a list of ideas, with options for searching, filtering, sorting, and creating new ideas. The page also includes a set of statistics cards that provide an overview of the ideas. Users can vote on ideas, and view and add comments. The page is well-structured and provides a good user experience for managing ideas.

## Files Page

The `frontend/src/pages/files/FilesPage.tsx` file defines the files page of the application. It uses the `FileManager` component to display a file manager that allows users to upload, organize, and manage files. The page is well-structured and provides a good user experience for managing files.

## Support Page

The `frontend/src/pages/support/SupportPage.tsx` file defines the support page of the application. It includes a dashboard with key metrics, a table of support companies, and a table of support tickets. Users can create, edit, and delete companies and tickets. The page also includes a feature for importing tickets from an Excel file. The page is well-structured and provides a comprehensive set of tools for managing customer support.

## PMO Dashboard Page

The `frontend/src/pages/pmo/PMODashboard.tsx` file defines the PMO dashboard page of the application. It displays a high-level overview of all projects, with key metrics and visualizations. The page includes a dashboard with KPIs, a table of projects with their health status, a timeline of upcoming milestones, and a team workload summary. It also includes an analytics tab with more detailed information on budget, schedule, risk, and team performance. The page is well-structured and provides a comprehensive set of tools for project management.

## Team Management Page

The `frontend/src/pages/admin/TeamManagementPage.tsx` file defines the team management page of the application. It displays a table of users, with options for creating, editing, and deleting users. The page also includes a set of statistics cards that provide an overview of the team. The page is well-structured and provides a good user experience for managing users.

## Profile Page

The `frontend/src/pages/profile/ProfilePage.tsx` file defines the profile page of the application. It displays the user's profile information, including their name, email, and role. It also allows the user to change their password. The page is well-structured and provides a good user experience for managing user profiles.

## Login Page

The `frontend/src/pages/auth/LoginPage.tsx` file defines the login page of the application. It displays the `LoginForm` component and redirects to the dashboard if the user is already authenticated.

## Login Form

The `frontend/src/components/auth/LoginForm.tsx` file defines the login form component. It includes fields for email and password, a submit button, and an alert for displaying login errors. It also includes a feature for showing and filling in demo credentials. The component is well-structured and provides a good user experience for logging in.

## Project Card

The `frontend/src/components/projects/ProjectCard.tsx` file defines the `ProjectCard` component, which is used to display a project in a card format. It displays the project's name, description, status, priority, progress, and other information. It also includes a dropdown menu with actions for viewing, editing, and deleting the project. The component is well-structured and provides a good user experience for viewing project information.

## Project ROI Card

The `frontend/src/components/projects/ProjectROICard.tsx` file defines the `ProjectROICard` component, which is used to display the return on investment (ROI) for a project. It displays the project's sale price, cost, profit, and ROI. It also includes a set of alerts that are triggered when certain thresholds are met. The component is well-structured and provides a good overview of the project's financial performance.

## Create Project Modal

The `frontend/src/components/projects/CreateProjectModal.tsx` file defines the `CreateProjectModal` component, which is used to create and edit projects. It includes a form with fields for the project's name, description, status, priority, budget, and other information. The component is well-structured and provides a good user experience for creating and editing projects.

## Create Idea Modal

The `frontend/src/components/ideas/CreateIdeaModal.tsx` file defines the `CreateIdeaModal` component, which is used to create and edit ideas. It includes a form with fields for the idea's title, description, category, impact score, effort score, and status. The component is well-structured and provides a good user experience for creating and editing ideas.

## Idea Comments Modal

The `frontend/src/components/ideas/IdeaCommentsModal.tsx` file defines the `IdeaCommentsModal` component, which is used to display and add comments to an idea. It includes a text area for adding new comments and a list of existing comments. The component is well-structured and provides a good user experience for managing idea comments.

## Idea Priority Matrix

The `frontend/src/components/ideas/IdeaPriorityMatrix.tsx` file defines the `IdeaPriorityMatrix` component, which is used to display a priority matrix of ideas. The matrix is a 2x2 grid that plots ideas based on their impact and effort scores. The component is well-structured and provides a good user experience for visualizing the priority of ideas.

## Common Components

The `frontend/src/components/common/index.ts` file exports the `PriorityMatrix` component and its related types. This suggests that the `PriorityMatrix` is a reusable component that is used in other parts of the application.

## File Manager

The `frontend/src/components/files/FileManager.tsx` file defines the `FileManager` component, which is used to manage files. It includes a file list and an upload tab. The file list displays a list of files, with options for filtering, searching, and deleting files. The upload tab allows users to upload new files. The component is well-structured and provides a good user experience for managing files.

## File List

The `frontend/src/components/files/FileList.tsx` file defines the `FileList` component, which is used to display a list of files. It includes options for filtering, searching, and deleting files. It also displays information about each file, such as its size, type, and upload date. The component is well-structured and provides a good user experience for managing files.

## File Error Boundary

The `frontend/src/components/files/FileErrorBoundary.tsx` file defines a `FileErrorBoundary` component that is used to catch errors in the file upload component. It displays an error message and a "Try Again" button when an error occurs. This is a good practice for handling errors in a React application.

## Excel Import Modal

The `frontend/src/components/support/ExcelImportModal.tsx` file defines the `ExcelImportModal` component, which is used to import tickets from an Excel file. It includes a three-step process for uploading a file, mapping the fields, and viewing the import results. The component is well-structured and provides a good user experience for importing data from an Excel file.

## File Upload

The `frontend/src/components/files/FileUpload.tsx` file defines the `FileUpload` component, which is used to upload files. It includes a drag-and-drop area for selecting files, a file list for displaying the selected files, and an upload button. The component also includes options for adding a description and setting the visibility of the uploaded files. The component is well-structured and provides a good user experience for uploading files.

## Project Store

The `frontend/src/store/projectStore.ts` file defines the project store for the frontend application. It uses Zustand for state management. The store is responsible for:

*   Storing the list of projects, the selected project, the loading state, and any errors.
*   Providing actions for fetching, creating, updating, and deleting projects.
*   Providing actions for setting the selected project, loading state, and error.

The store is well-structured and provides a clean interface for managing project state.

## Idea Store

The `frontend/src/store/ideaStore.ts` file defines the idea store for the frontend application. It uses Zustand for state management. The store is responsible for:

*   Storing the list of ideas, the selected idea, the comments for the selected idea, the idea statistics, the loading state, and any errors.
*   Providing actions for fetching, creating, updating, and deleting ideas.
*   Providing actions for voting on ideas, fetching and creating idea comments, and fetching idea statistics.
*   Providing actions for setting the selected idea, loading state, and error.

The store is well-structured and provides a clean interface for managing idea state.

## Project Data Types

The `frontend/src/types/project.ts` file defines the data types for the project-related data. It includes interfaces for `Project`, `TaskBoard`, `TaskColumn`, `Task`, and `TaskDependency`. It also defines enums for `ProjectStatus`, `Priority`, `TaskType`, and `TaskStatus`. The file is well-structured and provides a clear and consistent data model for the project-related data.

## Authentication Data Types

The `frontend/src/types/auth.ts` file defines the data types for the authentication-related data. It includes interfaces for `User`, `LoginCredentials`, `LoginResponse`, and `AuthState`. It also defines an enum for `UserRole` and a set of labels and colors for each role. The file is well-structured and provides a clear and consistent data model for the authentication-related data.

## Idea Data Types

The `frontend/src/types/idea.ts` file defines the data types for the idea-related data. It includes interfaces for `Idea`, `IdeaVote`, `IdeaComment`, `IdeaStats`, `CreateIdeaRequest`, `UpdateIdeaRequest`, and `IdeaFilters`. It also defines enums for `IdeaCategory` and `IdeaStatus`. The file is well-structured and provides a clear and consistent data model for the idea-related data.

## Batch Operation Data Types

The `frontend/src/types/batch-operations.ts` file defines the data types for the batch deletion operations. It includes interfaces for `BatchDeletionConfig`, `BatchDeletionItem`, `BatchDeletionResult`, `BatchOperationPromiseResult`, `BatchDeletionSummary`, `BatchDeletionService`, `ValidationResult`, `CategorizedItems`, and `UserMessage`. It also defines an enum for `BatchErrorCode` and a set of configuration constants. The file is well-structured and provides a clear and consistent data model for the batch deletion operations.

## Utility Functions

The `frontend/src/utils/colorMappings.ts` file defines a set of color mappings for different states and categories in the application. It includes color mappings for project status, task status, idea status, support ticket status, priority, file status, and user roles. It also includes a set of generic status colors and a set of colors for progress and financial metrics. The file is well-structured and provides a centralized place for managing the application's color scheme.

## Batch Deletion Hook

The `frontend/src/hooks/useBatchDeletion.ts` file defines a custom hook for managing batch deletion operations. It encapsulates the logic for validating the selection, categorizing the items, executing the batch deletion, and providing user feedback. The hook is well-structured and provides a clean interface for components that need to perform batch deletions.

## Gantt Data Hook

The `frontend/src/hooks/useGanttData.ts` file defines a custom hook for managing Gantt data. It encapsulates the logic for fetching, loading, and refreshing Gantt data. It also includes features for debouncing, deduplication, and error handling. The hook is well-structured and provides a clean interface for components that need to display Gantt charts.

## Batch Deletion Service

The `frontend/src/services/batch-deletion.service.ts` file defines a `BatchDeletionServiceImpl` class that provides a set of methods for handling batch deletion operations. It includes methods for validating the selection, categorizing the items, executing the batch deletion, and generating user feedback. The class is well-structured and provides a clean interface for components that need to perform batch deletions.

## Project ML Analytics

The `frontend/src/components/projects/ProjectMLAnalytics.tsx` file defines the `ProjectMLAnalytics` component, which is used to display the machine learning analytics for a project. It includes predictions for completion time, budget variance, and risk score. It also includes explanations for the predictions, such as feature importance. The component is well-structured and provides a good user experience for understanding the ML predictions.

## Project PMO View

The `frontend/src/components/projects/ProjectPMOView.tsx` file defines the `ProjectPMOView` component, which is used to display a detailed PMO (Project Management Office) view of a project. It includes performance metrics, risk assessment, hours tracking, quality metrics, and a timeline of milestones. The component is well-structured and provides a comprehensive set of tools for project management.

## Project Priority Matrix

The `frontend/src/components/projects/ProjectPriorityMatrix.tsx` file defines the `ProjectPriorityMatrix` component, which is used to display a priority matrix of projects based on their ROI and complexity. It fetches ROI data for each project and then plots them on a 2x2 grid. The component is well-structured and provides a good user experience for visualizing project priorities.

## Task Priority Matrix

The `frontend/src/components/tasks/TaskPriorityMatrix.tsx` file defines the `TaskPriorityMatrix` component, which is used to display a priority matrix of tasks based on their urgency and impact. It calculates urgency based on due date and priority, and impact based on task type, story points, and estimated hours. The component is well-structured and provides a good user experience for visualizing task priorities.
