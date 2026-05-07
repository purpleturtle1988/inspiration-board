const FILTERS = [
  { id: 'typ', label: 'Typ', options: ['Sportlich', 'Verschmust', 'Energiegeladen', 'Fröhlich'] },
  { id: 'pose', label: 'Posen', options: ['Stehend', 'Laufend', 'Sitzend'] },
  { id: 'location', label: 'Location', options: ['Indoor', 'Outdoor', 'Stadt'] },
];

export default function FilterBar({ filters, onChange, total, filtered }) {
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
    <div className="px-5 py-2 border-b border-white/5 flex items-center gap-5 overflow-x-auto flex-shrink-0">
      {FILTERS.map((cat) => (
        <div key={cat.id} className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
            {cat.label}
          </span>
          <div className="flex gap-1">
            {cat.options.map((opt) => {
              const active = (filters[cat.id] || []).includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggle(cat.id, opt)}
                  className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                    active
                      ? 'bg-amber-500 text-black font-semibold'
                      : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {hasAny && (
        <>
          <div className="w-px h-4 bg-white/10 flex-shrink-0" />
          <button
            onClick={() => onChange({ typ: [], pose: [], location: [] })}
            className="text-xs text-gray-500 hover:text-white flex-shrink-0 transition-colors"
          >
            ✕ Alle Filter löschen
          </button>
          {total !== filtered && (
            <span className="text-xs text-gray-600 flex-shrink-0">
              {filtered} von {total}
            </span>
          )}
        </>
      )}
    </div>
  );
}
