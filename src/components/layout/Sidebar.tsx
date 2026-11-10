import React from 'react';
import {
  Sparkles,
  Download,
  FileText,
  Sliders,
  Film,
  Settings,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';
import { useStudioStore } from '../../stores/useStudioStore';
import type { StudioTab } from '../../types';

interface NavItem {
  id: StudioTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'studio', label: 'Studio Viewport', icon: Sparkles },
  { id: 'youtube', label: 'YouTube Downloader', icon: Download },
  { id: 'lyrics', label: 'Lyrics Database', icon: FileText },
  { id: 'presets', label: 'Preset Library', icon: Sliders },
  { id: 'export', label: 'Export Center', icon: Film },
  { id: 'settings', label: 'Appearance & System', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const activeTab = useStudioStore((s) => s.activeTab);
  const setActiveTab = useStudioStore((s) => s.setActiveTab);
  const sidebarCollapsed = useStudioStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStudioStore((s) => s.toggleSidebar);

  return (
    <nav
      aria-label="Workspace navigation"
      className={`h-full shrink-0 border-r border-gatefold-line bg-gatefold-panel-strong flex flex-col justify-between z-30 select-none ${
        sidebarCollapsed ? 'w-14' : 'w-52'
      }`}
    >
      <div className="p-1.5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full h-10 flex items-center gap-3 rounded-md text-sm font-medium border focus-visible:outline focus-visible:outline-2 focus-visible:outline-gatefold-accent ${
                sidebarCollapsed ? 'justify-center px-0' : 'px-3'
              } ${
                isActive
                  ? 'bg-gatefold-accent/15 text-gatefold-accent border-gatefold-accent/30'
                  : 'text-gatefold-text-2 hover:text-gatefold-text hover:bg-gatefold-hover border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-gatefold-accent' : 'text-gatefold-text-3'}`}
              />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      <div className="p-1.5 border-t border-gatefold-line">
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-md text-xs font-medium text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
};
