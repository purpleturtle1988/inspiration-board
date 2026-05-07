import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import ImageGrid from './components/ImageGrid';
import TagPanel from './components/TagPanel';
import AddImageModal from './components/AddImageModal';

export default function App() {
  const [view, setView] = useState('inbox');
  const [images, setImages] = useState([]);
  const [counts, setCounts] = useState({ inbox: 0, paare: 0, familie: 0, business: 0 });
  const [selectedImage, setSelectedImage] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dragCounter = useRef(0);

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

  useEffect(() => {
    fetchImages();
    fetchCounts();
  }, [fetchImages, fetchCounts]);

  // Global drag & drop from Finder/Desktop
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
          const formData = new FormData();
          formData.append('file', file);
          await axios.post('/api/images/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
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

  // Listen for PWA share target messages from service worker
  useEffect(() => {
    const handler = async (event) => {
      if (event.data?.type === 'SHARE_FILE') {
        const blob = new Blob([event.data.buffer], { type: event.data.mimeType });
        const file = new File([blob], event.data.fileName, { type: event.data.mimeType });
        const formData = new FormData();
        formData.append('file', file);
        try {
          await axios.post('/api/images/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setView('inbox');
          fetchImages();
          fetchCounts();
        } catch (e) {
          console.error('Share upload failed:', e);
        }
      } else if (event.data?.type === 'SHARE_URL') {
        try {
          await axios.post('/api/images/url', { url: event.data.url });
          setView('inbox');
          fetchImages();
          fetchCounts();
        } catch (e) {
          console.error('Share URL failed:', e);
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [fetchImages, fetchCounts]);

  const handleImageAdded = () => {
    fetchImages();
    fetchCounts();
  };

  const handleImageUpdated = (updatedImage) => {
    const artTags = updatedImage.tags?.art || [];
    let removeFromView = false;

    if (view === 'inbox' && artTags.length > 0) {
      removeFromView = true;
    } else if (view !== 'inbox') {
      const viewCat = view.charAt(0).toUpperCase() + view.slice(1);
      if (!artTags.includes(viewCat)) removeFromView = true;
    }

    if (removeFromView) {
      setImages((prev) => prev.filter((img) => img.id !== updatedImage.id));
      setSelectedImage(null);
    } else {
      setImages((prev) => prev.map((img) => (img.id === updatedImage.id ? updatedImage : img)));
      setSelectedImage(updatedImage);
    }
    fetchCounts();
  };

  const handleImageDeleted = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setSelectedImage(null);
    fetchCounts();
  };

  const viewLabel =
    view === 'inbox' ? 'Inbox' : view.charAt(0).toUpperCase() + view.slice(1);

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar view={view} onViewChange={(v) => { setView(v); setSelectedImage(null); }} counts={counts} />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <h1 className="text-base font-semibold text-white">{viewLabel}</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + Bild hinzufügen
          </button>
        </header>

        <div className="flex-1 overflow-hidden flex min-h-0">
          <div className="flex-1 overflow-y-auto p-5">
            <ImageGrid
              images={images}
              loading={loading}
              selectedId={selectedImage?.id}
              onSelect={setSelectedImage}
            />
          </div>

          {selectedImage && (
            <TagPanel
              image={selectedImage}
              onUpdate={handleImageUpdated}
              onDelete={handleImageDeleted}
              onClose={() => setSelectedImage(null)}
            />
          )}
        </div>
      </main>

      {/* Global drag & drop overlay */}
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
    </div>
  );
}
