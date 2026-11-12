import { tauriBridge, type ExportProgress, type ExportResult } from '../../services/tauriBridge';
import type { SubtitleLine, WordAnimationStyle, ParticlePresetType } from '../../types';
import { tokenizeSubtitleText } from '../text/RubyLayout';
import { formatCssFontStack } from '../text/fontLoader';
import {
  PRESET_CONFIGS,
  RAINBOW_TINTS_HEX,
  createTintedParticleCanvas,
} from '../particles/particleShapes';

const CJK_TOKEN_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

function hexToRgbaString(hex: string, alpha: number): string {
  const cleaned = (hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
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
    particleEnabled?: boolean;
    particlePreset?: ParticlePresetType;
    particleBurstCount?: number;
    particleSpeed?: number;
    particleGravity?: 'up' | 'none' | 'down';
    particleSize?: number;
    particleLifetime?: number;
    particleColorMode?: 'lyric' | 'glow' | 'rainbow';
  };
  audioSourcePath?: string;
  onProgress?: (progress: ExportProgress) => void;
}

interface SafeContext {
  ctx: CanvasRenderingContext2D | null;
  getRegionImageData: (y: number, height: number) => Uint8Array;
  getRectImageData: (x: number, y: number, w: number, h: number) => Uint8Array;
}

interface OverlayBand {
  y: number;
  height: number;
}

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
  inactiveSprite?: HTMLCanvasElement;
  activeSprite?: HTMLCanvasElement;
  originX: number;
  originBaselineY: number;
  spriteWidth: number;
  spriteHeight: number;
}

interface CachedLineLayout {
  measured: MeasuredToken[];
  totalWidth: number;
  scaledXOffset: number;
  baseBaselineY: number;
  scale: number;
  baseFontSize: number;
  rubyFontSize: number;
  outerStroke: number;
  innerStroke: number;
  glowBlur: number;
  baseFont: string;
  rubyFont: string;
  cssFontStack: string;
  lineSpan: number;
  entryWindow: number;
  exitWindow: number;
  transitionSec: number;
  translationSprite?: HTMLCanvasElement;
  translationWidth: number;
  translationHeight: number;
}

interface ExportParticle {
  type: ParticlePresetType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  scale: number;
  scaleSpeed: number;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  decay: number;
  life: number;
  maxLife: number;
  alive: boolean;
  tintHex: string;
}

const RAW_IPC_CHUNK_SIZE = 4 * 1024 * 1024;
const EMPTY_CHUNK = new Uint8Array(0);

export function computeSubtitleOverlayBand(options: ExportJobOptions): OverlayBand {
  const scale = options.height / 720;
  const baseFontSize = Math.round(options.style.fontSize * scale);
  const rubyFontSize = Math.round(baseFontSize * options.style.rubySizeRatio);
  const outerStroke = Math.max(0, Math.round(options.style.outlineThickness * scale));
  const innerStroke = Math.max(
    0,
    Math.round((options.style.innerStrokeWidth ?? options.style.outlineThickness * 0.4) * scale)
  );
  const glowBlur = Math.max(0, (options.style.glowBlur ?? 0) * scale);
  const scaledYOffset = Math.round((options.style.yOffset ?? 60) * scale);
  const vPos = options.style.verticalPosition ?? 'bottom';
  const baselineY =
    vPos === 'top'
      ? scaledYOffset + baseFontSize
      : vPos === 'center'
      ? Math.round((options.height + baseFontSize) / 2 + scaledYOffset)
      : options.height - scaledYOffset;

  const hasTranslation = options.lines.some(
    (l) => typeof l.translation === 'string' && l.translation.trim().length > 0
  );
  const transSize = Math.max(14, Math.round(baseFontSize * 0.45));
  const topParticlePad = options.style.particleEnabled ? Math.round(140 * scale) : 0;
  const bottomParticlePad = options.style.particleEnabled ? Math.round(90 * scale) : 0;
  const topPad =
    baseFontSize * 1.45 +
    rubyFontSize * 1.6 +
    outerStroke +
    innerStroke +
    glowBlur * 2 +
    44 * scale +
    topParticlePad;
  const bottomPad =
    (hasTranslation ? baseFontSize * 0.65 + transSize * 0.7 : baseFontSize * 0.35) +
    outerStroke +
    innerStroke +
    glowBlur * 2 +
    28 * scale +
    bottomParticlePad;

  const minY = Math.max(0, Math.floor(baselineY - topPad));
  const maxY = Math.min(options.height, Math.ceil(baselineY + bottomPad));
  const alignedY = minY & ~1;
  const rawHeight = Math.max(16, maxY - alignedY);
  const alignedHeight = Math.min(options.height - alignedY, (rawHeight + 1) & ~1);

  return {
    y: alignedY,
    height: Math.max(2, alignedHeight),
  };
}

function isStaticAtTime(
  layout: CachedLineLayout,
  line: SubtitleLine,
  t: number,
  animStyle: WordAnimationStyle
): boolean {
  if (t - line.startTime < layout.entryWindow || line.endTime - t < layout.exitWindow) {
    return false;
  }
  const continuousWhileActive =
    animStyle === 'smooth-sweep' ||
    animStyle === 'float' ||
    animStyle === 'glow-pulse' ||
    animStyle === 'staccato' ||
    animStyle === 'wave';

  for (const m of layout.measured) {
    if (m.disableAnim) continue;
    if (t >= m.startTime && t < m.endTime) {
      if (continuousWhileActive) {
        return false;
      }
      if (t < m.startTime + layout.transitionSec) {
        return false;
      }
    }
  }
  return true;
}

function sameTokenStateBoundary(
  layout: CachedLineLayout,
  tPrev: number,
  tCurr: number
): boolean {
  for (const m of layout.measured) {
    if ((tPrev < m.startTime) !== (tCurr < m.startTime)) return false;
    if ((tPrev < m.endTime) !== (tCurr < m.endTime)) return false;
    const settle = m.startTime + layout.transitionSec;
    if ((tPrev < settle) !== (tCurr < settle)) return false;
  }
  return true;
}

