import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Text, TextStyle, Graphics, FillGradient } from 'pixi.js';
import { usePerfStore } from '../../stores/usePerfStore';
import { useStudioStore } from '../../stores/useStudioStore';
import { tokenizeSubtitleText, computeRubyPosition } from '../../engine/text/RubyLayout';
import { getCanvasPixelDimensions } from '../../engine/layout/layoutMath';
import { ParticleManager } from '../../engine/particles/ParticleManager';
import { playbackEngine } from '../../engine/audio/PlaybackEngine';
import { tauriBridge } from '../../services/tauriBridge';
import type { ParticlePresetType } from '../../types';
import { Music, Play, FolderOpen } from 'lucide-react';

const CJK_TOKEN_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

interface BuiltTokenNode {
  container: Container;
  inactiveBase: Text;
  activeBase: Text;
  inactiveRuby: Text | null;
  activeRuby: Text | null;
  startTime: number;
  endTime: number;
  disableAnim: boolean;
}

interface BuiltLineState {
  lineId: string;
  startTime: number;
  endTime: number;
  baseY: number;
  transBaseY: number;
  scaleFactor: number;
  transitionSec: number;
  wordAnimStyle: 'pop' | 'sweep' | 'float' | 'static';
  particleEnabled: boolean;
  particlePreset: ParticlePresetType;
  particleBurstCount: number;
  activeWordColorNum: number;
  lineContainer: Container;
  transText: Text | null;
  tokens: BuiltTokenNode[];
}

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

