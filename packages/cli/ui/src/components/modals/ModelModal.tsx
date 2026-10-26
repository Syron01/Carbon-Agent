import { useState, useEffect, useRef } from 'react';
import { IconX, IconSearch, IconLock, IconLockOpen } from '@tabler/icons-react';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import type { ModelInfo } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f', anthropic: '#d4a574', google: '#4285f4',
  groq: '#f55036', openrouter: '#84309c', deepseek: '#4f6bf5',
  perplexity: '#1e1b4b', together: '#fa2f5e',
  ollama: '#f5a623', 'lm-studio': '#6366f1',
  opencode: '#8b5cf6', minimax: '#06b6d4',
};

const PROVIDER_INITIALS: Record<string, string> = {
  openai: 'O', anthropic: 'A', google: 'G', groq: 'G',
  openrouter: 'OR', deepseek: 'D', perplexity: 'P',
  together: 'T', ollama: 'OL', 'lm-studio': 'LM',
  opencode: 'OC', minimax: 'MX',
};

export function ModelModal({ open, onClose }: Props) {
  const { models, setModel, status, refresh } = useApp();
  const [tab, setTab] = useState<'cloud' | 'local'>('cloud');
  const [localTab, setLocalTab] = useState<'ollama' | 'lm-studio'>('ollama');
  const [search, setSearch] = useState('');

  const isCloud = (m: ModelInfo) => !['ollama', 'lm-studio'].includes(m.provider);
  const matchesSearch = (m: ModelInfo) =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase());

  const cloudModels = models.filter(m => isCloud(m) && matchesSearch(m))
    .sort((a, b) => {
      if (a.authenticated !== b.authenticated) return a.authenticated ? -1 : 1;
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return a.name.localeCompare(b.name);
    });

  const ollamaModels = models.filter(m => m.provider === 'ollama' && matchesSearch(m))
    .sort((a, b) => a.name.localeCompare(b.name));

  const lmStudioModels = models.filter(m => m.provider === 'lm-studio' && matchesSearch(m))
    .sort((a, b) => a.name.localeCompare(b.name));

  const groupedCloud = cloudModels.reduce((acc, m) => {
    (acc[m.provider] = acc[m.provider] || []).push(m);
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Stop any auth-status polling when the modal closes or unmounts
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, []);

  const handleSelect = async (provider: string, modelId: string) => {
    await setModel(provider, modelId);
    onClose();
  };

  const handleLogin = (provider: string) => {
    window.open(`http://127.0.0.1:3131/login?provider=${provider}`, 'auth', 'width=600,height=700');
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getAuthStatus();
        if (data?.isLoggedIn) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          refresh();
        }
      } catch {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 2000);
  };

  if (!open) return null;

  const renderModelItem = (m: ModelInfo) => (
    <div key={m.id} onClick={() => { if (!m.authenticated && isCloud(m)) return; handleSelect(m.provider, m.id); }}
      className={cn('model-item', status?.model === m.id && 'selected', !m.authenticated && isCloud(m) && 'opacity-50 cursor-not-allowed')}>
      <div className="model-icon" style={{ background: `${PROVIDER_COLORS[m.provider] || '#555'}20`, color: PROVIDER_COLORS[m.provider] || '#888' }}>
        {PROVIDER_INITIALS[m.provider] || m.provider[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{m.name}</div>
        <div className="text-xs text-fg-subtle truncate font-mono">{m.id}</div>
      </div>
      {m.context && <span className="badge badge-info text-2xs">{(m.context / 1000).toFixed(0)}k</span>}
      {!m.authenticated && isCloud(m) && (
        <IconLock size={14} className="text-fg-subtle shrink-0" />
      )}
      {status?.model === m.id && <span className="badge badge-accent text-2xs">Active</span>}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title"><IconSearch size={18} /> Select Model</span>
          <button className="modal-close" onClick={onClose}><IconX size={18} /></button>
        </div>
        <div className="px-4 pt-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..."
            className="input text-sm" autoFocus />
        </div>
        {status?.model && (() => {
          const current = models.find(m => m.id === status.model);
          return (
            <div className="flex items-center gap-2 mx-4 mt-3 px-3 py-2 rounded-[var(--radius-md)] bg-base-2 border border-border-default">
              <div className="model-icon" style={{ background: `${PROVIDER_COLORS[current?.provider || ''] || '#555'}20`, color: PROVIDER_COLORS[current?.provider || ''] || '#888' }}>
                {PROVIDER_INITIALS[current?.provider || ''] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xs uppercase tracking-wider text-fg-subtle">Current model</div>
                <div className="text-sm font-medium truncate">{current?.name || status.model}</div>
              </div>
              {current?.context && <span className="badge badge-info text-2xs">{(current.context / 1000).toFixed(0)}k</span>}
            </div>
          );
        })()}
        <div className="flex gap-0 px-4 border-b border-border-default">
          <button onClick={() => setTab('cloud')} className={cn('tab', tab === 'cloud' && 'active')}>Cloud</button>
          <button onClick={() => setTab('local')} className={cn('tab', tab === 'local' && 'active')}>Local</button>
        </div>
        <div className="modal-body">
          {tab === 'cloud' ? (
            Object.keys(groupedCloud).length > 0 ? (
              Object.entries(groupedCloud).map(([provider, ms]) => (
                <div key={provider} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase text-fg-subtle tracking-wider">{provider}</span>
                    {!ms[0]?.authenticated && (
                      <button onClick={() => handleLogin(provider)}
                        className="flex items-center gap-1 px-2 py-1 text-2xs rounded-full bg-accent-subtle text-fg-accent hover:bg-accent-subtle/70 transition-colors">
                        <IconLockOpen size={12} /> Login
                      </button>
                    )}
                  </div>
                  {ms.map(renderModelItem)}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-fg-subtle text-sm">
                {search ? 'No models match your search' : 'No cloud models available'}
              </div>
            )
          ) : (
            /* Local tab: Ollama + LM Studio split */
            <div>
              <div className="flex gap-0 mb-4 border-b border-border-default">
                <button onClick={() => setLocalTab('ollama')} className={cn('tab', localTab === 'ollama' && 'active')}>Ollama</button>
                <button onClick={() => setLocalTab('lm-studio')} className={cn('tab', localTab === 'lm-studio' && 'active')}>LM Studio</button>
              </div>

              {localTab === 'ollama' && (
                <div>
                  {ollamaModels.length > 0 ? (
                    <div className="mb-2">
                      {ollamaModels.map(renderModelItem)}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-fg-subtle text-sm">
                      <span>No Ollama models found</span>
                      <span className="text-xs mt-1">Make sure Ollama is running and has models pulled</span>
                    </div>
                  )}
                </div>
              )}

              {localTab === 'lm-studio' && (
                <div>
                  {lmStudioModels.length > 0 ? (
                    <div className="mb-2">
                      {lmStudioModels.map(renderModelItem)}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-fg-subtle text-sm">
                      <span>No LM Studio models found</span>
                      <span className="text-xs mt-1">Make sure LM Studio is running with API server enabled</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
