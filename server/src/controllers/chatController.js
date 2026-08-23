import {
  storeFindRepo,
  storeCreateChatHistory,
  storeFindChatHistory
} from '../services/storeService.js';
import { retrieveRelevantCode, streamRAGResponse } from '../services/ragService.js';

// @desc    Ask a question about a repository (Streams response via SSE)
// @route   POST /api/repos/:id/chat
// @access  Private
export const askQuestionStream = async (req, res) => {
  const repoId = req.params.id;
  const userId = req.user?.id || '66a000000000000000000001';
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Please provide a valid question.' });
  }

  try {
    // 1. Verify repository status
    const repo = await storeFindRepo({ _id: repoId });
    if (!repo) {
      return res.status(404).json({ success: false, message: 'Repository not found or access denied.' });
    }

    if (repo.status === 'indexing') {
      return res.status(400).json({
        success: false,
        message: `Repository is still indexing. Please wait a few moments.`
      });
    }

    // 2. Retrieve Top-K Code Chunks via Vector Search
    const retrievedChunks = await retrieveRelevantCode(repo._id || repoId, question, 5);

    const sources = retrievedChunks.map((chunk) => ({
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      snippet: chunk.content.slice(0, 250)
    }));

    // 3. Set SSE HTTP Response Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial sources metadata event
    res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);

    let accumulatedAnswer = '';

    // 4. Stream Tokens from LLM
    await streamRAGResponse({
      repoName: repo.repoName,
      question,
      retrievedChunks,
      onToken: (token) => {
        accumulatedAnswer += token;
        res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
      },
      onComplete: async (fullAnswer) => {
        // 5. Save Q&A to Chat History
        try {
          const chatDoc = await storeCreateChatHistory({
            userId,
            repoId: repo._id || repoId,
            question,
            answer: fullAnswer || accumulatedAnswer,
            sources
          });

          res.write(
            `data: ${JSON.stringify({
              type: 'done',
              chatId: chatDoc?._id || 'chat_done',
              sources
            })}\n\n`
          );
        } catch (dbErr) {
          res.write(`data: ${JSON.stringify({ type: 'done', sources })}\n\n`);
        }
        res.end();
      },
      onError: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
      }
    });
  } catch (error) {
    console.error('[Chat Stream Error]:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
};

// @desc    Get chat history for a specific repository
// @route   GET /api/repos/:id/chat/history
// @access  Private
export const getChatHistory = async (req, res) => {
  try {
    const { id: repoId } = req.params;
    const history = await storeFindChatHistory(repoId, req.user?.id);

    res.status(200).json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat history',
      error: error.message
    });
  }
};
