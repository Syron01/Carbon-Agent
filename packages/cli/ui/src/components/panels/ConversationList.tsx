import { useState } from 'react';
import { IconPlus, IconMessage, IconTrash, IconPencil, IconCheck } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { cn, formatTime, truncate } from '../../lib/utils';

export function ConversationList() {
  const { conversations, activeConversationId, switchConversation, newConversation, deleteConversation, renameConversation } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleRename = async (id: string) => {
    if (editName.trim()) await renameConversation(id, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Conversations</span>
        <button onClick={newConversation} className="flex items-center justify-center w-6 h-6 rounded-full text-fg-muted hover:text-fg-default hover:bg-sidebar-hover transition-colors" title="New conversation">
          <IconPlus size={16} stroke={1.5} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-fg-subtle text-sm gap-2">
            <IconMessage size={28} stroke={1} className="opacity-30" />
            <span>No conversations</span>
            <button onClick={newConversation} className="btn btn-primary btn-sm mt-1">Start new</button>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => switchConversation(conv.id)}
              className={cn(
                'group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors border-b border-border-default/50',
                activeConversationId === conv.id
                  ? 'bg-sidebar-active text-fg-default'
                  : 'text-fg-muted hover:bg-sidebar-hover hover:text-fg-default'
              )}
            >
              <IconMessage size={16} stroke={1.5} className="shrink-0 opacity-50" />
              <div className="flex-1 min-w-0">
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1">
                    <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                      onBlur={() => handleRename(conv.id)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(conv.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 bg-base-2 border border-border-default rounded px-1.5 py-0.5 text-sm text-fg-default outline-none"
                      onClick={e => e.stopPropagation()}
                    />
                    <button onClick={e => { e.stopPropagation(); handleRename(conv.id); }} className="text-fg-accent"><IconCheck size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm truncate font-medium">{truncate(conv.name || 'Untitled', 28)}</div>
                    <div className="text-xs text-fg-subtle mt-0.5">{conv.messageCount || 0} msgs · {formatTime(conv.updatedAt || conv.createdAt)}</div>
                  </>
                )}
              </div>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button onClick={e => { e.stopPropagation(); setEditingId(conv.id); setEditName(conv.name || ''); }}
                  className="flex items-center justify-center w-6 h-6 rounded text-fg-muted hover:text-fg-default hover:bg-base-3 transition-colors">
                  <IconPencil size={14} stroke={1.5} />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="flex items-center justify-center w-6 h-6 rounded text-fg-muted hover:text-fg-danger hover:bg-base-3 transition-colors">
                  <IconTrash size={14} stroke={1.5} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
