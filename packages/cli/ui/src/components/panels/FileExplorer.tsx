import { useState, useEffect, useCallback } from 'react';
import { IconChevronRight, IconChevronDown, IconFolder, IconFolderOpen, IconLoader2, IconFile } from '@tabler/icons-react';
import { cn, getFileColor } from '../../lib/utils';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import type { FileNode } from '../../types';

function TreeNode({ node, depth }: { node: FileNode; depth: number }) {
  const { openFile } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileNode[]>(node.children || []);
  const [loading, setLoading] = useState(false);
  const isDir = node.type === 'directory';

  const toggle = useCallback(async () => {
    if (!isDir) {
      openFile(node.path, node.name);
      return;
    }
    if (expanded) {
      setExpanded(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getFsTree(node.path);
      setChildren((data as any)?.children || []);
    } catch {
      setChildren([]);
    }
    setLoading(false);
    setExpanded(true);
  }, [isDir, expanded, node.path, node.name, openFile]);

  return (
    <>
      <div
        onClick={toggle}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 text-sm rounded-full cursor-pointer transition-colors text-fg-muted hover:bg-sidebar-hover hover:text-fg-default'
        )}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        {isDir ? (
          <span className="flex items-center text-fg-subtle shrink-0 w-4">
            {loading ? <IconLoader2 size={14} className="animate-spin" /> :
             expanded ? <IconChevronDown size={14} stroke={1.5} /> : <IconChevronRight size={14} stroke={1.5} />}
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        {isDir ? (
          expanded
            ? <IconFolderOpen size={15} stroke={1.5} className="text-fg-accent shrink-0" />
            : <IconFolder size={15} stroke={1.5} className="text-fg-accent shrink-0" />
        ) : (
          <IconFile size={15} stroke={1.5} className="shrink-0" style={{ color: getFileColor(node.name) }} />
        )}
        <span className="truncate text-xs">{node.name}</span>
      </div>
      {isDir && expanded && children.map(child => (
        <TreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function FileExplorer() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTree = useCallback(async () => {
    try {
      const data = await api.getFsTree();
      const children = (data as any)?.children;
      setTree(Array.isArray(children) ? children : Array.isArray(data) ? data : []);
    } catch { setTree([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTree(); const i = setInterval(fetchTree, 10000); return () => clearInterval(i); }, [fetchTree]);

  if (loading) return (
    <div className="flex items-center justify-center py-10 text-fg-subtle text-sm">
      <IconLoader2 size={16} className="animate-spin mr-2" /> Loading...
    </div>
  );

  if (tree.length === 0) return (
    <div className="flex flex-col items-center justify-center py-10 text-fg-subtle text-sm gap-2">
      <IconFolder size={32} stroke={1} className="opacity-30" />
      <span>No files</span>
    </div>
  );

  return (
    <div className="py-1">
      {tree.map(node => <TreeNode key={node.path} node={node} depth={0} />)}
    </div>
  );
}
