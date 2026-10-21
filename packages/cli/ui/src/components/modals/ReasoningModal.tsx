import { useState } from 'react';
import { IconX, IconBrain } from '@tabler/icons-react';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

const LEVELS = [
  { value: 0, label: 'Off', desc: 'No reasoning, fastest responses' },
  { value: 1, label: 'Minimal', desc: 'Minimal reasoning for simple tasks' },
  { value: 2, label: 'Low', desc: 'Low level reasoning' },
  { value: 3, label: 'Medium', desc: 'Balanced reasoning depth' },
  { value: 4, label: 'High', desc: 'Deep reasoning for complex tasks' },
  { value: 5, label: 'X-High', desc: 'Maximum reasoning depth' },
];

export function ReasoningModal({ open, onClose }: Props) {
  const { settings, setThinking } = useApp();
  const [selected, setSelected] = useState(settings?.thinkingLevel ?? 1);

  const handleSelect = async (level: number) => {
    setSelected(level);
    await setThinking(level);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-title"><IconBrain size={18} /> Thinking Level</span>
          <button className="modal-close" onClick={onClose}><IconX size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="space-y-1">
            {LEVELS.map(l => (
              <div key={l.value} onClick={() => handleSelect(l.value)}
                className={cn('flex items-center gap-3 p-3 rounded-[var(--radius-md)] cursor-pointer transition-colors border',
                  selected === l.value
                    ? 'border-accent bg-accent-subtle'
                    : 'border-transparent hover:bg-base-3')}>
                <div className={cn('w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center text-sm font-bold',
                  selected === l.value ? 'bg-accent text-accent-ink' : 'bg-base-3 text-fg-muted')}>
                  {l.label[0]}
                </div>
                <div>
                  <div className="text-sm font-medium">{l.label}</div>
                  <div className="text-xs text-fg-subtle">{l.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
