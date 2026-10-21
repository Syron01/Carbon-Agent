import { IconCpu, IconCheck, IconX, IconLoader2 } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';

export function AgentsPanel() {
  const { subAgents } = useApp();
  const running = subAgents.filter(a => a.status === 'running').length;
  const completed = subAgents.filter(a => a.status === 'completed').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Sub-Agents</span>
        <span className="text-xs text-fg-subtle">{running} running · {completed} done</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {subAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-fg-subtle text-sm gap-2">
            <IconCpu size={28} stroke={1} className="opacity-30" />
            <span>No sub-agents</span>
          </div>
        ) : (
          subAgents.map(agent => (
            <div key={agent.id} className="px-3 py-2.5 border-b border-border-default/50 hover:bg-sidebar-hover transition-colors">
              <div className="flex items-center gap-2">
                {agent.status === 'running' ? <IconLoader2 size={16} className="animate-spin text-fg-info shrink-0" />
                  : agent.status === 'completed' ? <IconCheck size={16} className="text-fg-success shrink-0" />
                  : <IconX size={16} className="text-fg-danger shrink-0" />}
                <span className="text-sm flex-1 truncate font-medium">{agent.taskName}</span>
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full',
                  agent.status === 'running' ? 'badge-info' : agent.status === 'completed' ? 'badge-accent' : 'badge-danger')}>
                  {agent.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 ml-6 text-xs text-fg-subtle">
                <span>{agent.toolCalls} tool calls</span>
                {agent.duration != null && <span>{agent.duration.toFixed(1)}s</span>}
                {agent.model && <span className="truncate max-w-[120px]">{agent.model}</span>}
              </div>
              {agent.content && (
                <div className="mt-1.5 ml-6 text-xs text-fg-subtle/80 line-clamp-2 whitespace-pre-wrap break-words">
                  {agent.content}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
