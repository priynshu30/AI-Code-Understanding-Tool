import express from 'express';
import {
  submitRepo,
  getUserRepos,
  getRepoStatus,
  getRepoSummary,
  getRepoFiles,
  deleteRepo
} from '../controllers/repoController.js';
import { askQuestionStream, getChatHistory } from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all repository routes
router.use(protect);

router.route('/')
  .post(submitRepo)
  .get(getUserRepos);

router.route('/:id')
  .delete(deleteRepo);

router.get('/:id/status', getRepoStatus);
router.get('/:id/summary', getRepoSummary);
router.get('/:id/files', getRepoFiles);

// Chat & Streaming routes
router.post('/:id/chat', askQuestionStream);
router.get('/:id/chat/history', getChatHistory);

export default router;
