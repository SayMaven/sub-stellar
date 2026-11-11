import { tauriBridge, type ExportProgress, type ExportResult } from '../../services/tauriBridge';
import type { SubtitleLine, WordAnimationStyle } from '../../types';
import { tokenizeSubtitleText, computeRubyPosition } from '../text/RubyLayout';

const CJK_TOKEN_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

export interface ExportJobOptions {
  outputPath: string;
  mode: 'mp4_burnin' | 'webm_alpha' | 'prores_alpha';
  encoder?: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  lines: SubtitleLine[];
  style: {
    fontFamily: string;
    fontSize: number;
    primaryColor: string;
    outlineColor: string;
    secondaryOutlineColor: string;
    outlineThickness: number;
    innerStrokeWidth?: number;
    fillGradientEnabled?: boolean;
    fillGradientEndColor?: string;
    glowColor?: string;
    glowBlur?: number;
    rubyFillColor?: string;
    rubyActiveColor?: string;
    translationFillColor?: string;
    rubySizeRatio: number;
    wordTransitionMs?: number;
    wordAnimStyle?: WordAnimationStyle;
    wordActiveColor?: string;
    verticalPosition?: 'bottom' | 'center' | 'top';
    xOffset?: number;
    yOffset?: number;
  };
  audioSourcePath?: string;
  onProgress?: (progress: ExportProgress) => void;
}

interface SafeContext {
  ctx: CanvasRenderingContext2D | null;
  getImageData: () => Uint8Array;
}

function createSafeOffscreenContext(width: number, height: number): SafeContext {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return {
      ctx,
      getImageData: () => {
        if (!ctx) return new Uint8Array(width * height * 4);
        const img = ctx.getImageData(0, 0, width, height);
        return new Uint8Array(img.data.buffer);
      },
    };
  }

  // Headless test environment fallback
  const mockBuffer = new Uint8Array(width * height * 4);
  const mockCtx = {
    clearRect: () => {},
    fillRect: () => {},
    strokeText: () => {},
    fillText: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    measureText: (text: string) => ({ width: text.length * 10 }),
    beginPath: () => {},
    closePath: () => {},
    globalAlpha: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;

  return {
    ctx: mockCtx,
    getImageData: () => mockBuffer,
  };
}

export class FFmpegExportPipeline {
  private isCancelled = false;
  private currentSessionId: string | null = null;

  public cancel(): void {
    this.isCancelled = true;
    if (this.currentSessionId) {
      void tauriBridge.ffmpegCancelExport(this.currentSessionId);
    }
  }

