import { useState, useRef } from 'react';
import axios from 'axios';

export default function AddImageModal({ onClose, onAdded }) {
  const [tab, setTab] = useState('url');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/images/url', { url: url.trim() });
      onAdded();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Fehler beim Laden des Bildes');
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Bitte nur Bilddateien hochladen');
      return;
    }
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post('/api/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onAdded();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Upload fehlgeschlagen');
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold text-white">Bild hinzufügen</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {/* Tab switcher */}
          <div className="flex bg-white/5 rounded-lg p-1 mb-5 gap-1">
            {[
              { id: 'url', label: 'URL einfügen' },
              { id: 'upload', label: 'Datei hochladen' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setError(''); }}
                className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
                  tab === id
                    ? 'bg-amber-500 text-black font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'url' ? (
            <form onSubmit={handleUrlSubmit}>
              <label className="block text-xs text-gray-400 mb-1.5">
                Bild-URL (z.B. von Instagram oder einer Website)
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors mb-1"
                autoFocus
              />
              <p className="text-[11px] text-gray-600 mb-4">
                Rechtsklick auf ein Bild → "Bildadresse kopieren"
              </p>
              {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 text-black font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Bild wird geladen…' : 'Bild laden'}
              </button>
            </form>
          ) : (
            <div>
              <div
                onClick={() => !loading && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-amber-500 bg-amber-500/5'
                    : 'border-white/15 hover:border-amber-500/40 hover:bg-white/2'
                } ${loading ? 'pointer-events-none opacity-50' : ''}`}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Lädt hoch…</p>
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-3 opacity-40">📷</div>
                    <p className="text-sm text-gray-300 font-medium">
                      Klicken oder Bild hierher ziehen
                    </p>
                    <p className="text-xs text-gray-600 mt-1">JPG, PNG, WEBP, GIF bis 50 MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