const PixiViewportInner: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const appRef = useRef<Application | null>(null);
  const subtitleGroupRef = useRef<Container | null>(null);
  const safeGuidesRef = useRef<Graphics | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const lastActiveIndexRef = useRef<number>(-1);
  const builtLineRef = useRef<BuiltLineState | null>(null);
  const gradientsRef = useRef<FillGradient[]>([]);
  const [pixiReady, setPixiReady] = useState(false);

  const profile = usePerfStore((s) => s.profile);
  const updateMetrics = usePerfStore((s) => s.updateMetrics);

  // Use targeted selectors so PixiViewport NEVER re-renders at 60 FPS on currentTime ticks
  const lines = useStudioStore((s) => s.lines);
  const style = useStudioStore((s) => s.style);
  const track = useStudioStore((s) => s.track);
  const setTrack = useStudioStore((s) => s.setTrack);
  const loadLocalMediaFromPath = useStudioStore((s) => s.loadLocalMediaFromPath);
  const saveToLocalStorage = useStudioStore((s) => s.saveToLocalStorage);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const togglePlay = useStudioStore((s) => s.togglePlay);
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const canvasResolution = useStudioStore((s) => s.canvasResolution);

  const handleVideoError = useCallback(async () => {
    const currentTrack = useStudioStore.getState().track;
    // If asset:// URL failed in WebView2, automatically recover via raw binary Blob URL from Rust
    if (
      currentTrack.mediaFilePath &&
      tauriBridge.isAvailable() &&
      currentTrack.videoUrl &&
      !currentTrack.videoUrl.startsWith('blob:')
    ) {
      try {
        const blobUrl = await tauriBridge.readMediaBlobUrl(currentTrack.mediaFilePath);
        setTrack({ videoUrl: blobUrl });
        return;
      } catch {
        // Fall through if file was moved/deleted
      }
    }
    // Clear broken URL so the studio backdrop & Relink Video button appear instead of a blank black element
    if (currentTrack.videoUrl) {
      setTrack({ videoUrl: undefined });
    }
  }, [setTrack]);

  const handleRelinkVideo = useCallback(async () => {
    if (tauriBridge.isAvailable()) {
      try {
        const chosen = await tauriBridge.openMediaDialog();
        if (chosen) {
          await loadLocalMediaFromPath(chosen, { preserveTimelineState: true });
          saveToLocalStorage();
        }
      } catch {
        // Ignore
      }
    }
  }, [loadLocalMediaFromPath, saveToLocalStorage]);

  const activeLineId = useStudioStore((s) => {
    const byTime = s.lines.find(
      (l) => s.currentTime >= l.startTime && s.currentTime <= l.endTime
    );
    if (byTime) return byTime.id;
    if (!s.isPlaying) {
      const fallback = s.lines.find((l) => l.id === s.selectedLineId) || s.lines[0];
      return fallback ? fallback.id : null;
    }
    return null;
  });

  const activeLine = lines.find((l) => l.id === activeLineId) || null;

  const canvasDims = getCanvasPixelDimensions(aspectRatio, canvasResolution);
  const canvasWidth = canvasDims.width;
  const canvasHeight = canvasDims.height;

  // Explicitly destroy all GPU textures, TextStyles, and FillGradients when clearing a subtitle line
  const clearSubtitleGroup = useCallback(() => {
    builtLineRef.current = null;

    if (subtitleGroupRef.current) {
      const removed = subtitleGroupRef.current.removeChildren();
      for (const child of removed) {
        try {
          child.destroy({
            children: true,
            texture: true,
            textureSource: true,
            style: true,
          });
        } catch {
          // Ignore already destroyed nodes
        }
      }
    }

    if (gradientsRef.current.length > 0) {
      for (const grad of gradientsRef.current) {
        try {
          grad.destroy();
        } catch {
          // Ignore gradient cleanup errors
        }
      }
      gradientsRef.current = [];
    }
  }, []);

  // Zero-allocation per-frame animation of pre-built token nodes
  const animateBuiltLine = useCallback((currentTime: number) => {
    const built = builtLineRef.current;
    if (!built) return;

    const {
      startTime,
      endTime,
      baseY,
      transBaseY,
      scaleFactor,
      transitionSec,
      wordAnimStyle,
      particleEnabled,
      particlePreset,
      particleBurstCount,
      activeWordColorNum,
      lineContainer,
      transText,
      tokens,
    } = built;

    let currentActiveTokenIdx = -1;

    for (let idx = 0; idx < tokens.length; idx++) {
      const token = tokens[idx];
      if (token.disableAnim) {
        token.activeBase.alpha = 0;
        token.inactiveBase.alpha = 1;
        if (token.activeRuby && token.inactiveRuby) {
          token.activeRuby.alpha = 0;
          token.inactiveRuby.alpha = 1;
        }
        token.container.y = 0;
        token.container.scale.set(1);
        continue;
      }

      const isTokenActive = currentTime >= token.startTime && currentTime < token.endTime;
      const isTokenPassed = currentTime >= token.endTime;

      if (isTokenActive) {
        currentActiveTokenIdx = idx;
      }

      let enterProgress = 0;
      if (isTokenActive) {
        enterProgress = easeOutCubic((currentTime - token.startTime) / transitionSec);
      } else if (isTokenPassed && wordAnimStyle === 'sweep') {
        enterProgress = 1;
      }

      const highlightAlpha =
        isTokenActive
          ? Math.max(0.35, enterProgress)
          : isTokenPassed && wordAnimStyle === 'sweep'
          ? 1
          : 0;

      token.activeBase.alpha = highlightAlpha;
      token.inactiveBase.alpha = 1 - highlightAlpha * 0.92;

      if (token.activeRuby && token.inactiveRuby) {
        token.activeRuby.alpha = highlightAlpha;
        token.inactiveRuby.alpha = 1 - highlightAlpha * 0.92;
      }

      let motionOffsetY = 0;
      let scaleBoost = 1;
      if (isTokenActive) {
        const wordSpan = Math.max(0.05, token.endTime - token.startTime);
        const wordPhase = Math.min(1, Math.max(0, (currentTime - token.startTime) / wordSpan));

        if (wordAnimStyle === 'pop') {
          motionOffsetY = -Math.round(9 * scaleFactor * enterProgress);
          scaleBoost = 1 + 0.06 * Math.sin(enterProgress * Math.PI);
        } else if (wordAnimStyle === 'float') {
          motionOffsetY = -Math.round(11 * scaleFactor * Math.sin(wordPhase * Math.PI));
        } else if (wordAnimStyle === 'sweep') {
          motionOffsetY = -Math.round(4 * scaleFactor * enterProgress);
        }
      }

      token.container.y = motionOffsetY;
      token.container.scale.set(scaleBoost);
    }

    // Smooth line-level entry & exit fade/slide animation
    const lineSpan = Math.max(0.2, endTime - startTime);
    const entryWindow = Math.min(0.22, lineSpan * 0.25);
    const exitWindow = Math.min(0.18, lineSpan * 0.2);
    let lineAlpha = 1;
    let lineSlideY = 0;

    if (currentTime >= startTime && currentTime <= endTime) {
      const sinceStart = currentTime - startTime;
      const untilEnd = endTime - currentTime;
      if (sinceStart < entryWindow) {
        const p = easeOutCubic(sinceStart / entryWindow);
        lineAlpha = p;
        lineSlideY = Math.round((1 - p) * 12 * scaleFactor);
      } else if (untilEnd < exitWindow) {
        const p = Math.max(0, Math.min(1, untilEnd / exitWindow));
        lineAlpha = p;
      }
    }

    lineContainer.alpha = lineAlpha;
    lineContainer.y = baseY + lineSlideY;

    if (transText) {
      transText.alpha = lineAlpha;
      transText.y = transBaseY + lineSlideY;
    }

    // Trigger karaoke particle emission when active word switches
    const particleManager = particleManagerRef.current;
    if (
      currentActiveTokenIdx !== -1 &&
      currentActiveTokenIdx !== lastActiveIndexRef.current &&
      particleManager &&
      particleEnabled
    ) {
      lastActiveIndexRef.current = currentActiveTokenIdx;
      const targetToken = tokens[currentActiveTokenIdx];
      if (targetToken) {
        const worldX = lineContainer.x + targetToken.container.x + 20 * scaleFactor;
        const worldY = lineContainer.y - 10 * scaleFactor;
        particleManager.emit(
          particlePreset,
          worldX,
          worldY,
          particleBurstCount,
          activeWordColorNum
        );
      }
    } else if (currentActiveTokenIdx === -1) {
      lastActiveIndexRef.current = -1;
    }
  }, []);

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
        autoDensity: false,
      });

      if (!isMounted) {
        app.destroy(true, { children: true });
        return;
      }

      localApp = app;
      appRef.current = app;
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      app.canvas.style.display = 'block';
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
      setPixiReady(true);

      // Render Ticker — Zero GC / Zero Texture Allocations per frame
      let lastTime = performance.now();
      let frameCount = 0;
      let lastFpsCheck = performance.now();

      app.ticker.add(() => {
        const now = performance.now();
        const deltaSeconds = (now - lastTime) / 1000;
        lastTime = now;
        frameCount++;

        // Animate pre-built subtitle tokens for the current time without allocating textures
        animateBuiltLine(useStudioStore.getState().currentTime);

        // Update particle physics without GC allocations
        if (localParticleManager && useStudioStore.getState().style.particleEnabled) {
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
      setPixiReady(false);
      clearSubtitleGroup();
      if (localParticleManager) {
        localParticleManager.destroy();
        particleManagerRef.current = null;
      }
      if (localApp) {
        localApp.destroy(true, { children: true, texture: true, textureSource: true });
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
    animateBuiltLine,
    clearSubtitleGroup,
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

  // Build PixiJS Text & FillGradient nodes ONLY when activeLine or style changes (NOT on currentTime!)
  useEffect(() => {
    const subtitleGroup = subtitleGroupRef.current;
    if (!subtitleGroup || !pixiReady) return;

    // Explicitly destroy previous line's GPU textures, styles, and gradients first
    clearSubtitleGroup();
    lastActiveIndexRef.current = -1;

    if (!activeLine || !activeLine.text.trim()) return;

    const autoSegmented = tokenizeSubtitleText(activeLine.text);
    const useStoredTokens = Boolean(activeLine.tokens && activeLine.tokens.length > 0);

    const rubyTokens = useStoredTokens
      ? activeLine.tokens.map((t) => ({
          base: t.text,
          ruby: t.ruby,
          isRuby: Boolean(t.ruby),
          startTime: t.startTime,
          endTime: t.endTime,
          disableAnim: Boolean(t.disableAnim),
        }))
      : autoSegmented.map((t, i, arr) => {
          const step =
            Math.max(0.1, activeLine.endTime - activeLine.startTime) / Math.max(1, arr.length);
          return {
            ...t,
            startTime: activeLine.startTime + i * step,
            endTime: activeLine.startTime + (i + 1) * step,
            disableAnim: false,
          };
        });

    const scaleFactor = canvasHeight / 720;
    const scaledFontSize = Math.round(style.fontSize * scaleFactor);
    const scaledOuterStroke = Math.max(0, Math.round(style.outerStrokeWidth * scaleFactor));
    const scaledInnerStroke = Math.max(0, Math.round(style.innerStrokeWidth * scaleFactor));
    const scaledGlowBlur = Math.max(0, style.glowBlur * scaleFactor);
    const scaledXOffset = Math.round((style.xOffset ?? 0) * scaleFactor);
    const scaledYOffset = Math.round((style.yOffset ?? 60) * scaleFactor);

    // Generous canvas padding so outer stroke & dropShadow glow never clip into a box
    const textPadding = Math.ceil(
      (scaledOuterStroke + scaledInnerStroke + scaledGlowBlur + 14 * scaleFactor) * 1.4
    );

    const transitionSec = Math.max(0.01, (style.wordTransitionMs ?? 140) / 1000);

    const lineContainer = new Container();
    let currentX = 0;

    const fillHex = style.fillColor || '#ffffff';
    const gradEndHex = style.fillGradientEndColor || '#b8d0ff';
    const activeWordHex = style.wordActiveColor || '#7df9ff';
    const outerStrokeHex = style.outerStrokeColor || '#14161b';
    const innerStrokeHex = style.innerStrokeColor || '#8fb4ff';
    const glowHex = style.glowColor || '#5770b0';
    const rubyFillHex = style.rubyFillColor || '#8fb4ff';
    const rubyActiveHex = style.rubyActiveColor || '#5affb5';
    const transFillHex = style.translationFillColor || '#bfc3ca';

    // Create at most 2 shared FillGradient instances per line and track them for explicit .destroy()
    let normalFill: string | FillGradient = fillHex;
    let activeFill: string | FillGradient = activeWordHex;
    if (style.fillGradientEnabled) {
      try {
        const normGrad = new FillGradient({
          end: { x: 0, y: 1 },
          colorStops: [
            { offset: 0, color: fillHex },
            { offset: 1, color: gradEndHex },
          ],
        });
        const actGrad = new FillGradient({
          end: { x: 0, y: 1 },
          colorStops: [
            { offset: 0, color: activeWordHex },
            { offset: 1, color: innerStrokeHex },
          ],
        });
        gradientsRef.current.push(normGrad, actGrad);
        normalFill = normGrad;
        activeFill = actGrad;
      } catch {
        normalFill = fillHex;
        activeFill = activeWordHex;
      }
    }

    const builtTokens: BuiltTokenNode[] = [];

    rubyTokens.forEach((token, idx) => {
      const tokenContainer = new Container();

      // Layer 1: Outer Dark Stroke + Soft DropShadow Glow
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
            scaledGlowBlur > 0
              ? {
                  alpha: 0.65,
                  angle: Math.PI / 4,
                  blur: scaledGlowBlur,
                  color: glowHex,
                  distance: 0,
                }
              : undefined,
        });
        const outerText = new Text({ text: token.base, style: outerStyle });
        outerText.x = 0;
        outerText.y = 0;
        tokenContainer.addChild(outerText);
      }

      // Layer 2A: Inactive Base Text
      const inactiveBaseStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
        fontSize: scaledFontSize,
        fontWeight: 'bold',
        fill: normalFill,
        padding: textPadding,
        stroke:
          scaledInnerStroke > 0
            ? {
                color: innerStrokeHex,
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
      const inactiveBase = new Text({ text: token.base, style: inactiveBaseStyle });
      inactiveBase.x = 0;
      inactiveBase.y = 0;
      tokenContainer.addChild(inactiveBase);

      // Layer 2B: Active Highlight Base Text (cross-faded via alpha on ticker)
      const activeBaseStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
        fontSize: scaledFontSize,
        fontWeight: 'bold',
        fill: activeFill,
        padding: textPadding,
        stroke:
          scaledInnerStroke > 0
            ? {
                color: activeWordHex,
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
      const activeBase = new Text({ text: token.base, style: activeBaseStyle });
      activeBase.x = 0;
      activeBase.y = 0;
      activeBase.alpha = 0;
      tokenContainer.addChild(activeBase);

      // Ruby Text Nodes (if present)
      let inactiveRuby: Text | null = null;
      let activeRuby: Text | null = null;
      if (token.isRuby && token.ruby) {
        const inactiveRubyStyle = new TextStyle({
          fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
          fontSize: Math.round(scaledFontSize * style.rubyScale),
          fontWeight: 'bold',
          fill: rubyFillHex,
          padding: Math.ceil(textPadding * 0.6),
          stroke: {
            color: outerStrokeHex,
            width: Math.max(2, Math.round(scaledOuterStroke * 0.55)),
            join: 'round',
          },
        });
        const activeRubyStyle = new TextStyle({
          fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
          fontSize: Math.round(scaledFontSize * style.rubyScale),
          fontWeight: 'bold',
          fill: rubyActiveHex,
          padding: Math.ceil(textPadding * 0.6),
          stroke: {
            color: outerStrokeHex,
            width: Math.max(2, Math.round(scaledOuterStroke * 0.55)),
            join: 'round',
          },
        });

        inactiveRuby = new Text({ text: token.ruby, style: inactiveRubyStyle });
        activeRuby = new Text({ text: token.ruby, style: activeRubyStyle });

        const metrics = computeRubyPosition(
          0,
          0,
          inactiveBase.width,
          inactiveBase.height,
          inactiveRuby.width,
          inactiveRuby.height,
          Math.round(2 * scaleFactor)
        );
        inactiveRuby.x = metrics.rubyX;
        inactiveRuby.y = metrics.rubyY;
        activeRuby.x = metrics.rubyX;
        activeRuby.y = metrics.rubyY;
        activeRuby.alpha = 0;

        tokenContainer.addChild(inactiveRuby);
        tokenContainer.addChild(activeRuby);
      }

      tokenContainer.x = currentX;
      tokenContainer.y = 0;

      const nextToken = rubyTokens[idx + 1];
      const bothCjk =
        nextToken &&
        CJK_TOKEN_REGEX.test(token.base) &&
        CJK_TOKEN_REGEX.test(nextToken.base);
      const tokenGap = bothCjk
        ? Math.round(2 * scaleFactor)
        : Math.round(11 * scaleFactor);

      currentX += inactiveBase.width + (nextToken ? tokenGap : 0);
      lineContainer.addChild(tokenContainer);

      builtTokens.push({
        container: tokenContainer,
        inactiveBase,
        activeBase,
        inactiveRuby,
        activeRuby,
        startTime: token.startTime,
        endTime: token.endTime,
        disableAnim: token.disableAnim,
      });
    });

    const baseY =
      style.verticalPosition === 'top'
        ? scaledYOffset
        : style.verticalPosition === 'center'
        ? (canvasHeight - scaledFontSize) / 2 + scaledYOffset
        : canvasHeight - scaledYOffset - scaledFontSize;

    lineContainer.x = (canvasWidth - currentX) / 2 + scaledXOffset;
    lineContainer.y = baseY;

    let transText: Text | null = null;
    const transBaseY = baseY + scaledFontSize + Math.round(10 * scaleFactor);
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
      transText = new Text({ text: activeLine.translation, style: transStyle });
      transText.anchor.set(0.5, 0);
      transText.x = canvasWidth / 2 + scaledXOffset;
      transText.y = transBaseY;
      subtitleGroup.addChild(transText);
    }

    subtitleGroup.addChild(lineContainer);

    builtLineRef.current = {
      lineId: activeLine.id,
      startTime: activeLine.startTime,
      endTime: activeLine.endTime,
      baseY,
      transBaseY,
      scaleFactor,
      transitionSec,
      wordAnimStyle: style.wordAnimStyle,
      particleEnabled: style.particleEnabled,
      particlePreset: style.particlePreset,
      particleBurstCount: style.particleBurstCount,
      activeWordColorNum: hexToNumber(activeWordHex),
      lineContainer,
      transText,
      tokens: builtTokens,
    };

    // Apply initial frame state immediately
    animateBuiltLine(useStudioStore.getState().currentTime);
  }, [
    pixiReady,
    activeLine,
    style,
    canvasWidth,
    canvasHeight,
    clearSubtitleGroup,
    animateBuiltLine,
  ]);

  return (
    <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-black">
      {/* 1. Underlying Real Video Element (if video URL provided) */}
      {track.videoUrl ? (
        <video
          ref={videoRef}
          src={track.videoUrl}
          playsInline
          onError={() => void handleVideoError()}
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

          {tauriBridge.isAvailable() && (
            <button
              type="button"
              onClick={() => void handleRelinkVideo()}
              className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-gatefold-accent/20 border border-white/15 hover:border-gatefold-accent text-[11px] font-medium text-gatefold-text hover:text-gatefold-accent transition-colors cursor-pointer"
              title="Pilih atau tautkan ulang file video untuk proyek ini"
            >
              <FolderOpen className="w-3.5 h-3.5 text-gatefold-accent" />
              <span>Load / Relink Video</span>
            </button>
          )}

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
        className="absolute inset-0 z-10 w-full h-full flex items-center justify-center pointer-events-none [&>canvas]:!w-full [&>canvas]:!h-full [&>canvas]:object-contain"
      />
    </div>
  );
};

export const PixiViewport = React.memo(PixiViewportInner);
