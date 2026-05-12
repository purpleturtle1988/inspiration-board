import { useState, useRef, useEffect } from 'react';

export default function Sidebar({ view, onViewChange, counts, categories, onAddCategory, onDeleteCategory }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (adding) nameInputRef.current?.focus();
  }, [adding]);

  const submitNew = async () => {
    const name = newName.trim();
    if (!name) return;
    await onAddCategory(name, newEmoji.trim() || '📁');
    setNewName('');
    setNewEmoji('');
    setAdding(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') submitNew();
    else if (e.key === 'Escape') { setAdding(false); setNewName(''); setNewEmoji(''); }
  };

  return (
    <aside className="w-56 bg-[#141414] border-r border-white/[0.06] flex flex-col flex-shrink-0">
      <div className="px-5 py-6 border-b border-white/[0.06]">
        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-white/30">
          Inspiration
        </p>
        <p className="text-base font-semibold text-white mt-0.5">Fotografie</p>
      </div>

      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {/* Inbox */}
        <button
          onClick={() => onViewChange('inbox')}
          className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all mb-0.5 ${
            view === 'inbox'
              ? 'bg-amber-500/15 text-amber-400'
              : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="text-lg leading-none">📥</span>
            <span>Inbox</span>
          </span>
          {(counts.inbox ?? 0) > 0 && (
            <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
              view === 'inbox' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.06] text-white/30'
            }`}>
              {counts.inbox}
            </span>
          )}
        </button>

        {/* Dynamic categories */}
        {categories.map((cat) => {
          const id = cat.name.toLowerCase();
          const isActive = view === id;
          const count = counts[id] ?? 0;
          return (
            <div
              key={cat.id}
              className="relative mb-0.5"
              onMouseEnter={() => setHoveredId(cat.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => onViewChange(id)}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0 pr-5">
                  <span className="text-lg leading-none flex-shrink-0">{cat.emoji}</span>
                  <span className="truncate">{cat.name}</span>
                </span>
                {count > 0 && (
                  <span className={`text-xs rounded-full px-2 py-0.5 font-semibold flex-shrink-0 ${
                    isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.06] text-white/30'
                  }`}>
                    {count}
                  </span>
                )}
              </button>

              {/* Delete button on hover */}
              {hoveredId === cat.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
                  title="Kategorie löschen"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all text-xs z-10"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        {/* Add category form */}
        {adding ? (
          <div className="mt-1 px-1">
            <div className="flex gap-1.5 mb-1.5">
              <input
                type="text"
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="🏍️"
                maxLength={2}
                className="w-10 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-amber-500/40"
              />
              <input
                ref={nameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Kategoriename"
                className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-amber-500/40"
              />
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={submitNew}
                disabled={!newName.trim()}
                className="flex-1 py-1.5 text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-black font-semibold rounded-lg transition-colors"
              >
                Hinzufügen
              </button>
              <button
                onClick={() => { setAdding(false); setNewName(''); setNewEmoji(''); }}
                className="px-3 py-1.5 text-xs text-white/30 hover:text-white/60 border border-white/10 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 mt-1 rounded-xl text-xs text-white/25 hover:text-white/50 hover:bg-white/[0.03] transition-all"
          >
            <span className="text-base leading-none">＋</span>
            <span>Kategorie hinzufügen</span>
          </button>
        )}
      </nav>

      <div className="px-5 py-5 border-t border-white/[0.06]">
        <p className="text-[11px] text-white/20 leading-relaxed">
          Bilder per URL, Upload oder Drag & Drop hinzufügen.
        </p>
      </div>
    </aside>
  );
}
