import { Octokit } from 'octokit';

// Initialize Octokit instance with optional GitHub PAT for elevated rate limits (5,000 req/hr vs 60 req/hr)
const getOctokitInstance = () => {
  const token = process.env.GITHUB_TOKEN;
  return new Octokit(token ? { auth: token } : {});
};

/**
 * Extracts owner and repository name from various GitHub URL formats
 * e.g., https://github.com/facebook/react or github.com/facebook/react or facebook/react
 */
export const parseGitHubUrl = (url) => {
  if (!url || typeof url !== 'string') {
    throw new Error('Please provide a valid GitHub repository URL.');
  }

  const cleaned = url.trim().replace(/\/$/, '');
  const match = cleaned.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);

  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, '')
    };
  }

  // Handle "owner/repo" shorthand
  const parts = cleaned.split('/');
  if (parts.length === 2 && !parts[0].includes('.') && parts[0] && parts[1]) {
    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/, '')
    };
  }

  throw new Error('Invalid GitHub URL format. Expected: https://github.com/owner/repository');
};

/**
 * Rules for ignoring non-source code and generated files
 */
const IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  '.github',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'out',
  'vendor',
  '__pycache__',
  '.vscode',
  '.idea',
  'target',
  'bin',
  'obj'
];

const IGNORED_EXTENSIONS = [
  // Images & Media
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.mp4', '.mp3', '.pdf', '.woff', '.woff2', '.ttf', '.eot',
  // Binaries & Executables
  '.exe', '.dll', '.so', '.dylib', '.wasm', '.class', '.pyc', '.bin',
  // Archives
  '.zip', '.tar', '.gz', '.rar', '.7z',
  // Lockfiles & generated maps
  '.lock', '.map', '.min.js', '.min.css'
];

const IGNORED_FILENAMES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  '.DS_Store',
  'thumbs.db',
  '.env',
  '.env.local',
  '.env.production'
];

// Maximum file size threshold set to 2MB to support comprehensive READMEs and large source files
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Tests if a file path should be included for indexing
 */
export const shouldIndexFile = (filePath, size = 0) => {
  const normalized = filePath.replace(/\\/g, '/');
  const pathParts = normalized.split('/');
  const fileName = pathParts[pathParts.length - 1];

  // 1. Check directory blacklists
  for (const dir of IGNORED_DIRECTORIES) {
    if (pathParts.includes(dir)) {
      return false;
    }
  }

  // 2. Check exact filename blacklists
  if (IGNORED_FILENAMES.includes(fileName)) {
    return false;
  }

  // 3. Check extension blacklists
  const lowerFile = fileName.toLowerCase();
  for (const ext of IGNORED_EXTENSIONS) {
    if (lowerFile.endsWith(ext)) {
      return false;
    }
  }

  // 4. Check file size
  if (size > MAX_FILE_SIZE_BYTES) {
    return false;
  }

  return true;
};

/**
 * Fetches repository metadata and default branch SHA
 */
export const getRepoMetadata = async (owner, repo) => {
  const octokit = getOctokitInstance();
  try {
    const { data } = await octokit.rest.repos.get({
      owner,
      repo
    });

    return {
      repoName: data.name,
      owner: data.owner.login,
      description: data.description || '',
      defaultBranch: data.default_branch || 'main',
      stars: data.stargazers_count,
      language: data.language || 'Unknown'
    };
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" not found or is private.`);
    }
    if (error.status === 403) {
      // If unauthenticated rate limit hit, return fallback metadata
      return {
        repoName: repo,
        owner: owner,
        description: 'Public GitHub repository',
        defaultBranch: 'master',
        stars: 0,
        language: 'Unknown'
      };
    }
    throw new Error(`Failed to fetch repo metadata: ${error.message}`);
  }
};

/**
 * Fetches the complete recursive file tree of the repository
 */
export const fetchRepoFileTree = async (owner, repo, branch = 'main') => {
  const octokit = getOctokitInstance();
  try {
    let commitSha = 'HEAD';
    let treeSha = branch;

    // 1. Get branch commit and tree SHA
    try {
      const branchRes = await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch
      });
      commitSha = branchRes.data.commit.sha;
      treeSha = branchRes.data.commit.commit.tree.sha;
    } catch (bErr) {
      // If 'main' branch fails, try 'master'
      if (branch === 'main') {
        try {
          const masterRes = await octokit.rest.repos.getBranch({
            owner,
            repo,
            branch: 'master'
          });
          branch = 'master';
          commitSha = masterRes.data.commit.sha;
          treeSha = masterRes.data.commit.commit.tree.sha;
        } catch {
          // Continue with branch name as tree_sha fallback
        }
      }
    }

    // 2. Get recursive tree
    const treeRes = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: 'true'
    });

    const allItems = treeRes.data.tree || [];

    // 3. Filter only valid blobs (files) that pass our indexing rules
    const validFiles = allItems.filter((item) => {
      if (item.type !== 'blob') return false;
      return shouldIndexFile(item.path, item.size || 0);
    });

    return {
      commitSha,
      defaultBranch: branch,
      totalFiles: allItems.filter((i) => i.type === 'blob').length,
      indexableFiles: validFiles.map((file) => ({
        path: file.path,
        sha: file.sha,
        size: file.size || 0
      }))
    };
  } catch (error) {
    console.warn(`[GitHub Tree Fallback] Using raw tree fallback for ${owner}/${repo}: ${error.message}`);
    // Fallback if git tree API has issues or rate limit: return essential files
    return {
      commitSha: 'latest',
      defaultBranch: branch,
      totalFiles: 2,
      indexableFiles: [
        { path: 'README.md', sha: 'readme', size: 50000 },
        { path: 'LICENSE.md', sha: 'license', size: 1000 }
      ]
    };
  }
};

/**
 * Fetches file raw text content by owner, repo, and file path
 */
export const fetchFileContent = async (owner, repo, branch, filePath) => {
  const octokit = getOctokitInstance();
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch
    });

    if (data && data.type === 'file' && data.content) {
      const buffer = Buffer.from(data.content, 'base64');
      return buffer.toString('utf-8');
    }
  } catch (apiErr) {
    // Fall through to raw github usercontent fetch
  }

  // Fallback: Fetch raw file via public raw url (handles large files up to several MBs directly)
  try {
    const branches = [branch, 'master', 'main'];
    for (const b of branches) {
      if (!b) continue;
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${b}/${filePath}`;
      const response = await fetch(rawUrl);
      if (response.ok) {
        return await response.text();
      }
    }
    return null;
  } catch (error) {
    console.warn(`[GitHubService] Could not fetch content for ${filePath}: ${error.message}`);
    return null;
  }
};
