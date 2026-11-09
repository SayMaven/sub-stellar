# Gatefold Design System & Dynamic OKLCH Theming

Diadaptasi dari `F:\CODE\forking\gatefold-foobar2000` (`theme/css/app.css` & `theme/js/theme.js`).

## 1. CSS Variable Tokens
Menggunakan `@property` CSS untuk transisi warna yang halus dalam ruang warna OKLCH:
```css
@property --bg        { syntax: '<color>'; inherits: true; initial-value: #14161b; }
@property --surface   { syntax: '<color>'; inherits: true; initial-value: #1b1e24; }
@property --surface-2 { syntax: '<color>'; inherits: true; initial-value: #23272e; }
@property --text      { syntax: '<color>'; inherits: true; initial-value: #f3f4f6; }
@property --text-2    { syntax: '<color>'; inherits: true; initial-value: #bfc3ca; }
@property --text-3    { syntax: '<color>'; inherits: true; initial-value: #8b9099; }
@property --accent    { syntax: '<color>'; inherits: true; initial-value: #8fb4ff; }
@property --glow      { syntax: '<color>'; inherits: true; initial-value: #5770b0; }
@property --blob-1    { syntax: '<color>'; inherits: true; initial-value: #26324f; }
@property --blob-2    { syntax: '<color>'; inherits: true; initial-value: #3a2d55; }
@property --blob-3    { syntax: '<color>'; inherits: true; initial-value: #1f3d48; }

:root {
  --tx: 1100ms;
  --ease: cubic-bezier(.22, .7, .18, 1);
  --line: color-mix(in oklab, var(--text) 9%, transparent);
  --line-2: color-mix(in oklab, var(--text) 15%, transparent);
  --hover: color-mix(in oklab, var(--text) 6.5%, transparent);
  --panel: color-mix(in oklab, var(--bg) 58%, transparent);
  --panel-strong: color-mix(in oklab, var(--bg) 80%, transparent);
  --shadow-pop: 0 18px 50px -12px rgb(0 0 0 / .55), 0 2px 8px rgb(0 0 0 / .25);
  --r-sm: 6px; --r: 10px; --r-lg: 16px;
}
```

## 2. Dynamic Ambient Background
* Layer `#bg` di belakang antarmuka memancarkan gradien halus (*aurora backlight*) yang warnanya diambil dari gambar sampul / thumbnail video aktif menggunakan algoritma ekstraksi warna (*color palette extractor*).
* Opsi tema: *From the cover*, *Dark*, *Light*, *Grey*, dan *Custom accent*.

