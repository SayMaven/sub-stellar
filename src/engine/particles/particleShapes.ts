/**
 * SubStellar - Shared Procedural Particle Shapes and Presets
 *
 * Provides shared procedural vector drawing routines, preset configurations,
 * and rainbow tint palettes for both PixiJS v8 viewport and Canvas 2D export pipelines.
 */

import type { ParticlePresetType } from '../../types';

export interface ParticlePresetConfig {
  speedMin: number;
  speedMax: number;
  decayMin: number;
  decayMax: number;
  scaleMin: number;
  scaleMax: number;
  gravityY: number;
}

export const PRESET_CONFIGS: Record<ParticlePresetType, ParticlePresetConfig> = {
  stardust: {
    speedMin: 20,
    speedMax: 80,
    decayMin: 0.4,
    decayMax: 0.8,
    scaleMin: 0.16,
    scaleMax: 0.32,
    gravityY: -15, // Soft upward drift
  },
  sparkle: {
    speedMin: 80,
    speedMax: 260,
    decayMin: 0.8,
    decayMax: 1.6,
    scaleMin: 0.18,
    scaleMax: 0.38,
    gravityY: 40, // Radial burst falling under slight gravity
  },
  cosmic: {
    speedMin: 30,
    speedMax: 120,
    decayMin: 0.3,
    decayMax: 0.6,
    scaleMin: 0.2,
    scaleMax: 0.42,
    gravityY: -30, // Shimmering cosmic rise
  },
  sakura: {
    speedMin: 25,
    speedMax: 70,
    decayMin: 0.35,
    decayMax: 0.75,
    scaleMin: 0.18,
    scaleMax: 0.36,
    gravityY: 35, // Falling petals
  },
  notes: {
    speedMin: 35,
    speedMax: 90,
    decayMin: 0.4,
    decayMax: 0.85,
    scaleMin: 0.18,
    scaleMax: 0.34,
    gravityY: -25, // Rising melodic notes
  },
  firefly: {
    speedMin: 15,
    speedMax: 50,
    decayMin: 0.25,
    decayMax: 0.6,
    scaleMin: 0.16,
    scaleMax: 0.32,
    gravityY: -15, // Gentle floating embers
  },
  heart: {
    speedMin: 40,
    speedMax: 110,
    decayMin: 0.45,
    decayMax: 0.9,
    scaleMin: 0.18,
    scaleMax: 0.36,
    gravityY: -30, // Pop heart floating up
  },
};

export const RAINBOW_TINTS = [
  0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x00c7be, 0x32ade6, 0x5856d6, 0xaf52de,
];

export const RAINBOW_TINTS_HEX = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#32ade6', '#5856d6', '#af52de',
];

/**
 * Procedural vector drawings for each of the 7 particle shapes.
 * Assumes context is translated to shape center (0, 0) in a 128x128 space.
 */
