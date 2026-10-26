import { useRef, useEffect } from 'react';
import { IconCode, IconTestPipe, IconHammer, IconX, IconAlertCircle } from '@tabler/icons-react';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import { Logo } from '../Logo';
import { MessageBody } from '../Markdown';
import { ToolCard } from '../ToolCard';

export function ChatArea() {
  const { messages, streamingContent, liveTools, sendMessage, error, clearError } = useApp();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streamingContent, liveTools]);

  const quickActions = [
    { label: 'Review', icon: IconCode, cmd: 'Review the codebase and suggest improvements' },
    { label: 'Build', icon: IconHammer, cmd: '/build' },
    { label: 'Test', icon: IconTestPipe, cmd: '/test' },
  ];

  const empty = messages.length === 0 && !streamingContent && liveTools.length === 0;

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="mx-5 sm:mx-8 mt-3 flex items-start gap-2 px-3 py-2.5 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--fg-danger)_12%,transparent)] border border-[color-mix(in_srgb,var(--fg-danger)_35%,transparent)] text-sm text-[var(--fg-danger)]">
          <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0 break-words">{error}</span>
          <button onClick={clearError} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity" title="Dismiss">
            <IconX size={15} />
          </button>
        </div>
      )}
      <div ref={listRef} className="flex-1 overflow-y-auto px-5 sm:px-8 pt-6">
        <div className={cn('mx-auto w-full max-w-[44rem]', empty && 'min-h-full flex flex-col justify-center')}>
          {empty ? (
            <div className="chat-empty flex flex-col items-center text-center gap-4 message-enter">
              <Logo size={30} className="text-fg-accent" />
              <h1 className="text-[1.65rem] font-semibold tracking-tight leading-tight">What are we building?</h1>
              <p className="text-[0.9375rem] text-fg-muted max-w-[36ch] leading-relaxed">
                Ask anything, or type <span className="font-mono text-fg-accent">/</span> for commands.
              </p>
              <div className="flex flex-wrap gap-2 pt-1 justify-center">
                {quickActions.map(({ label, icon: Icon, cmd }) => (
                  <button key={label} onClick={() => sendMessage(cmd)} className="btn btn-secondary btn-sm">
                    <Icon size={15} stroke={1.6} /> {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 justify-center">
                {['/clear', '/compact', '/lint', '/refresh'].map(cmd => (
                  <button key={cmd} onClick={() => sendMessage(cmd)}
                    className="px-2.5 py-1 text-xs rounded-full text-fg-subtle hover:text-fg-default hover:bg-base-3 transition-colors font-mono">
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {messages.map((msg, i) => (
                <MessageItem key={msg.id} message={msg} prevModel={messages[i - 1]?.model} />
              ))}
              {(streamingContent || liveTools.length > 0) && (
                <div className="py-4 message-enter">
                  <div className="flex items-center gap-2 mb-1.5 text-2xs">
                    <Logo size={13} className="text-fg-accent" />
                    <span className="font-semibold tracking-wide text-fg-accent">Carbon</span>
                    <span className="flex gap-0.5 items-center">
                      <span className="w-1 h-1 rounded-full bg-fg-accent animate-pulse" />
                      <span className="w-1 h-1 rounded-full bg-fg-accent animate-pulse [animation-delay:150ms]" />
                      <span className="w-1 h-1 rounded-full bg-fg-accent animate-pulse [animation-delay:300ms]" />
                    </span>
                  </div>
                  {streamingContent && (
                    <div className="text-sm">
                      <MessageBody text={streamingContent} />
                      <span className="streaming-cursor" />
                    </div>
                  )}
                  {liveTools.length > 0 && (
                    <div className="mt-2">
                      {liveTools.map(t => <ToolCard key={t.id} tool={t} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 sm:px-8 pb-6">
        <div className="mx-auto w-full max-w-[44rem]">
          <MessageInput />
        </div>
      </div>
    </div>
  );
}
