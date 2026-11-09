export type QualityMode = 'low' | 'balanced' | 'ultra';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3';

export type StudioTab = 'studio' | 'youtube' | 'lyrics' | 'presets' | 'export' | 'settings';

export type ProjectStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PerfMetrics {
  fps: number;
  activeParticles: number;
  frameTimeMs: number;
  droppedFrames: number;
  memoryMbEst: number;
}

export interface PerfProfile {
  mode: QualityMode;
  maxParticles: number;
  previewResolution: '720p' | '1080p';
  renderScale: number;
  bloomEnabled: boolean;
  supersampling: boolean;
  downsampledPeaksCount: number;
}

export interface ThemeTokens {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  glow: string;
  blob1: string;
  blob2: string;
  blob3: string;
}

export type ThemePresetName = 'default' | 'sakura' | 'cyberpunk' | 'aurora' | 'monochrome' | 'cover';

export interface RubyToken {
  text: string;
  ruby?: string;
  startTime: number;
  endTime: number;
}

export interface SubtitleLine {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  tokens: RubyToken[];
  translation?: string;
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fillColor: string;
  outerStrokeColor: string;
  outerStrokeWidth: number;
  innerStrokeColor: string;
  innerStrokeWidth: number;
  glowColor: string;
  glowBlur: number;
  verticalPosition: 'bottom' | 'center' | 'top';
  yOffset: number;
  rubyScale: number;
  showSafeGuides: boolean;
}

export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  bpm?: number;
  coverUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
}
