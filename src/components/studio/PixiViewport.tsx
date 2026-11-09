import React, { useEffect, useRef } from 'react';
import { Application, Container, Text, TextStyle, Graphics } from 'pixi.js';
import { usePerfStore } from '../../stores/usePerfStore';
import { useStudioStore } from '../../stores/useStudioStore';
import { parseMarkdownRuby, computeRubyPosition } from '../../engine/text/RubyLayout';
import { ParticleManager } from '../../engine/particles/ParticleManager';
import type { ParticlePresetType } from '../../types';

export const PixiViewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const subtitleGroupRef = useRef<Container | null>(null);
  const safeGuidesRef = useRef<Graphics | null>(null);
  const particleManagerRef = useRef<ParticleManager | null>(null);
  const lastActiveIndexRef = useRef<number>(-1);

  const { profile, updateMetrics } = usePerfStore();
  const { currentTime, lines, style } = useStudioStore();

  // Initialize PixiJS v8 Application & Zero-GC Particle Manager
  useEffect(() => {
    let isMounted = true;
    let localApp: Application | null = null;
    let localParticleManager: ParticleManager | null = null;

    async function initPixi() {
      if (!containerRef.current) return;

      const app = new Application();
      await app.init({
        width: 1280,
        height: 720,
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

      const actionW = 1280 * 0.93;
      const actionH = 720 * 0.93;
      safeGuides.rect((1280 - actionW) / 2, (720 - actionH) / 2, actionW, actionH);
      safeGuides.stroke({ color: 0x8fb4ff, alpha: 0.15, width: 1 });

      const titleW = 1280 * 0.90;
      const titleH = 720 * 0.90;
      safeGuides.rect((1280 - titleW) / 2, (720 - titleH) / 2, titleW, titleH);
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
  }, [profile.mode, profile.maxParticles, profile.bloomEnabled, profile.renderScale, updateMetrics, style.particleEnabled]);

  // Update Safe Guides visibility
  useEffect(() => {
    if (safeGuidesRef.current) {
      safeGuidesRef.current.visible = style.showSafeGuides;
    }
  }, [style.showSafeGuides]);

  // Listen for manual burst trigger (e.g. from Inspector "Test Burst")
  useEffect(() => {
    const handleTriggerBurst = (e: Event) => {
      const custom = e as CustomEvent<{ x?: number; y?: number; preset?: ParticlePresetType; count?: number; color?: number }>;
      if (particleManagerRef.current && style.particleEnabled) {
        const x = custom.detail?.x ?? 640;
        const y = custom.detail?.y ?? 360;
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
  }, [style.particleEnabled, style.particlePreset, style.particleBurstCount]);

  // Dynamic Subtitle, Ruby Text & Karaoke Sweep Rendering
  useEffect(() => {
    const subtitleGroup = subtitleGroupRef.current;
    const particleManager = particleManagerRef.current;
    if (!subtitleGroup) return;

    subtitleGroup.removeChildren();

    // Find active subtitle line based on currentTime
    const activeLine =
      lines.find((l) => currentTime >= l.startTime && currentTime <= l.endTime) || lines[0];

    if (!activeLine) return;

    // Parse Ruby tokens from line
    const rubyTokens = parseMarkdownRuby(activeLine.text);

    // Compute token durations for karaoke sweep
    const lineDuration = Math.max(0.1, activeLine.endTime - activeLine.startTime);
    const tokenDuration = lineDuration / Math.max(1, rubyTokens.length);

    // Create line container
    const lineContainer = new Container();
    let currentX = 0;
    let currentActiveTokenIdx = -1;

    rubyTokens.forEach((token, idx) => {
      const tokenStart = activeLine.startTime + idx * tokenDuration;
      const tokenEnd = tokenStart + tokenDuration;
      const isTokenActive = currentTime >= tokenStart && currentTime < tokenEnd;

      if (isTokenActive) {
        currentActiveTokenIdx = idx;
      }

      const tokenContainer = new Container();

      // Style: Active karaoke tokens shine in vibrant cyan/accent
      const baseStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
        fontSize: style.fontSize,
        fontWeight: 'bold',
        fill: isTokenActive ? 0x8fb4ff : 0xffffff,
        stroke: {
          color: isTokenActive ? 0x26324f : 0x14161b,
          width: style.outerStrokeWidth,
          join: 'round',
        },
        dropShadow: (style.glowBlur > 0 || isTokenActive) ? {
          alpha: isTokenActive ? 1.0 : 0.7,
          angle: Math.PI / 4,
          blur: isTokenActive ? style.glowBlur + 6 : style.glowBlur,
          color: isTokenActive ? 0x8fb4ff : 0x5770b0,
          distance: isTokenActive ? 3 : 2,
        } : undefined,
      });

      const rubyStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
        fontSize: Math.round(style.fontSize * style.rubyScale),
        fontWeight: 'bold',
        fill: isTokenActive ? 0x5affb5 : 0x8fb4ff,
        stroke: {
          color: 0x14161b,
          width: Math.max(3, style.outerStrokeWidth * 0.5),
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
          2
        );
        rubyText.x = metrics.rubyX;
        rubyText.y = metrics.rubyY;
        tokenContainer.addChild(rubyText);
      }

      tokenContainer.x = currentX;
      currentX += baseText.width + 6;
      lineContainer.addChild(tokenContainer);
    });

    // Center line horizontally & position vertically
    lineContainer.x = (1280 - currentX) / 2;
    lineContainer.y = 720 - style.yOffset;

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
        const worldX = lineContainer.x + targetChild.x + 20;
        const worldY = lineContainer.y - 10;
        particleManager.emit(
          style.particlePreset,
          worldX,
          worldY,
          style.particleBurstCount,
          0x8fb4ff
        );
      }
    } else if (currentActiveTokenIdx === -1) {
      lastActiveIndexRef.current = -1;
    }

    // Translation subtitle if present
    if (activeLine.translation) {
      const transStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'sans-serif'],
        fontSize: Math.max(16, Math.round(style.fontSize * 0.4)),
        fill: 0xbfc3ca,
        stroke: { color: 0x14161b, width: 4, join: 'round' },
      });
      const transText = new Text({ text: activeLine.translation, style: transStyle });
      transText.anchor.set(0.5, 0);
      transText.x = 640;
      transText.y = lineContainer.y + style.fontSize + 14;
      subtitleGroup.addChild(transText);
    }

    subtitleGroup.addChild(lineContainer);
  }, [currentTime, lines, style]);

  return (
    <div className="w-full h-full flex items-center justify-center p-2 relative overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center [&>canvas]:max-w-full [&>canvas]:max-h-full [&>canvas]:object-contain [&>canvas]:rounded-lg [&>canvas]:shadow-2xl"
      />
    </div>
  );
};
