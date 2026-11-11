export type QualityMode = 'low' | 'balanced' | 'ultra';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3';

export type CanvasResolutionPreset = '720p' | '1080p' | '1440p' | '4k';

export type WordAnimationStyle =
  | 'pop'
  | 'sweep'
  | 'smooth-sweep'
  | 'float'
  | 'glow-pulse'
  | 'slide'
  | 'staccato'
  | 'zoom-strike'
  | 'wave';

export type StudioTab = 'studio' | 'youtube' | 'lyrics' | 'presets' | 'export' | 'settings';

export type ProjectStatus = 'idle' | 'loading' | 'ready' | 'error';

export type ParticlePresetType =
  | 'stardust'
  | 'sparkle'
  | 'cosmic'
  | 'sakura'
  | 'notes'
  | 'firefly'
  | 'heart';

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
  disableAnim?: boolean;
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
  fillGradientEnabled: boolean;
  fillGradientEndColor: string;
  outerStrokeColor: string;
  outerStrokeWidth: number;
  innerStrokeColor: string;
  innerStrokeWidth: number;
  glowColor: string;
  glowBlur: number;
  rubyFillColor: string;
  rubyActiveColor: string;
  translationFillColor: string;
  verticalPosition: 'bottom' | 'center' | 'top';
  xOffset: number;
  yOffset: number;
  rubyScale: number;
  showSafeGuides: boolean;
  particlePreset: ParticlePresetType;
  particleBurstCount: number;
  particleEnabled: boolean;
  particleSpeed: number; // 0.5x .. 2.5x multiplier (default 1.0)
  particleGravity: 'up' | 'none' | 'down'; // particle vertical acceleration
  particleSize: number; // 0.5x .. 2.5x scale multiplier (default 1.0)
  particleLifetime: number; // 0.5x .. 2.5x decay multiplier (default 1.0)
  particleColorMode: 'lyric' | 'glow' | 'rainbow'; // tint strategy
  wordTransitionMs: number;
  wordAnimStyle: WordAnimationStyle;
  wordActiveColor: string;
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
  mediaFilePath?: string;
}

export interface SubStellarProjectFile {
  version: string;
  savedAt: string;
  aspectRatio: AspectRatio;
  canvasResolution: CanvasResolutionPreset;
  track: TrackMetadata;
  style: SubtitleStyle;
  lines: SubtitleLine[];
}
