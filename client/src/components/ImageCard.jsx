const TAG_STYLE = {
  art: 'bg-blue-500/25 text-blue-300',
  typ: 'bg-purple-500/25 text-purple-300',
  pose: 'bg-green-500/25 text-green-300',
  location: 'bg-orange-500/25 text-orange-300',
};

export default function ImageCard({ image, selected, onSelect }) {
  const allTags = Object.entries(image.tags || {}).flatMap(([cat, vals]) =>
    vals.map((v) => ({ cat, value: v }))
  );

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-150 ${
        selected
          ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-[#0a0a0a]'
          : 'ring-1 ring-white/10 hover:ring-white/25'
      }`}
    >
      <img
        src={`/uploads/${image.filename}`}
        alt={image.title || ''}
        className="w-full object-cover block"
        loading="lazy"
        onError={(e) => {
          e.target.parentElement.classList.add('min-h-[120px]', 'bg-white/5');
          e.target.style.display = 'none';
        }}
      />

      {/* Hover overlay with tag count */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-150 ${
          allTags.length > 0 || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {allTags.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <div className="flex flex-wrap gap-1">
              {allTags.slice(0, 3).map(({ cat, value }) => (
                <span
                  key={cat + value}
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${TAG_STYLE[cat] || 'bg-gray-500/25 text-gray-300'}`}
                >
                  {value}
                </span>
              ))}
              {allTags.length > 3 && (
                <span className="text-[10px] text-gray-400 px-1 py-0.5">
                  +{allTags.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
