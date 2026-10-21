import {
  IconHistory, IconFolder, IconChecklist, IconCpu, IconGauge, IconBolt,
  IconCommand, IconStack2, IconBrain, IconPlugConnected, IconDatabase, IconAdjustmentsHorizontal,
} from '@tabler/icons-react';
import { cn } from '../lib/utils';

interface Props {
  activeTab: string;
  sheetOpen: boolean;
  onSelectPanel: (id: string) => void;
  onOpenPalette: () => void;
  onOpenModel: () => void;
  onOpenReasoning: () => void;
  onOpenMcp: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
}

const panels = [
  { id: 'chat', icon: IconHistory, label: 'History' },
  { id: 'files', icon: IconFolder, label: 'Explorer' },
  { id: 'todo', icon: IconChecklist, label: 'Tasks' },
  { id: 'agents', icon: IconCpu, label: 'Sub-agents' },
  { id: 'context', icon: IconGauge, label: 'Context' },
  { id: 'skills', icon: IconBolt, label: 'Skills' },
];

function DockButton({ icon: Icon, label, active, onClick }: { icon: any; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('dock-item', active && 'active')} aria-label={label}>
      <Icon size={17} stroke={1.6} />
      <span className="dock-tip">{label}</span>
    </button>
  );
}

export function Dock({
  activeTab, sheetOpen, onSelectPanel, onOpenPalette, onOpenModel, onOpenReasoning, onOpenMcp, onOpenMemory, onOpenSettings,
}: Props) {
  return (
    <nav className="dock">
      {panels.map(p => (
        <DockButton
          key={p.id}
          icon={p.icon}
          label={p.label}
          active={sheetOpen && activeTab === p.id}
          onClick={() => onSelectPanel(p.id)}
        />
      ))}
      <span className="dock-sep" />
      <DockButton icon={IconCommand} label="Command palette" onClick={onOpenPalette} />
      <DockButton icon={IconStack2} label="Model" onClick={onOpenModel} />
      <DockButton icon={IconBrain} label="Reasoning" onClick={onOpenReasoning} />
      <DockButton icon={IconPlugConnected} label="MCP" onClick={onOpenMcp} />
      <DockButton icon={IconDatabase} label="Memory" onClick={onOpenMemory} />
      <DockButton icon={IconAdjustmentsHorizontal} label="Settings" onClick={onOpenSettings} />
    </nav>
  );
}
