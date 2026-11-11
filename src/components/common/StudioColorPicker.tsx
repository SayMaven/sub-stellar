/**
 * SubStellar - Modern Studio Color Picker
 *
 * Professional Dark-Themed Color Popover replacing native OS color wheels:
 * 1. Quick curated palettes (Gatefold, J-Pop Neon, Anime Pastel, Monochrome)
 * 2. Precision Hue & Lightness spectrum sliders
 * 3. Direct Hex input with copy-to-clipboard
 * 4. Native EyeDropper API screen sampling
 */

import React, { useState, useRef, useEffect } from 'react';
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

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace(/^#/, '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return { h: 215, s: 80, l: 60 };

  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
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
    h = Math.round(h * 60);
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export const StudioColorPicker: React.FC<StudioColorPickerProps> = ({
  value,
  onChange,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const popoverRef = useRef<HTMLDivElement>(null);

  const hsl = hexToHsl(value);
  const [hue, setHue] = useState(hsl.h);
  const [lightness, setLightness] = useState(hsl.l);
  const [saturation, setSaturation] = useState(hsl.s);

  useEffect(() => {
    setHexInput(value);
    const converted = hexToHsl(value);
    setHue(converted.h);
    setLightness(converted.l);
    setSaturation(converted.s);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen]);

  const handleHueChange = (newHue: number) => {
    setHue(newHue);
    const newHex = hslToHex(newHue, saturation || 90, lightness || 50);
    setHexInput(newHex);
    onChange(newHex);
  };

  const handleLightnessChange = (newLightness: number) => {
    setLightness(newLightness);
    const newHex = hslToHex(hue, saturation || 90, newLightness);
    setHexInput(newHex);
    onChange(newHex);
  };

  const handleHexSubmit = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      onChange(clean.toLowerCase());
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
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
        // User cancelled or not supported
      }
    }
  };

  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Sleek Swatch Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 bg-gatefold-surface hover:bg-gatefold-hover border border-gatefold-line hover:border-gatefold-line-2 rounded px-2 py-1 transition-colors group"
        title={label ? `${label}: ${value}` : value}
      >
        <span
          className="w-4 h-4 rounded shadow-inner border border-white/20 shrink-0"
          style={{ backgroundColor: value }}
        />
        <span className="font-mono text-[11px] text-gatefold-text uppercase tracking-wider">
          {value}
        </span>
        <ChevronDown className="w-3 h-3 text-gatefold-text-3 group-hover:text-gatefold-text transition-transform duration-150" />
      </button>

      {/* Modern Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 p-3 bg-gatefold-panel border border-gatefold-line-2 rounded-xl shadow-2xl space-y-3 select-none">
          {/* Header & Preview */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-gatefold-line">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-md shadow-md border border-white/20"
                style={{ backgroundColor: value }}
              />
              <span className="text-xs font-mono font-semibold text-gatefold-text uppercase">
                {value}
              </span>
            </div>
            <div className="flex items-center gap-1">
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
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Quick Curated Palettes */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase text-gatefold-text-3 font-semibold block">
              Curated Palettes
            </span>
            <div className="space-y-1">
              {SWATCH_PALETTES.map((row, rIdx) => (
                <div key={rIdx} className="grid grid-cols-6 gap-1">
                  {row.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onChange(color)}
                      className={`h-5 rounded border transition-transform hover:scale-110 active:scale-95 ${
                        value.toLowerCase() === color.toLowerCase()
                          ? 'ring-2 ring-gatefold-accent border-white'
                          : 'border-white/10 hover:border-white/40'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Hue Spectrum Bar */}
          <div className="space-y-1 pt-1 border-t border-gatefold-line">
            <div className="flex justify-between text-[10px] font-mono text-gatefold-text-3">
              <span>Hue</span>
              <span>{hue}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={hue}
              onChange={(e) => handleHueChange(Number(e.target.value))}
              className="w-full h-2.5 rounded-lg appearance-none cursor-pointer"
              style={{
                background:
                  'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              }}
            />
          </div>

          {/* Lightness Spectrum Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-gatefold-text-3">
              <span>Brightness</span>
              <span>{lightness}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="95"
              value={lightness}
              onChange={(e) => handleLightnessChange(Number(e.target.value))}
              className="w-full h-2.5 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #000000 0%, ${hslToHex(hue, saturation || 90, 50)} 50%, #ffffff 100%)`,
              }}
            />
          </div>

          {/* Hex Input Field */}
          <div className="pt-1 border-t border-gatefold-line flex items-center gap-1.5">
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
        </div>
      )}
    </div>
  );
};
