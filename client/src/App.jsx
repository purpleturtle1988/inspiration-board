import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { compressImage } from './utils/compressImage';
import Sidebar from './components/Sidebar';
import ImageGrid from './components/ImageGrid';
import TagPanel from './components/TagPanel';
import AddImageModal from './components/AddImageModal';
import FilterBar from './components/FilterBar';
import LightboxModal from './components/LightboxModal';

const ART_OPTIONS = ['Paare', 'Familie', 'Business'];

function findInTree(tree, id) {
  for (const s of tree) {
    if (s.id === id) return s;
    const found = findInTree(s.children || [], id);
    if (found) return found;
  }
  return null;
}

export default function App() {
  const [view, setView]           = useState('inbox');
  const [images, setImages]       = useState([]);
  const [counts, setCounts]       = useState({ inbox: 0, paare: 0, familie: 0, business: 0 });
  const [filterDefs, setFilterDefs] = useState([]);
  const [sessions, setSessions]   = useState([]);
  const [filters, setFilters]     = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const dragCounter = useRef(0);
  const imagesRef   = useRef(images);
  imagesRef.current = images;

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const url = view.startsWith('session:')
        ? `/api/sessions/${view.split(':')[1]}/images`
        : `/api/images?view=${view}`;
      const res = await axios.get(url);
      setImages(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [view]);

  const fetchCounts     = useCallback(async () => { try { const r = await axios.get('/api/images/counts');  setCounts(r.data); } catch (e) { console.error(e); } }, []);
  const fetchFilterDefs = useCallback(async () => { try { const r = await axios.get('/api/filters');         setFilterDefs(r.data); } catch (e) { console.error(e); } }, []);
  const fetchSessions   = useCallback(async () => { try { const r = await axios.get('/api/sessions');        setSessions(r.data); } catch (e) { console.error(e); } }, []);

  useEffect(() => {
    fetchImages();
    fetchCounts();
    fetchFilterDefs();
    fetchSessions();
  }, [fetchImages, fetchCounts, fetchFilterDefs, fetchSessions]);

  // ── Drag & drop (Finder / Desktop) ──────────────────────────────────────────

  useEffect(() => {
    const onDragEnter = (e) => {
      e.preventDefault();
      if ([...e.dataTransfer.items].some((i) => i.kind === 'file' && i.type.startsWith('image/'))) {
        dragCounter.current += 1; setDragOver(true);
      }
    };
    const onDragLeave = (e) => { e.preventDefault(); dragCounter.current -= 1; if (dragCounter.current === 0) setDragOver(false); };
    const onDragOver  = (e) => e.preventDefault();
    const onDrop = async (e) => {
      e.preventDefault();
      dragCounter.current = 0; setDragOver(false);
      const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      setUploading(true);
      try {
        for (const file of files) {
          const compressed = await compressImage(file).catch(() => file);
          const fd = new FormData(); fd.append('file', compressed);
          await axios.post('/api/images/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        setView('inbox'); await fetchImages(); await fetchCounts();
      } catch (e) { console.error('Drop upload failed:', e); }
      finally { setUploading(false); }
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [fetchImages, fetchCounts]);

  // ── Service worker ──────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = async (event) => {
      if (event.data?.type === 'SHARE_FILE') {
        const blob = new Blob([event.data.buffer], { type: event.data.mimeType });
        const file = new File([blob], event.data.fileName, { type: event.data.mimeType });
        const fd = new FormData(); fd.append('file', file);
        try { await axios.post('/api/images/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setView('inbox'); fetchImages(); fetchCounts(); }
        catch (e) { console.error(e); }
      } else if (event.data?.type === 'SHARE_URL') {
        try { await axios.post('/api/images/url', { url: event.data.url }); setView('inbox'); fetchImages(); fetchCounts(); }
        catch (e) { console.error(e); }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [fetchImages, fetchCounts]);

  // ── Image management ────────────────────────────────────────────────────────

  const handleImageAdded = () => { fetchImages(); fetchCounts(); };

  const belongsInView = useCallback((img) => {
    if (view.startsWith('session:')) return true;
    const artTags = img.tags?.art || [];
    if (view === 'inbox') return artTags.length === 0;
    const viewCat = view.charAt(0).toUpperCase() + view.slice(1);
    return artTags.includes(viewCat);
  }, [view]);

  const primaryImage = selectedIds.size === 1
    ? images.find((i) => i.id === [...selectedIds][0]) ?? null
    : null;

  const closePanel = useCallback((closedImage) => {
    if (closedImage && !belongsInView(closedImage)) {
      setImages((prev) => prev.filter((img) => img.id !== closedImage.id));
    }
    setSelectedIds(new Set());
  }, [belongsInView]);

  const handleViewChange = useCallback((v) => {
    closePanel(primaryImage);
    setView(v);
    setFilters({});
    setSelectedIds(new Set());
  }, [closePanel, primaryImage]);

  const handleImageUpdated = (updatedImage) => {
    setImages((prev) => prev.map((img) => (img.id === updatedImage.id ? updatedImage : img)));
    const prevArt = JSON.stringify(images.find(i => i.id === updatedImage.id)?.tags?.art || []);
    const nextArt = JSON.stringify(updatedImage.tags?.art || []);
    if (prevArt !== nextArt) fetchCounts();
  };

  const handleImageDeleted = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setSelectedIds(new Set());
    fetchCounts();
  };

  // ── Multi-select ────────────────────────────────────────────────────────────

  const handleSelectImage = useCallback((img, index, event, lastIndex, currentImages) => {
    if (event.shiftKey && lastIndex !== null) {
      const start = Math.min(lastIndex, index);
      const end   = Math.max(lastIndex, index);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentImages.slice(start, end + 1).forEach((i) => next.add(i.id));
        return next;
      });
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(img.id)) next.delete(img.id); else next.add(img.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        if (prev.size === 1) {
          const prevImg = imagesRef.current.find((i) => i.id === [...prev][0]);
          if (prevImg && prevImg.id !== img.id && !belongsInView(prevImg)) {
            setImages((list) => list.filter((i) => i.id !== prevImg.id));
          }
        }
        return new Set([img.id]);
      });
    }
  }, [belongsInView]);

  // ── Bulk actions ────────────────────────────────────────────────────────────

  // Toggle a tag value on/off across all selected images
  const handleBulkToggleTag = async (slug, value, isSingle = false) => {
    const cur = imagesRef.current;
    const selected = [...selectedIds].map(id => cur.find(i => i.id === id)).filter(Boolean);
    const allHave  = selected.every(img => img.tags?.[slug]?.includes(value));

    const updated = selected.map(img => {
      const existing = img.tags?.[slug] || [];
      let newVals;
      if (isSingle) {
        // single-select: toggle off if this one is set, otherwise replace
        newVals = existing.includes(value) && allHave ? [] : [value];
      } else {
        newVals = allHave ? existing.filter(v => v !== value) : (existing.includes(value) ? existing : [...existing, value]);
      }
      return { ...img, tags: { ...(img.tags || {}), [slug]: newVals } };
    });

    setImages(prev => prev.map(img => updated.find(u => u.id === img.id) || img));
    try {
      await Promise.all(updated.map(img =>
        axios.patch(`/api/images/${img.id}`, { tags: img.tags, notes: img.notes || '' })
      ));
      if (slug === 'art') { fetchCounts(); fetchImages(); setSelectedIds(new Set()); }
    } catch (e) { console.error(e); fetchImages(); }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`${selectedIds.size} Bilder löschen?`)) return;
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map(id => axios.delete(`/api/images/${id}`)));
      setImages(prev => prev.filter(img => !ids.includes(img.id)));
      setSelectedIds(new Set());
      fetchCounts();
    } catch (e) { console.error(e); }
  };

  // ── Session management ──────────────────────────────────────────────────────

  const handleCreateSession = async (name, parentId = null) => {
    try {
      await axios.post('/api/sessions', { name, parent_id: parentId });
      fetchSessions();
    } catch (e) { console.error(e); }
  };

  const handleDeleteSession = async (id) => {
    try {
      await axios.delete(`/api/sessions/${id}`);
      fetchSessions();
      if (view === `session:${id}`) handleViewChange('inbox');
    } catch (e) { console.error(e); }
  };

  const handleDropImageToSession = async (imageId, sessionId) => {
    try {
      await axios.post(`/api/sessions/${sessionId}/images`, { imageId });
      fetchSessions();
      if (view === `session:${sessionId}`) fetchImages();
    } catch (e) { console.error(e); }
  };

  // Drag-to-reorder within session view
  const sessionId = view.startsWith('session:') ? parseInt(view.split(':')[1]) : null;
  const handleSessionReorder = useCallback((fromIndex, toIndex) => {
    if (!sessionId) return;
    const cur = [...imagesRef.current];
    const [item] = cur.splice(fromIndex, 1);
    cur.splice(toIndex, 0, item);
    setImages(cur);
    axios.patch(`/api/sessions/${sessionId}/images/reorder`, { orderedIds: cur.map(i => i.id) })
      .catch(console.error);
  }, [sessionId]);

  // ── Filter management ───────────────────────────────────────────────────────

  const handleAddCategory = async (label) => {
    try {
      const res = await axios.post('/api/filters/categories', { label });
      setFilterDefs(prev => [...prev, res.data]);
    } catch (e) {
      if (e.response?.status === 409) alert('Diese Filterkategorie existiert bereits.');
      else console.error(e);
    }
  };

  const handleDeleteCategory = async (slug) => {
    try {
      await axios.delete(`/api/filters/categories/${slug}`);
      setFilterDefs(prev => prev.filter(c => c.slug !== slug));
      setFilters(prev => { const next = { ...prev }; delete next[slug]; return next; });
    } catch (e) { console.error(e); }
  };

  const handleAddOption = async (slug, value) => {
    try {
      const res = await axios.post('/api/filters/options', { slug, value });
      setFilterDefs(prev => prev.map(c => c.slug === slug ? { ...c, options: [...c.options, res.data] } : c));
    } catch (e) {
      if (e.response?.status === 409) alert('Diese Option existiert bereits.');
      else console.error(e);
    }
  };

  const handleDeleteOption = async (id, slug, value) => {
    try {
      await axios.delete(`/api/filters/options/${id}`);
      setFilterDefs(prev => prev.map(c => c.slug === slug ? { ...c, options: c.options.filter(o => o.id !== id) } : c));
      setFilters(prev => ({ ...prev, [slug]: (prev[slug] || []).filter(v => v !== value) }));
    } catch (e) { console.error(e); }
  };

  // ── Derived state ───────────────────────────────────────────────────────────

  const viewLabel = useMemo(() => {
    if (view === 'inbox') return 'Inbox';
    if (view.startsWith('session:')) return findInTree(sessions, parseInt(view.split(':')[1]))?.name ?? 'Session';
    return view.charAt(0).toUpperCase() + view.slice(1);
  }, [view, sessions]);

  // ⚡ Memoized filter — no re-calc unless images or filters change
  const filteredImages = useMemo(() =>
    images.filter(img =>
      Object.entries(filters).every(([slug, vals]) =>
        vals.length === 0 || vals.some(v => img.tags?.[slug]?.includes(v))
      )
    ), [images, filters]);

  // Bulk panel: compute tag state (all/some/none) per option
  const selectedImages = useMemo(() =>
    [...selectedIds].map(id => images.find(i => i.id === id)).filter(Boolean),
    [selectedIds, images]);

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar
        view={view}
        onViewChange={handleViewChange}
        counts={counts}
        sessions={sessions}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        onDropImageToSession={handleDropImageToSession}
      />

      <FilterBar
        filters={filters}
        onChange={(f) => setFilters(f)}
        filterDefs={filterDefs}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onAddOption={handleAddOption}
        onDeleteOption={handleDeleteOption}
      />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <header className="px-7 py-5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <h1 className="text-xl font-bold text-white">{viewLabel}</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-100"
          >
            + Bild hinzufügen
          </button>
        </header>

        <div className="flex-1 overflow-hidden flex min-h-0">
          <div className="flex-1 overflow-y-auto p-5">
            <ImageGrid
              images={filteredImages}
              loading={loading}
              selectedIds={selectedIds}
              onSelect={handleSelectImage}
              onOpenLightbox={setLightboxImage}
              onReorder={sessionId ? handleSessionReorder : undefined}
            />
          </div>

          {/* Bulk panel — ≥2 selected */}
          {selectedIds.size >= 2 && (
            <aside className="w-72 bg-[#141414] border-l border-white/[0.06] flex flex-col flex-shrink-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06] flex-shrink-0">
                <h2 className="text-sm font-bold tracking-wide text-white/60 uppercase">
                  {selectedIds.size} ausgewählt
                </h2>
                <button onClick={() => setSelectedIds(new Set())}
                  className="text-white/25 hover:text-white/70 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
                {/* Art */}
                <div>
                  <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2.5">
                    Art <span className="normal-case font-normal opacity-60 ml-1">(1 wählbar)</span>
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {ART_OPTIONS.map((opt) => {
                      const count = selectedImages.filter(img => img.tags?.art?.includes(opt)).length;
                      const all   = count === selectedImages.length;
                      const some  = count > 0 && !all;
                      return (
                        <button key={opt}
                          onClick={() => handleBulkToggleTag('art', opt, true)}
                          className={`text-sm px-3 py-2 rounded-xl border text-left transition-all ${
                            all  ? 'bg-amber-500 border-amber-500 text-black font-semibold'
                            : some ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                   : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/80'
                          }`}>
                          {opt} {some && <span className="text-[10px] opacity-60">({count}/{selectedImages.length})</span>}
                        </button>
                      );
                    })}
                    <button onClick={() => handleBulkToggleTag('art', '', true)}
                      className="text-sm px-3 py-2 rounded-xl border border-white/10 text-white/30 hover:border-white/25 hover:text-white/60 hover:bg-white/[0.03] transition-all text-left">
                      → Zurück in Inbox
                    </button>
                  </div>
                </div>

                {/* Dynamic filter categories */}
                {filterDefs.map((cat) => (
                  <div key={cat.slug}>
                    <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2.5">{cat.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.options.map((opt) => {
                        const count = selectedImages.filter(img => img.tags?.[cat.slug]?.includes(opt.value)).length;
                        const all   = count === selectedImages.length;
                        const some  = count > 0 && !all;
                        return (
                          <button key={opt.id}
                            onClick={() => handleBulkToggleTag(cat.slug, opt.value, false)}
                            className={`text-sm px-3 py-1.5 rounded-xl border transition-all ${
                              all  ? 'bg-amber-500 border-amber-500 text-black font-semibold'
                              : some ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                     : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/80'
                            }`}>
                            {opt.value}
                            {some && <span className="text-[9px] opacity-60 ml-1">{count}/{selectedImages.length}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-4 border-t border-white/[0.06] flex-shrink-0">
                <button onClick={handleBulkDelete}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-white/25 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                  {selectedIds.size} Bilder löschen
                </button>
              </div>
            </aside>
          )}

          {/* Single-image TagPanel */}
          {primaryImage && selectedIds.size === 1 && (
            <TagPanel
              image={primaryImage}
              filterDefs={filterDefs}
              onUpdate={handleImageUpdated}
              onDelete={handleImageDeleted}
              onClose={() => closePanel(primaryImage)}
            />
          )}
        </div>
      </main>

      {/* Drag & drop overlay */}
      {(dragOver || uploading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#1a1a1a] border-2 border-dashed border-amber-500 rounded-2xl px-16 py-12 text-center shadow-2xl">
            {uploading ? (
              <><div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white font-semibold text-lg">Lädt hoch…</p></>
            ) : (
              <><div className="text-5xl mb-4">📷</div>
              <p className="text-white font-semibold text-lg">Bilder loslassen</p>
              <p className="text-gray-400 text-sm mt-1">Landen direkt in der Inbox</p></>
            )}
          </div>
        </div>
      )}

      {showAddModal && <AddImageModal onClose={() => setShowAddModal(false)} onAdded={handleImageAdded} />}

      {lightboxImage && (
        <LightboxModal
          image={lightboxImage}
          images={filteredImages}
          onClose={() => setLightboxImage(null)}
          onNavigate={setLightboxImage}
        />
      )}
    </div>
  );
}
