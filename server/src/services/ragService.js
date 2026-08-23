import mongoose from 'mongoose';
import OpenAI from 'openai';
import { storeFindChunks } from './storeService.js';
import {
  generateQueryEmbedding,
  cosineSimilarity,
  extractTerms,
  calculateKeywordScore
} from './embeddingService.js';

let openaiClient = null;

const getOpenAIClient = () => {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openaiClient;
};

/**
 * Strips messy raw HTML markup for cleaner reading
 */
const cleanSnippetText = (text) => {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p>/gi, '\n')
    .replace(/<\/?sup>/gi, '')
    .replace(/\[TOC\]/gi, '')
    .replace(/<a\s+href="([^"]+)"><b>([^<]+)<\/b><\/a>/gi, '[$2]($1)')
    .replace(/<a\s+href="([^"]+)">([^<]+)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '')
    .trim();
};

/**
 * Retrieves top-K most relevant code/doc chunks using Hybrid Vector + Keyword Search
 */
export const retrieveRelevantCode = async (repoId, query, topK = 5) => {
  const queryEmbedding = await generateQueryEmbedding(query);
  const queryTerms = extractTerms(query);

  let retrievedChunks = [];

  // 1. Try MongoDB Atlas Vector Search if active
  if (mongoose.connection.readyState === 1) {
    try {
      const CodeChunk = mongoose.model('CodeChunk');
      const atlasResults = await CodeChunk.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: Math.max(topK * 10, 50),
            limit: topK,
            filter: {
              repoId: new mongoose.Types.ObjectId(repoId)
            }
          }
        },
        {
          $project: {
            filePath: 1,
            content: 1,
            startLine: 1,
            endLine: 1,
            language: 1,
            chunkType: 1,
            identifier: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ]);

      if (atlasResults && atlasResults.length > 0) {
        retrievedChunks = atlasResults;
      }
    } catch (vectorSearchErr) {
      // Fall through to in-memory store
    }
  }

  // 2. Hybrid In-Memory Ranking (Cosine Vector Similarity + Keyword Score)
  if (retrievedChunks.length === 0) {
    const allChunks = await storeFindChunks(repoId);
    if (!allChunks || allChunks.length === 0) return [];

    const scored = allChunks.map((chunk) => {
      const cosSim = cosineSimilarity(queryEmbedding, chunk.embedding);
      const kwScore = calculateKeywordScore(queryTerms, chunk.content, chunk.filePath);
      const finalScore = cosSim * 0.5 + kwScore * 0.5;

      return {
        ...chunk,
        score: finalScore
      };
    });

    scored.sort((a, b) => b.score - a.score);
    retrievedChunks = scored.slice(0, topK);
  }

  return retrievedChunks;
};

/**
 * Formats retrieved code chunks into structured LLM Context
 */
export const formatCodeContext = (chunks) => {
  if (!chunks || chunks.length === 0) {
    return 'No directly matching source code was found in the indexed repository.';
  }

  return chunks
    .map((chunk, index) => {
      return `--- CONTEXT CHUNK #${index + 1} ---
File: ${chunk.filePath}
Lines: ${chunk.startLine}-${chunk.endLine}
Type: ${chunk.chunkType} (${chunk.identifier || 'anonymous'})
Language: ${chunk.language}
Code:
\`\`\`${chunk.language}
${chunk.content}
\`\`\`
------------------------------`;
    })
    .join('\n\n');
};

/**
 * Streams answer generation using OpenAI GPT-4o-mini (or clean synthesized fallback)
 */
export const streamRAGResponse = async ({
  repoName,
  question,
  retrievedChunks,
  onToken,
  onComplete,
  onError
}) => {
  const contextString = formatCodeContext(retrievedChunks);

  const systemPrompt = `You are RepoMind, an elite AI Software Architect and Code Intelligence Assistant.
You are helping a developer understand the codebase of repository: "${repoName}".

CRITICAL INSTRUCTIONS:
1. Answer strictly and accurately using the provided code snippets in the CONTEXT.
2. Every major explanation MUST reference the source file and line numbers (e.g. \`[src/auth/jwt.js:L12-L24]\`).
3. If the context does not contain enough information to answer definitively, honestly state what is missing instead of hallucinating guesses.
4. Format your response cleanly using GitHub-flavored Markdown with syntax highlighted code blocks.
5. Provide concise, high-signal explanations with architectural insights.`;

  const userPrompt = `USER QUESTION:
${question}

RETRIEVED CODE CONTEXT:
${contextString}

Provide a clear, in-depth, and well-cited explanation:`;

  const client = getOpenAIClient();

  if (!client) {
    // Clean formatted synthesized fallback
    let fallbackText = `### 🔍 Analysis for "${question}" in **${repoName}**\n\n`;
    if (retrievedChunks.length > 0) {
      fallbackText += `Based on the repository index, here are the most relevant tools and implementations found:\n\n`;
      retrievedChunks.forEach((c, idx) => {
        const title = c.identifier ? ` - **${c.identifier}**` : '';
        const cleaned = cleanSnippetText(c.content).slice(0, 350);
        fallbackText += `#### 📌 Source ${idx + 1}: \`${c.filePath}\` (Lines ${c.startLine}–${c.endLine})${title}\n\n`;
        fallbackText += `${cleaned}...\n\n`;
      });
      fallbackText += `> **💡 Key Takeaway**: The sections above contain the primary references for "${question}". You can click any citation badge below to view the exact lines in GitHub.`;
    } else {
      fallbackText += `No matching indexed files found for "${question}". Try refining your query or re-indexing the repository.`;
    }

    const words = fallbackText.split(' ');
    for (let i = 0; i < words.length; i++) {
      onToken(words[i] + ' ');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    onComplete(fallbackText);
    return;
  }

  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      stream: true
    });

    let fullAnswer = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullAnswer += delta;
        onToken(delta);
      }
    }

    onComplete(fullAnswer);
  } catch (error) {
    console.error('[RAG Stream Error]:', error.message);
    onError(error);
  }
};

/**
 * Generates an automated repository architectural summary
 */
export const generateRepoSummary = async ({ repoName, description, sampleFiles }) => {
  const client = getOpenAIClient();

  if (!client) {
    return `### 📖 Summary of ${repoName}
- **Overview**: ${description || 'Public GitHub Repository'}
- **Indexed Modules**: ${sampleFiles.slice(0, 10).join(', ')}
- **Architecture**: Comprehensive technical repository with indexed topics and vector search capabilities.`;
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a software architect. Write a concise, 3-section architectural summary of this GitHub repository based on its name, description, and file list: 1. Purpose 2. Tech Stack & Directory Breakdown 3. Getting Started / Key Entry Points.'
        },
        {
          role: 'user',
          content: `Repo: ${repoName}\nDescription: ${description}\nFiles:\n${sampleFiles.slice(0, 40).join('\n')}`
        }
      ],
      temperature: 0.3
    });

    return response.choices[0]?.message?.content || 'Summary unavailable.';
  } catch (error) {
    return `Summary generation error: ${error.message}`;
  }
};
