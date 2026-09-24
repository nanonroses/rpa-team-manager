import express from 'express';
import { TaskController } from '../controllers/taskController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createTaskSchema } from '../validation/schemas';

const router = express.Router();
const taskController = new TaskController();

// Task Boards
router.get('/tasks/boards', authenticate, taskController.getBoards);
router.get('/tasks/boards/:id', authenticate, taskController.getBoard);
router.post('/tasks/boards', authenticate, taskController.createBoard);

// Tasks CRUD
router.get('/tasks', authenticate, taskController.getTasks);
router.post('/tasks', authenticate, validate({ body: createTaskSchema }), taskController.createTask);

// Specific routes MUST come before parameterized routes
router.post('/tasks/batch', authenticate, taskController.batchCreateTasks);
router.delete('/tasks/batch', authenticate, taskController.batchDeleteTasks);

// Parameterized routes come after specific routes
router.put('/tasks/:id', authenticate, taskController.updateTask);
router.delete('/tasks/:id', authenticate, taskController.deleteTask);

// Task operations
router.post('/tasks/:id/move', authenticate, taskController.moveTask);
router.get('/tasks/:id/activity', authenticate, taskController.getTaskActivity);

// Subtareas (checklist liviano) - path de 3 segmentos, no colisiona con /tasks/:id
router.get('/tasks/:taskId/subtasks', authenticate, taskController.getTaskSubtasks);
router.post('/tasks/:taskId/subtasks', authenticate, taskController.createTaskSubtask);
router.patch('/tasks/:taskId/subtasks/:subtaskId', authenticate, taskController.updateTaskSubtask);
router.delete('/tasks/:taskId/subtasks/:subtaskId', authenticate, taskController.deleteTaskSubtask);

// Comentarios con @menciones - path de 3 segmentos, no colisiona con /tasks/:id
router.get('/tasks/:taskId/comments', authenticate, taskController.getTaskComments);
router.post('/tasks/:taskId/comments', authenticate, taskController.createTaskComment);
router.patch('/tasks/:taskId/comments/:commentId', authenticate, taskController.updateTaskComment);
router.delete('/tasks/:taskId/comments/:commentId', authenticate, taskController.deleteTaskComment);

router.get('/tasks/my-tasks', authenticate, taskController.getMyTasks);
router.get('/tasks/project/:projectId', authenticate, taskController.getProjectTasks);

// IMPORTANTE: va después de /tasks/my-tasks y /tasks/project/:projectId (rutas literales de un
// segmento bajo /tasks/) para que Express no las capture como si "my-tasks" fuera un :id.
router.get('/tasks/:id', authenticate, taskController.getTaskById);

export { router as taskRoutes };