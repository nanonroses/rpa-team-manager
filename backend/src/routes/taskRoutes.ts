import express from 'express';
import { TaskController } from '../controllers/taskController';
import { authenticate } from '../middleware/auth';

const router = express.Router();
const taskController = new TaskController();

// Task Boards
router.get('/tasks/boards', authenticate, taskController.getBoards);
router.get('/tasks/boards/:id', authenticate, taskController.getBoard);
router.post('/tasks/boards', authenticate, taskController.createBoard);

// Tasks CRUD
router.get('/tasks', authenticate, taskController.getTasks);
router.post('/tasks', authenticate, taskController.createTask);
router.put('/tasks/:id', authenticate, taskController.updateTask);
router.delete('/tasks/:id', authenticate, taskController.deleteTask);

// Task operations
router.post('/tasks/:id/move', authenticate, taskController.moveTask);
router.get('/tasks/my-tasks', authenticate, taskController.getMyTasks);
router.get('/tasks/project/:projectId', authenticate, taskController.getProjectTasks);

export { router as taskRoutes };