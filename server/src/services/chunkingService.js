/**
 * Smart Code & Markdown Chunking Service
 *
 * Implements structural AST/Regex chunking for programming languages
 * and heading-based semantic chunking for Markdown documentation files,
 * with line-preserving sliding-window fallback.
 */

const EXTENSION_MAP = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  cpp: 'cpp',
  c: 'c',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  html: 'html',
  css: 'css',
  scss: 'scss',
  sql: 'sql',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  txt: 'plaintext',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'shell',
  bash: 'shell'
};

/**
 * Detect language by file extension
 */
export const detectLanguage = (filePath) => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return EXTENSION_MAP[ext] || 'plaintext';
};

/**
 * Detects structural code boundaries (functions, classes, interfaces, methods)
 */
const detectCodeDefinitions = (lines, language) => {
  const definitions = [];

  const patterns = {
    javascript: [
      { regex: /^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/, type: 'function' },
      { regex: /^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/, type: 'function' },
      { regex: /^(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/, type: 'class' },
      { regex: /^\s*(?:async\s+)?([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/, type: 'method' }
    ],
    typescript: [
      { regex: /^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/, type: 'function' },
      { regex: /^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/, type: 'function' },
      { regex: /^(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)/, type: 'class' },
      { regex: /^(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)/, type: 'struct' },
      { regex: /^\s*(?:public|private|protected)?\s*(?:async\s+)?([a-zA-Z0-9_$]+)\s*\([^)]*\)/, type: 'method' }
    ],
    python: [
      { regex: /^def\s+([a-zA-Z0-9_]+)\s*\(/, type: 'function' },
      { regex: /^\s{4}def\s+([a-zA-Z0-9_]+)\s*\(/, type: 'method' },
      { regex: /^class\s+([a-zA-Z0-9_]+)/, type: 'class' }
    ],
    go: [
      { regex: /^func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(/, type: 'function' },
      { regex: /^type\s+([a-zA-Z0-9_]+)\s+struct/, type: 'struct' },
      { regex: /^type\s+([a-zA-Z0-9_]+)\s+interface/, type: 'struct' }
    ],
    java: [
      { regex: /^(?:public|private|protected|static|\s)*class\s+([a-zA-Z0-9_$]+)/, type: 'class' },
      { regex: /^(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/, type: 'method' }
    ]
  };

  const activePatterns = patterns[language] || [];
  if (activePatterns.length === 0) return [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    for (const { regex, type } of activePatterns) {
      const match = trimmed.match(regex);
      if (match) {
        definitions.push({
          lineIndex: index,
          name: match[1] || 'anonymous',
          type
        });
        break;
      }
    }
  });

  return definitions;
};

/**
 * Detects Markdown section boundaries (headings #, ##, ###, ####)
 */
const detectMarkdownHeadings = (lines) => {
  const headings = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^(#{1,4})\s+(.+)/);
    if (match) {
      headings.push({
        lineIndex: index,
        name: match[2].replace(/[#*_`]/g, '').trim(),
        level: match[1].length,
        type: 'section'
      });
    }
  });
  return headings;
};

/**
 * Chunks a single file content into logical, line-indexed CodeChunks
 *
 * @param {string} filePath - Repository file path
 * @param {string} content - Raw file text
 * @param {object} options - Chunking options
 * @returns {Array<object>} - Array of chunks with line numbers
 */
export const chunkFile = (filePath, content, options = {}) => {
  const {
    maxChunkLines = 80,
    minChunkLines = 6,
    overlapLines = 12
  } = options;

  if (!content || typeof content !== 'string') {
    return [];
  }

  const lines = content.split('\n');
  const totalLines = lines.length;

  // Very small files (< maxChunkLines) become a single chunk
  if (totalLines <= maxChunkLines) {
    return [
      {
        filePath,
        content: content.trim(),
        startLine: 1,
        endLine: totalLines,
        language: detectLanguage(filePath),
        chunkType: 'general',
        identifier: filePath.split('/').pop()
      }
    ];
  }

  const language = detectLanguage(filePath);
  const isMarkdown = language === 'markdown';
  const chunks = [];

  if (isMarkdown) {
    // Markdown Section-based chunking
    const headings = detectMarkdownHeadings(lines);

    if (headings.length > 0) {
      for (let i = 0; i < headings.length; i++) {
        const currentHead = headings[i];
        const startIdx = currentHead.lineIndex;
        const nextHead = headings[i + 1];
        let endIdx = nextHead ? nextHead.lineIndex - 1 : totalLines - 1;

        // If section is very large, sub-chunk it
        if (endIdx - startIdx > maxChunkLines) {
          let subStart = startIdx;
          while (subStart <= endIdx) {
            let subEnd = Math.min(subStart + maxChunkLines - 1, endIdx);
            const chunkSlice = lines.slice(subStart, subEnd + 1).join('\n').trim();
            if (chunkSlice.length > 0) {
              chunks.push({
                filePath,
                content: chunkSlice,
                startLine: subStart + 1,
                endLine: subEnd + 1,
                language: 'markdown',
                chunkType: 'section',
                identifier: `${currentHead.name} (Part ${Math.floor((subStart - startIdx) / maxChunkLines) + 1})`
              });
            }
            if (subEnd >= endIdx) break;
            subStart = subEnd - overlapLines + 1;
          }
        } else {
          const chunkText = lines.slice(startIdx, endIdx + 1).join('\n').trim();
          if (chunkText.length > 0) {
            chunks.push({
              filePath,
              content: chunkText,
              startLine: startIdx + 1,
              endLine: endIdx + 1,
              language: 'markdown',
              chunkType: 'section',
              identifier: currentHead.name
            });
          }
        }
      }
    }
  } else {
    // Code structural chunking
    const definitions = detectCodeDefinitions(lines, language);

    if (definitions.length > 0) {
      for (let i = 0; i < definitions.length; i++) {
        const currentDef = definitions[i];
        const startLineIdx = currentDef.lineIndex;
        const nextDef = definitions[i + 1];
        let endLineIdx = nextDef ? nextDef.lineIndex - 1 : totalLines - 1;

        if (endLineIdx - startLineIdx > maxChunkLines) {
          endLineIdx = startLineIdx + maxChunkLines;
        }

        const chunkLines = lines.slice(startLineIdx, endLineIdx + 1);
        const chunkText = chunkLines.join('\n').trim();

        if (chunkText.length > 0) {
          chunks.push({
            filePath,
            content: chunkText,
            startLine: startLineIdx + 1,
            endLine: endLineIdx + 1,
            language,
            chunkType: currentDef.type,
            identifier: currentDef.name
          });
        }
      }
    }
  }

  // Sliding window fallback for unchunked or remaining gaps
  if (chunks.length === 0) {
    let currentStart = 0;
    while (currentStart < totalLines) {
      let currentEnd = Math.min(currentStart + maxChunkLines - 1, totalLines - 1);
      const chunkLines = lines.slice(currentStart, currentEnd + 1);
      const chunkText = chunkLines.join('\n').trim();

      if (chunkText.length > 0) {
        chunks.push({
          filePath,
          content: chunkText,
          startLine: currentStart + 1,
          endLine: currentEnd + 1,
          language,
          chunkType: 'block',
          identifier: `${filePath.split('/').pop()}:L${currentStart + 1}-L${currentEnd + 1}`
        });
      }

      if (currentEnd >= totalLines - 1) break;
      currentStart = currentEnd - overlapLines + 1;
      if (currentStart <= 0) break;
    }
  }

  return chunks;
};
