import React, { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { TransportBar } from './TransportBar';
import { MainStage } from '../studio/MainStage';
import { YouTubeDrawer } from '../youtube/YouTubeDrawer';
import { LyricsDrawer } from '../lyrics/LyricsDrawer';
import { PresetsDrawer } from '../presets/PresetsDrawer';
import { ExportDrawer } from '../export/ExportDrawer';
import { SettingsModal } from '../settings/SettingsModal';
import { TelemetryOverlay } from '../common/TelemetryOverlay';
import { useStudioStore } from '../../stores/useStudioStore';
import { usePerfStore } from '../../stores/usePerfStore';

export const Shell: React.FC = () => {
  const { activeTab, togglePlay, stepTime, setActiveTab } = useStudioStore();
  const { cycleQualityMode, toggleTelemetry } = usePerfStore();

  // Keyboard shortcut controller
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        cycleQualityMode();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setActiveTab('youtube');
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTelemetry();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepTime(e.shiftKey ? -1.0 : -0.1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepTime(e.shiftKey ? 1.0 : 0.1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, cycleQualityMode, setActiveTab, toggleTelemetry, stepTime]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'studio':
        return <MainStage />;
      case 'youtube':
        return <YouTubeDrawer />;
      case 'lyrics':
        return <LyricsDrawer />;
      case 'presets':
        return <PresetsDrawer />;
      case 'export':
        return <ExportDrawer />;
      case 'settings':
        return <SettingsModal />;
      default:
        return <MainStage />;
    }
  };

  return (
    <div className="relative w-screen h-screen flex flex-col overflow-hidden bg-gatefold-bg text-gatefold-text">
      {/* Dynamic Ambient Aurora Glow Backlight */}
      <div className="ambient-aurora-bg">
        <div className="aurora-blob-1" />
        <div className="aurora-blob-2" />
        <div className="aurora-blob-3" />
      </div>

      {/* Top Header (46px) */}
      <Header />

      {/* Middle Workspace: Collapsible Sidebar + Main Viewport / Drawer */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        <Sidebar />
        <main className="flex-1 flex overflow-hidden">{renderActiveView()}</main>
      </div>

      {/* Bottom Transport Bar (92px) */}
      <TransportBar />

      {/* Diagnostics / Telemetry Overlay */}
      <TelemetryOverlay />
    </div>
  );
};
