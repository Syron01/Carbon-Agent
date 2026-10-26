import type { Message, Conversation, StatusInfo, ModelInfo, AuthStatus, FileNode, McpPanelState, TodoItem, AppSettings, BrowserToolStatus } from '../types';

const BASE = '';

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Accept': 'application/json' },
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`GET ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

async function postJSON<T>(path: string, body?: any, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`POST ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // Status
  getStatus: (signal?: AbortSignal) => getJSON<StatusInfo>('/api/status', signal),

  // Auth
  getAuthStatus: (signal?: AbortSignal) => getJSON<AuthStatus>('/api/auth/status', signal),
  logout: (provider?: string) => postJSON<{ success: boolean }>('/api/logout', provider ? { provider } : undefined),

  // Messages
  sendMessage: (prompt: string, opts?: { images?: string[]; aiName?: string; extraInstructions?: string; systemAdditions?: string }) =>
    postJSON<{ success: boolean }>('/api/prompt', { prompt, ...opts }),
  getHistory: (signal?: AbortSignal) => getJSON<Message[]>('/api/history', signal),
  deleteMessage: (id: string) => postJSON<{ success: boolean }>('/api/history/delete', { id }),
  editMessage: (id: string, text: string) => postJSON<{ success: boolean }>('/api/history/edit', { id, text }),
  togglePin: (id: string, pinned: boolean) => postJSON<{ success: boolean }>('/api/history/pin', { id, pinned }),
  interrupt: () => postJSON<{ success: boolean }>('/api/interrupt'),
  reset: () => postJSON<{ success: boolean }>('/api/reset'),

  // Conversations
  getConversations: (signal?: AbortSignal) => getJSON<{ sessions: Conversation[]; activeId: string }>('/api/conversations', signal),
  newConversation: () => postJSON<{ success: boolean; id: string }>('/api/conversations/new'),
  switchConversation: (id: string) => postJSON<{ success: boolean }>('/api/conversations/switch', { id }),
  renameConversation: (id: string, name: string) => postJSON<{ success: boolean }>('/api/conversations/rename', { id, name }),
  deleteConversation: (id: string) => postJSON<{ success: boolean }>('/api/conversations/delete', { id }),

  // Models
  getModels: (signal?: AbortSignal) => getJSON<ModelInfo[]>('/api/models', signal),
  setModel: (provider: string, model: string) => postJSON<{ success: boolean }>('/api/set-model', { provider, model }),

  // Settings
  getSettings: (signal?: AbortSignal) => getJSON<AppSettings>('/api/settings', signal),
  saveSettings: (settings: Partial<AppSettings>) => postJSON<{ success: boolean }>('/api/settings', settings),

  // Thinking / Fusion
  setThinking: (level: number) => postJSON<{ success: boolean }>('/api/set-thinking', { level }),
  setFusion: (enabled: boolean, thinkModel?: { provider: string; id: string }, codeModel?: { provider: string; id: string }) =>
    postJSON<{ success: boolean }>('/api/set-fusion', { enabled, thinkModel, codeModel }),

  // Filesystem
  getFsTree: (dir?: string, signal?: AbortSignal) => getJSON<FileNode>(`/api/fs/tree${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`, signal),
  readFile: (path: string) => {
    const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'].includes(ext);
    return getJSON<{ content: string }>(`/api/fs/read?path=${encodeURIComponent(path)}${isImage ? '&raw=true' : ''}`);
  },

  // MCP
  getMcpPanel: (signal?: AbortSignal) => getJSON<McpPanelState>('/api/mcp-panel', signal),
  mcpAction: (action: string, data?: any) => postJSON<{ ok: boolean; message?: string; error?: string }>('/api/mcp-panel/action', { action, ...data }),

  // Todo
  getTodo: (signal?: AbortSignal) => getJSON<{ todos: TodoItem[] }>('/api/todo', signal),
  updateTodo: (action: string, data?: { id?: string; text?: string }) =>
    postJSON<{ ok: boolean; todos?: TodoItem[] }>('/api/todo', { action, ...data }),

  // Session
  forkSession: (id: string) => postJSON<{ success: boolean }>('/api/session/fork', { id }),
  exportSession: (format: 'jsonl' | 'html') => {
    const url = `${BASE}/api/session/export?format=${format}`;
    window.open(url, '_blank');
  },
  importSession: (body: string) =>
    fetch(`${BASE}/api/session/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }),
  shareSession: () => postJSON<{ success: boolean; url: string }>('/api/session/share'),

  // Browser Bridge
  getBridgeStatus: (signal?: AbortSignal) => getJSON<any>('/api/browser/status', signal),

  // Commands
  getCommands: (signal?: AbortSignal) => getJSON<{ cmd: string; desc: string }[]>('/api/commands', signal),

  // Skills
  getSkills: (signal?: AbortSignal) => getJSON<{ skills: { name: string; description: string }[]; active?: string[] }>('/api/skills', signal),
  loadSkill: (name: string) => postJSON<{ success: boolean; error?: string }>('/api/skills/load', { name }),

  // Context / auto-compaction
  setCompactionThreshold: (percent: number | null) =>
    postJSON<{ success: boolean }>('/api/settings', { compactionThresholdPercent: percent }),
  setAutoCompaction: (enabled: boolean) =>
    postJSON<{ success: boolean }>('/api/settings', { autoCompactionEnabled: enabled }),

  // Memory
  getMemoryExperiences: (signal?: AbortSignal) => getJSON<{ success: boolean; experiences: any[] }>('/api/memory/experiences', signal),

  // Browser Tool
  getBrowserToolStatus: (signal?: AbortSignal) => getJSON<BrowserToolStatus>('/api/browser-tool/status', signal),
  setBrowserToolEnabled: (enabled: boolean) => postJSON<{ success: boolean }>('/api/browser-tool/enabled', { enabled }),
};
