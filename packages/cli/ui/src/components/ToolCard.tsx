import { useState } from 'react';
import { IconChevronDown, IconChevronUp, IconCheck, IconX, IconLoader2 } from '@tabler/icons-react';
import type { ToolCall } from '../types';

export function ToolCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = tool.status === 'running';
  const isDone = tool.status === 'done';
  const isError = tool.status === 'error';

  const icon = isRunning ? <IconLoader2 size={13} className="animate-spin" /> :
    isDone ? <IconCheck size={13} className="text-fg-success" /> :
    <IconX size={13} className="text-fg-danger" />;

  return (
    <div className="my-1.5 rounded-[var(--radius-md)] border border-border-muted bg-base-1/40 overflow-hidden">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-base-2/60 transition-colors select-none"
      >
        <span className="shrink-0">{icon}</span>
        <span className="text-xs flex-1 truncate font-mono text-fg-muted">{tool.tool}</span>
        {tool.duration !== undefined && (
          <span className="text-2xs text-fg-subtle shrink-0 tabular-nums">{(tool.duration / 1000).toFixed(1)}s</span>
        )}
        <span className="shrink-0 text-fg-subtle">
          {expanded ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
        </span>
      </div>
      {expanded && (
        <div className="border-t border-border-muted">
          {tool.input && (
            <div className="px-3 py-2 border-b border-border-muted">
              <div className="tool-section-label">Input</div>
              <pre className="text-xs text-fg-muted whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">{tool.input}</pre>
            </div>
          )}
          {tool.output && (
            <div className="px-3 py-2">
              <div className="tool-section-label">Output</div>
              <pre className={`text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto ${isRunning ? 'text-fg-info' : isError ? 'text-fg-danger' : 'text-fg-muted'}`}>{tool.output}</pre>
            </div>
          )}
          {!tool.output && isRunning && (
            <div className="px-3 py-2 text-xs text-fg-subtle">Running…</div>
          )}
        </div>
      )}
    </div>
  );
}
