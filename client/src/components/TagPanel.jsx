import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const TAG_CATEGORIES = [
  { id: 'art', label: 'Art', single: true, options: ['Paare', 'Familie', 'Business'] },
  { id: 'typ', label: 'Typ', single: false, options: ['Sportlich', 'Verschmust', 'Energiegeladen', 'Fröhlich'] },
  { id: 'pose', label: 'Posen', single: false, options: ['Stehend', 'Laufend', 'Sitzend'] },
  { id: 'location', label: 'Location', single: false, options: ['Indoor', 'Outdoor', 'Stadt'] },
];

export default function TagPanel({ image, onUpdate, onDelete, onClose }) {
  const [tags, setTags] = useState(image.tags || {});
  const [notes, setNotes] = useState(image.notes || '');
  const [saved, setSaved] = useState(false);
  const initialized = useRef(false);
  const notesTimer = useRef(null);
  const latestTags = useRef(tags);
  const latestNotes = useRef(notes);
  latestTags.current = tags;
  latestNotes.current = notes;

  // Reset when switching to a different image
  useEffect(() => {
    initialized.current = false;
    setTags(image.tags || {});
    setNotes(image.notes || '');
    setSaved(false);
  }, [image.id]);

  const save = useCallback(async (currentTags, currentNotes) => {
    try {
      const res = await axios.patch(`/api/images/${image.id}`, {
        tags: currentTags,
        notes: currentNotes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onUpdate(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [image.id, onUpdate]);

  // Auto-save tags immediately on change (skip initial load)
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    save(latestTags.current, latestNotes.current);
  }, [tags, save]);

  // Auto-save notes with debounce
  useEffect(() => {
    if (!initialized.current) return;
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      save(latestTags.current, latestNotes.current);
    }, 800);
    return () => clearTimeout(notesTimer.current);
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

  return (
    <aside className="w-64 bg-[#111111] border-l border-white/10 flex flex-col flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <h2 className="text-sm font-semibold text-white">Eigenschaften</h2>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-400 animate-pulse">✓ Gespeichert</span>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Image preview */}
        <div className="p-4 border-b border-white/5">
          <img
            src={`/uploads/${image.filename}`}
            alt=""
            className="w-full rounded-lg object-cover max-h-44"
          />
          {image.source_url && (
            <a
              href={image.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-amber-500/70 hover:text-amber-400 mt-2 block truncate transition-colors"
            >
              ↗ Originalquelle öffnen
            </a>
          )}
        </div>

        {/* Tag categories */}
        <div className="px-4 py-4 space-y-5">
          {TAG_CATEGORIES.map((cat) => (
            <div key={cat.id}>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                {cat.label}
                {cat.single && (
                  <span className="ml-1 text-gray-700 normal-case font-normal">(1 wählbar)</span>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cat.options.map((opt) => {
                  const selected = (tags[cat.id] || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleTag(cat.id, opt, cat.single)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        selected
                          ? 'bg-amber-500 border-amber-500 text-black font-semibold'
                          : 'border-white/15 text-gray-400 hover:border-white/35 hover:text-white'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              Notizen
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notizen hinzufügen..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-amber-500/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Delete button only */}
      <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Bild löschen
        </button>
      </div>
    </aside>
  );
}
