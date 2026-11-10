import React, { useEffect, useRef } from 'react';
import { Application, Container, Text, TextStyle, Graphics, FillGradient } from 'pixi.js';
import { usePerfStore } from '../../stores/usePerfStore';
import { useStudioStore } from '../../stores/useStudioStore';
import { tokenizeSubtitleText, computeRubyPosition } from '../../engine/text/RubyLayout';
import { getCanvasPixelDimensions } from '../../engine/layout/layoutMath';
import { ParticleManager } from '../../engine/particles/ParticleManager';
import { playbackEngine } from '../../engine/audio/PlaybackEngine';
import type { ParticlePresetType } from '../../types';
import { Music, Play } from 'lucide-react';

const CJK_TOKEN_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

function hexToNumber(hex: string, fallback = 0x8fb4ff): number {
  const cleaned = (hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return parseInt(cleaned, 16);
  }
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = cleaned[0];
    const g = cleaned[1];
    const b = cleaned[2];
    return parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
  }
  return fallback;
}

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

export const PixiViewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const appRef = useRef<Application | null>(null);
  const subtitleGroupRef = useRef<Container | null>(null);
  const safeGuidesRef = useRef<Graphics | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const lastActiveIndexRef = useRef<number>(-1);

  const { profile, updateMetrics } = usePerfStore();
  const {
    currentTime,
    lines,
    style,
    track,
    isPlaying,
    togglePlay,
    selectedLineId,
    aspectRatio,
    canvasResolution,
  } = useStudioStore();

  const canvasDims = getCanvasPixelDimensions(aspectRatio, canvasResolution);
  const canvasWidth = canvasDims.width;
  const canvasHeight = canvasDims.height;

  // Bind media element to playback engine
  useEffect(() => {
    const el = videoRef.current || audioRef.current;
    if (el) {
      playbackEngine.bindMediaElement(el);
    }
  }, [track.videoUrl, track.audioUrl]);

  // Initialize PixiJS v8 Application & Zero-GC Particle Manager
  useEffect(() => {
    let isMounted = true;
    let localApp: Application | null = null;
    let localParticleManager: ParticleManager | null = null;

    async function initPixi() {
      if (!containerRef.current) return;

      const app = new Application();
      await app.init({
        width: canvasWidth,
        height: canvasHeight,
        backgroundAlpha: 0,
        antialias: profile.bloomEnabled,
        resolution: profile.renderScale,
        autoDensity: true,
      });

      if (!isMounted) {
        app.destroy(true, { children: true });
        return;
      }

      localApp = app;
      appRef.current = app;
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(app.canvas);

      // Safe Margins Guide Layer (Action Safe 93%, Title Safe 90%)
      const safeGuides = new Graphics();
      safeGuides.visible = style.showSafeGuides;
      app.stage.addChild(safeGuides);
      safeGuidesRef.current = safeGuides;

      const actionW = canvasWidth * 0.93;
      const actionH = canvasHeight * 0.93;
      safeGuides.rect((canvasWidth - actionW) / 2, (canvasHeight - actionH) / 2, actionW, actionH);
      safeGuides.stroke({ color: 0x8fb4ff, alpha: 0.15, width: 1 });

      const titleW = canvasWidth * 0.9;
      const titleH = canvasHeight * 0.9;
      safeGuides.rect((canvasWidth - titleW) / 2, (canvasHeight - titleH) / 2, titleW, titleH);
      safeGuides.stroke({ color: 0x8fb4ff, alpha: 0.25, width: 1 });

      // Zero-GC Particle Manager with ParticleContainer
      localParticleManager = new ParticleManager(profile.maxParticles);
      particleManagerRef.current = localParticleManager;
      app.stage.addChild(localParticleManager.stageContainer);

      // Subtitle Display Group (Rendered above particles)
      const subtitleGroup = new Container();
      app.stage.addChild(subtitleGroup);
      subtitleGroupRef.current = subtitleGroup;

      // Render Ticker
      let lastTime = performance.now();
      let frameCount = 0;
      let lastFpsCheck = performance.now();

      app.ticker.add(() => {
        const now = performance.now();
        const deltaSeconds = (now - lastTime) / 1000;
        lastTime = now;
        frameCount++;

        // Update particle physics without GC allocations
        if (localParticleManager && style.particleEnabled) {
          localParticleManager.update(deltaSeconds);
        }

        // FPS & Performance Telemetry
        if (now - lastFpsCheck >= 1000) {
          const fps = Math.round((frameCount * 1000) / (now - lastFpsCheck));
          updateMetrics({
            fps,
            frameTimeMs: deltaSeconds * 1000,
            activeParticles: localParticleManager?.activeCount || 0,
          });
          frameCount = 0;
          lastFpsCheck = now;
        }
      });
    }

    initPixi();

    return () => {
      isMounted = false;
      if (localParticleManager) {
        localParticleManager.destroy();
        particleManagerRef.current = null;
      }
      if (localApp) {
        localApp.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [
    canvasWidth,
    canvasHeight,
    profile.mode,
    profile.maxParticles,
    profile.bloomEnabled,
    profile.renderScale,
    updateMetrics,
    style.particleEnabled,
  ]);

  // Update Safe Guides visibility
  useEffect(() => {
    if (safeGuidesRef.current) {
      safeGuidesRef.current.visible = style.showSafeGuides;
    }
  }, [style.showSafeGuides]);

  // Listen for manual burst trigger (e.g. from Inspector "Test Burst")
  useEffect(() => {
    const handleTriggerBurst = (e: Event) => {
      const custom = e as CustomEvent<{
        x?: number;
        y?: number;
        preset?: ParticlePresetType;
        count?: number;
        color?: number;
      }>;
      if (particleManagerRef.current && style.particleEnabled) {
        const x = custom.detail?.x ?? canvasWidth / 2;
        const y = custom.detail?.y ?? canvasHeight / 2;
        const preset = custom.detail?.preset ?? style.particlePreset;
        const count = custom.detail?.count ?? style.particleBurstCount;
        const color = custom.detail?.color ?? 0x8fb4ff;
        particleManagerRef.current.emit(preset, x, y, count, color);
      }
    };

    window.addEventListener('substellar:trigger-burst', handleTriggerBurst);
    return () => {
      window.removeEventListener('substellar:trigger-burst', handleTriggerBurst);
    };
  }, [
    canvasWidth,
    canvasHeight,
    style.particleEnabled,
    style.particlePreset,
    style.particleBurstCount,
  ]);

  // Dynamic Subtitle, Ruby Text & Per-Word Vocal Timing/Transition Rendering
  useEffect(() => {
    const subtitleGroup = subtitleGroupRef.current;
    const particleManager = particleManagerRef.current;
    if (!subtitleGroup) return;

    subtitleGroup.removeChildren();

    // Find active subtitle line based on currentTime, or selected line when paused
    const activeLine =
      lines.find((l) => currentTime >= l.startTime && currentTime <= l.endTime) ||
      (!isPlaying ? lines.find((l) => l.id === selectedLineId) || lines[0] : null);

    if (!activeLine || !activeLine.text.trim()) return;

    const autoSegmented = tokenizeSubtitleText(activeLine.text);
    const useStoredTokens =
      activeLine.tokens &&
      (activeLine.tokens.length > 1 ||
        (activeLine.tokens.length === 1 && autoSegmented.length <= 1));

    const rubyTokens = useStoredTokens
      ? activeLine.tokens.map((t) => ({
          base: t.text,
          ruby: t.ruby,
          isRuby: Boolean(t.ruby),
          startTime: t.startTime,
          endTime: t.endTime,
        }))
      : autoSegmented.map((t, i, arr) => {
          const step =
            Math.max(0.1, activeLine.endTime - activeLine.startTime) / Math.max(1, arr.length);
          return {
            ...t,
            startTime: activeLine.startTime + i * step,
            endTime: activeLine.startTime + (i + 1) * step,
          };
        });

    const scaleFactor = canvasHeight / 720;
    const scaledFontSize = Math.round(style.fontSize * scaleFactor);
    const scaledOuterStroke = Math.max(0, Math.round(style.outerStrokeWidth * scaleFactor));
    const scaledInnerStroke = Math.max(0, Math.round(style.innerStrokeWidth * scaleFactor));
    const scaledGlowBlur = Math.max(0, style.glowBlur * scaleFactor);
    const scaledYOffset = Math.round(style.yOffset * scaleFactor);

    // Generous canvas padding so outer stroke & dropShadow glow never clip into a box
    const textPadding = Math.ceil(
      (scaledOuterStroke + scaledInnerStroke + scaledGlowBlur + 18 * scaleFactor) * 1.8
    );

    const transitionSec = Math.max(0.01, (style.wordTransitionMs ?? 140) / 1000);

    const lineContainer = new Container();
    let currentX = 0;
    let currentActiveTokenIdx = -1;

    const fillHex = style.fillColor || '#ffffff';
    const gradEndHex = style.fillGradientEndColor || '#b8d0ff';
    const activeWordHex = style.wordActiveColor || '#7df9ff';
    const outerStrokeHex = style.outerStrokeColor || '#14161b';
    const innerStrokeHex = style.innerStrokeColor || '#8fb4ff';
    const glowHex = style.glowColor || '#5770b0';
    const rubyFillHex = style.rubyFillColor || '#8fb4ff';
    const rubyActiveHex = style.rubyActiveColor || '#5affb5';
    const transFillHex = style.translationFillColor || '#bfc3ca';

    rubyTokens.forEach((token, idx) => {
      const tokenStart = token.startTime;
      const tokenEnd = token.endTime;

      const isTokenActive = currentTime >= tokenStart && currentTime < tokenEnd;
      const isTokenPassed = currentTime >= tokenEnd;

      if (isTokenActive) {
        currentActiveTokenIdx = idx;
      }

      // Compute smooth transition progress (0..1) based on wordTransitionMs
      let enterProgress = 0;
      if (isTokenActive) {
        enterProgress = easeOutCubic((currentTime - tokenStart) / transitionSec);
      } else if (isTokenPassed && style.wordAnimStyle === 'sweep') {
        enterProgress = 1;
      }

      const tokenContainer = new Container();
      const highlightActive = isTokenActive || (isTokenPassed && style.wordAnimStyle === 'sweep');

      // Build fill (solid or vertical linear gradient)
      let mainFill: string | FillGradient = highlightActive ? activeWordHex : fillHex;
      if (style.fillGradientEnabled) {
        try {
          mainFill = new FillGradient({
            end: { x: 0, y: 1 },
            colorStops: [
              { offset: 0, color: highlightActive ? activeWordHex : fillHex },
              { offset: 1, color: highlightActive ? innerStrokeHex : gradEndHex },
            ],
          });
        } catch {
          mainFill = highlightActive ? activeWordHex : fillHex;
        }
      }

      // Layer 1: Outer Dark Stroke + Soft DropShadow Glow (with generous padding so it never clips)
      if (scaledOuterStroke > 0 || scaledGlowBlur > 0) {
        const outerStyle = new TextStyle({
          fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
          fontSize: scaledFontSize,
          fontWeight: 'bold',
          fill: outerStrokeHex,
          padding: textPadding,
          stroke:
            scaledOuterStroke + scaledInnerStroke > 0
              ? {
                  color: outerStrokeHex,
                  width: scaledOuterStroke + scaledInnerStroke,
                  join: 'round',
                }
              : undefined,
          dropShadow:
            scaledGlowBlur > 0 || isTokenActive
              ? {
                  alpha: isTokenActive ? 0.65 + 0.3 * enterProgress : 0.6,
                  angle: Math.PI / 4,
                  blur: isTokenActive
                    ? scaledGlowBlur + 5 * scaleFactor * enterProgress
                    : scaledGlowBlur,
                  color: isTokenActive ? activeWordHex : glowHex,
                  distance: 0,
                }
              : undefined,
        });
        const outerText = new Text({ text: token.base, style: outerStyle });
        outerText.x = 0;
        outerText.y = 0;
        tokenContainer.addChild(outerText);
      }

      // Layer 2: Inner Stroke + Main Fill / Gradient Fill
      const baseStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
        fontSize: scaledFontSize,
        fontWeight: 'bold',
        fill: mainFill,
        padding: textPadding,
        stroke:
          scaledInnerStroke > 0
            ? {
                color: highlightActive ? activeWordHex : innerStrokeHex,
                width: scaledInnerStroke,
                join: 'round',
              }
            : scaledOuterStroke > 0
            ? {
                color: outerStrokeHex,
                width: Math.max(1, Math.round(scaledOuterStroke * 0.4)),
                join: 'round',
              }
            : undefined,
      });

      const rubyStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
        fontSize: Math.round(scaledFontSize * style.rubyScale),
        fontWeight: 'bold',
        fill: highlightActive ? rubyActiveHex : rubyFillHex,
        padding: Math.ceil(textPadding * 0.6),
        stroke: {
          color: outerStrokeHex,
          width: Math.max(2, Math.round(scaledOuterStroke * 0.55)),
          join: 'round',
        },
      });

      // Base Text Node
      const baseText = new Text({ text: token.base, style: baseStyle });
      baseText.x = 0;
      baseText.y = 0;
      tokenContainer.addChild(baseText);

      // Ruby Text Node (if present)
      if (token.isRuby && token.ruby) {
        const rubyText = new Text({ text: token.ruby, style: rubyStyle });
        const metrics = computeRubyPosition(
          0,
          0,
          baseText.width,
          baseText.height,
          rubyText.width,
          rubyText.height,
          Math.round(2 * scaleFactor)
        );
        rubyText.x = metrics.rubyX;
        rubyText.y = metrics.rubyY;
        tokenContainer.addChild(rubyText);
      }

      // Apply per-word transition motion based on style.wordAnimStyle and enterProgress
      let motionOffsetY = 0;
      let scaleBoost = 1;
      if (isTokenActive) {
        const wordSpan = Math.max(0.05, tokenEnd - tokenStart);
        const wordPhase = Math.min(1, Math.max(0, (currentTime - tokenStart) / wordSpan));

        if (style.wordAnimStyle === 'pop') {
          motionOffsetY = -Math.round(9 * scaleFactor * enterProgress);
          scaleBoost = 1 + 0.06 * Math.sin(enterProgress * Math.PI);
        } else if (style.wordAnimStyle === 'float') {
          motionOffsetY = -Math.round(11 * scaleFactor * Math.sin(wordPhase * Math.PI));
        } else if (style.wordAnimStyle === 'sweep') {
          motionOffsetY = -Math.round(4 * scaleFactor * enterProgress);
        }
      }

      tokenContainer.x = currentX;
      tokenContainer.y = motionOffsetY;
      tokenContainer.scale.set(scaleBoost);

      const nextToken = rubyTokens[idx + 1];
      const bothCjk =
        nextToken &&
        CJK_TOKEN_REGEX.test(token.base) &&
        CJK_TOKEN_REGEX.test(nextToken.base);
      const tokenGap = bothCjk
        ? Math.round(2 * scaleFactor)
        : Math.round(11 * scaleFactor);

      currentX += baseText.width + (nextToken ? tokenGap : 0);
      lineContainer.addChild(tokenContainer);
    });

    // Smooth line-level entry & exit fade/slide animation
    const lineSpan = Math.max(0.2, activeLine.endTime - activeLine.startTime);
    const entryWindow = Math.min(0.22, lineSpan * 0.25);
    const exitWindow = Math.min(0.18, lineSpan * 0.2);
    let lineAlpha = 1;
    let lineSlideY = 0;

    if (currentTime >= activeLine.startTime && currentTime <= activeLine.endTime) {
      const sinceStart = currentTime - activeLine.startTime;
      const untilEnd = activeLine.endTime - currentTime;
      if (sinceStart < entryWindow) {
        const p = easeOutCubic(sinceStart / entryWindow);
        lineAlpha = p;
        lineSlideY = Math.round((1 - p) * 12 * scaleFactor);
      } else if (untilEnd < exitWindow) {
        const p = Math.max(0, Math.min(1, untilEnd / exitWindow));
        lineAlpha = p;
      }
    }

    // Center line horizontally & position vertically
    lineContainer.alpha = lineAlpha;
    lineContainer.x = (canvasWidth - currentX) / 2;
    lineContainer.y =
      (style.verticalPosition === 'top'
        ? scaledYOffset
        : style.verticalPosition === 'center'
        ? canvasHeight / 2
        : canvasHeight - scaledYOffset - scaledFontSize) + lineSlideY;

    // Trigger karaoke particle emission when word switches
    if (
      currentActiveTokenIdx !== -1 &&
      currentActiveTokenIdx !== lastActiveIndexRef.current &&
      particleManager &&
      style.particleEnabled
    ) {
      lastActiveIndexRef.current = currentActiveTokenIdx;
      const targetChild = lineContainer.children[currentActiveTokenIdx];
      if (targetChild) {
        const worldX = lineContainer.x + targetChild.x + 20 * scaleFactor;
        const worldY = lineContainer.y - 10 * scaleFactor;
        particleManager.emit(
          style.particlePreset,
          worldX,
          worldY,
          style.particleBurstCount,
          hexToNumber(activeWordHex)
        );
      }
    } else if (currentActiveTokenIdx === -1) {
      lastActiveIndexRef.current = -1;
    }

    // Secondary Translation subtitle if present
    if (activeLine.translation) {
      const transStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'sans-serif'],
        fontSize: Math.max(14, Math.round(scaledFontSize * 0.45)),
        fill: transFillHex,
        padding: Math.ceil(textPadding * 0.6),
        stroke: {
          color: outerStrokeHex,
          width: Math.max(2, Math.round(4 * scaleFactor)),
          join: 'round',
        },
      });
      const transText = new Text({ text: activeLine.translation, style: transStyle });
      transText.anchor.set(0.5, 0);
      transText.alpha = lineAlpha;
      transText.x = canvasWidth / 2;
      transText.y = lineContainer.y + scaledFontSize + Math.round(10 * scaleFactor);
      subtitleGroup.addChild(transText);
    }

    subtitleGroup.addChild(lineContainer);
  }, [currentTime, lines, style, isPlaying, selectedLineId, canvasWidth, canvasHeight]);

  return (
    <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-black">
      {/* 1. Underlying Real Video Element (if video URL provided) */}
      {track.videoUrl ? (
        <video
          ref={videoRef}
          src={track.videoUrl}
          playsInline
          className="absolute inset-0 w-full h-full object-contain z-0"
        />
      ) : track.coverUrl ? (
        /* 2. Album Cover Backdrop */
        <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center">
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      ) : (
        /* 3. Clean Dark Studio Backdrop */
        <div className="absolute inset-0 z-0 bg-[#0d1017] flex items-center justify-center overflow-hidden">
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-[11px] font-mono text-gatefold-text-3">
            <Music className="w-3.5 h-3.5 text-gatefold-accent" />
            <span className="text-gatefold-text-2 font-medium">{track.title}</span>
            <span>•</span>
            <span>{track.artist}</span>
          </div>

          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute z-20 w-16 h-16 rounded-full bg-black/60 hover:bg-gatefold-accent hover:text-black border border-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Click to Play"
            >
              <Play className="w-7 h-7 fill-current ml-1" />
            </button>
          )}
        </div>
      )}

      {/* Hidden Audio element if audio-only URL is provided */}
      {track.audioUrl && !track.videoUrl && (
        <audio ref={audioRef} src={track.audioUrl} preload="auto" />
      )}

      {/* 4. PixiJS Interactive Canvas Viewport (Overlay with Furigana & Particles) */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-10 w-full h-full flex items-center justify-center pointer-events-none [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:object-contain"
      />
    </div>
  );
};
