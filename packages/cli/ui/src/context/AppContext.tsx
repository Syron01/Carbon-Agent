import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Message, Conversation, StatusInfo, ModelInfo, AuthStatus, McpPanelState, TodoItem, AppSettings, SubAgent, BrowserToolStatus, ToolCall } from '../types';
import { api } from '../lib/api';
import { useSSE } from '../hooks/useSSE';
import { stripFableBlock } from '../lib/utils';

interface AppState {
  messages: Message[];
  conversations: Conversation[];
  activeConversationId: string | null;
  status: StatusInfo | null;
  models: ModelInfo[];
  auth: AuthStatus | null;
  mcp: McpPanelState | null;
  todos: TodoItem[];
  settings: AppSettings | null;
  subAgents: SubAgent[];
  liveTools: ToolCall[];
  loading: boolean;
  streamingContent: string;
  error: string | null;
  sidebarOpen: boolean;
  activeTab: string;
  ideOpen: boolean;
  ideTab: string;
  openFiles: { path: string; name: string; content?: string; loading?: boolean; error?: string }[];
  activeFilePath: string | null;
  browserToolStatus: BrowserToolStatus | null;
}

interface AppActions {
  sendMessage: (prompt: string, opts?: { images?: string[] }) => Promise<void>;
  clearError: () => void;
  setTodos: (todos: TodoItem[]) => void;
  interrupt: () => Promise<void>;
  switchConversation: (id: string) => Promise<void>;
  newConversation: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, name: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  editMessage: (id: string, text: string) => Promise<void>;
  togglePin: (id: string, pinned: boolean) => Promise<void>;
  setModel: (provider: string, model: string) => Promise<void>;
  setTheme: (theme: 'dark' | 'light' | 'tokyo') => void;
  setPermission: (level: 'ask' | 'safe' | 'full') => Promise<void>;
  setThinking: (level: number) => Promise<void>;
  logout: (provider?: string) => Promise<void>;
  refresh: () => Promise<void>;
  toggleSidebar: () => void;
  toggleIde: () => void;
  setActiveTab: (tab: string) => void;
  setIdeTab: (tab: string) => void;
  refreshStatus: () => Promise<void>;
  openFile: (path: string, name: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
}

type AppContextType = AppState & AppActions;

const defaultSettings: AppSettings = {
  theme: 'dark',
  thinkingLevel: 1,
  permissionLevel: 'ask',
  compactionProfile: 'balanced',
  fusionEnabled: false,
  aiName: 'Carbon',
  extraInstructions: '',
  browserToolEnabled: false,
};

const AppContext = createContext<AppContextType | null>(null);

function partsToText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.filter((p: any) => p?.type === 'text').map((p: any) => p.text || '').join('\n');
  if (typeof v === 'object') {
    if (Array.isArray(v.content)) return partsToText(v.content);
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }
  return String(v);
}

