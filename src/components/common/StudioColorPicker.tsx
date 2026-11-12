/**
 * SubStellar - Modern Studio Color Picker
 *
 * Dark Gatefold Color Popover with Viewport Boundary Clamping:
 * 1. Interactive 2D Saturation x Brightness (HSV) Pad with pointer capture
 * 2. Rainbow Hue Slider (auto-activates chroma when dragging from white/black)
 * 3. Quick curated palettes (J-Pop Neon, Anime Pastel, Gatefold Monochromes)
 * 4. Direct Hex input with copy-to-clipboard & native EyeDropper sampling
 * 5. Portaled fixed positioning clamped strictly inside viewport bounds
 */

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Pipette, Copy, Check, ChevronDown } from 'lucide-react';

interface StudioColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

const SWATCH_PALETTES = [
  // J-Pop Neon
  ['#00f0ff', '#ff007f', '#5affb5', '#ffd700', '#a855f7', '#ff3b30'],
  // Anime Pastel
  ['#ffffff', '#ffc2d9', '#b8d0ff', '#c4f0ff', '#ffe4b5', '#d8b4fe'],
  // Gatefold & Monochromes
  ['#8fb4ff', '#5770b0', '#9ca3af', '#4b5563', '#1b1e24', '#000000'],
];

function normalizeHex(hex: string): string {
  let c = (hex || '').trim().replace(/^#/, '');
  if (c.length === 3) {
    c = c
      .split('')
      .map((x) => x + x)
      .join('');
  }
  return /^[0-9a-fA-F]{6}$/.test(c) ? `#${c.toLowerCase()}` : '#ffffff';
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = normalizeHex(hex).slice(1);
  const num = parseInt(clean, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;

  return {
    h: Math.round(h) % 360,
    s: Math.round(s),
    v: Math.round(v),
  };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const val = Math.max(0, Math.min(100, v)) / 100;

  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const StudioColorPicker: React.FC<StudioColorPickerProps> = ({
  value,
  onChange,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const triggerWrapperRef = useRef<HTMLDivElement>(null);
  const triggerBtnRef = useRef<HTMLButtonElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const isDraggingPadRef = useRef(false);

  const initialHsv = hexToHsv(value);
  const [hue, setHue] = useState(initialHsv.h);
  const [sat, setSat] = useState(initialHsv.s);
  const [val, setVal] = useState(initialHsv.v);

  // Keep local HSV synchronized when external value prop changes (without resetting Hue on white/black)
  useEffect(() => {
    setHexInput(value);
    const currentFromLocal = hsvToHex(hue, sat, val).toLowerCase();
    if (normalizeHex(value) === currentFromLocal) {
      return;
    }
    const converted = hexToHsv(value);
    if (converted.s > 0) {
      setHue(converted.h);
    }
    setSat(converted.s);
    setVal(converted.v);
  }, [value, hue, sat, val]);

  const computePopoverPosition = useCallback((): { top: number; left: number } | null => {
    const triggerEl = triggerBtnRef.current;
    if (!triggerEl || typeof window === 'undefined') return null;

    const rect = triggerEl.getBoundingClientRect();
    const menuEl = portalMenuRef.current;
    const menuW = menuEl?.offsetWidth || 264;
    const menuH = menuEl?.offsetHeight || 412;
    const margin = 12;

    // Clamp horizontally so right-edge sidebar pickers never overflow off-screen
    let left = rect.left;
    if (left + menuW > window.innerWidth - margin) {
      left = rect.right - menuW;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - menuW - margin));

    // Flip upward if space below is insufficient, clamping inside vertical viewport bounds
    const fitsBelow = rect.bottom + 6 + menuH <= window.innerHeight - margin;
    let top = fitsBelow ? rect.bottom + 6 : rect.top - menuH - 6;
    top = Math.max(margin, Math.min(top, window.innerHeight - menuH - margin));

    return { top: Math.round(top), left: Math.round(left) };
  }, []);

  const updatePopoverPosition = useCallback(() => {
    const next = computePopoverPosition();
    if (next) setMenuPos(next);
  }, [computePopoverPosition]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePopoverPosition();

    const handleReposition = () => updatePopoverPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, updatePopoverPosition]);

  // Close on outside click or Escape (checks both trigger wrapper and portaled menu)
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const inTrigger = triggerWrapperRef.current?.contains(target);
      const inMenu = portalMenuRef.current?.contains(target);
      if (!inTrigger && !inMenu) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const applyHsv = (nextH: number, nextS: number, nextV: number) => {
    setHue(nextH);
    setSat(nextS);
    setVal(nextV);
    const nextHex = hsvToHex(nextH, nextS, nextV);
    setHexInput(nextHex);
    onChange(nextHex);
  };

  const updateFromPadPointer = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const rx = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const ry = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
    const nextS = Math.round(rx * 100);
    const nextV = Math.round((1 - ry) * 100);
    applyHsv(hue, nextS, nextV);
  };

  const handleHueChange = (newHue: number) => {
    // If current color is white/black/gray, lift saturation & value so Hue drag shows visible color
    const activeSat = sat < 8 ? 85 : sat;
    const activeVal = val < 8 ? 92 : val;
    applyHsv(newHue, activeSat, activeVal);
  };

  const handleHexSubmit = (raw: string) => {
    let clean = raw.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      const normalized = clean.toLowerCase();
      const next = hexToHsv(normalized);
      if (next.s > 0) setHue(next.h);
      setSat(next.s);
      setVal(next.v);
      onChange(normalized);
    }
  };

  const handleCopy = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleEyeDropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        // @ts-expect-error - Chromium native EyeDropper API
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          onChange(result.sRGBHex.toLowerCase());
        }
      } catch {
        // User cancelled or unsupported
      }
    }
  };

  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  const pureHueHex = hsvToHex(hue, 100, 100);

  return (
    <div className="w-full" ref={triggerWrapperRef}>
      {label && (
        <label className="text-[10px] text-gatefold-text-3 block mb-1 truncate" title={label}>
          {label}
        </label>
      )}

      {/* Sleek Swatch Trigger */}
      <button
        ref={triggerBtnRef}
        type="button"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }
          const initialPos = computePopoverPosition();
          if (initialPos) {
            setMenuPos(initialPos);
          }
          setIsOpen(true);
        }}
        className={`w-full flex items-center justify-between gap-1.5 bg-gatefold-surface hover:bg-gatefold-hover border rounded px-2 py-1.5 transition-colors group ${
          isOpen ? 'border-gatefold-accent' : 'border-gatefold-line hover:border-gatefold-line-2'
        }`}
        title={label ? `${label}: ${value}` : value}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-4 h-4 rounded shadow-inner border border-white/25 shrink-0"
            style={{ backgroundColor: value }}
          />
          <span className="font-mono text-[11px] text-gatefold-text uppercase tracking-wider truncate">
            {value}
          </span>
        </div>
        <ChevronDown
          className={`w-3 h-3 text-gatefold-text-3 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-gatefold-accent' : 'group-hover:text-gatefold-text'
          }`}
        />
      </button>

      {/* Portaled Opaque Popover clamped strictly inside viewport */}
      {isOpen &&
        menuPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={portalMenuRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              transition: 'none',
            }}
            className="z-[160] w-[264px] p-3 bg-[#181b22] border border-gatefold-line-2 rounded-xl shadow-2xl shadow-black/90 space-y-2.5 select-none"
          >
            {/* Header & Preview */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-gatefold-line">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-6 h-6 rounded-md shadow-md border border-white/25 shrink-0"
                  style={{ backgroundColor: value }}
                />
                <div className="min-w-0">
                  {label && (
                    <div className="text-[9px] text-gatefold-text-3 truncate leading-none mb-0.5">
                      {label}
                    </div>
                  )}
                  <div className="text-xs font-mono font-semibold text-gatefold-text uppercase leading-none">
                    {value}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hasEyeDropper && (
                  <button
                    type="button"
                    onClick={handleEyeDropper}
                    className="p-1 rounded hover:bg-gatefold-surface text-gatefold-text-3 hover:text-gatefold-accent transition-colors"
                    title="Pick Color from Screen"
                  >
                    <Pipette className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-gatefold-surface text-gatefold-text-3 hover:text-gatefold-text transition-colors"
                  title="Copy HEX Code"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Interactive 2D Saturation x Value Color Spectrum Pad */}
            <div
              ref={padRef}
              onPointerDown={(e) => {
                e.preventDefault();
                isDraggingPadRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                updateFromPadPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (!isDraggingPadRef.current) return;
                updateFromPadPointer(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                isDraggingPadRef.current = false;
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
              onPointerCancel={() => {
                isDraggingPadRef.current = false;
              }}
              className="relative w-full h-32 rounded-lg overflow-hidden cursor-crosshair border border-white/15 touch-none"
              style={{ backgroundColor: pureHueHex }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(to right, #ffffff, rgba(255,255,255,0))' }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(to top, #000000, rgba(0,0,0,0))' }}
              />
              {/* Active Position Thumb */}
              <div
                className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.85)] pointer-events-none"
                style={{
                  left: `${sat}%`,
                  top: `${100 - val}%`,
                  backgroundColor: value,
                }}
              />
            </div>

            {/* Hue Rainbow Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-gatefold-text-3">
                <span>Hue</span>
                <span>{hue}° · S:{sat}% · B:{val}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={hue}
                onChange={(e) => handleHueChange(Number(e.target.value))}
                className="w-full h-2.5 rounded-lg appearance-none cursor-pointer"
                style={{
                  background:
                    'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                }}
              />
            </div>

            {/* Quick Curated Palettes */}
            <div className="space-y-1 pt-1 border-t border-gatefold-line">
              <span className="text-[9px] font-mono uppercase text-gatefold-text-3 font-semibold block">
                Curated Swatches
              </span>
              <div className="space-y-1">
                {SWATCH_PALETTES.map((row, rIdx) => (
                  <div key={rIdx} className="grid grid-cols-6 gap-1">
                    {row.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => onChange(color)}
                        className={`h-4.5 py-2 rounded border transition-transform hover:scale-110 active:scale-95 ${
                          value.toLowerCase() === color.toLowerCase()
                            ? 'ring-2 ring-gatefold-accent border-white'
                            : 'border-white/15 hover:border-white/40'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Hex Input Field */}
            <div className="pt-1.5 border-t border-gatefold-line flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-gatefold-text-3 uppercase">HEX:</span>
              <input
                type="text"
                value={hexInput}
                onChange={(e) => {
                  setHexInput(e.target.value);
                  handleHexSubmit(e.target.value);
                }}
                onBlur={() => setHexInput(value)}
                className="flex-1 bg-gatefold-bg border border-gatefold-line rounded px-2 py-0.5 font-mono text-xs text-gatefold-text uppercase focus:outline-none focus:border-gatefold-accent"
                placeholder="#ffffff"
                maxLength={7}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
