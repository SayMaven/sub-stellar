import React, { useEffect, useRef } from 'react';
import { Application, Container, Text, TextStyle, Graphics } from 'pixi.js';
import { usePerfStore } from '../../stores/usePerfStore';
import { useStudioStore } from '../../stores/useStudioStore';
import { parseMarkdownRuby, computeRubyPosition } from '../../engine/text/RubyLayout';

export const PixiViewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const subtitleGroupRef = useRef<Container | null>(null);
  const safeGuidesRef = useRef<Graphics | null>(null);

  const { profile, updateMetrics } = usePerfStore();
  const { currentTime, lines, style } = useStudioStore();

  // Initialize PixiJS v8 Application
  useEffect(() => {
    let isMounted = true;
    let localApp: Application | null = null;

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

      // Draw standard broadcast safe lines
      // 93% Action Safe
      const actionW = 1280 * 0.93;
      const actionH = 720 * 0.93;
      safeGuides.rect((1280 - actionW) / 2, (720 - actionH) / 2, actionW, actionH);
      safeGuides.stroke({ color: 0x8fb4ff, alpha: 0.15, width: 1 });

      // 90% Title Safe
      const titleW = 1280 * 0.90;
      const titleH = 720 * 0.90;
      safeGuides.rect((1280 - titleW) / 2, (720 - titleH) / 2, titleW, titleH);
      safeGuides.stroke({ color: 0x8fb4ff, alpha: 0.25, width: 1 });

      // Ambient particle container
      const particleContainer = new Container();
      app.stage.addChild(particleContainer);

      const starGraphics: Graphics[] = [];
      const particleCount = profile.mode === 'low' ? 50 : profile.mode === 'balanced' ? 140 : 280;

      for (let i = 0; i < particleCount; i++) {
        const star = new Graphics();
        star.circle(0, 0, Math.random() * 2 + 0.8);
        star.fill({ color: 0x8fb4ff, alpha: Math.random() * 0.8 + 0.2 });
        star.x = Math.random() * 1280;
        star.y = Math.random() * 720;
        (star as unknown as { vx: number; vy: number }).vx = (Math.random() - 0.5) * 0.3;
        (star as unknown as { vy: number }).vy = -Math.random() * 0.5 - 0.2;
        particleContainer.addChild(star);
        starGraphics.push(star);
      }

      // Subtitle Display Group
      const subtitleGroup = new Container();
      app.stage.addChild(subtitleGroup);
      subtitleGroupRef.current = subtitleGroup;

      // Render Ticker
      let lastTime = performance.now();
      let frameCount = 0;
      let lastFpsCheck = performance.now();

      app.ticker.add(() => {
        const now = performance.now();
        const deltaMs = now - lastTime;
        lastTime = now;
        frameCount++;

        if (now - lastFpsCheck >= 1000) {
          const fps = Math.round((frameCount * 1000) / (now - lastFpsCheck));
          updateMetrics({
            fps,
            frameTimeMs: deltaMs,
            activeParticles: particleCount,
          });
          frameCount = 0;
          lastFpsCheck = now;
        }

        // Animate ambient stars
        for (let i = 0; i < starGraphics.length; i++) {
          const star = starGraphics[i];
          const typedStar = star as unknown as { vx: number; vy: number };
          star.x += typedStar.vx;
          star.y += typedStar.vy;

          if (star.y < 0) {
            star.y = 720;
            star.x = Math.random() * 1280;
          }
        }
      });
    }

    initPixi();

    return () => {
      isMounted = false;
      if (localApp) {
        localApp.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [profile.mode, profile.bloomEnabled, profile.renderScale, updateMetrics]);

  // Update Safe Guides visibility
  useEffect(() => {
    if (safeGuidesRef.current) {
      safeGuidesRef.current.visible = style.showSafeGuides;
    }
  }, [style.showSafeGuides]);

  // Dynamic Subtitle & Ruby Text Rendering on Canvas
  useEffect(() => {
    const subtitleGroup = subtitleGroupRef.current;
    if (!subtitleGroup) return;

    subtitleGroup.removeChildren();

    // Find active subtitle line based on currentTime
    const activeLine =
      lines.find((l) => currentTime >= l.startTime && currentTime <= l.endTime) || lines[0];

    if (!activeLine) return;

    // Parse Ruby tokens from line
    const rubyTokens = parseMarkdownRuby(activeLine.text);

    // Create line container
    const lineContainer = new Container();

    // Base text style
    const baseStyle = new TextStyle({
      fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
      fontSize: style.fontSize,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: {
        color: 0x14161b,
        width: style.outerStrokeWidth,
        join: 'round',
      },
      dropShadow: style.glowBlur > 0 ? {
        alpha: 0.8,
        angle: Math.PI / 4,
        blur: style.glowBlur,
        color: 0x5770b0,
        distance: 2,
      } : undefined,
    });

    const rubyStyle = new TextStyle({
      fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
      fontSize: Math.round(style.fontSize * style.rubyScale),
      fontWeight: 'bold',
      fill: 0x8fb4ff,
      stroke: {
        color: 0x14161b,
        width: Math.max(3, style.outerStrokeWidth * 0.5),
        join: 'round',
      },
    });

    let currentX = 0;
    const tokenNodes: Container[] = [];

    for (const token of rubyTokens) {
      const tokenContainer = new Container();

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
      currentX += baseText.width + 4;
      tokenNodes.push(tokenContainer);
      lineContainer.addChild(tokenContainer);
    }

    // Center entire line horizontally
    lineContainer.x = (1280 - currentX) / 2;
    // Position vertically based on yOffset from bottom
    lineContainer.y = 720 - style.yOffset;

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
      transText.y = lineContainer.y + style.fontSize + 12;
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
