import { useState, useRef } from 'react';
import axios from 'axios';
import { compressImage } from '../utils/compressImage';

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
    const compressed = await compressImage(file).catch(() => file);
    const formData = new FormData();
    formData.append('file', compressed);
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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#141414] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <h2 className="text-base font-bold text-white">Bild hinzufügen</h2>
          <button
            onClick={onClose}
            className="text-white/25 hover:text-white/70 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          <div className="flex bg-white/[0.04] rounded-xl p-1 mb-6 gap-1">
            {[
              { id: 'url', label: 'URL einfügen' },
              { id: 'upload', label: 'Datei hochladen' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setError(''); }}
                className={`flex-1 py-2 text-sm rounded-lg transition-all font-medium ${
                  tab === id
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'url' ? (
            <form onSubmit={handleUrlSubmit}>
              <label className="block text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2">
                Bild-URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 focus:bg-white/[0.06] transition-all mb-2"
                autoFocus
              />
              <p className="text-[11px] text-white/25 mb-5">
                Rechtsklick auf ein Bild → "Bildadresse kopieren"
              </p>
              {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 text-black font-bold py-3 rounded-xl text-sm transition-all hover:scale-[1.01] active:scale-100"
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
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-amber-500 bg-amber-500/[0.06]'
                    : 'border-white/10 hover:border-amber-500/40 hover:bg-white/[0.02]'
                } ${loading ? 'pointer-events-none opacity-50' : ''}`}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-9 h-9 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    <p className="text-sm text-white/50">Lädt hoch…</p>
                  </div>
                ) : (
                  <>
                    <div className="text-5xl mb-4 opacity-30">📷</div>
                    <p className="text-sm text-white/70 font-semibold">
                      Klicken oder Bild hierher ziehen
                    </p>
                    <p className="text-xs text-white/25 mt-1.5">JPG, PNG, WEBP, GIF bis 50 MB</p>
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
