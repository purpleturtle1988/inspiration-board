const NAV_ITEMS = [
  { id: 'inbox', label: 'Inbox', emoji: '📥' },
  { id: 'paare', label: 'Paare', emoji: '💑' },
  { id: 'familie', label: 'Familie', emoji: '👨‍👩‍👧' },
  { id: 'business', label: 'Business', emoji: '💼' },
];

export default function Sidebar({ view, onViewChange, counts }) {
  return (
    <aside className="w-56 bg-[#141414] border-r border-white/[0.06] flex flex-col flex-shrink-0">
      <div className="px-5 py-6 border-b border-white/[0.06]">
        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-white/30">
          Inspiration
        </p>
        <p className="text-base font-semibold text-white mt-0.5">Fotografie</p>
      </div>

      <nav className="flex-1 py-3 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = view === item.id;
          const count = counts[item.id] ?? 0;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                isActive
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="text-lg leading-none">{item.emoji}</span>
                <span>{item.label}</span>
              </span>
              {count > 0 && (
                <span
                  className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-white/[0.06] text-white/30'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-5 border-t border-white/[0.06]">
        <p className="text-[11px] text-white/20 leading-relaxed">
          Bilder per URL, Upload oder Drag & Drop hinzufügen.
        </p>
      </div>
    </aside>
  );
}
