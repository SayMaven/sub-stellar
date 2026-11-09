import React from 'react';
import {
  Sparkles,
  Download,
  FileText,
  Sliders,
  Film,
  Settings,
  ChevronLeft,
  ChevronRight,
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
  const { activeTab, setActiveTab, sidebarCollapsed, toggleSidebar } = useStudioStore();

  return (
    <aside
      className={`h-full border-r border-gatefold-line bg-gatefold-panel-strong backdrop-blur-md flex flex-col justify-between transition-all duration-300 z-30 select-none ${
        sidebarCollapsed ? 'w-[68px]' : 'w-[236px]'
      }`}
    >
      {/* Navigation List */}
      <div className="p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gatefold-accent/15 text-gatefold-accent border border-gatefold-accent/30 shadow-[0_0_12px_rgba(143,180,255,0.15)]'
                  : 'text-gatefold-text-2 hover:text-gatefold-text hover:bg-gatefold-hover border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-gatefold-accent' : 'text-gatefold-text-3'}`} />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer / Collapse Button */}
      <div className="p-2 border-t border-gatefold-line">
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gatefold-text-3 hover:text-gatefold-text hover:bg-gatefold-hover transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