function createSafeOffscreenContext(width: number, height: number): SafeContext {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return {
      ctx,
      getRegionImageData: (y: number, regionHeight: number) => {
        if (!ctx) return new Uint8Array(width * regionHeight * 4);
        const img = ctx.getImageData(0, y, width, regionHeight);
        return new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength);
      },
      getRectImageData: (x: number, y: number, w: number, h: number) => {
        if (!ctx) return new Uint8Array(w * h * 4);
        const img = ctx.getImageData(x, y, w, h);
        return new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength);
      },
    };
  }

  // Headless test environment fallback
  const mockCtx = {
    clearRect: () => {},
    fillRect: () => {},
    strokeText: () => {},
    fillText: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    drawImage: () => {},
    clip: () => {},
    rect: () => {},
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
    getRegionImageData: (_y: number, regionHeight: number) =>
      new Uint8Array(width * regionHeight * 4),
    getRectImageData: (_x: number, _y: number, w: number, h: number) =>
      new Uint8Array(w * h * 4),
  };
}

/**
 * Encodes a tight dirty RGBA rectangle into a sparse 32-bit transparent-run RLE packet
 * with a 20-byte header for WebSocket binary streaming.
 */
export function encodeSparseRgbaPacket(
  rgbaBytes: Uint8Array,
  dirtyX: number,
  dirtyRelY: number,
  dirtyW: number,
  dirtyH: number,
  isTransparent: boolean,
  scratchU32: { buf: Uint32Array }
): Uint8Array {
  const totalPixels = dirtyW * dirtyH;
  const neededWords = 6 + totalPixels * 2;
  if (scratchU32.buf.length < neededWords) {
    scratchU32.buf = new Uint32Array(Math.max(neededWords, scratchU32.buf.length * 2));
  }
  const out = scratchU32.buf;
  const pixels =
    rgbaBytes.byteOffset % 4 === 0
      ? new Uint32Array(rgbaBytes.buffer, rgbaBytes.byteOffset, totalPixels)
      : new Uint32Array(rgbaBytes.slice().buffer, 0, totalPixels);

  let wordPos = 5;
  let i = 0;
  // Little-endian RGBA for opaque studio background #0a0d14ff
  const opaqueBlankU32 = 0xff140d0a;

  while (i < totalPixels) {
    let skip = 0;
    if (isTransparent) {
      while (i + skip < totalPixels && (pixels[i + skip] & 0xff000000) === 0) {
        skip++;
      }
    } else {
      while (i + skip < totalPixels && pixels[i + skip] === opaqueBlankU32) {
        skip++;
      }
    }
    if (skip > 0) {
      out[wordPos++] = skip;
      i += skip;
    }
    if (i >= totalPixels) break;

    const litStart = i;
    let lit = 0;
    if (isTransparent) {
      while (i + lit < totalPixels && (pixels[i + lit] & 0xff000000) !== 0) {
        lit++;
      }
    } else {
      while (i + lit < totalPixels && pixels[i + lit] !== opaqueBlankU32) {
        lit++;
      }
    }
    if (lit > 0) {
      out[wordPos++] = (0x80000000 | lit) >>> 0;
      for (let k = 0; k < lit; k++) {
        out[wordPos++] = pixels[litStart + k];
      }
      i += lit;
    }
  }

  // Fallback to uncompressed raw dirty rect if sparse RLE did not shrink payload
  if (wordPos - 5 >= totalPixels) {
    out[0] = 0;
    out[1] = dirtyX;
    out[2] = dirtyRelY;
    out[3] = dirtyW;
    out[4] = dirtyH;
    out.set(pixels.subarray(0, totalPixels), 5);
    return new Uint8Array(out.buffer, 0, (5 + totalPixels) * 4);
  }

  out[0] = 1;
  out[1] = dirtyX;
  out[2] = dirtyRelY;
  out[3] = dirtyW;
  out[4] = dirtyH;
  return new Uint8Array(out.buffer, 0, wordPos * 4);
}

