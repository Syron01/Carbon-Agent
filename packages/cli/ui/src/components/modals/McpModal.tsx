import { useState } from 'react';
import { IconX, IconPlugConnected, IconPlugConnectedX, IconRefresh, IconPlus, IconTrash, IconTool, IconUsers } from '@tabler/icons-react';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function McpModal({ open, onClose }: Props) {
  const { mcp, refresh } = useApp();
  const [customName, setCustomName] = useState('');
  const [customCommand, setCustomCommand] = useState('');
  const [customArgs, setCustomArgs] = useState('');
  const [customEnv, setCustomEnv] = useState('');
  const [customCwd, setCustomCwd] = useState('');
  const [customAutoStart, setCustomAutoStart] = useState(false);

  const handleAction = async (action: string, data?: any) => {
    try {
      await api.mcpAction(action, data);
      refresh();
      toast.success(`MCP ${action} successful`);
    } catch (e: any) {
      toast.error(e.message || `MCP ${action} failed`);
    }
  };

  const handleAddCustom = async () => {
    if (!customName.trim() || !customCommand.trim()) return;
    const env: Record<string, string> = {};
    customEnv.split('\n').filter(Boolean).forEach(line => {
      const idx = line.indexOf('=');
      if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    await handleAction('add_custom', {
      name: customName.trim(),
      command: customCommand.trim(),
      args: customArgs.trim() ? customArgs.trim().split(/\s+/) : [],
      env: Object.keys(env).length > 0 ? env : undefined,
      cwd: customCwd.trim() || undefined,
      autoStart: customAutoStart,
    });
    setCustomName(''); setCustomCommand(''); setCustomArgs('');
    setCustomEnv(''); setCustomCwd(''); setCustomAutoStart(false);
  };

  if (!open) return null;

  const servers = mcp?.servers || [];
  const clients = mcp?.clients || [];
  const clientCount = Array.isArray(clients) ? clients.length : (typeof clients === 'number' ? clients : 0);
  const toolTotal = mcp?.tools || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <span className="modal-title"><IconPlugConnected size={18} /> MCP Manager</span>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="btn btn-ghost btn-icon" title="Refresh"><IconRefresh size={16} /></button>
            <button className="modal-close" onClick={onClose}><IconX size={18} /></button>
          </div>
        </div>
        <div className="px-5 py-2.5 border-b border-border-muted flex items-center gap-4 text-2xs text-fg-subtle">
          <span><strong className="text-fg-muted font-semibold tabular-nums">{servers.length}</strong> servers</span>
          <span><strong className="text-fg-muted font-semibold tabular-nums">{clientCount}</strong> clients</span>
          <span><strong className="text-fg-muted font-semibold tabular-nums">{toolTotal}</strong> tools</span>
        </div>
        <div className="modal-body">
          {servers.length > 0 ? (
            <div className="space-y-2 mb-4">
              {servers.map(s => (
                <div key={s.name} className="p-3 rounded-[var(--radius-md)] border border-border-default bg-base-2">
                  <div className="flex items-center gap-2">
                    {s.connected
                      ? <IconPlugConnected size={16} className="text-fg-success shrink-0" />
                      : <IconPlugConnectedX size={16} className="text-fg-danger shrink-0" />
                    }
                    <span className="text-sm font-medium flex-1">{s.name}</span>
                    <span className={cn('badge text-2xs', s.connected ? 'badge-accent' : 'badge-danger')}>
                      {s.connected ? 'Connected' : 'Disconnected'}
                    </span>
                    {!s.connected ? (
                      <button onClick={() => handleAction('connect', { name: s.name })}
                        className="btn btn-ghost btn-sm text-2xs">Connect</button>
                    ) : (
                      <button disabled title="This server does not support disconnecting from the UI yet."
                        className="btn btn-ghost btn-sm text-2xs disabled:opacity-40 disabled:cursor-not-allowed">Disconnect</button>
                    )}
                    <button onClick={() => handleAction('remove', { name: s.name })}
                      className="btn btn-ghost btn-icon text-fg-danger">
                      <IconTrash size={14} />
                    </button>
                  </div>
                  {Array.isArray(s.tools) && s.tools.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 ml-6 text-xs text-fg-subtle">
                      <IconTool size={12} /> {s.tools.join(', ')}
                    </div>
                  )}
                  {s.command && (
                    <div className="ml-6 text-2xs text-fg-subtle font-mono mt-0.5">{s.command} {s.args?.join(' ')}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-fg-subtle text-sm mb-4">
              <IconPlugConnected size={32} stroke={1} className="opacity-30 mb-2" />
              <span>No MCP servers configured</span>
            </div>
          )}

          {clientCount > 0 && Array.isArray(clients) && (
            <div className="border-t border-border-default pt-3 pb-2">
              <span className="text-xs font-semibold uppercase text-fg-subtle tracking-wider block mb-2">
                <IconUsers size={14} className="inline mr-1" />Connected Clients
              </span>
              <div className="flex flex-wrap gap-2">
                {clients.map((c: any, i: number) => (
                  <span key={i} className="badge badge-info text-2xs">{c.name}{c.version ? ` ${c.version}` : ''}</span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border-default pt-4">
            <span className="text-sm font-medium block mb-3">Add Custom MCP Server</span>
            <div className="space-y-3">
              <div>
                <label className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle block mb-1">Server name</label>
                <input value={customName} onChange={e => setCustomName(e.target.value)}
                  placeholder="e.g. filesystem" className="input text-sm" />
              </div>
              <div>
                <label className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle block mb-1">Command</label>
                <input value={customCommand} onChange={e => setCustomCommand(e.target.value)}
                  placeholder="npx, uvx, node…" className="input text-sm" />
              </div>
              <div>
                <label className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle block mb-1">Arguments</label>
                <input value={customArgs} onChange={e => setCustomArgs(e.target.value)}
                  placeholder="space-separated" className="input text-sm" />
              </div>
              <div>
                <label className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle block mb-1">Working directory <span className="normal-case font-normal">(optional)</span></label>
                <input value={customCwd} onChange={e => setCustomCwd(e.target.value)}
                  placeholder="C:\\path\\to\\dir" className="input text-sm" />
              </div>
              <div>
                <label className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle block mb-1">Environment <span className="normal-case font-normal">(KEY=VALUE per line, optional)</span></label>
                <textarea value={customEnv} onChange={e => setCustomEnv(e.target.value)}
                  placeholder="API_KEY=..." className="input text-sm min-h-[50px]" />
              </div>
              <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
                <input type="checkbox" checked={customAutoStart} onChange={e => setCustomAutoStart(e.target.checked)}
                  className="rounded border-border-default" />
                Auto-start with Carbon Agent
              </label>
              <button onClick={handleAddCustom} disabled={!customName.trim() || !customCommand.trim()}
                className="btn btn-primary w-full mt-1 disabled:opacity-40 disabled:cursor-not-allowed">
                <IconPlus size={16} /> Add &amp; Connect
              </button>
            </div>
          </div>

          <div className="border-t border-border-default pt-4 mt-4">
            <span className="text-sm font-medium block mb-3">Built-in MCP Servers</span>
            <div className="flex gap-2">
              {['blender', 'scratch', 'godot'].map(name => (
                <button key={name} onClick={() => handleAction('connect_builtin', { name })}
                  className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-[var(--radius-md)] border border-border-default bg-base-2 text-sm text-fg-muted hover:bg-base-3 hover:text-fg-default hover:border-base-5 transition-colors capitalize">
                  <span className="w-1.5 h-1.5 rounded-full bg-fg-accent shrink-0" />
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
