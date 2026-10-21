export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  text?: string;
  summary?: string;
  timestamp: number;
  model?: string;
  provider?: string;
  pinned?: boolean;
  status?: 'streaming' | 'done' | 'error';
  tools?: ToolCall[];
  images?: string[];
}

export interface ToolCall {
  id: string;
  tool: string;
  status: 'running' | 'done' | 'error';
  input?: string;
  output?: string;
  duration?: number;
}

export interface Conversation {
  id: string;
  name: string;
  path?: string;
  cwd?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface StatusInfo {
  cwd: string;
  model: string;
  provider?: string;
  usage: { in: number; out: number };
  tokens?: { in: number; out: number };
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null } | null;
  compaction?: { enabled: boolean; profile: string; thresholdPercent: number | null } | null;
  activeSkills?: string[];
  isGenerating: boolean;
  authUrl: string;
  tools: string[];
  thinking: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  context?: number;
  authenticated: boolean;
  thinking?: boolean;
}

export interface AuthStatus {
  isLoggedIn: boolean;
  account: { name: string; email: string; initial: string } | null;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modifiedAt?: number;
}

export interface McpServer {
  name: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  autoStart?: boolean;
  connected: boolean;
  tools: string[];
  port?: number;
}

export interface McpClient {
  name: string;
  version: string;
}

export interface McpPanelState {
  servers: McpServer[];
  clients: McpClient[];
  tools: number;
  market: any[];
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt?: number;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'tokyo';
  thinkingLevel: number;
  permissionLevel: 'ask' | 'safe' | 'full';
  compactionProfile: 'aggressive' | 'balanced' | 'off';
  fusionEnabled: boolean;
  aiName: string;
  extraInstructions: string;
  browserToolEnabled: boolean;
}

export interface BrowserToolStatus {
  enabled: boolean;
  port: number;
  connected: boolean;
  clients: number;
  extensionPath: string;
  sharedPortFile: string;
}

export interface SubAgent {
  id: string;
  taskName: string;
  status: 'running' | 'completed' | 'error';
  toolCalls: number;
  startTime: number;
  duration?: number;
  content?: string;
  model?: string;
}

export type TabType = 'files' | 'search' | 'chat' | 'todo' | 'mcp' | 'agents' | 'context' | 'skills';
export type IdeTabType = 'files' | 'plan' | 'todo' | 'agents';
