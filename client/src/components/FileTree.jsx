import React, { useState, useMemo } from 'react';
import { Folder, FolderOpen, FileCode, FileText, ChevronRight, ChevronDown, Search } from 'lucide-react';

// Helper to convert flat list of file paths to nested tree structure
const buildFileTree = (filePaths) => {
  const root = { name: 'root', type: 'folder', children: {} };

  filePaths.forEach((path) => {
    const parts = path.split('/');
    let current = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      if (isFile) {
        current.children[part] = { name: part, type: 'file', path };
      } else {
        if (!current.children[part]) {
          current.children[part] = { name: part, type: 'folder', children: {} };
        }
        current = current.children[part];
      }
    });
  });

  const convertToArray = (node) => {
    return Object.values(node.children).map((child) => {
      if (child.type === 'folder') {
        return {
          ...child,
          children: convertToArray(child)
        };
      }
      return child;
    });
  };

  return convertToArray(root);
};

const TreeNode = ({ node, onSelectFile, selectedFile, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(depth < 1); // Expand top level by default

  if (node.type === 'folder') {
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 py-1 px-2 hover:bg-dark-800 rounded cursor-pointer text-xs text-slate-300 select-none transition"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
          {isOpen ? (
            <FolderOpen className="w-3.5 h-3.5 text-brand-400" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-brand-400" />
          )}
          <span className="truncate font-mono">{node.name}</span>
        </div>
        {isOpen && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path || child.name}
                node={child}
                onSelectFile={onSelectFile}
                selectedFile={selectedFile}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedFile === node.path;

  return (
    <div
      onClick={() => onSelectFile?.(node.path)}
      className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer text-xs select-none transition ${
        isSelected
          ? 'bg-brand-600/30 text-white font-medium border-l-2 border-brand-500'
          : 'hover:bg-dark-800 text-slate-400 hover:text-slate-200'
      }`}
      style={{ paddingLeft: `${depth * 12 + 16}px` }}
    >
      <FileCode className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
      <span className="truncate font-mono">{node.name}</span>
    </div>
  );
};

export default function FileTree({ files = [], onSelectFile, selectedFile }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) return files;
    return files.filter((f) => f.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [files, searchTerm]);

  const tree = useMemo(() => buildFileTree(filteredFiles), [filteredFiles]);

  return (
    <div className="w-60 border-r border-dark-700 bg-dark-900 flex flex-col h-full flex-shrink-0">
      <div className="p-2.5 border-b border-dark-700">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          File Explorer ({files.length})
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-800 border border-dark-700 rounded-md pl-8 pr-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1 py-2">
        {tree.length === 0 ? (
          <div className="p-3 text-center text-xs text-slate-500">No matching files found.</div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.path || node.name}
              node={node}
              onSelectFile={onSelectFile}
              selectedFile={selectedFile}
            />
          ))
        )}
      </div>
    </div>
  );
}
