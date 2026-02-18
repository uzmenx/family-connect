import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { type StoryHighlight } from '@/hooks/useStoryHighlights';

interface HighlightViewerProps {
  highlight: StoryHighlight;
  onClose: () => void;
}

export function HighlightViewer({ highlight, onClose }: HighlightViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = highlight.items;

  const goNext = useCallback(() => {
    if (currentIndex < items.length - 1) setCurrentIndex(i => i + 1);
    else onClose();
  }, [currentIndex, items.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  }, [currentIndex]);

  // Auto-advance for images
  useEffect(() => {
    const item = items[currentIndex];
    if (!item || item.media_type === 'video') return;
    const timer = setTimeout(goNext, 5000);
    return () => clearTimeout(timer);
  }, [currentIndex, goNext, items]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, onClose]);

  if (items.length === 0) { onClose(); return null; }

  const item = items[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
        {items.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div
              className={`h-full bg-white rounded-full transition-all ${
                i < currentIndex ? 'w-full' : i === currentIndex ? 'w-full animate-[progress_5s_linear]' : 'w-0'
              }`}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 z-10 flex items-center justify-between px-4 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">{highlight.name}</span>
        </div>
        <button onClick={onClose} className="text-white p-1">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center" onClick={goNext}>
        {item.media_type === 'video' ? (
          <video src={item.media_url} className="max-h-full max-w-full object-contain" autoPlay controls onEnded={goNext} />
        ) : (
          <img src={item.media_url} alt="" className="max-h-full max-w-full object-contain" />
        )}
      </div>

      {/* Caption */}
      {item.caption && (
        <div className="absolute bottom-8 left-0 right-0 text-center px-8">
          <p className="text-white text-sm bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2 inline-block">{item.caption}</p>
        </div>
      )}

      {/* Nav arrows */}
      {currentIndex > 0 && (
        <button onClick={(e) => { e.stopPropagation(); goPrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 z-10">
          <ChevronLeft className="h-8 w-8" />
        </button>
      )}
    </div>
  );
}
