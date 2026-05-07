import { useState, useEffect, useCallback } from 'react';
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

      {showAddModal && (
        <AddImageModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleImageAdded}
        />
      )}
    </div>
  );
}
