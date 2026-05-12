import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const FIXED_CATEGORIES = [
  { id: 'typ', label: 'Typ', single: false, options: ['Sportlich', 'Verschmust', 'Energiegeladen', 'Fröhlich'] },
  { id: 'pose', label: 'Posen', single: false, options: ['Stehend', 'Laufend', 'Sitzend'] },
  { id: 'location', label: 'Location', single: false, options: ['Indoor', 'Outdoor', 'Stadt'] },
];

export default function TagPanel({ image, categories, onUpdate, onDelete, onClose }) {
  const [tags, setTags] = useState(image.tags || {});
  const [notes, setNotes] = useState(image.notes || '');
  const initialized = useRef(false);
  const saveTimer = useRef(null);
  const latestTags = useRef(tags);
  const latestNotes = useRef(notes);
  latestTags.current = tags;
  latestNotes.current = notes;

  useEffect(() => {
    initialized.current = false;
    setTags(image.tags || {});
    setNotes(image.notes || '');
  }, [image.id]);

  const save = useCallback(async (currentTags, currentNotes) => {
    try {
      const res = await axios.patch(`/api/images/${image.id}`, {
        tags: currentTags,
        notes: currentNotes,
      });
      onUpdate(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [image.id, onUpdate]);

  // Debounce tag saves to 300ms
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save(latestTags.current, latestNotes.current);
    }, 300);
  }, [save]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    scheduleSave();
  }, [tags, scheduleSave]);

  // Debounce notes saves to 800ms
  useEffect(() => {
    if (!initialized.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save(latestTags.current, latestNotes.current);
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [notes, save]);

  const toggleTag = (categoryId, value, single) => {
    setTags((prev) => {
      const current = prev[categoryId] || [];
      if (single) {
        return { ...prev, [categoryId]: current.includes(value) ? [] : [value] };
      }
      return {
        ...prev,
        [categoryId]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  };

  const handleDelete = async () => {
    if (!window.confirm('Bild wirklich löschen?')) return;
    try {
      await axios.delete(`/api/images/${image.id}`);
      onDelete(image.id);
    } catch (e) {
      console.error(e);
    }
  };

  // Build Art options dynamically from the categories prop
  const artOptions = (categories || []).map((c) => c.name);

  return (
    <aside className="w-68 bg-[#141414] border-l border-white/[0.06] flex flex-col flex-shrink-0 overflow-hidden" style={{width: '17rem'}}>
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06] flex-shrink-0">
        <h2 className="text-sm font-bold tracking-wide text-white/60 uppercase">Eigenschaften</h2>
        <button onClick={onClose} className="text-white/25 hover:text-white/70 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-white/[0.04]">
          <img
            src={`/uploads/${image.filename}`}
            alt=""
            className="w-full rounded-xl object-cover max-h-48"
          />
          {image.source_url && (
            <a
              href={image.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-500/60 hover:text-amber-400 mt-2.5 block truncate transition-colors"
            >
              ↗ Originalquelle öffnen
            </a>
          )}
        </div>

        <div className="px-4 py-5 space-y-6">
          {/* Art — dynamic from categories */}
          {artOptions.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2.5">
                Art <span className="ml-1.5 normal-case font-normal opacity-60">(1 wählbar)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {artOptions.map((opt) => {
                  const selected = (tags.art || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleTag('art', opt, true)}
                      className={`text-sm px-3 py-1.5 rounded-xl border transition-all ${
                        selected
                          ? 'bg-amber-500 border-amber-500 text-black font-semibold'
                          : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/80'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fixed categories: Typ, Posen, Location */}
          {FIXED_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2.5">
                {cat.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cat.options.map((opt) => {
                  const selected = (tags[cat.id] || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleTag(cat.id, opt, cat.single)}
                      className={`text-sm px-3 py-1.5 rounded-xl border transition-all ${
                        selected
                          ? 'bg-amber-500 border-amber-500 text-black font-semibold'
                          : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/80'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2.5">Notizen</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notizen hinzufügen…"
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.06] transition-all"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 border-t border-white/[0.06] flex-shrink-0">
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-white/25 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
          Bild löschen
        </button>
      </div>
    </aside>
  );
}
