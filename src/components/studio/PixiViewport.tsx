import React, { useEffect, useRef } from 'react';
import { Application, Container, Text, TextStyle, Graphics } from 'pixi.js';
import { usePerfStore } from '../../stores/usePerfStore';
import { useStudioStore } from '../../stores/useStudioStore';

export const PixiViewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const { profile, updateMetrics } = usePerfStore();
  const { currentTime, lines } = useStudioStore();

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

      // Scene Root
      const stage = app.stage;
      const subtitleContainer = new Container();
      subtitleContainer.x = 640;
      subtitleContainer.y = 520; // Bottom centered
      stage.addChild(subtitleContainer);

      // Particles Container for ambient stardust
      const particleContainer = new Container();
      stage.addChild(particleContainer);

      // Create static pool of ambient stars
      const starGraphics: Graphics[] = [];
      const particleCount = profile.mode === 'low' ? 60 : profile.mode === 'balanced' ? 180 : 350;

      for (let i = 0; i < particleCount; i++) {
        const star = new Graphics();
        star.circle(0, 0, Math.random() * 2 + 0.8);
        star.fill({ color: 0x8fb4ff, alpha: Math.random() * 0.8 + 0.2 });
        star.x = Math.random() * 1280;
        star.y = Math.random() * 720;
        (star as unknown as { vx: number; vy: number }).vx = (Math.random() - 0.5) * 0.4;
        (star as unknown as { vy: number }).vy = -Math.random() * 0.6 - 0.2;
        particleContainer.addChild(star);
        starGraphics.push(star);
      }

      // Main Lyric Text
      const mainTextStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
        fontSize: 54,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color: 0x14161b, width: 8, join: 'round' },
        dropShadow: {
          alpha: 0.7,
          angle: Math.PI / 4,
          blur: 10,
          color: 0x5770b0,
          distance: 4,
        },
      });

      const rubyTextStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'Noto Sans JP', 'sans-serif'],
        fontSize: 22,
        fontWeight: 'bold',
        fill: 0x8fb4ff,
        stroke: { color: 0x14161b, width: 4, join: 'round' },
      });

      const transTextStyle = new TextStyle({
        fontFamily: ['Segoe UI', 'sans-serif'],
        fontSize: 22,
        fill: 0xbfc3ca,
        stroke: { color: 0x14161b, width: 4, join: 'round' },
      });

      // Assemble Subtitle with Ruby Layout
      const mainText = new Text({ text: 'もう何もいらない', style: mainTextStyle });
      mainText.anchor.set(0.5, 0.5);

      // Ruby Furigana text: "なに" positioned right above "何"
      const rubyText = new Text({ text: 'なに', style: rubyTextStyle });
      rubyText.anchor.set(0.5, 1);
      rubyText.x = -36; // Centered above '何'
      rubyText.y = -34;

      const transText = new Text({ text: 'I do not need anything anymore', style: transTextStyle });
      transText.anchor.set(0.5, 0);
      transText.y = 42;

      subtitleContainer.addChild(mainText);
      subtitleContainer.addChild(rubyText);
      subtitleContainer.addChild(transText);

      // Frame Ticker
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

        // Animate particles
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

  // Handle subtitle line update when currentTime changes
  useEffect(() => {
    // Current line sync
    const activeLine = lines.find(
      (l) => currentTime >= l.startTime && currentTime <= l.endTime
    ) || lines[0];

    if (activeLine && appRef.current) {
      // Future lines update in phase 2
    }
  }, [currentTime, lines]);

  return (
    <div className="w-full h-full flex items-center justify-center p-2 relative overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center [&>canvas]:max-w-full [&>canvas]:max-h-full [&>canvas]:object-contain [&>canvas]:rounded-lg [&>canvas]:shadow-2xl"
      />
    </div>
  );
};

