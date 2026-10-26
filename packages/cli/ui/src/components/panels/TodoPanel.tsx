import { useState } from 'react';
import { IconCheckbox, IconCircle, IconCircleCheckFilled, IconTrash, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';

export function TodoPanel() {
  const { todos, setTodos, refresh } = useApp();
  const [newText, setNewText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      const data = await api.updateTodo('add', { text: newText.trim() as any });
      if (data?.todos) setTodos(data.todos); else refresh();
      setNewText('');
    } catch (e: any) {
      setError(e.message || 'Failed to add task');
      console.error('updateTodo failed:', e);
    }
  };

  const handleToggle = async (id: string, isDone: boolean) => {
    try {
      const data = await api.updateTodo(isDone ? 'uncheck' : 'check', { id });
      if (data?.todos) setTodos(data.todos); else refresh();
    } catch (e: any) {
      setError(e.message || 'Failed to update task');
      console.error('updateTodo failed:', e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const data = await api.updateTodo('remove', { id });
      if (data?.todos) setTodos(data.todos); else refresh();
    } catch (e: any) {
      setError(e.message || 'Failed to remove task');
      console.error('updateTodo failed:', e);
    }
  };

  const handleClear = async () => {
    try {
      for (const t of todos.filter(t => t.done)) await api.updateTodo('remove', { id: t.id });
      refresh();
    } catch (e: any) {
      setError(e.message || 'Failed to clear tasks');
      console.error('updateTodo failed:', e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Todo</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-fg-subtle">{todos.filter(t => t.done).length}/{todos.length}</span>
          <button onClick={handleClear} className="flex items-center justify-center w-6 h-6 rounded text-fg-muted hover:text-fg-danger transition-colors" title="Clear completed">
            <IconTrash size={14} stroke={1.5} />
          </button>
          <button onClick={refresh} className="flex items-center justify-center w-6 h-6 rounded text-fg-muted hover:text-fg-default transition-colors" title="Refresh">
            <IconRefresh size={14} stroke={1.5} />
          </button>
        </div>
      </div>
      <div className="px-3 py-2 border-b border-border-default">
        <div className="flex gap-2">
          <input value={newText} onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Add a task..."
            className="flex-1 input text-xs py-1.5"
          />
          <button onClick={handleAdd} disabled={!newText.trim()}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-accent text-accent-ink hover:bg-accent-hover disabled:opacity-40 transition-colors shrink-0">
            <IconPlus size={15} stroke={1.5} />
          </button>
        </div>
      </div>
      {error && (
        <div className="px-3 py-2 text-2xs text-fg-danger bg-[color-mix(in_srgb,var(--fg-danger)_10%,transparent)] border-b border-border-default flex items-start gap-1.5">
          <span className="flex-1 break-words">{error}</span>
          <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100" title="Dismiss">×</button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-fg-subtle text-sm gap-2">
            <IconCheckbox size={28} stroke={1} className="opacity-30" />
            <span>No tasks</span>
          </div>
        ) : (
          todos.map(todo => (
            <div key={todo.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-sidebar-hover transition-colors cursor-pointer border-b border-border-default/30"
              onClick={() => handleToggle(todo.id, todo.done)}>
              {todo.done
                ? <IconCircleCheckFilled size={18} className="text-fg-accent shrink-0" />
                : <IconCircle size={18} stroke={1.5} className="text-fg-subtle shrink-0" />
              }
              <span className={cn('flex-1 text-sm truncate', todo.done && 'line-through text-fg-subtle')}>{todo.text}</span>
              <button onClick={e => { e.stopPropagation(); handleDelete(todo.id); }}
                className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded text-fg-muted hover:text-fg-danger transition-colors shrink-0">
                <IconTrash size={14} stroke={1.5} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
