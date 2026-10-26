import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconHistory, IconFolder, IconChecklist, IconCpu, IconGauge, IconBolt,
  IconStack2, IconBrain, IconPlugConnected, IconDatabase, IconAdjustmentsHorizontal,
  IconMinimize, IconPlus, IconMessages, IconSun,
} from '@tabler/icons-react';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectPanel: (id: string) => void;
  onOpenModel: () => void;
  onOpenReasoning: () => void;
  onOpenMcp: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
}

interface Item {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: any;
  run: () => void;
}

export function CommandPalette({
  open, onClose, onSelectPanel, onOpenModel, onOpenReasoning, onOpenMcp, onOpenMemory, onOpenSettings,
}: Props) {
  const { conversations, models, activeConversationId, switchConversation, newConversation, sendMessage, setModel, setTheme } = useApp();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setQuery(''); setActive(0); }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const go = (id: string, label: string, icon: any) => ({ id: `go-${id}`, label, group: 'Go to', icon, run: () => { onSelectPanel(id); onClose(); } });
    const base: Item[] = [
      go('chat', 'History', IconHistory),
      go('files', 'Explorer', IconFolder),
      go('todo', 'Tasks', IconChecklist),
      go('agents', 'Sub-agents', IconCpu),
      go('context', 'Context', IconGauge),
      go('skills', 'Skills', IconBolt),
      { id: 'act-model', label: 'Switch model', group: 'Actions', icon: IconStack2, run: () => { onOpenModel(); onClose(); } },
      { id: 'act-reasoning', label: 'Reasoning level', group: 'Actions', icon: IconBrain, run: () => { onOpenReasoning(); onClose(); } },
      { id: 'act-mcp', label: 'MCP servers', group: 'Actions', icon: IconPlugConnected, run: () => { onOpenMcp(); onClose(); } },
      { id: 'act-memory', label: 'Memory', group: 'Actions', icon: IconDatabase, run: () => { onOpenMemory(); onClose(); } },
      { id: 'act-settings', label: 'Settings', group: 'Actions', icon: IconAdjustmentsHorizontal, run: () => { onOpenSettings(); onClose(); } },
      { id: 'act-theme', label: 'Toggle theme', group: 'Actions', icon: IconSun, run: () => { setTheme((document.documentElement.getAttribute('data-theme') ?? 'dark') === 'dark' ? 'light' : 'dark'); onClose(); } },
      { id: 'act-new', label: 'New conversation', group: 'Actions', icon: IconPlus, run: () => { newConversation(); onClose(); } },
      { id: 'act-compact', label: 'Compact context', group: 'Actions', icon: IconMinimize, run: () => { sendMessage('/compact'); onClose(); } },
    ];
    const convs: Item[] = conversations.slice(0, 12).map(c => ({
      id: `conv-${c.id}`,
      label: c.name || c.id,
      hint: c.id === activeConversationId ? 'current' : undefined,
      group: 'Conversations',
      icon: IconMessages,
      run: () => { switchConversation(c.id); onClose(); },
    }));
    const modelItems: Item[] = models.filter(m => m.authenticated).slice(0, 40).map(m => ({
      id: `model-${m.provider}-${m.id}`,
      label: m.name,
      hint: m.provider,
      group: 'Models',
      icon: IconStack2,
      run: () => { setModel(m.provider, m.id); onClose(); },
    }));
    return [...base, ...convs, ...modelItems];
  }, [conversations, models, activeConversationId, onSelectPanel, onClose, onOpenModel, onOpenReasoning, onOpenMcp, onOpenMemory, onOpenSettings, newConversation, sendMessage, setModel, setTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 24);
    return items.filter(i => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q) || (i.hint || '').toLowerCase().includes(q)).slice(0, 40);
  }, [items, query]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelectorAll('.palette-item')[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[active]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let lastGroup = '';

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <input
          className="palette-input"
          placeholder="Search, jump to, or run a command…"
          value={query}
          autoFocus
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-fg-subtle">No matches</div>
          ) : (
            filtered.map((item, i) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  {showGroup && <div className="palette-group">{item.group}</div>}
                  <div
                    className={cn('palette-item', i === active && 'active')}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => item.run()}
                  >
                    <span className="palette-icon"><Icon size={17} stroke={1.6} /></span>
                    <span className="text-sm truncate">{item.label}</span>
                    {item.hint && <span className="palette-hint">{item.hint}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
