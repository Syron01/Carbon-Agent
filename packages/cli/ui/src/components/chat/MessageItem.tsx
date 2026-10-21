import { memo, useState } from 'react';
import { IconCopy, IconPin, IconPinFilled, IconTrash, IconPencil, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { Message, ToolCall } from '../../types';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';
import { Logo } from '../Logo';
import { MessageBody } from '../Markdown';
import { ToolCard } from '../ToolCard';

interface Props {
  message: Message;
  prevModel?: string;
}

function toText(content: unknown, fallback?: string): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c: any) => c?.text || '').join('');
  return fallback || '';
}

function shortModel(model: string): string {
  const tail = model.split('/').pop() || model;
  return tail.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function MessageItemInner({ message, prevModel }: Props) {
  const { deleteMessage, togglePin } = useApp();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const displayText = toText(message.content, message.text);
  const [editText, setEditText] = useState(displayText);
  const [expanded, setExpanded] = useState(true);

  const isUser = message.role === 'user';
  const hasTools = !isUser && !!message.tools && message.tools.length > 0;

  // An assistant turn that produced neither text nor tools renders as an empty
  // shell; skip it so the transcript never shows a blank "Carbon" block.
  if (!isUser && !displayText.trim() && !hasTools) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const msgTime = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const modelChanged = !isUser && message.model && message.model !== prevModel;
  const actionBtn = 'flex items-center gap-1 px-2 py-1 text-2xs rounded-full text-fg-subtle hover:text-fg-default hover:bg-base-3 transition-colors';

  return (
    <div className={cn('group py-4 message-enter flex', isUser && 'justify-end')}>
      <div className={cn('min-w-0', isUser ? 'max-w-[78%]' : 'w-full')}>
        <div className={cn('flex items-center gap-2 mb-1.5 text-2xs', isUser && 'justify-end')}>
          {!isUser && <Logo size={13} className="text-fg-accent" />}
          <span className={cn('font-semibold tracking-wide', isUser ? 'text-fg-subtle' : 'text-fg-accent')}>
            {isUser ? 'You' : 'Carbon'}
          </span>
          {modelChanged && <span className="text-fg-subtle/70 truncate max-w-[180px]">{shortModel(message.model!)}</span>}
          <span className="text-fg-subtle tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{msgTime}</span>
          {message.pinned && <IconPinFilled size={11} className="text-fg-accent" />}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea value={editText} onChange={e => setEditText(e.target.value)}
              className="input text-sm min-h-[80px]" autoFocus />
            <div className={cn('flex gap-2', isUser && 'justify-end')}>
              <button onClick={() => setEditing(false)} className="btn btn-primary btn-sm">Save</button>
              <button onClick={() => setEditing(false)} className="btn btn-secondary btn-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className={cn(!expanded && displayText.length > 500 && 'max-h-32 overflow-hidden')}>
            {expanded || displayText.length <= 500
              ? <MessageBody text={displayText} />
              : <><MessageBody text={displayText.slice(0, 500)} /><span className="text-fg-subtle">…</span></>}
          </div>
        )}

        {!isUser && displayText.length > 500 && (
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 mt-1 text-2xs text-fg-accent hover:text-accent-hover transition-colors">
            {expanded ? <><IconChevronUp size={13} /> Show less</> : <><IconChevronDown size={13} /> Show more ({displayText.length} chars)</>}
          </button>
        )}

        {!isUser && message.tools && message.tools.length > 0 && (
          <div className="mt-1">
            {message.tools.map((tool: ToolCall) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        <div className={cn('flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity', isUser && 'justify-end')}>
          <button onClick={handleCopy} className={actionBtn}>
            <IconCopy size={13} stroke={1.6} /> {copied ? 'Copied' : 'Copy'}
          </button>
          {isUser && (
            <button onClick={() => { setEditing(true); setEditText(displayText); }} className={actionBtn}>
              <IconPencil size={13} stroke={1.6} /> Edit
            </button>
          )}
          <button onClick={() => togglePin(message.id, !message.pinned)} className={cn(actionBtn,
            message.pinned && 'text-fg-accent bg-accent-subtle')}>
            {message.pinned ? <IconPinFilled size={13} /> : <IconPin size={13} stroke={1.6} />}
          </button>
          <button onClick={() => deleteMessage(message.id)} className={cn(actionBtn, 'hover:text-fg-danger')}>
            <IconTrash size={13} stroke={1.6} />
          </button>
        </div>
      </div>
    </div>
  );
}

export const MessageItem = memo(MessageItemInner);