function buildWsControlPacket(flags: number, arg1 = 0): Uint8Array {
  const pkt = new Uint32Array(5);
  pkt[0] = flags >>> 0;
  pkt[1] = arg1 >>> 0;
  return new Uint8Array(pkt.buffer);
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
    const roiBand = isNative
      ? computeSubtitleOverlayBand(options)
      : { y: 0, height: options.height };

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
          overlay_y: roiBand.y,
          overlay_height: roiBand.height,
        });
      } catch (err) {
        throw new Error(`Failed to initialize FFmpeg pipeline: ${String(err)}`);
      }
    }

    const { ctx, getRegionImageData, getRectImageData } = createSafeOffscreenContext(
      options.width,
      options.height
    );
    const layoutCache = new Map<SubtitleLine, CachedLineLayout>();

    const hasVideoBackground = Boolean(
      options.audioSourcePath && /\.(mp4|webm|mkv|mov)$/i.test(options.audioSourcePath)
    );
    const isTransparent =
      options.mode === 'webm_alpha' || options.mode === 'prores_alpha' || hasVideoBackground;
    const startTime = performance.now();
    let hasCachedBlank = false;
    let lastRenderedLine: SubtitleLine | null = null;
    let lastRenderedTime = -1;
    let lastRenderedWasBlank = false;
    const animStyle = options.style.wordAnimStyle ?? 'pop';
    let inFlightWrite: Promise<void> | null = null;

    const flushInFlight = async () => {
      if (inFlightWrite) {
        await inFlightWrite;
        inFlightWrite = null;
      }
    };

    // Open high-speed loopback WebSocket binary stream if running in native Tauri WebView
    let ws: WebSocket | null = null;
    let wsAckResolve: (() => void) | null = null;
    let wsFailed = false;
    if (isNative && typeof WebSocket !== 'undefined') {
      try {
        const wsInfo = await tauriBridge.ffmpegOpenWsStream(sessionId);
        if (wsInfo) {
          ws = await new Promise<WebSocket | null>((resolve) => {
            const socket = new WebSocket(
              `ws://127.0.0.1:${wsInfo.port}/?token=${encodeURIComponent(wsInfo.token)}`
            );
            socket.binaryType = 'arraybuffer';
            const timer = setTimeout(() => {
              try {
                socket.close();
              } catch {
                // Ignore
              }
              resolve(null);
            }, 3000);
            socket.onopen = () => {
              clearTimeout(timer);
              resolve(socket);
            };
            socket.onerror = () => {
              clearTimeout(timer);
              wsFailed = true;
              resolve(null);
            };
            socket.onclose = () => {
              if (wsAckResolve) {
                wsAckResolve();
                wsAckResolve = null;
              }
            };
            socket.onmessage = (ev) => {
              if (ev.data instanceof ArrayBuffer && ev.data.byteLength >= 16) {
                const view = new DataView(ev.data);
                const written = view.getUint32(0, true);
                const total = Math.max(1, view.getUint32(4, true));
                const fpsX100 = view.getUint32(8, true);
                const isAck = view.getUint32(12, true);
                options.onProgress?.({
                  session_id: sessionId,
                  frames_written: written,
                  total_frames: total,
                  percentage: Math.min(99.9, (written / total) * 100),
                  fps: fpsX100 / 100,
                });
                if (isAck === 1 && wsAckResolve) {
                  wsAckResolve();
                  wsAckResolve = null;
                }
              }
            };
          });
        }
      } catch {
        ws = null;
      }
    }

    const useWs = Boolean(ws && ws.readyState === WebSocket.OPEN && !wsFailed);
    const maxBatch = useWs
      ? Math.min(120, Math.max(1, Math.round(options.fps * 2)))
      : Math.min(30, Math.max(1, Math.round(options.fps / 2)));
    const rleScratch = { buf: new Uint32Array(262144) };
    let prevDirtyRect: { x: number; y: number; w: number; h: number } | null = null;

    const particleEnabled = options.style.particleEnabled ?? false;
    const particlePreset = options.style.particlePreset ?? 'stardust';
    const particleBurstCount = options.style.particleBurstCount ?? 15;
    const activeWordColorHex = options.style.wordActiveColor || options.style.outlineColor || '#8fb4ff';
    const activeParticles: ExportParticle[] = [];
    let lastActiveTokenKey: string | null = null;
    const particleCanvasCache = new Map<string, HTMLCanvasElement>();

    const getTintedParticleCanvas = (type: ParticlePresetType, tint: string): HTMLCanvasElement => {
      const key = `${type}_${tint.toLowerCase()}`;
      let c = particleCanvasCache.get(key);
      if (!c) {
        c = createTintedParticleCanvas(type, tint, 128);
        particleCanvasCache.set(key, c);
      }
      return c;
    };

    try {
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (this.isCancelled) {
          await flushInFlight();
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.close();
            } catch {
              // Ignore
            }
          }
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
        const activeLine = options.lines.find(
          (l) => currentTime >= l.startTime && currentTime <= l.endTime
        );
        const hasParticles = particleEnabled && activeParticles.length > 0;

        if (isNative && !activeLine && (hasCachedBlank || useWs) && !hasParticles) {
          let repeatCount = 1;
          while (repeatCount < maxBatch && frameIndex + repeatCount < totalFrames) {
            const nextTime = (frameIndex + repeatCount) * frameInterval;
            const nextLine = options.lines.find(
              (l) => nextTime >= l.startTime && nextTime <= l.endTime
            );
            if (nextLine) break;
            repeatCount++;
          }

          if (useWs && ws && ws.readyState === WebSocket.OPEN) {
            if (ws.bufferedAmount > 4 * 1024 * 1024) {
              await new Promise((r) => setTimeout(r, 1));
            }
            ws.send(buildWsControlPacket(2, repeatCount));
          } else {
            await flushInFlight();
            inFlightWrite = tauriBridge
              .ffmpegWriteFrameChunk(sessionId, EMPTY_CHUNK, {
                useBlank: true,
                repeatCount,
              })
              .then((prog) => options.onProgress?.(prog));
          }
          lastRenderedLine = null;
          lastRenderedWasBlank = true;
          frameIndex += repeatCount - 1;
          continue;
        }

        if (
          isNative &&
          activeLine &&
          ctx &&
          !lastRenderedWasBlank &&
          lastRenderedLine === activeLine &&
          !hasParticles
        ) {
          const cachedLayout = this.getOrBuildLineLayout(ctx, activeLine, options, layoutCache);
          if (
            isStaticAtTime(cachedLayout, activeLine, lastRenderedTime, animStyle) &&
            isStaticAtTime(cachedLayout, activeLine, currentTime, animStyle) &&
            sameTokenStateBoundary(cachedLayout, lastRenderedTime, currentTime)
          ) {
            let repeatCount = 1;
            let prevStaticTime = currentTime;
            while (repeatCount < maxBatch && frameIndex + repeatCount < totalFrames) {
              const nextTime = (frameIndex + repeatCount) * frameInterval;
              if (nextTime > activeLine.endTime) break;
              if (
                !isStaticAtTime(cachedLayout, activeLine, nextTime, animStyle) ||
                !sameTokenStateBoundary(cachedLayout, prevStaticTime, nextTime)
              ) {
                break;
              }
              prevStaticTime = nextTime;
              repeatCount++;
            }

            if (useWs && ws && ws.readyState === WebSocket.OPEN) {
              if (ws.bufferedAmount > 4 * 1024 * 1024) {
                await new Promise((r) => setTimeout(r, 1));
              }
              ws.send(buildWsControlPacket(3, repeatCount));
            } else {
              await flushInFlight();
              inFlightWrite = tauriBridge
                .ffmpegWriteFrameChunk(sessionId, EMPTY_CHUNK, {
                  reuseLast: true,
                  repeatCount,
                })
                .then((prog) => options.onProgress?.(prog));
            }
            lastRenderedTime = prevStaticTime;
            frameIndex += repeatCount - 1;
            continue;
          }
        }

        // Track tight per-frame dirty rect covering text + active particles
        let dMinX = options.width;
        let dMinY = roiBand.y + roiBand.height;
        let dMaxX = 0;
        let dMaxY = roiBand.y;

        if (ctx) {
          // Clear previous dirty region (or full ROI band on first frame)
          if (prevDirtyRect && prevDirtyRect.w > 0 && prevDirtyRect.h > 0) {
            if (isTransparent) {
              ctx.clearRect(prevDirtyRect.x, prevDirtyRect.y, prevDirtyRect.w, prevDirtyRect.h);
            } else {
              ctx.fillStyle = '#0a0d14';
              ctx.fillRect(prevDirtyRect.x, prevDirtyRect.y, prevDirtyRect.w, prevDirtyRect.h);
            }
          } else {
            if (isTransparent) {
              ctx.clearRect(0, roiBand.y, options.width, roiBand.height);
            } else {
              ctx.fillStyle = '#0a0d14';
              ctx.fillRect(0, roiBand.y, options.width, roiBand.height);
            }
          }

          let activeLayout: CachedLineLayout | null = null;
          if (activeLine) {
            activeLayout = this.getOrBuildLineLayout(ctx, activeLine, options, layoutCache);

            // 1. Trigger particle emission when active word switches (using Studio coordinate match)
            if (particleEnabled) {
              const activeIdx = activeLayout.measured.findIndex(
                (m) => !m.disableAnim && currentTime >= m.startTime && currentTime < m.endTime
              );
              if (activeIdx !== -1) {
                const tokenKey = `${activeLine.id}_${activeIdx}`;
                if (tokenKey !== lastActiveTokenKey) {
                  lastActiveTokenKey = tokenKey;
                  const targetToken = activeLayout.measured[activeIdx];
                  let originTokenX =
                    (options.width - activeLayout.totalWidth) / 2 + activeLayout.scaledXOffset;
                  for (let i = 0; i < activeIdx; i++) {
                    originTokenX +=
                      activeLayout.measured[i].baseWidth + activeLayout.measured[i].tokenGap;
                  }
                  const sinceStart = currentTime - activeLine.startTime;
                  const lineSlideY =
                    sinceStart < activeLayout.entryWindow
                      ? Math.round(
                          (1 - easeOutCubic(sinceStart / activeLayout.entryWindow)) *
                            12 *
                            activeLayout.scale
                        )
                      : 0;
                  const lineTopY =
                    activeLayout.baseBaselineY - activeLayout.baseFontSize + lineSlideY;
                  const emitX = originTokenX + targetToken.baseWidth / 2;
                  const emitY = lineTopY - 10 * activeLayout.scale;

                  const config = PRESET_CONFIGS[particlePreset] || PRESET_CONFIGS.stardust;
                  const speedMult = options.style.particleSpeed ?? 1.0;
                  const sizeMult = options.style.particleSize ?? 1.0;
                  const lifetimeMult = options.style.particleLifetime ?? 1.0;
                  const gravityDir = options.style.particleGravity ?? 'none';
                  const colorMode = options.style.particleColorMode ?? 'lyric';

                  for (let pIdx = 0; pIdx < particleBurstCount; pIdx++) {
                    const tint =
                      colorMode === 'rainbow'
                        ? RAINBOW_TINTS_HEX[Math.floor(Math.random() * RAINBOW_TINTS_HEX.length)]
                        : colorMode === 'glow'
                        ? options.style.glowColor || activeWordColorHex
                        : activeWordColorHex;

                    const baseSpeed =
                      config.speedMin + Math.random() * (config.speedMax - config.speedMin);
                    const speed = baseSpeed * speedMult * (options.height / 720);

                    const angle =
                      particlePreset === 'sakura'
                        ? Math.PI / 4 + (Math.random() - 0.5) * 0.8
                        : particlePreset === 'notes' ||
                          particlePreset === 'firefly' ||
                          particlePreset === 'heart'
                        ? -Math.PI / 2 + (Math.random() - 0.5) * 1.4
                        : Math.random() * Math.PI * 2;

                    const ay =
                      gravityDir === 'up'
                        ? -Math.abs(config.gravityY || 20) * (options.height / 720)
                        : gravityDir === 'down'
                        ? Math.abs(config.gravityY || 20) * (options.height / 720)
                        : 0;

                    const baseScale =
                      config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
                    const baseDecay =
                      config.decayMin + Math.random() * (config.decayMax - config.decayMin);
                    const decay = baseDecay / Math.max(0.1, lifetimeMult);

                    activeParticles.push({
                      type: particlePreset,
                      x: emitX + (Math.random() - 0.5) * 20 * (options.height / 720),
                      y: emitY + (Math.random() - 0.5) * 16 * (options.height / 720),
                      vx: Math.cos(angle) * speed,
                      vy: Math.sin(angle) * speed,
                      ay,
                      scale: baseScale * sizeMult * (options.height / 720),
                      scaleSpeed: (Math.random() - 0.5) * 0.2,
                      rotation: Math.random() * Math.PI * 2,
                      rotationSpeed: (Math.random() - 0.5) * 4,
                      alpha: 1,
                      decay,
                      life: 0,
                      maxLife: 1 / decay,
                      alive: true,
                      tintHex: tint,
                    });
                  }
                }
              }
            }
          }

          // 2. Update kinematics & render active particles FIRST (strictly UNDER subtitle text)
          if (particleEnabled && activeParticles.length > 0) {
            for (let pIdx = activeParticles.length - 1; pIdx >= 0; pIdx--) {
              const p = activeParticles[pIdx];
              p.life += frameInterval;
              p.alpha -= p.decay * frameInterval;
              if (p.alpha <= 0.01 || p.life >= p.maxLife) {
                activeParticles.splice(pIdx, 1);
                continue;
              }
              p.vy += p.ay * frameInterval;
              p.x += p.vx * frameInterval;
              p.y += p.vy * frameInterval;
              p.scale = Math.max(0.05, p.scale + p.scaleSpeed * frameInterval);
              p.rotation += p.rotationSpeed * frameInterval;

              const pRad = Math.ceil(64 * p.scale) + 4;
              if (p.x - pRad < dMinX) dMinX = p.x - pRad;
              if (p.y - pRad < dMinY) dMinY = p.y - pRad;
              if (p.x + pRad > dMaxX) dMaxX = p.x + pRad;
              if (p.y + pRad > dMaxY) dMaxY = p.y + pRad;

              ctx.save();
              ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
              ctx.translate(p.x, p.y);
              ctx.rotate(p.rotation);
              ctx.scale(p.scale, p.scale);
              const pCanvas = getTintedParticleCanvas(p.type, p.tintHex);
              ctx.drawImage(pCanvas, -pCanvas.width / 2, -pCanvas.height / 2);
              ctx.restore();
            }
          }

          // 3. Render subtitle text SECOND (on top of particle layer, matching Studio PixiViewport)
          if (activeLine && activeLayout) {
            this.renderSubtitleFrame(ctx, activeLine, activeLayout, currentTime, options);

            const lineLeft =
              (options.width - activeLayout.totalWidth) / 2 + activeLayout.scaledXOffset;
            const pad = Math.ceil(
              activeLayout.glowBlur * 2 +
                activeLayout.outerStroke +
                activeLayout.innerStroke +
                36 * activeLayout.scale
            );
            const lMinX = lineLeft - pad;
            const lMaxX = lineLeft + activeLayout.totalWidth + pad;
            const lMinY =
              activeLayout.baseBaselineY -
              activeLayout.baseFontSize -
              activeLayout.rubyFontSize -
              pad;
            let lMaxY = activeLayout.baseBaselineY + pad;

            if (activeLayout.translationSprite) {
              const tLeft =
                (options.width - activeLayout.translationWidth) / 2 + activeLayout.scaledXOffset;
              const tRight = tLeft + activeLayout.translationWidth;
              const tBottom =
                activeLayout.baseBaselineY +
                activeLayout.baseFontSize * 0.65 +
                activeLayout.translationHeight;
              if (tLeft < dMinX) dMinX = tLeft;
              if (tRight > dMaxX) dMaxX = tRight;
              if (tBottom > lMaxY) lMaxY = tBottom;
            }

            if (lMinX < dMinX) dMinX = lMinX;
            if (lMaxX > dMaxX) dMaxX = lMaxX;
            if (lMinY < dMinY) dMinY = lMinY;
            if (lMaxY > dMaxY) dMaxY = lMaxY;
          }
        }

        // Clamp tight dirty rect to ROI band
        const dirtyX = Math.max(0, Math.floor(dMinX));
        const dirtyY = Math.max(roiBand.y, Math.floor(dMinY));
        const dirtyMaxX = Math.min(options.width, Math.ceil(dMaxX));
        const dirtyMaxY = Math.min(roiBand.y + roiBand.height, Math.ceil(dMaxY));
        const hasValidDirty = dirtyMaxX > dirtyX && dirtyMaxY > dirtyY;
        const safeDirtyX = hasValidDirty ? dirtyX : 0;
        const safeDirtyY = hasValidDirty ? dirtyY : roiBand.y;
        const safeDirtyW = hasValidDirty ? dirtyMaxX - dirtyX : 2;
        const safeDirtyH = hasValidDirty ? dirtyMaxY - dirtyY : 2;
        prevDirtyRect = { x: safeDirtyX, y: safeDirtyY, w: safeDirtyW, h: safeDirtyH };

        if (isNative) {
          if (useWs && ws && ws.readyState === WebSocket.OPEN) {
            if (ws.bufferedAmount > 4 * 1024 * 1024) {
              await new Promise((r) => setTimeout(r, 1));
            }
            const rectBytes = getRectImageData(safeDirtyX, safeDirtyY, safeDirtyW, safeDirtyH);
            const packet = encodeSparseRgbaPacket(
              rectBytes,
              safeDirtyX,
              safeDirtyY - roiBand.y,
              safeDirtyW,
              safeDirtyH,
              isTransparent,
              rleScratch
            );
            ws.send(packet);
            if (frameIndex % 12 === 0) {
              await new Promise((r) => setTimeout(r, 0));
            }
          } else {
            const roiBytes = getRegionImageData(roiBand.y, roiBand.height);
            const shouldCacheBlank = !activeLine && !hasCachedBlank && !hasParticles;
            await flushInFlight();
            inFlightWrite = this.writeRawFrameInChunks(sessionId, roiBytes, shouldCacheBlank).then(
              (prog) => options.onProgress?.(prog)
            );
            if (shouldCacheBlank) {
              hasCachedBlank = true;
            }
          }
          lastRenderedLine = activeLine ?? null;
          lastRenderedTime = currentTime;
          lastRenderedWasBlank = !activeLine && !hasParticles;
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

      if (useWs && ws && ws.readyState === WebSocket.OPEN) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 5000);
          wsAckResolve = () => {
            clearTimeout(timeout);
            resolve();
          };
          ws!.send(buildWsControlPacket(4)); // Flush & ACK
        });
        try {
          ws.close();
        } catch {
          // Ignore
        }
      } else {
        await flushInFlight();
      }
    } catch (err) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.close();
        } catch {
          // Ignore
        }
      }
      if (isNative) {
        await tauriBridge.ffmpegCancelExport(sessionId);
      }
      throw err;
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

  private async writeRawFrameInChunks(
    sessionId: string,
    rawBytes: Uint8Array,
    cacheBlank = false
  ): Promise<ExportProgress> {
    if (rawBytes.byteLength <= RAW_IPC_CHUNK_SIZE) {
      return tauriBridge.ffmpegWriteFrameChunk(sessionId, rawBytes, {
        cacheBlank,
        commitFrame: true,
        repeatCount: 1,
      });
    }

    let lastProgress: ExportProgress | undefined;
    for (let offset = 0; offset < rawBytes.byteLength; offset += RAW_IPC_CHUNK_SIZE) {
      if (this.isCancelled) {
        break;
      }
      const end = Math.min(rawBytes.byteLength, offset + RAW_IPC_CHUNK_SIZE);
      const isLast = end >= rawBytes.byteLength;
      const slice = rawBytes.subarray(offset, end);
      lastProgress = await tauriBridge.ffmpegWriteFrameChunk(sessionId, slice, {
        cacheBlank,
        commitFrame: isLast,
        repeatCount: 1,
      });
    }

    return (
      lastProgress ?? {
        session_id: sessionId,
        frames_written: 0,
        total_frames: 0,
        percentage: 0,
        fps: 0,
      }
    );
  }

  private getOrBuildLineLayout(
    ctx: CanvasRenderingContext2D,
    line: SubtitleLine,
    options: ExportJobOptions,
    cache: Map<SubtitleLine, CachedLineLayout>
  ): CachedLineLayout {
    const cached = cache.get(line);
    if (cached) {
      return cached;
    }

    const scale = options.height / 720;
    const baseFontSize = Math.round(options.style.fontSize * scale);
    const rubyFontSize = Math.round(baseFontSize * options.style.rubySizeRatio);
    const outerStroke = Math.max(0, Math.round(options.style.outlineThickness * scale));
    const innerStroke = Math.max(
      0,
      Math.round((options.style.innerStrokeWidth ?? options.style.outlineThickness * 0.4) * scale)
    );
    const glowBlur = Math.max(0, (options.style.glowBlur ?? 0) * scale);
    const cssFontStack = formatCssFontStack(options.style.fontFamily, [
      'Segoe UI',
      'Yu Gothic UI',
      'Meiryo',
      'Noto Sans JP',
      'sans-serif',
    ]);
    const baseFont = `700 ${baseFontSize}px ${cssFontStack}`;
    const rubyFont = `700 ${rubyFontSize}px ${cssFontStack}`;

    const autoTokens = tokenizeSubtitleText(line.text);
    const lineSpan = Math.max(0.2, line.endTime - line.startTime);
    const fallbackStep =
      Math.max(0.1, line.endTime - line.startTime) / Math.max(1, autoTokens.length);
    const transitionSec = Math.max(0.01, (options.style.wordTransitionMs ?? 140) / 1000);

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
      ctx.font = baseFont;
      const bw = ctx.measureText(t.base).width;
      let rw = 0;
      if (t.isRuby && t.ruby) {
        ctx.font = rubyFont;
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

      const clusterWidth = Math.max(bw, rw);
      const spritePad = Math.ceil(glowBlur * 2 + outerStroke + innerStroke + 16 * scale);
      const spriteW = Math.max(1, Math.ceil(clusterWidth + spritePad * 2));
      const kanjiAscent = Math.round(baseFontSize * 0.88);
      const rubyGap = Math.max(3, Math.round(4 * scale));
      const spriteH = Math.max(
        1,
        Math.ceil(baseFontSize + rubyFontSize + rubyGap + spritePad * 2 + 10 * scale)
      );
      const originX = Math.round(spritePad + (clusterWidth - bw) / 2);
      const originBaselineY = Math.round(spritePad + rubyFontSize + rubyGap + kanjiAscent);

      let inactiveSprite: HTMLCanvasElement | undefined;
      let activeSprite: HTMLCanvasElement | undefined;

      if (typeof document !== 'undefined') {
        const buildSprite = (isActive: boolean) => {
          const sCanvas = document.createElement('canvas');
          sCanvas.width = spriteW;
          sCanvas.height = spriteH;
          const sctx = sCanvas.getContext('2d', { willReadFrequently: true });
          if (!sctx) return sCanvas;

          sctx.lineJoin = 'round';
          sctx.textAlign = 'left';

          const strokeCol = isActive
            ? options.style.wordActiveColor || options.style.outlineColor
            : options.style.outlineColor;
          const fillCol = isActive
            ? options.style.wordActiveColor || options.style.primaryColor
            : options.style.primaryColor;
          const rubyFillCol = isActive
            ? options.style.rubyActiveColor || '#5affb5'
            : options.style.rubyFillColor || options.style.primaryColor;

          // 1. Outer outline + glow (alpha: 0.65 parity with PixiViewport dropShadow)
          if (outerStroke + innerStroke > 0 || glowBlur > 0) {
            sctx.save();
            if (glowBlur > 0 && options.style.glowColor) {
              sctx.shadowColor = hexToRgbaString(options.style.glowColor, 0.65);
              sctx.shadowBlur = glowBlur;
            }
            if (outerStroke + innerStroke > 0) {
              sctx.font = baseFont;
              sctx.textBaseline = 'alphabetic';
              sctx.lineWidth = outerStroke + innerStroke;
              sctx.strokeStyle = options.style.secondaryOutlineColor;
              sctx.strokeText(t.base, originX, originBaselineY);
            }
            sctx.restore();
          }

          // 2. Inner stroke (or subtle outer fallback when innerStroke is 0, matching PixiViewport)
          if (innerStroke > 0) {
            sctx.font = baseFont;
            sctx.textBaseline = 'alphabetic';
            sctx.lineWidth = innerStroke;
            sctx.strokeStyle = strokeCol;
            sctx.strokeText(t.base, originX, originBaselineY);
          } else if (outerStroke > 0) {
            sctx.font = baseFont;
            sctx.textBaseline = 'alphabetic';
            sctx.lineWidth = Math.max(1, Math.round(outerStroke * 0.4));
            sctx.strokeStyle = options.style.secondaryOutlineColor;
            sctx.strokeText(t.base, originX, originBaselineY);
          }

          // 3. Fill
          sctx.font = baseFont;
          sctx.textBaseline = 'alphabetic';
          if (options.style.fillGradientEnabled && typeof sctx.createLinearGradient === 'function') {
            const grad = sctx.createLinearGradient(
              originX,
              originBaselineY - baseFontSize,
              originX,
              originBaselineY
            );
            if (isActive) {
              grad.addColorStop(0, fillCol);
              grad.addColorStop(1, strokeCol);
            } else {
              grad.addColorStop(0, fillCol);
              grad.addColorStop(1, options.style.fillGradientEndColor || '#b8d0ff');
            }
            sctx.fillStyle = grad;
          } else {
            sctx.fillStyle = fillCol;
          }
          sctx.fillText(t.base, originX, originBaselineY);

          // 4. Positioned Furigana above kanji
          if (t.isRuby && t.ruby) {
            const rubyBottomY = originBaselineY - kanjiAscent - rubyGap;
            const rubyX = Math.round(originX + (bw - rw) / 2);
            sctx.font = rubyFont;
            sctx.textBaseline = 'bottom';
            const rStroke = Math.max(2, Math.round(outerStroke * 0.55));
            if (rStroke > 0) {
              sctx.lineWidth = rStroke;
              sctx.strokeStyle = options.style.secondaryOutlineColor;
              sctx.strokeText(t.ruby, rubyX, rubyBottomY);
            }
            sctx.fillStyle = rubyFillCol;
            sctx.fillText(t.ruby, rubyX, rubyBottomY);
          }

          return sCanvas;
        };

        inactiveSprite = buildSprite(false);
        activeSprite = buildSprite(true);
      }

      return {
        ...t,
        baseWidth: bw,
        rubyWidth: rw,
        clusterWidth,
        tokenGap,
        inactiveSprite,
        activeSprite,
        originX,
        originBaselineY,
        spriteWidth: spriteW,
        spriteHeight: spriteH,
      };
    });

    const totalWidth = measured.reduce((sum, m) => sum + m.baseWidth + m.tokenGap, 0);
    const scaledXOffset = Math.round((options.style.xOffset ?? 0) * scale);
    const scaledYOffset = Math.round((options.style.yOffset ?? 60) * scale);
    const vPos = options.style.verticalPosition ?? 'bottom';
    const baseBaselineY =
      vPos === 'top'
        ? scaledYOffset + baseFontSize
        : vPos === 'center'
        ? Math.round((options.height + baseFontSize) / 2 + scaledYOffset)
        : options.height - scaledYOffset;

    let translationSprite: HTMLCanvasElement | undefined;
    let translationWidth = 0;
    let translationHeight = 0;
    if (line.translation && line.translation.trim().length > 0 && typeof document !== 'undefined') {
      const transText = line.translation.trim();
      const transSize = Math.max(14, Math.round(baseFontSize * 0.45));
      ctx.font = `600 ${transSize}px ${cssFontStack}`;
      const tw = ctx.measureText(transText).width;
      const tpad = Math.ceil(outerStroke + 16 * scale);
      const tCanvas = document.createElement('canvas');
      tCanvas.width = Math.ceil(tw + tpad * 2);
      tCanvas.height = Math.ceil(transSize * 1.6 + tpad * 2);
      const tctx = tCanvas.getContext('2d', { willReadFrequently: true });
      if (tctx) {
        tctx.font = `600 ${transSize}px ${cssFontStack}`;
        tctx.textAlign = 'left';
        tctx.textBaseline = 'alphabetic';
        tctx.lineJoin = 'round';
        tctx.lineWidth = Math.max(2, Math.round(4 * scale));
        tctx.strokeStyle = options.style.secondaryOutlineColor;
        const tx = tpad;
        const ty = Math.round(tpad + transSize * 1.0);
        tctx.strokeText(transText, tx, ty);
        tctx.fillStyle = options.style.translationFillColor || '#bfc3ca';
        tctx.fillText(transText, tx, ty);
        translationSprite = tCanvas;
        translationWidth = tCanvas.width;
        translationHeight = tCanvas.height;
      }
    }

    const layout: CachedLineLayout = {
      measured,
      totalWidth,
      scaledXOffset,
      baseBaselineY,
      scale,
      baseFontSize,
      rubyFontSize,
      outerStroke,
      innerStroke,
      glowBlur,
      baseFont,
      rubyFont,
      cssFontStack,
      lineSpan,
      entryWindow: Math.min(0.22, lineSpan * 0.25),
      exitWindow: Math.min(0.18, lineSpan * 0.2),
      transitionSec,
      translationSprite,
      translationWidth,
      translationHeight,
    };
    cache.set(line, layout);
    return layout;
  }

  private renderSubtitleFrame(
    ctx: CanvasRenderingContext2D,
    line: SubtitleLine,
    layout: CachedLineLayout,
    currentTime: number,
    options: ExportJobOptions
  ): void {
    const {
      measured,
      totalWidth,
      scaledXOffset,
      baseBaselineY,
      scale,
      baseFontSize,
      outerStroke,
      innerStroke,
      glowBlur,
      baseFont,
      rubyFont,
      cssFontStack,
      entryWindow,
      exitWindow,
      transitionSec,
    } = layout;

    const animStyle = options.style.wordAnimStyle ?? 'pop';
    const activeHighlightColor = options.style.wordActiveColor || options.style.outlineColor;
    const rubyFillColor = options.style.rubyFillColor || options.style.primaryColor;
    const rubyActiveColor = options.style.rubyActiveColor || '#5affb5';
    const translationFillColor = options.style.translationFillColor || '#bfc3ca';

    // Line-level entry & exit fade/slide parity with PixiViewport
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
    ctx.font = baseFont;

    const baselineY = baseBaselineY + lineSlideY;
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

      // Ultra-fast path: Blit pre-baked token offscreen sprites (zero Gaussian blur / CPU re-rasterization)
      if (m.inactiveSprite && m.activeSprite) {
        const spriteDrawX = tokenBaselineX - m.originX;
        const spriteDrawY = tokenBaselineY - m.originBaselineY;

        ctx.save();
        if (scaleBoost !== 1) {
          const pivotX = tokenBaselineX + m.baseWidth / 2;
          const pivotY = tokenBaselineY - baseFontSize / 2;
          ctx.translate(pivotX, pivotY);
          ctx.scale(scaleBoost, scaleBoost);
          ctx.translate(-pivotX, -pivotY);
        }

        if (animStyle === 'smooth-sweep') {
          const isPassed = currentTime >= m.endTime;
          const isCurrent = currentTime >= m.startTime && currentTime < m.endTime;

          ctx.drawImage(m.inactiveSprite, spriteDrawX, spriteDrawY);

          if (isPassed) {
            ctx.drawImage(m.activeSprite, spriteDrawX, spriteDrawY);
          } else if (isCurrent) {
            const span = Math.max(0.01, m.endTime - m.startTime);
            const progress = Math.min(1, Math.max(0, (currentTime - m.startTime) / span));
            if (progress > 0.001) {
              const extra = progress >= 0.98 ? 4 : 0;
              const wipeWidth = Math.min(
                m.spriteWidth,
                Math.round(m.originX + m.baseWidth * progress + extra)
              );
              if (wipeWidth > 0) {
                ctx.drawImage(
                  m.activeSprite,
                  0,
                  0,
                  wipeWidth,
                  m.spriteHeight,
                  spriteDrawX,
                  spriteDrawY,
                  wipeWidth,
                  m.spriteHeight
                );
              }
            }
          }
        } else {
          const highlightAlpha = isTokenActive
            ? Math.max(0.35, enterProgress)
            : isTokenPassed && animStyle === 'sweep'
            ? 1
            : 0;

          if (highlightAlpha <= 0) {
            ctx.drawImage(m.inactiveSprite, spriteDrawX, spriteDrawY);
          } else if (highlightAlpha >= 1) {
            ctx.drawImage(m.activeSprite, spriteDrawX, spriteDrawY);
          } else {
            const baseAlpha = ctx.globalAlpha;
            ctx.globalAlpha = baseAlpha * (1 - highlightAlpha * 0.92);
            ctx.drawImage(m.inactiveSprite, spriteDrawX, spriteDrawY);
            ctx.globalAlpha = baseAlpha * highlightAlpha;
            ctx.drawImage(m.activeSprite, spriteDrawX, spriteDrawY);
            ctx.globalAlpha = baseAlpha;
          }
        }
        ctx.restore();
      } else {
        // Fallback vector drawing (headless tests with mock canvas)
        ctx.save();
        if (scaleBoost !== 1) {
          const pivotX = tokenBaselineX + m.baseWidth / 2;
          const pivotY = tokenBaselineY - baseFontSize / 2;
          ctx.translate(pivotX, pivotY);
          ctx.scale(scaleBoost, scaleBoost);
          ctx.translate(-pivotX, -pivotY);
        }

        ctx.font = baseFont;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round';

        // Outer outline + glow
        if (outerStroke + innerStroke > 0 || glowBlur > 0) {
          ctx.save();
          if (glowBlur > 0 && options.style.glowColor) {
            ctx.shadowColor = hexToRgbaString(options.style.glowColor, 0.65);
            ctx.shadowBlur = glowBlur;
          }
          if (outerStroke + innerStroke > 0) {
            ctx.lineWidth = outerStroke + innerStroke;
            ctx.strokeStyle = options.style.secondaryOutlineColor;
            ctx.strokeText(m.base, tokenBaselineX, tokenBaselineY);
          }
          ctx.restore();
        }

        const isHighlighted = isTokenActive || (isTokenPassed && animStyle === 'sweep');

        // Inner outline
        if (innerStroke > 0) {
          ctx.lineWidth = innerStroke;
          ctx.strokeStyle = isHighlighted ? activeHighlightColor : options.style.outlineColor;
          ctx.strokeText(m.base, tokenBaselineX, tokenBaselineY);
        }

        // Fill
        if (options.style.fillGradientEnabled && typeof ctx.createLinearGradient === 'function') {
          const grad = ctx.createLinearGradient(
            tokenBaselineX,
            tokenBaselineY - baseFontSize,
            tokenBaselineX,
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
        ctx.fillText(m.base, tokenBaselineX, tokenBaselineY);

        // Positioned Furigana cleanly above kanji
        if (m.isRuby && m.ruby) {
          const kanjiAscent = Math.round(baseFontSize * 0.88);
          const rubyGap = Math.max(3, Math.round(4 * scale));
          const rubyX = Math.round(tokenBaselineX + (m.baseWidth - m.rubyWidth) / 2);
          const rubyBottomY = tokenBaselineY - kanjiAscent - rubyGap;

          ctx.font = rubyFont;
          ctx.textBaseline = 'bottom';
          ctx.lineWidth = Math.max(2, Math.round(outerStroke * 0.55));
          ctx.strokeStyle = options.style.secondaryOutlineColor;
          ctx.strokeText(m.ruby, rubyX, rubyBottomY);

          ctx.fillStyle = isHighlighted ? rubyActiveColor : rubyFillColor;
          ctx.fillText(m.ruby, rubyX, rubyBottomY);
        }

        ctx.restore();
      }

      currentX += m.baseWidth + m.tokenGap;
    }

    // Secondary translation rendering
    if (layout.translationSprite) {
      const transX = Math.round((options.width - layout.translationWidth) / 2 + scaledXOffset);
      const transY = Math.round(baselineY + baseFontSize * 0.65 - 16 * scale);
      ctx.drawImage(layout.translationSprite, transX, transY);
    } else if (line.translation && line.translation.trim().length > 0) {
      const transSize = Math.max(14, Math.round(baseFontSize * 0.45));
      ctx.font = `600 ${transSize}px ${cssFontStack}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
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
