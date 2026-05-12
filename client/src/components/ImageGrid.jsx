import { memo, useCallback, useRef, useState } from 'react';
import ImageCard from './ImageCard';

const ImageGrid = memo(function ImageGrid({ images, loading, selectedIds, onSelect, onOpenLightbox, onReorder }) {
  const lastIndexRef  = useRef(null);
  const dragSrcRef    = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleClick = useCallback((image, index, e) => {
    onSelect(image, index, e, lastIndexRef.current, images);
    if (!e.shiftKey) lastIndexRef.current = index;
  }, [onSelect, images]);

  const handleLightbox = useCallback((image) => () => onOpenLightbox(image), [onOpenLightbox]);

  const multiMode = selectedIds.size > 0;

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
        <p className="text-gray-600 text-xs mt-1">Klicke auf "Bild hinzufügen" um zu starten</p>
      </div>
    );
  }

  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-3">
      {images.map((image, index) => (
        <div
          key={image.id}
          className="break-inside-avoid mb-3"
          draggable
          onDragStart={(e) => {
            dragSrcRef.current = index;
            e.dataTransfer.setData('text/plain', String(image.id));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => { dragSrcRef.current = null; setDragOverId(null); }}
          onDragOver={(e) => {
            if (!onReorder) return;
            e.preventDefault();
            e.stopPropagation();
            setDragOverId(image.id);
          }}
          onDragLeave={() => { if (onReorder) setDragOverId(null); }}
          onDrop={(e) => {
            if (!onReorder) return;
            e.preventDefault();
            e.stopPropagation();
            if (dragSrcRef.current !== null && dragSrcRef.current !== index) {
              onReorder(dragSrcRef.current, index);
            }
            setDragOverId(null);
            dragSrcRef.current = null;
          }}
        >
          <ImageCard
            image={image}
            selected={selectedIds.has(image.id)}
            multiMode={multiMode}
            dragOver={onReorder ? dragOverId === image.id : false}
            onSelect={(e) => handleClick(image, index, e)}
            onOpenLightbox={handleLightbox(image)}
          />
        </div>
      ))}
    </div>
  );
});

export default ImageGrid;
