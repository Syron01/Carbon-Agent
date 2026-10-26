import { useState, useRef, useCallback, useEffect } from 'react';
import {
  IconPlus, IconPhoto, IconFolder, IconAt, IconChecklist, IconWorld, IconChevronUp,
  IconMicrophone, IconArrowRight, IconShield, IconCheck, IconX, IconGauge,
} from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';
import { cn } from '../../lib/utils';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const PERMISSIONS = [
  { value: 'ask' as const, label: 'Request Review', desc: 'Every command requires approval.' },
  { value: 'safe' as const, label: 'Default', desc: 'Ask before sensitive operations.' },
  { value: 'full' as const, label: 'Turbo', desc: 'Run all commands without restrictions.' },
];

const pop = 'absolute bottom-[calc(100%+10px)] z-50 rounded-[var(--radius-md)] border border-border-default bg-base-1 shadow-[var(--shadow-lg)] overflow-hidden';

function formatTokens(n: number | null | undefined): string {
  if (n == null) return '--';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function MessageInput() {
  const { sendMessage, interrupt, loading, settings, status, models, setModel, setPermission, refreshStatus, auth, logout } = useApp();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<null | 'context' | 'model' | 'permission'>(null);
  const [commands, setCommands] = useState<{ cmd: string; desc: string }[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const [listening, setListening] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; data: string; type: string }[]>([]);
  const [showUnavailable, setShowUnavailable] = useState(false);

  const browserEnabled = settings?.browserToolEnabled ?? false;
  const permission = settings?.permissionLevel ?? 'ask';
  const permissionLabel = PERMISSIONS.find(p => p.value === permission)?.label ?? 'Default';

  const currentModel = models.find(m => m.id === status?.model || m.name === status?.model);
  const modelName = currentModel?.name ?? status?.model ?? 'Model';

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }
  }, []);

  useEffect(() => { adjustHeight(); }, [input, adjustHeight]);

  useEffect(() => {
    api.getCommands().then(data => setCommands(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if ((!trimmed && attachedFiles.length === 0) || loading) return;
    let finalPrompt = trimmed;
    if (attachedFiles.length > 0) {
      finalPrompt += '\n[Attached files: ' + attachedFiles.map(f => f.name).join(', ') + ']';
    }
    const images = attachedFiles.map(f => f.data);
    setInput('');
    setAttachedFiles([]);
    setShowCommands(false);
    setMenu(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    sendMessage(finalPrompt, { images });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') { setShowCommands(false); setMenu(null); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    setShowCommands(val.startsWith('/'));
  };

  const insertCommand = (cmd: string) => {
    setInput(cmd + ' ');
    textareaRef.current?.focus();
    setShowCommands(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) { toast.error(`File too large (max 20 MB): ${file.name}`); continue; }
      try {
        const data = await readFileAsBase64(file);
        const isImage = file.type.startsWith('image/');
        setAttachedFiles(prev => [...prev, { name: file.name, data, type: isImage ? 'image' : 'file' }]);
      } catch { toast.error(`Failed to read file: ${file.name}`); }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const readFileAsBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader error'));
    const timeout = setTimeout(() => { reader.abort(); reject(new Error('timeout')); }, 30000);
    reader.onloadend = () => clearTimeout(timeout);
    reader.readAsDataURL(file);
  });

  const removeFile = (index: number) => setAttachedFiles(prev => prev.filter((_, i) => i !== index));

  const insert = (text: string) => {
    setInput(prev => (prev ? prev + text : text));
    setTimeout(() => textareaRef.current?.focus(), 0);
    setMenu(null);
  };

  const toggleBrowser = async () => {
    setMenu(null);
    try {
      await api.setBrowserToolEnabled(!browserEnabled);
      await refreshStatus();
      toast.success(browserEnabled ? 'Browser tool disabled' : 'Browser tool enabled');
    } catch { toast.error('Could not update browser tool'); }
  };

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.info('Voice input is not supported in this browser'); return; }
    if (listening) return;
    const rec = new SR();
    rec.lang = 'tr-TR';
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results as any).map((r: any) => r[0].transcript).join(' ');
      setInput(prev => (prev ? prev + ' ' : '') + text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const filteredCommands = showCommands && input.startsWith('/')
    ? commands.filter(c => c.cmd.includes(input.toLowerCase().split(' ')[0]))
    : [];

  const contextItems = [
    { icon: IconPhoto, label: 'Media', run: () => fileInputRef.current?.click() },
    { icon: IconFolder, label: 'Folder', run: () => fileInputRef.current?.click() },
    { icon: IconAt, label: 'Mentions', run: () => insert('@') },
    { icon: IconChecklist, label: 'Actions', run: () => { setInput('/'); setShowCommands(true); textareaRef.current?.focus(); setMenu(null); } },
    { icon: IconWorld, label: 'Browser', run: toggleBrowser },
  ];

  const ctrlBtn = 'flex items-center gap-1.5 h-7 px-2 rounded-full text-[12.5px] text-fg-muted hover:text-fg-default hover:bg-base-3 transition-colors';
  const usage = status?.contextUsage;

  return (
    <div ref={rootRef} className="relative">
      <input ref={fileInputRef} type="file" multiple
        accept="image/*,.txt,.pdf,.csv,.json,.md,.ts,.tsx,.js,.jsx,.py,.css,.html"
        className="hidden" onChange={handleFileSelect} />

      {/* Slash-command autocomplete */}
      {filteredCommands.length > 0 && (
        <div className="mb-2 rounded-[var(--radius-md)] border border-border-default bg-base-1 overflow-hidden shadow-lg max-h-48 overflow-y-auto">
          {filteredCommands.map(c => (
            <div key={c.cmd} onClick={() => insertCommand(c.cmd)} className="palette-item !rounded-none">
              <span className="font-mono text-fg-accent text-xs">{c.cmd}</span>
              <span className="text-fg-muted text-xs">{c.desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add-context menu */}
      {menu === 'context' && (
        <div className={cn(pop, 'left-0 w-60 p-1.5')}>
          <div className="palette-group">Add Context</div>
          {contextItems.map(({ icon: Icon, label, run }) => (
            <div key={label} onClick={run} className="palette-item">
              <span className="palette-icon"><Icon size={16} stroke={1.6} /></span>
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Model menu */}
      {menu === 'model' && (
        <div className={cn(pop, 'left-0 flex flex-col w-[30rem] max-w-[92vw]')}>
          <div className="flex min-h-0">
          <div className="flex-1 max-h-[22rem] overflow-y-auto p-1.5">
            {(() => {
              const available = models.filter(m => m.authenticated);
              const unavailable = models.filter(m => !m.authenticated);
              const renderRow = (m: (typeof models)[number]) => {
                const selected = m.id === status?.model || m.name === status?.model;
                return (
                  <div key={`${m.provider}-${m.id}`}
                    onClick={() => { if (m.authenticated) { setModel(m.provider, m.id); setMenu(null); } }}
                    className={cn('model-item', selected && 'selected', !m.authenticated && 'opacity-45 cursor-not-allowed')}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{m.name}</div>
                      <div className="text-2xs text-fg-subtle truncate">{m.provider}{!m.authenticated && ' · Unavailable'}</div>
                    </div>
                    {selected && <IconCheck size={15} className="text-fg-accent shrink-0" />}
                  </div>
                );
              };
              return (
                <>
                  <div className="palette-group">Available</div>
                  {available.length > 0 ? available.map(renderRow)
                    : <div className="px-3 py-3 text-center text-xs text-fg-subtle">No authenticated models</div>}
                  {unavailable.length > 0 && (
                    <>
                      <button onClick={() => setShowUnavailable(v => !v)}
                        className="w-full flex items-center gap-1.5 px-3 py-2 mt-1 text-2xs uppercase tracking-wider text-fg-subtle hover:text-fg-muted transition-colors">
                        <IconChevronUp size={12} className={cn('transition-transform', !showUnavailable && 'rotate-180')} />
                        Unavailable ({unavailable.length})
                      </button>
                      {showUnavailable && unavailable.map(renderRow)}
                    </>
                  )}
                </>
              );
            })()}
            {models.length === 0 && <div className="px-3 py-6 text-center text-xs text-fg-subtle">No models</div>}
          </div>
          <div className="hidden sm:block w-[13rem] border-l border-border-muted p-3">
            <div className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle mb-2">Usage</div>
            <div className="rounded-[var(--radius-md)] border border-border-muted p-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Context</span>
                <span className="text-sm tabular-nums font-semibold">{usage?.percent != null ? `${usage.percent.toFixed(0)}%` : '--'}</span>
              </div>
              <div className="text-2xs text-fg-subtle mt-0.5">
                {formatTokens(usage?.tokens)} / {formatTokens(usage?.contextWindow)}
              </div>
              <div className="h-2 mt-2 rounded-full bg-base-3 overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, usage?.percent ?? 0))}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-2xs text-fg-subtle">
              <IconGauge size={13} stroke={1.6} /> Session tokens {formatTokens((status?.usage?.in ?? 0) + (status?.usage?.out ?? 0))}
            </div>
          </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border-t border-border-muted">
            {auth?.isLoggedIn ? (
              <>
                <span className="w-5 h-5 rounded-full bg-accent-subtle text-fg-accent flex items-center justify-center text-2xs font-semibold shrink-0">
                  {auth.account?.initial || 'A'}
                </span>
                <span className="text-xs text-fg-muted truncate flex-1 min-w-0">{auth.account?.email || auth.account?.name || 'Signed in'}</span>
                <button onClick={(e) => { e.stopPropagation(); logout(); }}
                  className="text-2xs px-2.5 py-1 rounded-full border border-border-default text-fg-muted hover:text-fg-default hover:bg-base-3 transition-colors shrink-0">
                  Log out
                </button>
              </>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); window.open(`${status?.authUrl || 'http://127.0.0.1:3131'}/login`, '_blank', 'noopener'); }}
                className="btn btn-primary btn-sm w-full justify-center">
                <IconShield size={14} stroke={1.8} /> Log in
              </button>
            )}
          </div>
        </div>
      )}

      {/* Permission menu */}
      {menu === 'permission' && (
        <div className={cn(pop, 'left-0 w-72 p-1.5 sm:left-auto sm:right-14')}>
          {PERMISSIONS.map(p => {
            const risky = p.value === 'full';
            return (
              <div key={p.value}
                onClick={() => { setPermission(p.value); setMenu(null); }}
                className={cn('flex items-start gap-3 p-2.5 rounded-[var(--radius-md)] cursor-pointer transition-colors',
                  permission === p.value && (risky ? 'bg-[color-mix(in_srgb,var(--fg-warning)_14%,transparent)]' : 'bg-accent-subtle'),
                  permission !== p.value && 'hover:bg-base-3')}>
                <IconShield size={18} stroke={1.6} className={cn('mt-0.5 shrink-0',
                  risky ? 'text-[var(--fg-warning)]' : permission === p.value ? 'text-fg-accent' : 'text-fg-subtle')} />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-medium', risky && 'text-[var(--fg-warning)]')}>{p.label}</div>
                  <div className="text-xs text-fg-subtle mt-0.5">{p.desc}</div>
                </div>
                {permission === p.value && <IconCheck size={15} className={cn('mt-0.5 shrink-0', risky ? 'text-[var(--fg-warning)]' : 'text-fg-accent')} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <div
        onClick={() => textareaRef.current?.focus()}
        className={cn(
          'flex flex-col gap-2 px-3 pt-3 pb-2.5 rounded-[22px] border bg-chat-input-bg transition-colors cursor-text',
          'border-border-default focus-within:border-border-accent shadow-[var(--shadow-sm)]'
        )}
      >
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-base-2 border border-border-default text-xs">
                {f.type === 'image'
                  ? <img src={f.data} alt={f.name} className="w-5 h-5 rounded-full object-cover" />
                  : <span className="text-fg-muted text-[10px] font-mono">FILE</span>}
                <span className="text-fg-muted max-w-[120px] truncate">{f.name}</span>
                <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-fg-subtle hover:text-fg-danger ml-0.5">
                  <IconX size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything, @ to mention, / for actions"
          rows={1}
          className="w-full bg-transparent text-sm text-fg-default placeholder-fg-muted outline-none resize-none max-h-[200px] leading-relaxed px-2"
        />

        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setMenu(menu === 'context' ? null : 'context'); }} className={ctrlBtn} title="Add context">
              <IconPlus size={17} stroke={1.8} />
              {browserEnabled && <span className="w-1.5 h-1.5 rounded-full bg-fg-success" />}
            </button>
          </div>

          <button onClick={(e) => { e.stopPropagation(); setMenu(menu === 'model' ? null : 'model'); }} className={cn(ctrlBtn, 'max-w-[220px]')} title="Select model">
            <span className="truncate">{modelName}</span>
            <IconChevronUp size={13} stroke={1.8} className={cn('shrink-0 transition-transform', menu === 'model' && 'rotate-180')} />
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setMenu(menu === 'permission' ? null : 'permission'); }}
              className={cn(ctrlBtn, permission === 'full' && 'text-[var(--fg-warning)] hover:text-[var(--fg-warning)]')} title="Permission mode">
              <IconShield size={16} stroke={1.6} className={permission === 'full' ? 'text-[var(--fg-warning)]' : undefined} />
              <span className="hidden sm:inline">{permissionLabel}</span>
              <IconChevronUp size={13} stroke={1.8} className={cn('shrink-0 transition-transform', menu === 'permission' && 'rotate-180')} />
            </button>

            <button onClick={(e) => { e.stopPropagation(); startVoice(); }}
              className={cn(ctrlBtn, listening && 'text-fg-danger')} title="Voice input">
              <IconMicrophone size={17} stroke={1.6} />
            </button>

            {loading ? (
              <button onClick={(e) => { e.stopPropagation(); interrupt(); }}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-base-3 hover:bg-base-4 transition-colors" title="Stop">
                <span className="w-3 h-3 rounded-[3px] bg-[var(--fg-danger)]" />
              </button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); handleSend(); }}
                disabled={!input.trim() && attachedFiles.length === 0}
                className={cn('flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                  (input.trim() || attachedFiles.length > 0)
                    ? 'bg-accent text-accent-ink hover:bg-accent-hover'
                    : 'bg-base-3 text-fg-subtle cursor-not-allowed')}
                title="Send">
                <IconArrowRight size={16} stroke={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
