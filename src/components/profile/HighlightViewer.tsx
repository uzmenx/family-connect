import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { type StoryHighlight } from '@/hooks/useStoryHighlights';
import { createPortal } from 'react-dom';

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

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    if (x < w * 0.33) goPrev();
    else if (x > w * 0.66) goNext();
  };

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

  const content = (
    <div className="fullscreen-story-view flex flex-col">
      {/* Progress bars — safe-area */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 pt-[max(8px,env(safe-area-inset-top))] px-2">
        {items.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div
              className={`h-full bg-white rounded-full transition-all duration-100 ${
                i < currentIndex ? 'w-full' : i === currentIndex ? 'w-full animate-[progress_5s_linear]' : 'w-0'
              }`}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-[max(16px,calc(8px+env(safe-area-inset-top)))] left-0 right-0 z-10 flex items-center justify-between px-4">
        <span className="text-white font-semibold text-sm">{highlight.name}</span>
        <button onClick={onClose} className="text-white p-2 -m-2" aria-label="Yopish">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Media — Instagram-style tap: chap orqaga, o‘ng keyingi */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center touch-none cursor-default"
        onClick={handleTap}
      >
        {item.media_type === 'video' ? (
          <video
            src={item.media_url}
            className="max-h-full max-w-full w-full h-full object-contain"
            autoPlay
            playsInline
            onEnded={goNext}
          />
        ) : (
          <img src={item.media_url} alt="" className="max-h-full max-w-full w-full h-full object-contain" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none" />
      </div>

      {/* Caption — safe-area */}
      {item.caption && (
        <div className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] left-0 right-0 text-center px-6">
          <p className="text-white text-sm bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2 inline-block">{item.caption}</p>
        </div>
      )}

      {/* Nav arrows (desktop) */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-white/80 hover:text-white z-10 p-2 hidden sm:flex"
          aria-label="Oldingi"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
      )}
      {currentIndex < items.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/80 hover:text-white z-10 p-2 hidden sm:flex"
          aria-label="Keyingi"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
