import type { FileNode } from '../types';

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return d.toLocaleDateString();
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '…';
}

export function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'file-type-ts', tsx: 'file-type-tsx', js: 'file-type-js', jsx: 'file-type-jsx',
    json: 'file-type-json', html: 'file-type-html', css: 'file-type-css',
    md: 'file-type-md', py: 'file-type-py', rs: 'file-type-rust',
    go: 'file-type-go', yml: 'file-type-yml', yaml: 'file-type-yml',
    toml: 'file-type-toml', lock: 'file-type-lock', env: 'file-type-env',
    svg: 'file-type-svg', png: 'file-type-image', jpg: 'file-type-image',
    jpeg: 'file-type-image', ico: 'file-type-image', sh: 'file-type-shell',
    bat: 'file-type-shell', ps1: 'file-type-shell', txt: 'file-type-text',
    xml: 'file-type-xml', sql: 'file-type-sql', vue: 'file-type-vue',
    svelte: 'file-type-svelte', scss: 'file-type-scss', less: 'file-type-less',
  };
  return map[ext || ''] || 'file';
}

export function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: '#3178c6', tsx: '#61dafb', js: '#f7df1e', jsx: '#61dafb',
    json: '#5c5c5c', html: '#e34f26', css: '#1572b6', md: '#083fa1',
    py: '#3776ab', rs: '#dea584', go: '#00add8', svg: '#ffb13b',
    vue: '#42b883', svelte: '#ff3e00', sql: '#e38c00', xml: '#f16529',
  };
  return map[ext || ''] || 'var(--fg-muted)';
}

export function buildFileTree(files: FileNode[]): FileNode[] {
  return files;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function stripFableBlock(text: any): any {
  // Assistant content can arrive as a parts array; only strings contain the tag.
  if (typeof text !== 'string') return text;
  return text.replace(/<fable-mode>[\s\S]*?<\/fable-mode>\s*/g, '');
}
