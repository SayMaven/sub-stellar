import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Type, Search, Check, ChevronDown, Upload, X } from 'lucide-react';
import type { FontOption } from '../../engine/text/fontLoader';

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

  // Combine and deduplicate fonts
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

  // Current selected font item
  const currentFont = useMemo(() => {
    const directMatch = allFonts.find(
      (f) => f.family.toLowerCase() === value.toLowerCase() || value.toLowerCase().startsWith(f.family.toLowerCase())
    );
    return directMatch || {
      family: value,
      label: value.split(',')[0].replace(/['"]/g, ''),
      category: 'Curated J-Pop' as const,
    };
  }, [allFonts, value]);

  // Filtered fonts based on category and search
  const filteredFonts = useMemo(() => {
    let list = allFonts;
    if (activeCategory === 'Curated') {
      list = list.filter((f) => f.category === 'Curated J-Pop');
    } else if (activeCategory === 'Custom') {
      list = list.filter((f) => f.category === 'Custom Imported');
    } else if (activeCategory === 'System') {
      list = list.filter((f) => f.category === 'System Fonts');
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase().trim();
    return list.filter(
      (f) => f.family.toLowerCase().includes(query) || f.label.toLowerCase().includes(query)
    );
  }, [allFonts, activeCategory, searchQuery]);

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
            style={{ fontFamily: currentFont.family }}
          >
            {currentFont.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-gatefold-surface-2 text-gatefold-text-3 border border-gatefold-line">
            {currentFont.category === 'Curated J-Pop' ? 'Curated' : currentFont.category === 'Custom Imported' ? 'Custom' : 'System'}
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
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#181b22] border border-gatefold-line-2 rounded-xl shadow-2xl shadow-black/90 z-50 flex flex-col max-h-[380px] overflow-hidden animate-in fade-in duration-150">
          {/* Header with Search and Import Action */}
          <div className="p-2.5 border-b border-gatefold-line space-y-2 shrink-0 bg-[#14161d]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gatefold-text-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search font family or Japanese type..."
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

            {/* Category Filter Pills & Upload Button */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
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

              {onImportFontFile && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Import .ttf, .otf, .woff font file"
                  className="px-2 py-0.5 rounded bg-gatefold-surface-2 hover:bg-gatefold-hover text-gatefold-accent border border-gatefold-line text-[10px] font-medium flex items-center gap-1 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  <span>Import Font</span>
                </button>
              )}
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
              isDragging ? 'bg-gatefold-accent/20 border-b border-gatefold-accent py-2 text-center text-gatefold-accent font-medium' : ''
            }`}
          >
            {isDragging && <span>Drop .ttf / .otf / .woff file here to load immediately!</span>}
          </div>

          {/* Scrollable Font Options List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 divide-y divide-gatefold-line/30">
            {filteredFonts.length === 0 ? (
              <div className="py-8 text-center text-gatefold-text-3 space-y-1">
                <p className="text-xs">No fonts matching "{searchQuery}"</p>
                <p className="text-[10px]">Import a custom font or choose another category.</p>
              </div>
            ) : (
              filteredFonts.map((font) => {
                const isSelected =
                  font.family.toLowerCase() === value.toLowerCase() ||
                  value.toLowerCase().startsWith(font.family.toLowerCase());

                return (
                  <button
                    key={font.family}
                    type="button"
                    onClick={() => {
                      onChange(font.family);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg transition-colors flex flex-col gap-0.5 ${
                      isSelected
                        ? 'bg-gatefold-accent/15 border border-gatefold-accent/40 text-gatefold-accent'
                        : 'hover:bg-gatefold-hover text-gatefold-text'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-xs truncate">{font.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] font-mono text-gatefold-text-3 uppercase">
                          {font.category === 'Curated J-Pop' ? 'Curated' : font.category === 'Custom Imported' ? 'Custom' : 'System'}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-gatefold-accent" />}
                      </div>
                    </div>

                    {/* Live typography preview specimen */}
                    <div
                      className="text-sm pt-0.5 truncate text-gatefold-text/90"
                      style={{ fontFamily: font.family }}
                    >
                      AaBb 123 幸せな君に出会えて
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
