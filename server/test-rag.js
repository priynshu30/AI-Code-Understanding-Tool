import { parseGitHubUrl, getRepoMetadata, fetchRepoFileTree, fetchFileContent } from './src/services/githubService.js';
import { chunkFile } from './src/services/chunkingService.js';
import { generateBatchEmbeddings } from './src/services/embeddingService.js';
import { retrieveRelevantCode, streamRAGResponse } from './src/services/ragService.js';
import { storeSaveChunks, storeCreateRepo } from './src/services/storeService.js';

async function testPipeline() {
  console.log('🧪 Testing GitHub Ingestion, Chunking & RAG Retrieval...');

  const repoUrl = 'https://github.com/trimstray/the-book-of-secret-knowledge';
  const { owner, repo } = parseGitHubUrl(repoUrl);
  console.log(`1. Parsed Repo: ${owner}/${repo}`);

  const metadata = await getRepoMetadata(owner, repo);
  console.log(`2. Metadata: branch=${metadata.defaultBranch}, desc=${metadata.description}`);

  const tree = await fetchRepoFileTree(owner, repo, metadata.defaultBranch);
  console.log(`3. Total Files: ${tree.totalFiles}, Indexable: ${tree.indexableFiles.length}`);
  console.log('Files list:', tree.indexableFiles.map(f => f.path));

  const chunks = [];
  for (const file of tree.indexableFiles) {
    const content = await fetchFileContent(owner, repo, tree.defaultBranch || metadata.defaultBranch, file.path);
    if (content) {
      const fileChunks = chunkFile(file.path, content);
      console.log(`   Indexed ${file.path}: ${fileChunks.length} chunks`);
      chunks.push(...fileChunks);
    }
  }

  console.log(`4. Total Chunks generated: ${chunks.length}`);

  const repoDoc = await storeCreateRepo({
    userId: '66a000000000000000000001',
    repoUrl,
    repoName: repo,
    owner,
    status: 'ready',
    fileCount: tree.indexableFiles.length,
    chunkCount: chunks.length
  });

  const texts = chunks.map(c => `File: ${c.filePath}\nLanguage: ${c.language}\n${c.content}`);
  const embeddings = await generateBatchEmbeddings(texts, 50);

  const chunkDocs = chunks.map((c, idx) => ({
    repoId: repoDoc._id,
    filePath: c.filePath,
    content: c.content,
    embedding: embeddings[idx],
    startLine: c.startLine,
    endLine: c.endLine,
    language: c.language,
    chunkType: c.chunkType,
    identifier: c.identifier
  }));

  await storeSaveChunks(repoDoc._id, chunkDocs);
  console.log('5. Chunks saved to store successfully.');

  // Test question retrieval
  const query = 'What are the best CLI tools mentioned for network discovery and packet analysis?';
  console.log(`\n6. Testing RAG Retrieval for Query: "${query}"`);
  const retrieved = await retrieveRelevantCode(repoDoc._id, query, 3);

  console.log(`Retrieved ${retrieved.length} chunks:`);
  retrieved.forEach((r, i) => {
    console.log(`\n[Chunk ${i + 1}] File: ${r.filePath} (L${r.startLine}-L${r.endLine}) - Score: ${r.score?.toFixed(3)}`);
    console.log(`Snippet: ${r.content.slice(0, 180)}...`);
  });

  console.log('\n✅ Pipeline Test Completed Successfully!');
}

testPipeline().catch(console.error);
