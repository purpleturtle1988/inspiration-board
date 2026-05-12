import { useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function LightboxModal({ image, images, onClose, onNavigate }) {
  // Always compute fresh — no stale closure issues
  const navigate = (dir) => {
    if (images.length <= 1) return;
    const idx = images.findIndex((img) => img.id === image.id);
    if (idx === -1) return;
    const next = dir === 'next'
      ? (idx + 1) % images.length
      : (idx - 1 + images.length) % images.length;
    onNavigate(images[next]);
  };

  // Keep a ref so the keyboard handler always calls the latest navigate
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') navigateRef.current('next');
      else if (e.key === 'ArrowLeft') navigateRef.current('prev');
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const currentIndex = images.findIndex((img) => img.id === image.id);

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[60] p-4 sm:p-8"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-white/40 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[70]"
      >
        <X className="w-7 h-7" />
      </button>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); navigate('prev'); }}
          className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 p-3 text-white/40 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[70]"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Image */}
      <img
        src={`/uploads/${image.filename}`}
        alt=""
        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl select-none"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); navigate('next'); }}
          className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 p-3 text-white/40 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[70]"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white/60 text-sm px-4 py-1.5 rounded-full">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
