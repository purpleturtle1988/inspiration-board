import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { compressImage } from './utils/compressImage';
import Sidebar from './components/Sidebar';
import ImageGrid from './components/ImageGrid';
import TagPanel from './components/TagPanel';
import AddImageModal from './components/AddImageModal';
import FilterBar from './components/FilterBar';
import LightboxModal from './components/LightboxModal';

export default function App() {
  const [view, setView] = useState('inbox');
  const [images, setImages] = useState([]);
  const [counts, setCounts] = useState({ inbox: 0, paare: 0, familie: 0, business: 0 });
  const [filterDefs, setFilterDefs] = useState([]);
  const [filters, setFilters] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const dragCounter = useRef(0);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/images?view=${view}`);
      setImages(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [view]);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await axios.get('/api/images/counts');
      setCounts(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchFilterDefs = useCallback(async () => {
    try {
      const res = await axios.get('/api/filters');
      setFilterDefs(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchImages();
    fetchCounts();
    fetchFilterDefs();
  }, [fetchImages, fetchCounts, fetchFilterDefs]);

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const onDragEnter = (e) => {
      e.preventDefault();
      if ([...e.dataTransfer.items].some((i) => i.kind === 'file' && i.type.startsWith('image/'))) {
        dragCounter.current += 1;
        setDragOver(true);
      }
    };
    const onDragLeave = (e) => {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current === 0) setDragOver(false);
    };
    const onDragOver = (e) => e.preventDefault();
    const onDrop = async (e) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragOver(false);
      const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      setUploading(true);
      try {
        for (const file of files) {
          const compressed = await compressImage(file).catch(() => file);
          const formData = new FormData();
          formData.append('file', compressed);
          await axios.post('/api/images/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        setView('inbox');
        await fetchImages();
        await fetchCounts();
      } catch (e) {
        console.error('Drop upload failed:', e);
      } finally {
        setUploading(false);
      }
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

  // ── Service worker share target ─────────────────────────────────────────────

  useEffect(() => {
    const handler = async (event) => {
      if (event.data?.type === 'SHARE_FILE') {
        const blob = new Blob([event.data.buffer], { type: event.data.mimeType });
        const file = new File([blob], event.data.fileName, { type: event.data.mimeType });
        const formData = new FormData();
        formData.append('file', file);
        try {
          await axios.post('/api/images/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          setView('inbox');
          fetchImages();
          fetchCounts();
        } catch (e) { console.error('Share upload failed:', e); }
      } else if (event.data?.type === 'SHARE_URL') {
        try {
          await axios.post('/api/images/url', { url: event.data.url });
          setView('inbox');
          fetchImages();
          fetchCounts();
        } catch (e) { console.error('Share URL failed:', e); }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [fetchImages, fetchCounts]);

  // ── Image management ────────────────────────────────────────────────────────

  const handleImageAdded = () => { fetchImages(); fetchCounts(); };

  const belongsInView = useCallback((img) => {
    const artTags = img.tags?.art || [];
    if (view === 'inbox') return artTags.length === 0;
    const viewCat = view.charAt(0).toUpperCase() + view.slice(1);
    return artTags.includes(viewCat);
  }, [view]);

  // The single image whose TagPanel is open (only when exactly 1 selected)
  const primaryImage = selectedIds.size === 1
    ? images.find((i) => i.id === [...selectedIds][0]) ?? null
    : null;

  const closePanel = useCallback((closedImage) => {
    if (closedImage && !belongsInView(closedImage)) {
      setImages((prev) => prev.filter((img) => img.id !== closedImage.id));
    }
    setSelectedIds(new Set());
  }, [belongsInView]);

  const handleImageUpdated = (updatedImage) => {
    setImages((prev) => prev.map((img) => (img.id === updatedImage.id ? updatedImage : img)));
    // Don't restore selection — only update image data, leave selection unchanged
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
      // Range select
      const start = Math.min(lastIndex, index);
      const end   = Math.max(lastIndex, index);
      const rangeIds = currentImages.slice(start, end + 1).map((i) => i.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => next.add(id));
        return next;
      });
    } else if (event.ctrlKey || event.metaKey) {
      // Toggle individual
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(img.id)) next.delete(img.id);
        else next.add(img.id);
        return next;
      });
    } else {
      // Single select — flush deferred removal of previous primary
      setSelectedIds((prev) => {
        if (prev.size === 1) {
          const prevImg = images.find((i) => i.id === [...prev][0]);
          if (prevImg && prevImg.id !== img.id && !belongsInView(prevImg)) {
            setImages((list) => list.filter((i) => i.id !== prevImg.id));
          }
        }
        return new Set([img.id]);
      });
    }
  }, [images, belongsInView]);

  // ── Bulk actions ────────────────────────────────────────────────────────────

  const handleBulkAssignArt = async (artValue) => {
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => {
        const img = images.find((i) => i.id === id);
        const newTags = { ...(img?.tags || {}), art: artValue ? [artValue] : [] };
        return axios.patch(`/api/images/${id}`, { tags: newTags, notes: img?.notes || '' });
      }));
      fetchImages();
      fetchCounts();
      setSelectedIds(new Set());
    } catch (e) { console.error(e); }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`${selectedIds.size} Bilder löschen?`)) return;
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => axios.delete(`/api/images/${id}`)));
      setImages((prev) => prev.filter((img) => !ids.includes(img.id)));
      setSelectedIds(new Set());
      fetchCounts();
    } catch (e) { console.error(e); }
  };

  // ── Filter management ───────────────────────────────────────────────────────

  const handleAddCategory = async (label) => {
    try {
      const res = await axios.post('/api/filters/categories', { label });
      setFilterDefs((prev) => [...prev, res.data]);
    } catch (e) {
      if (e.response?.status === 409) alert('Diese Filterkategorie existiert bereits.');
      else console.error(e);
    }
  };

  const handleDeleteCategory = async (slug) => {
    try {
      await axios.delete(`/api/filters/categories/${slug}`);
      setFilterDefs((prev) => prev.filter((c) => c.slug !== slug));
      // Remove any active filters for this slug
      setFilters((prev) => { const next = { ...prev }; delete next[slug]; return next; });
    } catch (e) { console.error(e); }
  };

  const handleAddOption = async (slug, value) => {
    try {
      const res = await axios.post('/api/filters/options', { slug, value });
      setFilterDefs((prev) => prev.map((c) =>
        c.slug === slug ? { ...c, options: [...c.options, res.data] } : c
      ));
    } catch (e) {
      if (e.response?.status === 409) alert('Diese Option existiert bereits.');
      else console.error(e);
    }
  };

  const handleDeleteOption = async (id, slug, value) => {
    try {
      await axios.delete(`/api/filters/options/${id}`);
      setFilterDefs((prev) => prev.map((c) =>
        c.slug === slug ? { ...c, options: c.options.filter((o) => o.id !== id) } : c
      ));
      // Remove from active filters if selected
      setFilters((prev) => ({
        ...prev,
        [slug]: (prev[slug] || []).filter((v) => v !== value),
      }));
    } catch (e) { console.error(e); }
  };

  // ── Derived state ───────────────────────────────────────────────────────────

  const viewLabel = view === 'inbox' ? 'Inbox' : view.charAt(0).toUpperCase() + view.slice(1);

  const filteredImages = images.filter((img) => {
    return Object.entries(filters).every(([slug, vals]) =>
      vals.length === 0 || vals.some((v) => img.tags?.[slug]?.includes(v))
    );
  });

  const ART_OPTIONS = ['Paare', 'Familie', 'Business'];

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar
        view={view}
        onViewChange={(v) => { closePanel(primaryImage); setView(v); setFilters({}); setSelectedIds(new Set()); }}
        counts={counts}
      />

      <FilterBar
        filters={filters}
        onChange={(f) => { setFilters(f); setSelectedIds(new Set()); }}
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
            />
          </div>

          {/* Bulk panel — shown when ≥2 images selected */}
          {selectedIds.size >= 2 && (
            <aside className="w-64 bg-[#141414] border-l border-white/[0.06] flex flex-col flex-shrink-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06]">
                <h2 className="text-sm font-bold tracking-wide text-white/60 uppercase">
                  {selectedIds.size} ausgewählt
                </h2>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-white/25 hover:text-white/70 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5"
                >✕</button>
              </div>
              <div className="flex-1 p-5 space-y-6">
                <div>
                  <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-3">
                    Art zuweisen
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {ART_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleBulkAssignArt(opt)}
                        className="text-sm px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-500/5 transition-all text-left"
                      >
                        {opt}
                      </button>
                    ))}
                    <button
                      onClick={() => handleBulkAssignArt('')}
                      className="text-sm px-4 py-2.5 rounded-xl border border-white/10 text-white/30 hover:border-white/25 hover:text-white/60 hover:bg-white/[0.03] transition-all text-left"
                    >
                      → Zurück in Inbox
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-white/[0.06]">
                <button
                  onClick={handleBulkDelete}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-white/25 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                  {selectedIds.size} Bilder löschen
                </button>
              </div>
            </aside>
          )}

          {/* Single image TagPanel */}
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
              <>
                <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white font-semibold text-lg">Lädt hoch…</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">📷</div>
                <p className="text-white font-semibold text-lg">Bilder loslassen</p>
                <p className="text-gray-400 text-sm mt-1">Landen direkt in der Inbox</p>
              </>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddImageModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleImageAdded}
        />
      )}

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