export function drawParticleShape(c: CanvasRenderingContext2D, type: ParticlePresetType): void {
  switch (type) {
    case 'stardust': {
      // 1. Sharp celestial orb with luminous glow aura
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 54);
      g.addColorStop(0, 'rgba(255, 255, 255, 1)');
      g.addColorStop(0.25, 'rgba(230, 245, 255, 0.95)');
      g.addColorStop(0.55, 'rgba(160, 210, 255, 0.5)');
      g.addColorStop(1, 'rgba(60, 130, 255, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 54, 0, Math.PI * 2);
      c.fill();

      // Solid bright core for crisp definition
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(0, 0, 16, 0, Math.PI * 2);
      c.fill();
      break;
    }

    case 'sparkle': {
      // 2. Sharp 4-point anime diamond flare
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 36);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      g.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 36, 0, Math.PI * 2);
      c.fill();

      // Primary 4-pointed diamond star
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(0, -56);
      c.quadraticCurveTo(0, 0, 56, 0);
      c.quadraticCurveTo(0, 0, 0, 56);
      c.quadraticCurveTo(0, 0, -56, 0);
      c.quadraticCurveTo(0, 0, 0, -56);
      c.closePath();
      c.fill();

      // Secondary diagonal micro-spikes
      c.fillStyle = 'rgba(255, 255, 255, 0.85)';
      c.beginPath();
      c.moveTo(0, -26);
      c.quadraticCurveTo(0, 0, 26, 0);
      c.quadraticCurveTo(0, 0, 0, 26);
      c.quadraticCurveTo(0, 0, -26, 0);
      c.quadraticCurveTo(0, 0, 0, -26);
      c.closePath();
      c.save();
      c.rotate(Math.PI / 4);
      c.fill();
      c.restore();

      // Solid core highlight
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(0, 0, 6, 0, Math.PI * 2);
      c.fill();
      break;
    }

    case 'cosmic': {
      // 3. Concentric orbital rings with bright core
      c.strokeStyle = 'rgba(190, 225, 255, 0.85)';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(0, 0, 50, 0, Math.PI * 2);
      c.stroke();

      // Tilted elliptical orbit ring
      c.strokeStyle = '#ffffff';
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(0, 0, 48, 20, Math.PI / 3, 0, Math.PI * 2);
      c.stroke();

      // Second counter-tilted ring
      c.strokeStyle = 'rgba(140, 200, 255, 0.7)';
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(0, 0, 48, 20, -Math.PI / 3, 0, Math.PI * 2);
      c.stroke();

      // Core star
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(0, 0, 16, 0, Math.PI * 2);
      c.fill();

      // Orbiting mini satellites
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(36, -34, 5, 0, Math.PI * 2);
      c.arc(-36, 34, 5, 0, Math.PI * 2);
      c.fill();
      break;
    }

    case 'sakura': {
      // 4. Crisp notched cherry blossom petal
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(0, 48);
      c.bezierCurveTo(-38, 16, -34, -34, -14, -50);
      c.lineTo(0, -36); // Center notch
      c.lineTo(14, -50);
      c.bezierCurveTo(34, -34, 38, 16, 0, 48);
      c.closePath();
      c.fill();

      // Delicate inner central vein line
      c.strokeStyle = 'rgba(255, 182, 193, 0.6)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, 36);
      c.lineTo(0, -20);
      c.stroke();
      break;
    }

    case 'notes': {
      // 5. Musical eighth note (♪)
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.ellipse(-16, 26, 20, 14, -Math.PI / 6, 0, Math.PI * 2);
      c.fill();

      // Vertical Stem
      c.fillRect(-2, -38, 10, 66);

      // Dynamic musical flag
      c.beginPath();
      c.moveTo(8, -38);
      c.bezierCurveTo(34, -28, 38, -6, 32, 6);
      c.bezierCurveTo(26, -6, 18, -18, 8, -18);
      c.closePath();
      c.fill();
      break;
    }

    case 'firefly': {
      // 6. Warm glowing floating ember
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 56);
      g.addColorStop(0, 'rgba(255, 255, 255, 1)');
      g.addColorStop(0.2, 'rgba(255, 240, 150, 0.95)');
      g.addColorStop(0.5, 'rgba(255, 175, 40, 0.5)');
      g.addColorStop(1, 'rgba(255, 100, 20, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 56, 0, Math.PI * 2);
      c.fill();

      // Solid warm core
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(0, 0, 15, 0, Math.PI * 2);
      c.fill();
      break;
    }

    case 'heart': {
      // 7. Pop idol heart (♥)
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(0, 42);
      c.bezierCurveTo(-46, 10, -46, -38, 0, -18);
      c.bezierCurveTo(46, -38, 46, 10, 0, 42);
      c.closePath();
      c.fill();

      // Inner highlight gleam
      c.fillStyle = 'rgba(255, 255, 255, 0.5)';
      c.beginPath();
      c.arc(-16, -14, 6, 0, Math.PI * 2);
      c.fill();
      break;
    }
  }
}

/**
 * Pre-renders a particle shape to a standalone offscreen canvas with optional tinting.
 * Suitable for high-speed blitting during Canvas 2D export.
 */
export function createTintedParticleCanvas(
  type: ParticlePresetType,
  tintHex?: string,
  size = 128
): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    return { width: size, height: size } as unknown as HTMLCanvasElement;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  if (size !== 128) {
    ctx.scale(size / 128, size / 128);
  }
  drawParticleShape(ctx, type);
  ctx.restore();

  if (tintHex && tintHex.toLowerCase() !== '#ffffff' && tintHex.toLowerCase() !== '#fff') {
    ctx.save();
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = tintHex;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  return canvas;
}
