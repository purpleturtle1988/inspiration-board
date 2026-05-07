const NAV_ITEMS = [
  { id: 'inbox', label: 'Inbox', emoji: '📥' },
  { id: 'paare', label: 'Paare', emoji: '💑' },
  { id: 'familie', label: 'Familie', emoji: '👨‍👩‍👧' },
  { id: 'business', label: 'Business', emoji: '💼' },
];

export default function Sidebar({ view, onViewChange, counts }) {
  return (
    <aside className="w-52 bg-[#111111] border-r border-white/10 flex flex-col flex-shrink-0">
      <div className="px-4 py-5 border-b border-white/10">
        <p className="text-[10px] font-bold tracking-widest uppercase text-gray-500">
          Inspiration
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Fotografie</p>
      </div>

      <nav className="flex-1 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = view === item.id;
          const count = counts[item.id] ?? 0;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base leading-none">{item.emoji}</span>
                <span className="font-medium">{item.label}</span>
              </span>
              {count > 0 && (
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                    isActive
                      ? 'bg-amber-500/25 text-amber-300'
                      : 'bg-white/10 text-gray-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Bilder via URL oder Upload hinzufügen. Als PWA installieren für Mobile-Sharing.
        </p>
      </div>
    </aside>
  );
}
