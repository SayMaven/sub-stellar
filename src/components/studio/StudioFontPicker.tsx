import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Type, Search, Check, ChevronDown, Upload, X, Eye, EyeOff } from 'lucide-react';
import {
  formatCssFontStack,
  parseFontStack,
  probeJapaneseSupport,
  type FontOption,
} from '../../engine/text/fontLoader';

interface StudioFontPickerProps {
  value: string;
  onChange: (family: string) => void;
  curatedFonts: FontOption[];
  customFonts: FontOption[];
  systemFonts: FontOption[];
  onImportFontFile?: (file: File) => void;
}

export const StudioFontPicker: React.FC<StudioFontPickerProps> = ({
  value,
  onChange,
  curatedFonts,
  customFonts,
  systemFonts,
  onImportFontFile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | 'Curated' | 'Custom' | 'System'>('All');
  const [installedOnly, setInstalledOnly] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Combine and deduplicate fonts (custom -> curated -> system)
  const allFonts = useMemo(() => {
    const list: FontOption[] = [];
    const seen = new Set<string>();

    for (const f of [...customFonts, ...curatedFonts, ...systemFonts]) {
      const key = f.family.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(f);
      }
    }
    return list;
  }, [curatedFonts, customFonts, systemFonts]);

  // Primary selected family name (handles comma-separated preset stacks cleanly)
  const primaryValue = useMemo(() => parseFontStack(value, [])[0] || value, [value]);

  const currentFont = useMemo(() => {
    const directMatch = allFonts.find(
      (f) => f.family.toLowerCase() === primaryValue.toLowerCase()
    );
    return (
      directMatch || {
        family: primaryValue,
        label: primaryValue,
        category: 'Curated J-Pop' as const,
        installed: true,
      }
    );
  }, [allFonts, primaryValue]);

  // Filtered fonts based on category, installed filter, and search query
  const filteredFonts = useMemo(() => {
    let list = allFonts;
    if (activeCategory === 'Curated') {
      list = list.filter((f) => f.category === 'Curated J-Pop');
    } else if (activeCategory === 'Custom') {
      list = list.filter((f) => f.category === 'Custom Imported');
    } else if (activeCategory === 'System') {
      list = list.filter((f) => f.category === 'System Fonts');
    }

    if (installedOnly) {
      list = list.filter((f) => f.installed !== false);
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase().trim();
    return list.filter(
      (f) => f.family.toLowerCase().includes(query) || f.label.toLowerCase().includes(query)
    );
  }, [allFonts, activeCategory, installedOnly, searchQuery]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && onImportFontFile) {
      onImportFontFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportFontFile) {
      onImportFontFile(file);
      e.target.value = '';
    }
  };

  return (
    <div className="relative font-sans text-xs" ref={containerRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Button to toggle custom dropdown */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-gatefold-surface border border-gatefold-line hover:border-gatefold-line-2 rounded-lg flex items-center justify-between text-gatefold-text transition-all focus:outline-none focus:border-gatefold-accent group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Type className="w-3.5 h-3.5 text-gatefold-accent shrink-0" />
          <span
            className="truncate font-medium text-xs text-left"
            style={{ fontFamily: formatCssFontStack(currentFont.family) }}
          >
            {currentFont.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {currentFont.installed === false && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Fallback
            </span>
          )}
          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-gatefold-surface-2 text-gatefold-text-3 border border-gatefold-line">
            {currentFont.category === 'Curated J-Pop'
              ? 'Curated'
              : currentFont.category === 'Custom Imported'
              ? 'Custom'
              : 'System'}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-gatefold-text-3 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-gatefold-accent' : 'group-hover:text-gatefold-text'
            }`}
          />
        </div>
      </button>

      {/* Popover Menu: Solid, Opaque Dark Background */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#181b22] border border-gatefold-line-2 rounded-xl shadow-2xl shadow-black/90 z-50 flex flex-col max-h-[420px] overflow-hidden animate-in fade-in duration-150">
          {/* Header with Search, Count, Filter & Import Action */}
          <div className="p-2.5 border-b border-gatefold-line space-y-2 shrink-0 bg-[#14161d]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gatefold-text-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${allFonts.length} fonts...`}
                className="w-full pl-8 pr-7 py-1.5 bg-gatefold-surface border border-gatefold-line rounded-lg text-xs text-gatefold-text placeholder:text-gatefold-text-3 focus:outline-none focus:border-gatefold-accent"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gatefold-text-3 hover:text-gatefold-text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills & Installed Only Toggle */}
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-1">
                {(['All', 'Curated', 'Custom', 'System'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      activeCategory === cat
                        ? 'bg-gatefold-accent/20 text-gatefold-accent font-semibold border border-gatefold-accent/40'
                        : 'text-gatefold-text-3 hover:text-gatefold-text bg-gatefold-surface'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setInstalledOnly((prev) => !prev)}
                  title={
                    installedOnly
                      ? 'Showing fonts available on this PC (click to show un-installed curated fonts)'
                      : 'Showing all entries including un-installed curated fonts'
                  }
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors ${
                    installedOnly
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-gatefold-surface text-gatefold-text-3 border-gatefold-line hover:text-gatefold-text'
                  }`}
                >
                  {installedOnly ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                  <span>Installed</span>
                </button>

                {onImportFontFile && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Import .ttf, .otf, .woff font file"
                    className="px-2 py-0.5 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover text-gatefold-accent border border-gatefold-line text-[10px] font-medium flex items-center gap-1 transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Import</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-gatefold-text-3 px-0.5">
              <span>
                Showing <strong className="text-gatefold-text-2">{filteredFonts.length}</strong> of{' '}
                {allFonts.length} fonts
              </span>
              <span>JP = Native Kanji/Kana</span>
            </div>
          </div>

          {/* Drag & Drop Font Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            className={`transition-colors shrink-0 ${
              isDragging
                ? 'bg-gatefold-accent/20 border-b border-gatefold-accent py-2 text-center text-gatefold-accent font-medium'
                : ''
            }`}
          >
            {isDragging && <span>Drop .ttf / .otf / .woff file here to load immediately!</span>}
          </div>

          {/* Scrollable Font Options List (content-visibility keeps 300+ system fonts at 60 FPS) */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-gatefold-line/20">
            {filteredFonts.length === 0 ? (
              <div className="py-8 text-center text-gatefold-text-3 space-y-1">
                <p className="text-xs">No fonts matching "{searchQuery}"</p>
                <p className="text-[10px]">
                  {installedOnly
                    ? 'Toggle "Installed" off or import a custom .ttf / .otf file.'
                    : 'Import a custom font or choose another category.'}
                </p>
              </div>
            ) : (
              filteredFonts.map((font) => {
                const isSelected = font.family.toLowerCase() === primaryValue.toLowerCase();
                const isAvailable = font.installed !== false;
                const hasJp =
                  font.supportsJapanese ?? (isAvailable ? probeJapaneseSupport(font.family) : false);

                return (
                  <button
                    key={font.family}
                    type="button"
                    onClick={() => {
                      onChange(font.family);
                      setIsOpen(false);
                    }}
                    style={{
                      contentVisibility: 'auto',
                      containIntrinsicSize: '0 46px',
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors flex flex-col gap-0.5 ${
                      isSelected
                        ? 'bg-gatefold-accent/15 border border-gatefold-accent/40 text-gatefold-accent'
                        : 'hover:bg-gatefold-hover text-gatefold-text'
                    } ${!isAvailable ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[11px] truncate">{font.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isAvailable && (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Not Installed
                          </span>
                        )}
                        {hasJp && (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            JP
                          </span>
                        )}
                        <span className="text-[8px] font-mono text-gatefold-text-3 uppercase">
                          {font.category === 'Curated J-Pop'
                            ? 'Curated'
                            : font.category === 'Custom Imported'
                            ? 'Custom'
                            : 'System'}
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-gatefold-accent" />}
                      </div>
                    </div>

                    {/* Live typography preview specimen */}
                    <div
                      className="text-xs truncate text-gatefold-text/90"
                      style={{ fontFamily: formatCssFontStack(font.family) }}
                    >
                      {hasJp ? 'AaBb 123 幸せな君に出会えて' : 'AaBbCc 12345 (Latin Specimen)'}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
