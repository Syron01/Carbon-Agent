import { useEffect, useState } from 'react';
import { IconGauge, IconLoader2 } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

function formatTokens(n: number | null | undefined): string {
  if (n == null) return '--';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function ContextPanel() {
  const { status, refreshStatus } = useApp();
  const ctx = status?.contextUsage;
  const compaction = status?.compaction;

  const percent = ctx?.percent ?? 0;
  const threshold = compaction?.thresholdPercent ?? null;
  const enabled = compaction?.enabled ?? true;

  const [draftThreshold, setDraftThreshold] = useState<number>(threshold ?? 80);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (threshold != null) setDraftThreshold(threshold);
  }, [threshold]);

  const saveThreshold = async (value: number | null) => {
    setBusy(true);
    try {
      await api.setCompactionThreshold(value);
      await refreshStatus?.();
    } catch {
      /* surfaced via global error state */
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async () => {
    setBusy(true);
    try {
      await api.setAutoCompaction(!enabled);
      await refreshStatus?.();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const overThreshold = threshold != null && percent >= threshold;
  const barColor = overThreshold ? 'bg-danger' : percent > (threshold ?? 80) * 0.8 ? 'bg-warning' : 'bg-accent';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Context</span>
        {busy && <IconLoader2 size={14} className="animate-spin text-fg-subtle" />}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Usage */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">{percent.toFixed(1)}%</span>
            <span className="text-xs text-fg-subtle tabular-nums">
              {formatTokens(ctx?.tokens)} / {formatTokens(ctx?.contextWindow)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-base-3 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-[width] duration-300', barColor)}
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
          {!ctx && (
            <p className="text-xs text-fg-subtle flex items-center gap-1.5">
              <IconGauge size={13} stroke={1.5} />
              Waiting for the first message...
            </p>
          )}
        </div>

        {/* Auto-compaction */}
        <div className="rounded-[var(--radius-md)] border border-border-default p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Auto-compaction</div>
              <div className="text-xs text-fg-subtle">Compact when context reaches the threshold</div>
            </div>
            <button
              onClick={toggleAuto}
              className={cn('relative w-9 h-5 rounded-full transition-colors shrink-0',
                enabled ? 'bg-accent' : 'bg-base-3')}
              title={enabled ? 'Disable auto-compaction' : 'Enable auto-compaction'}
            >
              <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-[left]',
                enabled ? 'left-[18px]' : 'left-0.5')} />
            </button>
          </div>

          <div className={cn('space-y-2', !enabled && 'opacity-40 pointer-events-none')}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">Compact at</span>
              <span className="tabular-nums font-medium">
                {threshold == null ? 'Auto (profile)' : `${draftThreshold}%`}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={95}
              step={1}
              value={draftThreshold}
              onChange={(e) => setDraftThreshold(Number(e.target.value))}
              onMouseUp={(e) => saveThreshold(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => saveThreshold(Number((e.target as HTMLInputElement).value))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setDraftThreshold(80); saveThreshold(80); }}
                className="btn btn-secondary text-2xs px-2 py-1 flex-1"
              >
                Use 80%
              </button>
              <button
                onClick={() => saveThreshold(null)}
                className="btn btn-secondary text-2xs px-2 py-1 flex-1"
                title="Fall back to the compaction profile's automatic threshold"
              >
                Auto
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-fg-subtle leading-relaxed">
          Profile: <span className="text-fg-muted">{compaction?.profile ?? 'balanced'}</span>
          {threshold != null && (
            <> · Overrides the profile ceiling with a fixed share of the context window.</>
          )}
        </div>
      </div>
    </div>
  );
}
