import {
  storeFindRepo,
  storeFindUserRepos,
  storeCreateRepo,
  storeUpdateRepo,
  storeDeleteRepo,
  storeSaveChunks,
  storeFindChunks
} from '../services/storeService.js';
import { parseGitHubUrl, getRepoMetadata, fetchRepoFileTree, fetchFileContent } from '../services/githubService.js';
import { chunkFile } from '../services/chunkingService.js';
import { generateBatchEmbeddings } from '../services/embeddingService.js';
import { generateRepoSummary } from '../services/ragService.js';

/**
 * Worker that fetches, chunks, embeds, and indexes repo files
 */
const processRepoIndexing = async (repoId, owner, repoName, defaultBranch) => {
  try {
    console.log(`[Indexing] Starting ingestion for ${owner}/${repoName} (${repoId})...`);

    // 1. Fetch File Tree
    const treeData = await fetchRepoFileTree(owner, repoName, defaultBranch);
    const { commitSha, indexableFiles } = treeData;

    await storeUpdateRepo(repoId, {
      fileCount: indexableFiles.length,
      latestCommitSha: commitSha,
      status: 'indexing'
    });

    console.log(`[Indexing] Found ${indexableFiles.length} indexable files. Fetching and chunking...`);

    const allChunksToEmbed = [];

    // 2. Fetch and chunk files (limit to top 50 files for fast serverless execution)
    const filesToProcess = indexableFiles.slice(0, 50);
    for (const file of filesToProcess) {
      const content = await fetchFileContent(owner, repoName, defaultBranch, file.path);
      if (content) {
        const fileChunks = chunkFile(file.path, content);
        allChunksToEmbed.push(...fileChunks);
      }
    }

    console.log(`[Indexing] Generated ${allChunksToEmbed.length} chunks. Generating embeddings...`);

    // 3. Batch generate embeddings
    const chunkTexts = allChunksToEmbed.map((c) => `File: ${c.filePath}\nLanguage: ${c.language}\n${c.content}`);
    const embeddings = await generateBatchEmbeddings(chunkTexts, 50);

    // 4. Save chunks to Database / Store
    const chunkDocuments = allChunksToEmbed.map((chunk, index) => ({
      repoId,
      filePath: chunk.filePath,
      content: chunk.content,
      embedding: embeddings[index] || new Array(1536).fill(0),
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      language: chunk.language,
      chunkType: chunk.chunkType,
      identifier: chunk.identifier
    }));

    await storeSaveChunks(repoId, chunkDocuments);

    // 5. Generate Architecture Summary
    const samplePaths = indexableFiles.slice(0, 30).map((f) => f.path);
    const repoDoc = await storeFindRepo({ _id: repoId });
    const summary = await generateRepoSummary({
      repoName,
      description: repoDoc?.description || '',
      sampleFiles: samplePaths
    });

    // 6. Mark Ready
    const updated = await storeUpdateRepo(repoId, {
      status: 'ready',
      chunkCount: chunkDocuments.length,
      summary,
      indexedAt: new Date().toISOString()
    });

    console.log(`✅ [Indexing Complete] ${owner}/${repoName} indexed with ${chunkDocuments.length} chunks.`);
    return updated;
  } catch (error) {
    console.error(`❌ [Indexing Failed] ${owner}/${repoName}:`, error.message);
    await storeUpdateRepo(repoId, {
      status: 'failed',
      error: error.message
    });
  }
};

// @desc    Submit a GitHub repo to index
// @route   POST /api/repos
// @access  Private
export const submitRepo = async (req, res) => {
  try {
    const { repoUrl } = req.body;
    const userId = req.user?.id || '66a000000000000000000001';

    if (!repoUrl) {
      return res.status(400).json({ success: false, message: 'Please provide a repoUrl' });
    }

    const { owner, repo } = parseGitHubUrl(repoUrl);

    // Check if repo already exists
    let existingRepo = await storeFindRepo({ userId, repoName: repo, owner });

    if (existingRepo && existingRepo.status === 'ready') {
      return res.status(200).json({
        success: true,
        message: 'Repository already indexed',
        repo: existingRepo
      });
    }

    // Fetch repository metadata from GitHub
    const metadata = await getRepoMetadata(owner, repo);

    let targetRepo;
    if (existingRepo) {
      targetRepo = await storeUpdateRepo(existingRepo._id, {
        status: 'indexing',
        description: metadata.description,
        defaultBranch: metadata.defaultBranch,
        error: null
      });
    } else {
      targetRepo = await storeCreateRepo({
        userId,
        repoUrl: `https://github.com/${owner}/${repo}`,
        repoName: repo,
        owner,
        description: metadata.description,
        defaultBranch: metadata.defaultBranch,
        status: 'indexing'
      });
    }

    // On Serverless (Vercel), await indexing so function doesn't freeze before completing
    const completedRepo = await processRepoIndexing(targetRepo._id, owner, repo, metadata.defaultBranch);

    res.status(200).json({
      success: true,
      message: 'Repository indexed successfully',
      repo: completedRepo || targetRepo
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all indexed repositories for the authenticated user
// @route   GET /api/repos
// @access  Private
export const getUserRepos = async (req, res) => {
  try {
    const repos = await storeFindUserRepos(req.user?.id);
    res.status(200).json({
      success: true,
      count: repos.length,
      repos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve repositories',
      error: error.message
    });
  }
};

// @desc    Get status and details of a single repo
// @route   GET /api/repos/:id/status
// @access  Private
export const getRepoStatus = async (req, res) => {
  try {
    const repo = await storeFindRepo({ _id: req.params.id });
    if (!repo) {
      return res.status(404).json({ success: false, message: 'Repository not found' });
    }

    res.status(200).json({
      success: true,
      repo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching repo status',
      error: error.message
    });
  }
};

// @desc    Get repository auto-summary
// @route   GET /api/repos/:id/summary
// @access  Private
export const getRepoSummary = async (req, res) => {
  try {
    const repo = await storeFindRepo({ _id: req.params.id });
    if (!repo) {
      return res.status(404).json({ success: false, message: 'Repository not found' });
    }

    res.status(200).json({
      success: true,
      summary: repo.summary || 'Summary is being generated...'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving summary',
      error: error.message
    });
  }
};

// @desc    Get repository file list for tree viewer
// @route   GET /api/repos/:id/files
// @access  Private
export const getRepoFiles = async (req, res) => {
  try {
    const repo = await storeFindRepo({ _id: req.params.id });
    if (!repo) {
      return res.status(404).json({ success: false, message: 'Repository not found' });
    }

    const chunks = await storeFindChunks(repo._id);
    const uniqueFiles = [...new Set(chunks.map((c) => c.filePath))].sort();

    res.status(200).json({
      success: true,
      files: uniqueFiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching repo files',
      error: error.message
    });
  }
};

// @desc    Delete repository and its vector chunks & history
// @route   DELETE /api/repos/:id
// @access  Private
export const deleteRepo = async (req, res) => {
  try {
    const repo = await storeDeleteRepo(req.params.id, req.user?.id);
    if (!repo) {
      return res.status(404).json({ success: false, message: 'Repository not found' });
    }

    res.status(200).json({
      success: true,
      message: `Repository and indexed data deleted successfully.`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting repository',
      error: error.message
    });
  }
};
