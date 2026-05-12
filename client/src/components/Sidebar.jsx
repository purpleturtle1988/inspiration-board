import { useState, useRef, useEffect } from 'react';

const NAV_ITEMS = [
  { id: 'inbox',    label: 'Inbox',    emoji: '📥' },
  { id: 'paare',    label: 'Paare',    emoji: '💑' },
  { id: 'familie',  label: 'Familie',  emoji: '👨‍👩‍👧' },
  { id: 'business', label: 'Business', emoji: '💼' },
];

function findAncestors(tree, targetId, path = []) {
  for (const s of tree) {
    if (s.id === targetId) return path;
    const found = findAncestors(s.children || [], targetId, [...path, s.id]);
    if (found) return found;
  }
  return null;
}

function SessionItem({ session, depth, view, expandedIds, toggleExpand, onViewChange, onCreateSub, onDelete, onDropImage }) {
  const [dragOver, setDragOver] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [subName, setSubName] = useState('');
  const subInputRef = useRef(null);
  const isActive   = view === `session:${session.id}`;
  const isExpanded = expandedIds.has(session.id);
  const hasChildren = session.children?.length > 0;

  useEffect(() => { if (addingSub) subInputRef.current?.focus(); }, [addingSub]);

  const indent = depth * 12;

  return (
    <div>
      <div
        className={`relative flex items-center gap-1 py-2 rounded-xl transition-all group/sess ${
          dragOver ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : isActive ? 'bg-amber-500/15' : 'hover:bg-white/[0.04]'
        }`}
        style={{ paddingLeft: `${8 + indent}px`, paddingRight: '8px' }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={(e) => { e.stopPropagation(); setDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const imageId = parseInt(e.dataTransfer.getData('text/plain'));
          if (!isNaN(imageId)) onDropImage(imageId, session.id);
        }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => { if (hasChildren || session.children?.length > 0) toggleExpand(session.id); }}
          className={`w-4 h-4 flex items-center justify-center text-white/25 flex-shrink-0 text-[10px] ${
            hasChildren ? 'hover:text-white/60' : 'cursor-default opacity-0'
          }`}
        >
          {isExpanded ? '▾' : '▸'}
        </button>

        {/* Session name */}
        <button
          onClick={() => onViewChange(`session:${session.id}`)}
          className={`flex-1 text-sm text-left truncate transition-colors ${
            isActive ? 'text-amber-400 font-medium' : 'text-white/40 hover:text-white/80'
          }`}
        >
          <span className="mr-1.5 text-base leading-none">{depth === 0 ? '📂' : '📄'}</span>
          {session.name}
        </button>

        {/* Count badge */}
        {session._count > 0 && (
          <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-semibold flex-shrink-0 mr-1 ${
            isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.06] text-white/30'
          }`}>
            {session._count}
          </span>
        )}

        {/* Action buttons on hover */}
        <div className="hidden group-hover/sess:flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setAddingSub(true); if (!isExpanded) toggleExpand(session.id); }}
            title="Unterordner erstellen"
            className="w-5 h-5 flex items-center justify-center text-white/20 hover:text-amber-400 text-xs rounded transition-colors"
          >＋</button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.id, session.name); }}
            title="Session löschen"
            className="w-5 h-5 flex items-center justify-center text-white/20 hover:text-red-400 text-xs rounded transition-colors"
          >✕</button>
        </div>
      </div>

      {/* Sub-session inline form */}
      {addingSub && (
        <div style={{ paddingLeft: `${20 + indent}px`, paddingRight: '8px' }} className="py-1">
          <div className="flex gap-1">
            <input
              ref={subInputRef}
              type="text"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && subName.trim()) {
                  onCreateSub(subName.trim(), session.id);
                  setSubName('');
                  setAddingSub(false);
                } else if (e.key === 'Escape') { setAddingSub(false); setSubName(''); }
              }}
              placeholder="Ordnername"
              className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40"
            />
            <button
              onClick={() => { if (subName.trim()) { onCreateSub(subName.trim(), session.id); setSubName(''); setAddingSub(false); } }}
              className="px-2 py-1 text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg"
            >✓</button>
          </div>
        </div>
      )}

      {/* Children */}
      {isExpanded && session.children?.map((child) => (
        <SessionItem
          key={child.id}
          session={child}
          depth={depth + 1}
          view={view}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          onViewChange={onViewChange}
          onCreateSub={onCreateSub}
          onDelete={onDelete}
          onDropImage={onDropImage}
        />
      ))}
    </div>
  );
}

export default function Sidebar({ view, onViewChange, counts, sessions, onCreateSession, onDeleteSession, onDropImageToSession }) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [addingRoot, setAddingRoot]   = useState(false);
  const [rootName, setRootName]       = useState('');
  const rootInputRef = useRef(null);

  useEffect(() => { if (addingRoot) rootInputRef.current?.focus(); }, [addingRoot]);

  // Auto-expand ancestors when navigating to a session
  useEffect(() => {
    if (!view.startsWith('session:')) return;
    const sid = parseInt(view.split(':')[1]);
    const ancestors = findAncestors(sessions, sid);
    if (ancestors?.length) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        ancestors.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [view, sessions]);

  const toggleExpand = (id) => setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const submitRoot = () => {
    if (rootName.trim()) {
      onCreateSession(rootName.trim(), null);
      setRootName('');
      setAddingRoot(false);
    }
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Session "${name}" und alle Unterordner löschen?\nDie Fotos bleiben erhalten.`)) {
      onDeleteSession(id);
    }
  };

  return (
    <aside className="w-56 bg-[#141414] border-r border-white/[0.06] flex flex-col flex-shrink-0">
      {/* App header */}
      <div className="px-5 py-6 border-b border-white/[0.06]">
        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-white/30">Inspiration</p>
        <p className="text-base font-semibold text-white mt-0.5">Fotografie</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Main nav */}
        <nav className="py-3 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = view === item.id;
            const count    = counts[item.id] ?? 0;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                  isActive ? 'bg-amber-500/15 text-amber-400' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-lg leading-none">{item.emoji}</span>
                  <span>{item.label}</span>
                </span>
                {count > 0 && (
                  <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
                    isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.06] text-white/30'
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sessions section */}
        <div className="border-t border-white/[0.06] pt-3 pb-2 px-2">
          <div className="flex items-center justify-between px-3 mb-1">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-white/25">Sessions</p>
          </div>

          <div className="space-y-0">
            {sessions.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                depth={0}
                view={view}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                onViewChange={onViewChange}
                onCreateSub={onCreateSession}
                onDelete={handleDelete}
                onDropImage={onDropImageToSession}
              />
            ))}
          </div>

          {/* Add root session */}
          {addingRoot ? (
            <div className="px-2 pt-1">
              <div className="flex gap-1">
                <input
                  ref={rootInputRef}
                  type="text"
                  value={rootName}
                  onChange={(e) => setRootName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRoot();
                    else if (e.key === 'Escape') { setAddingRoot(false); setRootName(''); }
                  }}
                  placeholder="z. B. Hochzeit Müller"
                  className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40"
                />
                <button onClick={submitRoot} className="px-2 py-1 text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg">✓</button>
              </div>
              <button onClick={() => { setAddingRoot(false); setRootName(''); }} className="text-[10px] text-white/25 hover:text-white/50 mt-1 px-1">Abbrechen</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingRoot(true)}
              className="w-full flex items-center gap-2 px-3 py-2 mt-0.5 rounded-xl text-xs text-white/25 hover:text-white/50 hover:bg-white/[0.03] transition-all"
            >
              <span>＋</span><span>Session erstellen</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4 border-t border-white/[0.06]">
        <p className="text-[11px] text-white/20 leading-relaxed">
          Bilder per URL, Upload oder Drag & Drop hinzufügen.
        </p>
      </div>
    </aside>
  );
}
