import { useState, useEffect } from 'react';
import { IconX, IconSettings, IconBrain, IconShieldLock, IconPalette, IconWorld, IconCopy, IconCheck } from '@tabler/icons-react';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'memory' | 'security' | 'custom' | 'browser';

export function SettingsModal({ open, onClose }: Props) {
  const { settings, browserToolStatus, refresh } = useApp();
  const [tab, setTab] = useState<SettingsTab>('general');
  const [localSettings, setLocalSettings] = useState({ ...settings });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (settings) setLocalSettings({ ...settings });
  }, [settings]);

  const handleSave = async () => {
    await api.saveSettings(localSettings as any);
    if ('browserToolEnabled' in localSettings) {
      await api.setBrowserToolEnabled(localSettings.browserToolEnabled as boolean);
    }
    refresh();
    onClose();
  };

  const tabs: { id: SettingsTab; label: string; icon: typeof IconSettings }[] = [
    { id: 'general', label: 'General', icon: IconSettings },
    { id: 'memory', label: 'Memory', icon: IconBrain },
    { id: 'security', label: 'Security', icon: IconShieldLock },
    { id: 'custom', label: 'Customization', icon: IconPalette },
    { id: 'browser', label: 'Browser Tool', icon: IconWorld },
  ];

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 780 }}>
        <div className="modal-header">
          <span className="modal-title"><IconSettings size={18} /> Settings</span>
          <button className="modal-close" onClick={onClose}><IconX size={18} /></button>
        </div>
        <div className="flex flex-1 min-h-0">
          <nav className="w-48 shrink-0 border-r border-border-muted p-2.5 flex flex-col gap-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-sm text-left transition-colors',
                  tab === t.id ? 'bg-accent-subtle text-fg-accent' : 'text-fg-muted hover:bg-base-3 hover:text-fg-default')}>
                <t.icon size={16} stroke={1.5} /> {t.label}
              </button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto p-5">
          {tab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">AI Name</label>
                <input value={localSettings.aiName || ''} onChange={e => setLocalSettings(prev => ({ ...prev, aiName: e.target.value }))}
                  className="input text-sm" placeholder="Carbon" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Extra Instructions</label>
                <textarea value={localSettings.extraInstructions || ''} onChange={e => setLocalSettings(prev => ({ ...prev, extraInstructions: e.target.value }))}
                  className="input text-sm min-h-[100px]" placeholder="Custom instructions for the AI..." />
              </div>
            </div>
          )}
          {tab === 'memory' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Compaction Profile</label>
                <select value={localSettings.compactionProfile} onChange={e => setLocalSettings(prev => ({ ...prev, compactionProfile: e.target.value as any }))}
                  className="input text-sm">
                  <option value="balanced">Balanced</option>
                  <option value="aggressive">Aggressive</option>
                  <option value="off">Off</option>
                </select>
                <p className="text-xs text-fg-subtle mt-1">Controls how aggressively token usage is reduced</p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Thinking Level</label>
                <select value={localSettings.thinkingLevel} onChange={e => setLocalSettings(prev => ({ ...prev, thinkingLevel: parseInt(e.target.value) }))}
                  className="input text-sm">
                  <option value={0}>Off</option>
                  <option value={1}>Minimal</option>
                  <option value={2}>Low</option>
                  <option value={3}>Medium</option>
                  <option value={4}>High</option>
                  <option value={5}>X-High</option>
                </select>
              </div>
            </div>
          )}
          {tab === 'security' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Permission Level</label>
                <div className="flex gap-2">
                  {(['ask', 'safe', 'full'] as const).map(level => (
                    <button key={level} onClick={() => setLocalSettings(prev => ({ ...prev, permissionLevel: level }))}
                      className={cn('flex-1 p-3 rounded-[var(--radius-md)] border text-sm text-left transition-colors',
                        localSettings.permissionLevel === level
                          ? 'border-accent bg-accent-subtle text-fg-accent'
                          : 'border-border-default bg-base-2 text-fg-muted hover:bg-base-3')}>
                      <div className="font-medium capitalize mb-1">{level}</div>
                      <div className="text-xs opacity-70">
                        {level === 'ask' ? 'Ask before each action' : level === 'safe' ? 'Safe auto-execution' : 'Full auto-execution'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab === 'custom' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Theme</label>
                <div className="flex gap-2">
                  {(['dark', 'light', 'tokyo'] as const).map(theme => (
                    <button key={theme} onClick={() => setLocalSettings(prev => ({ ...prev, theme }))}
                      className={cn('flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] border text-sm transition-colors',
                        localSettings.theme === theme
                          ? 'border-accent bg-accent-subtle text-fg-accent'
                          : 'border-border-default bg-base-2 text-fg-muted hover:bg-base-3')}>
                      <IconPalette size={16} /> {theme === 'tokyo' ? 'Tokyo Midnight' : theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab === 'browser' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium block">Browser Tool</label>
                  <p className="text-xs text-fg-subtle mt-0.5">Enable browser automation via Chrome extension</p>
                </div>
                <button onClick={() => setLocalSettings(prev => ({ ...prev, browserToolEnabled: !prev.browserToolEnabled }))}
                  className={cn('relative w-12 h-6 rounded-full transition-colors',
                    localSettings.browserToolEnabled ? 'bg-accent' : 'bg-base-3'
                  )}>
                  <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                    localSettings.browserToolEnabled && 'translate-x-6')} />
                </button>
              </div>

              <div className={cn('space-y-5 transition-opacity', !localSettings.browserToolEnabled && 'opacity-45 pointer-events-none select-none')}>
                <div className="bg-base-2 rounded-[var(--radius-md)] p-3 border border-border-default">
                  <label className="text-xs font-semibold text-fg-subtle uppercase tracking-wider block mb-2">Extension Path</label>
                  <div className="flex items-start gap-2">
                    <code className="flex-1 min-w-0 text-xs font-mono bg-base-1 rounded-[var(--radius-sm)] px-2 py-1.5 break-all select-all"
                      onClick={() => { navigator.clipboard.writeText(browserToolStatus?.extensionPath || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                      {browserToolStatus?.extensionPath || 'Loading...'}
                    </code>
                    <button onClick={() => { navigator.clipboard.writeText(browserToolStatus?.extensionPath || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-full bg-base-3 hover:bg-base-4 transition-colors shrink-0">
                      {copied ? <IconCheck size={14} className="text-success" /> : <IconCopy size={14} />}
                    </button>
                  </div>
                  <ol className="text-xs text-fg-subtle mt-2 space-y-1 list-decimal list-inside marker:text-fg-subtle">
                    <li>Copy this path</li>
                    <li>Open <code className="text-fg-muted bg-base-1 px-1 rounded">chrome://extensions</code></li>
                    <li>Enable Developer mode</li>
                    <li>Click "Load unpacked" and paste the path</li>
                  </ol>
                </div>

                <div className="bg-base-2 rounded-[var(--radius-md)] p-3 border border-border-default">
                  <label className="text-xs font-semibold text-fg-subtle uppercase tracking-wider block mb-2">Connection Status</label>
                  <div className="flex items-center gap-3">
                    <span className={cn('w-3 h-3 rounded-full',
                      browserToolStatus?.connected ? 'bg-success' : 'bg-base-4'
                    )} />
                    <span className="text-sm font-medium">
                      {browserToolStatus?.connected
                        ? `Connected — Port ${browserToolStatus.port}`
                        : 'Not connected'}
                    </span>
                    <span className="text-xs text-fg-subtle ml-auto">
                      {browserToolStatus?.clients || 0} client{browserToolStatus?.clients !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-fg-subtle mt-1.5">
                    Shared port: <code className="text-fg-muted bg-base-1 px-1 rounded">{browserToolStatus?.sharedPortFile || '...'}</code>
                  </p>
                </div>

                <div className="bg-accent-subtle/10 rounded-[var(--radius-md)] p-3 border border-accent/20">
                  <p className="text-xs text-fg-subtle leading-relaxed">
                    <strong className="text-fg-default">How it works:</strong> The Browser Tool uses the existing Chrome extension to connect AI to your real browser with your sessions and cookies. All Carbon instances share the same bridge port.
                  </p>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary"><IconCheck size={16} /> Save</button>
        </div>
      </div>
    </div>
  );
}
