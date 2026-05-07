const FILTERS = [
  { id: 'typ', label: 'Typ', options: ['Sportlich', 'Verschmust', 'Energiegeladen', 'Fröhlich'] },
  { id: 'pose', label: 'Posen', options: ['Stehend', 'Laufend', 'Sitzend'] },
  { id: 'location', label: 'Location', options: ['Indoor', 'Outdoor', 'Stadt'] },
];

export default function FilterBar({ filters, onChange }) {
  const toggle = (category, value) => {
    const current = filters[category] || [];
    onChange({
      ...filters,
      [category]: current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    });
  };

  const hasAny = Object.values(filters).some((v) => v.length > 0);

  return (
    <aside className="w-44 bg-[#141414] border-r border-white/[0.06] flex flex-col flex-shrink-0">
      <div className="px-5 py-6 border-b border-white/[0.06]">
        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-white/30">Filter</p>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-6 px-3">
        {FILTERS.map((cat) => (
          <div key={cat.id}>
            <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2 px-2">
              {cat.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {cat.options.map((opt) => {
                const active = (filters[cat.id] || []).includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggle(cat.id, opt)}
                    className={`text-sm px-3 py-2 rounded-lg text-left transition-all ${
                      active
                        ? 'bg-amber-500/15 text-amber-400 font-medium'
                        : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {hasAny && (
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <button
            onClick={() => onChange({ typ: [], pose: [], location: [] })}
            className="text-xs text-white/25 hover:text-white/60 w-full text-left transition-colors px-2"
          >
            ✕ Filter löschen
          </button>
        </div>
      )}
    </aside>
  );
}
