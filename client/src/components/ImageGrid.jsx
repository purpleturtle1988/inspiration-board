import { memo, useCallback } from 'react';
import ImageCard from './ImageCard';

const ImageGrid = memo(function ImageGrid({ images, loading, selectedId, onSelect }) {
  const handleSelect = useCallback((image) => () => onSelect(image), [onSelect]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center select-none">
        <div className="text-5xl mb-3 opacity-30">📷</div>
        <p className="text-gray-500 text-sm">Keine Bilder vorhanden</p>
        <p className="text-gray-600 text-xs mt-1">
          Klicke auf "Bild hinzufügen" um zu starten
        </p>
      </div>
    );
  }

  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-3">
      {images.map((image) => (
        <div key={image.id} className="break-inside-avoid mb-3">
          <ImageCard
            image={image}
            selected={selectedId === image.id}
            onSelect={handleSelect(image)}
          />
        </div>
      ))}
    </div>
  );
});

export default ImageGrid;
