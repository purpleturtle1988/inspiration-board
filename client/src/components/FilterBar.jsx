import { useState, useRef, useEffect } from 'react';

export default function FilterBar({
  filters, onChange, filterDefs,
  onAddCategory, onDeleteCategory, onAddOption, onDeleteOption,
}) {
  const [editMode, setEditMode] = useState(false);
  const [addingTo, setAddingTo] = useState(null);   // slug of category getting new option
  const [newOption, setNewOption] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const optInputRef = useRef(null);
  const catInputRef = useRef(null);

  useEffect(() => { if (addingTo) optInputRef.current?.focus(); }, [addingTo]);
  useEffect(() => { if (addingCat) catInputRef.current?.focus(); }, [addingCat]);

  const toggle = (slug, value) => {
    const current = filters[slug] || [];
    onChange({
      ...filters,
      [slug]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  const hasAny = Object.values(filters).some((v) => v.length > 0);

  const submitOption = async (slug) => {
    const val = newOption.trim();
    if (!val) return;
    await onAddOption(slug, val);
    setNewOption('');
    setAddingTo(null);
  };

  const submitCategory = async () => {
    const label = newCatLabel.trim();
    if (!label) return;
    await onAddCategory(label);
    setNewCatLabel('');
    setAddingCat(false);
  };

  return (
    <aside className="w-44 bg-[#141414] border-r border-white/[0.06] flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-6 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-white/30">Filter</p>
        <button
          onClick={() => { setEditMode((v) => !v); setAddingTo(null); setAddingCat(false); }}
          title={editMode ? 'Fertig' : 'Filter anpassen'}
          className={`w-6 h-6 flex items-center justify-center rounded-md text-sm transition-colors ${
            editMode ? 'bg-amber-500/20 text-amber-400' : 'text-white/20 hover:text-white/50 hover:bg-white/[0.04]'
          }`}
        >
          {editMode ? '✓' : '✎'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-5 px-3">
        {filterDefs.map((cat) => (
          <div key={cat.slug}>
            {/* Category header */}
            <div className="flex items-center justify-between mb-1.5 px-2">
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider">
                {cat.label}
              </p>
              {editMode && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setAddingTo(cat.slug); setNewOption(''); }}
                    title="Option hinzufügen"
                    className="w-4 h-4 flex items-center justify-center text-white/25 hover:text-amber-400 text-xs rounded transition-colors"
                  >＋</button>
                  <button
                    onClick={() => onDeleteCategory(cat.slug)}
                    title="Kategorie löschen"
                    className="w-4 h-4 flex items-center justify-center text-white/20 hover:text-red-400 text-xs rounded transition-colors"
                  >✕</button>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="flex flex-col gap-0.5">
              {cat.options.map((opt) => {
                const active = (filters[cat.slug] || []).includes(opt.value);
                return (
                  <div key={opt.id} className="flex items-center gap-1 group/opt">
                    <button
                      onClick={() => toggle(cat.slug, opt.value)}
                      className={`flex-1 text-sm px-3 py-1.5 rounded-lg text-left transition-all ${
                        active
                          ? 'bg-amber-500/15 text-amber-400 font-medium'
                          : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
                      }`}
                    >
                      {opt.value}
                    </button>
                    {editMode && (
                      <button
                        onClick={() => onDeleteOption(opt.id, cat.slug, opt.value)}
                        className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-white/15 hover:text-red-400 text-xs rounded opacity-0 group-hover/opt:opacity-100 transition-all"
                      >✕</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inline: add option to this category */}
            {editMode && addingTo === cat.slug && (
              <div className="mt-1.5 flex gap-1">
                <input
                  ref={optInputRef}
                  type="text"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitOption(cat.slug);
                    else if (e.key === 'Escape') { setAddingTo(null); setNewOption(''); }
                  }}
                  placeholder="Neue Option…"
                  className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40"
                />
                <button
                  onClick={() => submitOption(cat.slug)}
                  className="px-2 py-1 text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors"
                >✓</button>
              </div>
            )}
          </div>
        ))}

        {/* Add new filter category */}
        {editMode && (
          addingCat ? (
            <div className="px-1 pt-1">
              <input
                ref={catInputRef}
                type="text"
                value={newCatLabel}
                onChange={(e) => setNewCatLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCategory();
                  else if (e.key === 'Escape') { setAddingCat(false); setNewCatLabel(''); }
                }}
                placeholder="z. B. Stimmung"
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 mb-1.5"
              />
              <div className="flex gap-1">
                <button
                  onClick={submitCategory}
                  disabled={!newCatLabel.trim()}
                  className="flex-1 py-1 text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-black font-semibold rounded-lg transition-colors"
                >Hinzufügen</button>
                <button
                  onClick={() => { setAddingCat(false); setNewCatLabel(''); }}
                  className="px-2 py-1 text-xs text-white/30 hover:text-white/60 border border-white/10 rounded-lg transition-colors"
                >✕</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingCat(true)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-white/25 hover:text-white/50 hover:bg-white/[0.03] transition-all"
            >
              <span>＋</span><span>Filter hinzufügen</span>
            </button>
          )
        )}
      </div>

      {/* Clear filters */}
      {hasAny && !editMode && (
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <button
            onClick={() => onChange({})}
            className="text-xs text-white/25 hover:text-white/60 w-full text-left transition-colors px-2"
          >
            ✕ Filter löschen
          </button>
        </div>
      )}
    </aside>
  );
}