  public async runExport(options: ExportJobOptions): Promise<ExportResult> {
    this.isCancelled = false;
    const sessionId = `export_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.currentSessionId = sessionId;

    const totalFrames = Math.max(1, Math.round(options.duration * options.fps));
    const frameInterval = 1 / options.fps;

    const isNative = tauriBridge.isAvailable();

    if (isNative) {
      try {
        await tauriBridge.ffmpegStartExportPipe({
          session_id: sessionId,
          output_path: options.outputPath,
          mode: options.mode,
          encoder: options.encoder,
          width: options.width,
          height: options.height,
          fps: options.fps,
          total_frames: totalFrames,
          audio_source_path: options.audioSourcePath,
        });
      } catch (err) {
        throw new Error(`Failed to initialize FFmpeg pipeline: ${String(err)}`);
      }
    }

    const { ctx, getImageData } = createSafeOffscreenContext(options.width, options.height);

    const hasVideoBackground = Boolean(
      options.audioSourcePath && /\.(mp4|webm|mkv|mov)$/i.test(options.audioSourcePath)
    );
    const isTransparent =
      options.mode === 'webm_alpha' || options.mode === 'prores_alpha' || hasVideoBackground;
    const startTime = performance.now();

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (this.isCancelled) {
        if (isNative) {
          await tauriBridge.ffmpegCancelExport(sessionId);
        }
        return {
          success: false,
          output_path: options.outputPath,
          file_size_bytes: 0,
          elapsed_seconds: (performance.now() - startTime) / 1000,
          error_message: 'Export was cancelled by user',
        };
      }

      const currentTime = frameIndex * frameInterval;

      if (ctx) {
        if (isTransparent) {
          ctx.clearRect(0, 0, options.width, options.height);
        } else {
          ctx.fillStyle = '#0a0d14';
          ctx.fillRect(0, 0, options.width, options.height);
        }

        const activeLine = options.lines.find(
          (l) => currentTime >= l.startTime && currentTime <= l.endTime
        );

        if (activeLine) {
          this.renderSubtitleFrame(ctx, activeLine, currentTime, options);
        }
      }

      if (isNative) {
        const rawBytes = getImageData();
        const progress = await tauriBridge.ffmpegWriteFrameChunk(sessionId, rawBytes);
        options.onProgress?.(progress);
      } else {
        const percentage = ((frameIndex + 1) / totalFrames) * 100;
        const elapsed = (performance.now() - startTime) / 1000;
        const fps = (frameIndex + 1) / Math.max(0.001, elapsed);
        options.onProgress?.({
          session_id: sessionId,
          frames_written: frameIndex + 1,
          total_frames: totalFrames,
          percentage,
          fps,
        });

        if (frameIndex % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }

    if (isNative) {
      return await tauriBridge.ffmpegFinishExport(sessionId);
    }

    const totalElapsed = (performance.now() - startTime) / 1000;
    return {
      success: true,
      output_path: options.outputPath,
      file_size_bytes: 1024 * 1024,
      elapsed_seconds: totalElapsed,
    };
  }

  private renderSubtitleFrame(
    ctx: CanvasRenderingContext2D,
    line: SubtitleLine,
    currentTime: number,
    options: ExportJobOptions
  ): void {
    const scale = options.height / 720;
    const baseFontSize = Math.round(options.style.fontSize * scale);
    const rubyFontSize = Math.round(baseFontSize * options.style.rubySizeRatio);
    const outerStroke = Math.max(0, Math.round(options.style.outlineThickness * scale));
    const innerStroke = Math.max(
      0,
      Math.round((options.style.innerStrokeWidth ?? options.style.outlineThickness * 0.4) * scale)
    );
    const glowBlur = Math.max(0, (options.style.glowBlur ?? 0) * scale);
    const fontFamily = options.style.fontFamily || 'Segoe UI';

    const autoTokens = tokenizeSubtitleText(line.text);
    const lineSpan = Math.max(0.2, line.endTime - line.startTime);
    const fallbackStep = Math.max(0.1, line.endTime - line.startTime) / Math.max(1, autoTokens.length);
    const transitionSec = Math.max(0.01, (options.style.wordTransitionMs ?? 140) / 1000);
    const animStyle = options.style.wordAnimStyle ?? 'pop';
    const activeHighlightColor = options.style.wordActiveColor || options.style.outlineColor;
    const rubyFillColor = options.style.rubyFillColor || options.style.primaryColor;
    const rubyActiveColor = options.style.rubyActiveColor || '#5affb5';
    const translationFillColor = options.style.translationFillColor || '#bfc3ca';

    // Line-level entry & exit fade/slide parity with PixiViewport
    const entryWindow = Math.min(0.22, lineSpan * 0.25);
    const exitWindow = Math.min(0.18, lineSpan * 0.2);
    let lineAlpha = 1;
    let lineSlideY = 0;

    if (currentTime >= line.startTime && currentTime <= line.endTime) {
      const sinceStart = currentTime - line.startTime;
      const untilEnd = line.endTime - currentTime;
      if (sinceStart < entryWindow) {
        const p = easeOutCubic(sinceStart / entryWindow);
        lineAlpha = p;
        lineSlideY = Math.round((1 - p) * 12 * scale);
      } else if (untilEnd < exitWindow) {
        lineAlpha = Math.max(0, Math.min(1, untilEnd / exitWindow));
      }
    }

    ctx.save();
    ctx.globalAlpha = lineAlpha;
    ctx.font = `700 ${baseFontSize}px "${fontFamily}", "Segoe UI", "Noto Sans JP", sans-serif`;

    interface MeasuredToken {
      base: string;
      ruby?: string;
      isRuby: boolean;
      baseWidth: number;
      rubyWidth: number;
      clusterWidth: number;
      tokenGap: number;
      startTime: number;
      endTime: number;
      disableAnim: boolean;
    }

    const sourceTokens =
      line.tokens && line.tokens.length > 0
        ? line.tokens.map((t) => ({
            base: t.text,
            ruby: t.ruby,
            isRuby: Boolean(t.ruby),
            startTime: t.startTime,
            endTime: t.endTime,
            disableAnim: Boolean(t.disableAnim),
          }))
        : autoTokens.map((t, idx) => ({
            ...t,
            startTime: line.startTime + idx * fallbackStep,
            endTime: line.startTime + (idx + 1) * fallbackStep,
            disableAnim: false,
          }));

    const measured: MeasuredToken[] = sourceTokens.map((t, idx) => {
      ctx.font = `700 ${baseFontSize}px "${fontFamily}", "Segoe UI", "Noto Sans JP", sans-serif`;
      const bw = ctx.measureText(t.base).width;
      let rw = 0;
      if (t.isRuby && t.ruby) {
        ctx.font = `700 ${rubyFontSize}px "${fontFamily}", "Segoe UI", "Noto Sans JP", sans-serif`;
        rw = ctx.measureText(t.ruby).width;
      }
      const nextToken = sourceTokens[idx + 1];
      const bothCjk =
        nextToken && CJK_TOKEN_REGEX.test(t.base) && CJK_TOKEN_REGEX.test(nextToken.base);
      const tokenGap = nextToken
        ? bothCjk
          ? Math.round(2 * scale)
          : Math.round(11 * scale)
        : 0;

      return {
        ...t,
        baseWidth: bw,
        rubyWidth: rw,
        clusterWidth: Math.max(bw, rw),
        tokenGap,
      };
    });

    const totalWidth = measured.reduce((sum, m) => sum + m.baseWidth + m.tokenGap, 0);
    const scaledXOffset = Math.round((options.style.xOffset ?? 0) * scale);
    const scaledYOffset = Math.round((options.style.yOffset ?? 60) * scale);
    const vPos = options.style.verticalPosition ?? 'bottom';

    const baselineY =
      (vPos === 'top'
        ? scaledYOffset + baseFontSize
        : vPos === 'center'
        ? options.height / 2 + scaledYOffset
        : options.height - scaledYOffset) + lineSlideY;

    let currentX = (options.width - totalWidth) / 2 + scaledXOffset;

    for (const m of measured) {
      const isTokenActive =
        !m.disableAnim && currentTime >= m.startTime && currentTime < m.endTime;
      const isTokenPassed = !m.disableAnim && currentTime >= m.endTime;

      let enterProgress = 0;
      if (isTokenActive) {
        enterProgress = easeOutCubic((currentTime - m.startTime) / transitionSec);
      } else if (isTokenPassed && animStyle === 'sweep') {
        enterProgress = 1;
      }

      let motionX = 0;
      let motionY = 0;
      let scaleBoost = 1;
      if (isTokenActive) {
        const span = Math.max(0.05, m.endTime - m.startTime);
        const phase = Math.min(1, Math.max(0, (currentTime - m.startTime) / span));
        if (animStyle === 'pop') {
          motionY = -Math.round(9 * scale * enterProgress);
          scaleBoost = 1 + 0.12 * Math.sin(enterProgress * Math.PI);
        } else if (animStyle === 'float') {
          motionY = -Math.round(11 * scale * Math.sin(phase * Math.PI));
        } else if (animStyle === 'sweep') {
          motionY = -Math.round(4 * scale * enterProgress);
        } else if (animStyle === 'smooth-sweep') {
          motionX = 0;
          motionY = 0;
          scaleBoost = 1;
        } else if (animStyle === 'glow-pulse') {
          motionY = -Math.round(6 * scale * Math.sin(phase * Math.PI));
          scaleBoost = 1 + 0.08 * Math.sin(phase * Math.PI);
        } else if (animStyle === 'slide') {
          motionX = -Math.round((1 - enterProgress) * 16 * scale);
          motionY = -Math.round(4 * scale * enterProgress);
        } else if (animStyle === 'staccato') {
          motionX = Math.sin(currentTime * 45) * 2.5 * scale;
          motionY = -Math.round(6 * scale) + Math.cos(currentTime * 45) * 2.5 * scale;
          scaleBoost = 1.05;
        } else if (animStyle === 'zoom-strike') {
          scaleBoost = 1 + 0.35 * Math.pow(1 - enterProgress, 2);
          motionY = -Math.round(8 * scale * (1 - enterProgress));
        } else if (animStyle === 'wave') {
          motionY = -Math.round(10 * scale * Math.sin(phase * Math.PI * 2));
        }
      }

      const tokenBaselineX = currentX + motionX;
      const tokenBaselineY = baselineY + motionY;

      const metrics = computeRubyPosition(
        tokenBaselineX,
        tokenBaselineY,
        m.baseWidth,
        baseFontSize,
        m.rubyWidth,
        rubyFontSize,
        Math.round(2 * scale)
      );

      ctx.save();
      if (scaleBoost !== 1) {
        const pivotX = metrics.baseX + m.baseWidth / 2;
        const pivotY = tokenBaselineY - baseFontSize / 2;
        ctx.translate(pivotX, pivotY);
        ctx.scale(scaleBoost, scaleBoost);
        ctx.translate(-pivotX, -pivotY);
      }

      ctx.font = `700 ${baseFontSize}px "${fontFamily}", "Segoe UI", "Noto Sans JP", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';

      // Layer 1: Outer outline + soft glow shadow
      if (outerStroke + innerStroke > 0 || glowBlur > 0) {
        ctx.save();
        if (glowBlur > 0 && options.style.glowColor) {
          ctx.shadowColor = options.style.glowColor;
          ctx.shadowBlur = glowBlur;
        }
        if (outerStroke + innerStroke > 0) {
          ctx.lineWidth = outerStroke + innerStroke;
          ctx.strokeStyle = options.style.secondaryOutlineColor;
          ctx.strokeText(m.base, metrics.baseX, tokenBaselineY);
        }
        ctx.restore();
      }

      if (animStyle === 'smooth-sweep') {
        const isPassed = currentTime >= m.endTime;
        const isCurrent = currentTime >= m.startTime && currentTime < m.endTime;

        // 1. Draw base text (inactive, solid color)
        if (innerStroke > 0) {
          ctx.lineWidth = innerStroke;
          ctx.strokeStyle = options.style.outlineColor;
          ctx.strokeText(m.base, metrics.baseX, tokenBaselineY);
        }
        if (options.style.fillGradientEnabled && typeof ctx.createLinearGradient === 'function') {
          const grad = ctx.createLinearGradient(
            metrics.baseX,
            tokenBaselineY - baseFontSize,
            metrics.baseX,
            tokenBaselineY
          );
          grad.addColorStop(0, options.style.primaryColor);
          grad.addColorStop(1, options.style.fillGradientEndColor || '#b8d0ff');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = options.style.primaryColor;
        }
        ctx.fillText(m.base, metrics.baseX, tokenBaselineY);

        if (m.isRuby && m.ruby) {
          ctx.font = `700 ${rubyFontSize}px "${fontFamily}", "Segoe UI", "Noto Sans JP", sans-serif`;
          ctx.lineWidth = Math.max(2, Math.round(outerStroke * 0.55));
          ctx.strokeStyle = options.style.secondaryOutlineColor;
          ctx.strokeText(m.ruby, metrics.rubyX, metrics.rubyY);
          ctx.fillStyle = rubyFillColor;
          ctx.fillText(m.ruby, metrics.rubyX, metrics.rubyY);
          ctx.font = `700 ${baseFontSize}px "${fontFamily}", "Segoe UI", "Noto Sans JP", sans-serif`;
        }

        // 2. Draw active highlighted text clipped horizontally (crisp geometric wipe)
        if (isCurrent || isPassed) {
          const span = Math.max(0.01, m.endTime - m.startTime);
          const progress = isPassed ? 1 : Math.min(1, Math.max(0, (currentTime - m.startTime) / span));

          ctx.save();
          ctx.beginPath();
          ctx.rect(metrics.baseX - 2, 0, m.baseWidth * progress + 2, options.height);
          ctx.clip();

          if (innerStroke > 0) {
            ctx.lineWidth = innerStroke;
            ctx.strokeStyle = activeHighlightColor;
            ctx.strokeText(m.base, metrics.baseX, tokenBaselineY);
          }
          if (options.style.fillGradientEnabled && typeof ctx.createLinearGradient === 'function') {
            const grad = ctx.createLinearGradient(
              metrics.baseX,
              tokenBaselineY - baseFontSize,
              metrics.baseX,
              tokenBaselineY
            );
            grad.addColorStop(0, activeHighlightColor);
            grad.addColorStop(1, options.style.outlineColor);
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = activeHighlightColor;
          }
          ctx.fillText(m.base, metrics.baseX, tokenBaselineY);

          if (m.isRuby && m.ruby) {
            ctx.font = `700 ${rubyFontSize}px "${fontFamily}", "Segoe UI", "Noto Sans JP", sans-serif`;
            ctx.lineWidth = Math.max(2, Math.round(outerStroke * 0.55));
            ctx.strokeStyle = options.style.secondaryOutlineColor;
            ctx.strokeText(m.ruby, metrics.rubyX, metrics.rubyY);
            ctx.fillStyle = rubyActiveColor;
            ctx.fillText(m.ruby, metrics.rubyX, metrics.rubyY);
          }
          ctx.restore();
        }
      } else {
        const isHighlighted = isTokenActive || (isTokenPassed && animStyle === 'sweep');

        // Layer 2: Inner outline
        if (innerStroke > 0) {
          ctx.lineWidth = innerStroke;
          ctx.strokeStyle = isHighlighted ? activeHighlightColor : options.style.outlineColor;
          ctx.strokeText(m.base, metrics.baseX, tokenBaselineY);
        }

        // Layer 3: Fill (supports vertical gradient when fillGradientEnabled is true)
        if (options.style.fillGradientEnabled && typeof ctx.createLinearGradient === 'function') {
          const grad = ctx.createLinearGradient(
            metrics.baseX,
            tokenBaselineY - baseFontSize,
            metrics.baseX,
            tokenBaselineY
          );
          if (isHighlighted) {
            grad.addColorStop(0, activeHighlightColor);
            grad.addColorStop(1, options.style.outlineColor);
          } else {
            grad.addColorStop(0, options.style.primaryColor);
            grad.addColorStop(1, options.style.fillGradientEndColor || '#b8d0ff');
          }
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = isHighlighted ? activeHighlightColor : options.style.primaryColor;
        }
        ctx.fillText(m.base, metrics.baseX, tokenBaselineY);

        if (m.isRuby && m.ruby) {
          ctx.font = `700 ${rubyFontSize}px "${fontFamily}", "Segoe UI", "Noto Sans JP", sans-serif`;
          ctx.lineWidth = Math.max(2, Math.round(outerStroke * 0.55));
          ctx.strokeStyle = options.style.secondaryOutlineColor;
          ctx.strokeText(m.ruby, metrics.rubyX, metrics.rubyY);

          ctx.fillStyle = isHighlighted ? rubyActiveColor : rubyFillColor;
          ctx.fillText(m.ruby, metrics.rubyX, metrics.rubyY);
        }
      }

      ctx.restore();
      currentX += m.baseWidth + m.tokenGap;
    }

    // Secondary translation rendering
    if (line.translation && line.translation.trim().length > 0) {
      const transSize = Math.max(14, Math.round(baseFontSize * 0.45));
      ctx.font = `600 ${transSize}px "${fontFamily}", "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, Math.round(4 * scale));
      ctx.strokeStyle = options.style.secondaryOutlineColor;
      const transY = baselineY + Math.round(baseFontSize * 0.65);
      ctx.strokeText(line.translation.trim(), options.width / 2 + scaledXOffset, transY);
      ctx.fillStyle = translationFillColor;
      ctx.fillText(line.translation.trim(), options.width / 2 + scaledXOffset, transY);
    }

    ctx.restore();
  }
}
