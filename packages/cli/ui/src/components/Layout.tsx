import { useState } from 'react';
import { TopRibbon } from './TopRibbon';
import { Dock } from './Dock';
import { CommandPalette } from './CommandPalette';
import { ChatArea } from './chat/ChatArea';
import { ConversationList } from './panels/ConversationList';
import { FileExplorer } from './panels/FileExplorer';
import { TodoPanel } from './panels/TodoPanel';
import { AgentsPanel } from './panels/AgentsPanel';
import { ContextPanel } from './panels/ContextPanel';
import { SkillsPanel } from './panels/SkillsPanel';
import { FilePreview } from './FilePreview';
import { ModelModal } from './modals/ModelModal';
import { SettingsModal } from './modals/SettingsModal';
import { McpModal } from './modals/McpModal';
import { ReasoningModal } from './modals/ReasoningModal';
import { MemoryModal } from './modals/MemoryModal';
import { useApp } from '../context/AppContext';
import { useKeyboard } from '../hooks/useKeyboard';

export function Layout() {
  const { activeTab, setActiveTab, sidebarOpen, toggleSidebar, ideOpen, toggleIde } = useApp();

  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [reasoningModalOpen, setReasoningModalOpen] = useState(false);
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const selectPanel = (id: string) => {
    if (sidebarOpen && activeTab === id) { toggleSidebar(); return; }
    if (activeTab !== id) setActiveTab(id);
    if (!sidebarOpen) toggleSidebar();
  };

  useKeyboard([
    { key: 'k', ctrl: true, handler: () => setPaletteOpen(true) },
    { key: 'b', ctrl: true, handler: toggleSidebar },
  ]);

  const renderPanel = () => {
    switch (activeTab) {
      case 'chat': return <ConversationList />;
      case 'todo': return <TodoPanel />;
      case 'agents': return <AgentsPanel />;
      case 'context': return <ContextPanel />;
      case 'skills': return <SkillsPanel />;
      case 'files':
      default: return <FileExplorer />;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <TopRibbon
        onOpenPalette={() => setPaletteOpen(true)}
        center={
          <Dock
            activeTab={activeTab}
            sheetOpen={sidebarOpen}
            onSelectPanel={selectPanel}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenModel={() => setModelModalOpen(true)}
            onOpenReasoning={() => setReasoningModalOpen(true)}
            onOpenMcp={() => setMcpModalOpen(true)}
            onOpenMemory={() => setMemoryModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
          />
        }
      />

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col h-full min-w-0">
          <ChatArea />
        </div>

        {(sidebarOpen || ideOpen) && (
          <div
            className="sheet-backdrop"
            onClick={() => { if (sidebarOpen) toggleSidebar(); if (ideOpen) toggleIde(); }}
          />
        )}

        {sidebarOpen && (
          <aside className="sheet sheet-left">{renderPanel()}</aside>
        )}

        {ideOpen && (
          <aside className="sheet sheet-right"><FilePreview /></aside>
        )}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectPanel={selectPanel}
        onOpenModel={() => setModelModalOpen(true)}
        onOpenReasoning={() => setReasoningModalOpen(true)}
        onOpenMcp={() => setMcpModalOpen(true)}
        onOpenMemory={() => setMemoryModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      <ModelModal open={modelModalOpen} onClose={() => setModelModalOpen(false)} />
      <SettingsModal open={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
      <McpModal open={mcpModalOpen} onClose={() => setMcpModalOpen(false)} />
      <ReasoningModal open={reasoningModalOpen} onClose={() => setReasoningModalOpen(false)} />
      <MemoryModal open={memoryModalOpen} onClose={() => setMemoryModalOpen(false)} />
    </div>
  );
}