export function AppProvider({ children }: { children: ReactNode }) {
  function cleanMessages(msgs: Message[]): Message[] {
    return msgs.map(m => ({
      ...m,
      content: typeof m.content === 'string' ? stripFableBlock(m.content) : m.content,
    }));
  }
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [mcp, setMcp] = useState<McpPanelState | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = localStorage.getItem('astro-theme');
    return stored ? { ...defaultSettings, theme: stored as 'dark' | 'light' | 'tokyo' } : defaultSettings;
  });
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [liveTools, setLiveTools] = useState<ToolCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [ideOpen, setIdeOpen] = useState(false);
  const [ideTab, setIdeTab] = useState('files');
  const [openFiles, setOpenFiles] = useState<{ path: string; name: string; content?: string; loading?: boolean; error?: string }[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [browserToolStatus, setBrowserToolStatus] = useState<BrowserToolStatus | null>(null);
  const lastFetchRef = useRef(0);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;

    try {
      const [convData, statusData, modelsData, authData, mcpData, todoData, settingsData, browserToolData] = await Promise.all([
        api.getConversations(),
        api.getStatus(),
        api.getModels(),
        api.getAuthStatus(),
        api.getMcpPanel(),
        api.getTodo(),
        api.getSettings(),
        api.getBrowserToolStatus().catch(() => null),
      ]);
      setConversations(convData.sessions || []);
      setActiveConversationId(convData.activeId || null);
      setStatus(statusData);
      setModels(modelsData || []);
      setAuth(authData);
      setMcp(mcpData);
      setTodos(todoData?.todos || []);
      if (settingsData) setSettings(prev => ({ ...prev, ...settingsData }));
      if (browserToolData) setBrowserToolStatus(browserToolData);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message);
      }
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await api.getStatus();
      setStatus(data);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    localStorage.setItem('astro-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, [refresh, refreshStatus]);

  useSSE('/api/stream', {
    open: () => setError(null),
    error: (data: any) => {
      setError(data?.error || 'SSE connection lost. Reconnecting...');
      setLoading(false);
    },
    state_update: (data: any) => {
      setStatus(prev => {
        const s = data.state || data;
        const merged: any = prev ? { ...prev, ...s } : s;
        if (s?.tokens) merged.usage = { in: s.tokens.in || 0, out: s.tokens.out || 0 };
        return merged;
      });
    },
    message_start: () => {
      setLoading(true);
      setStreamingContent('');
    },
    message_update: (data: any) => {
      if (data.content !== undefined) {
        setStreamingContent(data.content);
      }
    },
    message_end: () => {
      api.getHistory().then(msgs => setMessages(cleanMessages(msgs))).catch(() => {});
    },
    engine_end: (data: any) => {
      setLoading(false);
      setStreamingContent('');
      setLiveTools([]);
      if (data?.error) {
        setError(data.error);
      }
      api.getHistory().then(msgs => {
        setMessages(cleanMessages(msgs || []));
        // If last assistant message is empty/error, surface it
        if (msgs && msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant' && (!last.content || last.content.trim() === '')) {
            setError('Model returned empty response. Check the model or try again.');
          }
        }
      }).catch(() => {});
      refresh();
    },
    clear_chat: () => {
      setMessages([]);
      setStreamingContent('');
      setLiveTools([]);
      setLoading(false); // /clear never emits engine_end
    },
    subagent_start: (data: any) => {
      setSubAgents(prev => prev.some(a => a.id === data.id)
        ? prev
        : [...prev, { id: data.id, taskName: data.taskName, status: 'running', toolCalls: 0, startTime: Date.now(), model: data.model }]);
    },
    subagent_update: (data: any) => {
      setSubAgents(prev => prev.map(a => a.id === data.id
        ? { ...a, status: data.status || a.status, toolCalls: data.toolCalls || a.toolCalls, content: data.content !== undefined ? data.content : a.content }
        : a));
    },
    subagent_end: (data: any) => {
      setSubAgents(prev => prev.map(a => a.id === data.id ? { ...a, status: 'completed', duration: data.duration, toolCalls: data.toolCalls || a.toolCalls } : a));
    },
    skills_update: (data: any) => {
      setStatus(prev => prev ? { ...prev, activeSkills: data.active || [] } : prev);
    },
    tool_execution_start: (data: any) => {
      setLiveTools(prev => prev.some(t => t.id === data.toolCallId) ? prev : [...prev, {
        id: data.toolCallId,
        tool: data.toolName,
        status: 'running',
        input: typeof data.args === 'string' ? data.args : JSON.stringify(data.args ?? {}, null, 2),
      }]);
    },
    tool_execution_update: (data: any) => {
      setLiveTools(prev => prev.map(t => t.id === data.toolCallId ? { ...t, output: partsToText(data.partialResult) } : t));
    },
    tool_execution_end: (data: any) => {
      setLiveTools(prev => prev.map(t => t.id === data.toolCallId ? { ...t, status: data.isError ? 'error' : 'done', output: partsToText(data.result) } : t));
    },
  });

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      api.getHistory().then(msgs => setMessages(cleanMessages(msgs))).catch(() => {});
    }
  }, [activeConversationId]);

  const sendMessage = useCallback(async (prompt: string, opts?: { images?: string[] }) => {
    try {
      setError(null);
      setMessages(prev => [...prev, { id: `temp-${Date.now()}`, role: 'user', content: prompt, timestamp: Date.now() }]);
      setLiveTools([]);
      setLoading(true);
      await api.sendMessage(prompt, {
        images: opts?.images,
        aiName: settings.aiName || undefined,
        extraInstructions: settings.extraInstructions || undefined,
      });
      // Quick commands handled server-side without an engine_end event
      const cmd = prompt.trim().toLowerCase();
      if (cmd === '/clear' || cmd === '/compact') setLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to send message');
      setLoading(false);
    }
  }, [settings.aiName, settings.extraInstructions]);

  const interrupt = useCallback(async () => {
    try {
      await api.interrupt();
      setLoading(false);
      setStreamingContent('');
    } catch {}
  }, []);

  const switchConversation = useCallback(async (id: string) => {
    try {
      setActiveConversationId(id);
      setMessages([]);
      await api.switchConversation(id);
      const msgs = await api.getHistory();
      setMessages(cleanMessages(msgs || []));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const newConversation = useCallback(async () => {
    try {
      const data = await api.newConversation();
      if (data.id) {
        setActiveConversationId(data.id);
        setMessages([]);
        refresh();
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [refresh]);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await api.deleteConversation(id);
      refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }, [refresh]);

  const renameConversation = useCallback(async (id: string, name: string) => {
    try {
      await api.renameConversation(id, name);
      refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }, [refresh]);

  const deleteMessage = useCallback(async (id: string) => {
    try {
      await api.deleteMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch {}
  }, []);

  const editMessage = useCallback(async (id: string, text: string) => {
    try {
      await api.editMessage(id, text);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: text } : m));
    } catch {}
  }, []);

  const togglePin = useCallback(async (id: string, pinned: boolean) => {
    try {
      await api.togglePin(id, pinned);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, pinned } : m));
    } catch {}
  }, []);

  const setModelAction = useCallback(async (provider: string, modelId: string) => {
    try {
      await api.setModel(provider, modelId);
      refreshStatus();
    } catch (e: any) {
      setError(e.message);
    }
  }, [refreshStatus]);

  const setThinkingAction = useCallback(async (level: number) => {
    try {
      await api.setThinking(level);
      setSettings(prev => ({ ...prev, thinkingLevel: level }));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const logout = useCallback(async (provider?: string) => {
    try {
      await api.logout(provider);
      setAuth({ isLoggedIn: false, account: null });
    } catch {}
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const clearError = useCallback(() => setError(null), []);
  const toggleIde = useCallback(() => {
    setIdeOpen(prev => !prev);
    if (!ideOpen && openFiles.length > 0) setIdeTab('preview');
  }, [ideOpen, openFiles.length]);

  const openFile = useCallback(async (path: string, name: string) => {
    setOpenFiles(prev => {
      if (prev.some(f => f.path === path)) return prev;
      return [...prev, { path, name, loading: true }];
    });
    setActiveFilePath(path);
    setIdeOpen(true);
    setIdeTab('preview');
    try {
      const data = await api.readFile(path);
      setOpenFiles(prev => prev.map(f => f.path === path ? { ...f, content: data?.content || '', loading: false } : f));
    } catch {
      setOpenFiles(prev => prev.map(f => f.path === path ? { ...f, error: 'Failed to read file', loading: false } : f));
    }
  }, []);

  const closeFile = useCallback((path: string) => {
    setOpenFiles(prev => {
      const idx = prev.findIndex(f => f.path === path);
      const next = prev.filter(f => f.path !== path);
      if (activeFilePath === path) {
        const newIdx = Math.min(idx, next.length - 1);
        setActiveFilePath(next[newIdx]?.path || null);
      }
      return next;
    });
  }, [activeFilePath]);

  const setActiveFile = useCallback((path: string | null) => {
    setActiveFilePath(path);
  }, []);

  const setTheme = useCallback((theme: 'dark' | 'light' | 'tokyo') => {
    setSettings(prev => ({ ...prev, theme }));
  }, []);

  const setPermission = useCallback(async (level: 'ask' | 'safe' | 'full') => {
    setSettings(prev => ({ ...prev, permissionLevel: level }));
    try {
      await api.saveSettings({ permissionLevel: level });
    } catch {}
  }, []);

  return (
    <AppContext.Provider value={{
      messages, conversations, activeConversationId, status, models, auth, mcp, todos, settings,
      subAgents, liveTools, loading, streamingContent, error, sidebarOpen, activeTab, ideOpen, ideTab, openFiles, activeFilePath, browserToolStatus,
      sendMessage, clearError, setTodos, interrupt, switchConversation, newConversation, deleteConversation,
      renameConversation, deleteMessage, editMessage, togglePin, setModel: setModelAction,
      setThinking: setThinkingAction, logout, refresh, toggleSidebar, toggleIde, setActiveTab,
      setIdeTab, setTheme, refreshStatus, openFile, closeFile, setActiveFile, setPermission,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
