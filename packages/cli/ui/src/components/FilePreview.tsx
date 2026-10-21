import { IconX, IconLoader2 } from '@tabler/icons-react';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp']);

function isImage(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext ? IMAGE_EXTS.has(`.${ext}`) : false;
}

export function FilePreview() {
  const { openFiles, activeFilePath, closeFile, setActiveFile } = useApp();
  const active = openFiles.find(f => f.path === activeFilePath) || openFiles[0];

  if (openFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-fg-subtle text-sm gap-2 px-4">
        <span className="opacity-50 text-lg">📄</span>
        <span>Click a file to preview</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b border-border-default overflow-x-auto shrink-0">
        {openFiles.map(f => (
          <div
            key={f.path}
            onClick={() => setActiveFile(f.path)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-border-default shrink-0 max-w-[140px] transition-colors',
              (activeFilePath || openFiles[0]?.path) === f.path
                ? 'bg-base-2 text-fg-default border-b-2 border-b-accent'
                : 'text-fg-muted hover:text-fg-default hover:bg-sidebar-hover'
            )}
          >
            <span className="truncate">{f.name}</span>
            <button
              onClick={e => { e.stopPropagation(); closeFile(f.path); }}
              className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-base-4 transition-colors"
            >
              <IconX size={12} stroke={1.5} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {active?.loading ? (
          <div className="flex items-center justify-center h-full text-fg-subtle text-sm">
            <IconLoader2 size={16} className="animate-spin mr-2" /> Loading...
          </div>
        ) : active?.error ? (
          <div className="flex items-center justify-center h-full text-fg-danger text-sm">{active.error}</div>
        ) : active ? (
          isImage(active.name) ? (
            <div className="flex items-center justify-center h-full p-4">
              <img src={active.content} alt={active.name} className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          ) : (
            <pre className="p-4 text-sm font-mono leading-relaxed text-fg-default whitespace-pre-wrap break-all overflow-x-hidden">
              {active.content}
            </pre>
          )
        ) : null}
      </div>
    </div>
  );
}
