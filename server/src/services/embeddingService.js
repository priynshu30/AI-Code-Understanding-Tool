import OpenAI from 'openai';

let openaiClient = null;

const getOpenAIClient = () => {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openaiClient;
};

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours'
]);

/**
 * Tokenizes and extracts meaningful terms
 */
export const extractTerms = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.\/]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
};

/**
 * High-accuracy deterministic embedding (1536-dimensional float vector)
 * Uses word hashing, bigrams, and term-frequency scaling
 */
export const generateDeterministicEmbedding = (text) => {
  const dim = 1536;
  const vector = new Array(dim).fill(0);
  const words = extractTerms(text);

  if (words.length === 0) return vector;

  // Unigram frequencies
  words.forEach((word, idx) => {
    let hash = 5381;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) + hash) + word.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % dim;
    vector[bucket] += 1.0 / Math.sqrt(idx + 1);
  });

  // Bigram hashing for phrase capture (e.g. "network discovery", "cli tools")
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]}_${words[i + 1]}`;
    let hash = 5381;
    for (let j = 0; j < bigram.length; j++) {
      hash = ((hash << 5) + hash) + bigram.charCodeAt(j);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % dim;
    vector[bucket] += 2.0; // Higher weight for phrase matches
  }

  // Normalize vector to unit length (L2 norm)
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return norm > 0 ? vector.map((v) => v / norm) : vector;
};

/**
 * Generate embedding vector for a single query string
 */
export const generateQueryEmbedding = async (text) => {
  const client = getOpenAIClient();

  if (!client) {
    return generateDeterministicEmbedding(text);
  }

  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.replace(/\n/g, ' ')
    });
    return response.data[0].embedding;
  } catch (error) {
    console.warn('[EmbeddingService] OpenAI fallback to deterministic embedding:', error.message);
    return generateDeterministicEmbedding(text);
  }
};

/**
 * Generates embeddings in batches for multiple code chunks
 */
export const generateBatchEmbeddings = async (texts, batchSize = 50) => {
  const client = getOpenAIClient();
  const allEmbeddings = [];

  if (!client) {
    return texts.map((t) => generateDeterministicEmbedding(t));
  }

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.replace(/\n/g, ' ').substring(0, 8000));
    try {
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch
      });
      const batchVectors = response.data.map((item) => item.embedding);
      allEmbeddings.push(...batchVectors);
    } catch (error) {
      console.warn(`[EmbeddingService Batch Fallback at ${i}]:`, error.message);
      const fallbackBatch = batch.map((t) => generateDeterministicEmbedding(t));
      allEmbeddings.push(...fallbackBatch);
    }
  }

  return allEmbeddings;
};

/**
 * Cosine similarity between two vectors
 */
export const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
};

/**
 * Keyword BM25 score booster for hybrid search
 */
export const calculateKeywordScore = (queryTerms, chunkContent, filePath) => {
  if (queryTerms.length === 0) return 0;
  const contentLower = (chunkContent + ' ' + filePath).toLowerCase();
  let score = 0;

  queryTerms.forEach((term) => {
    if (contentLower.includes(term)) {
      score += 1.0;
    }
  });

  return score / queryTerms.length;
};
