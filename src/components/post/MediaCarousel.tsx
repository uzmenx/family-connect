import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaCarouselProps {
  mediaUrls: string[];
  className?: string;
}

export const MediaCarousel = ({ mediaUrls, className }: MediaCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!mediaUrls || mediaUrls.length === 0) return null;

  const isVideo = (url: string) => {
    return url.includes('.mp4') || url.includes('.mov') || url.includes('.webm');
  };

  const goTo = (index: number) => {
    setCurrentIndex(index);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? mediaUrls.length - 1 : prev - 1));
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev === mediaUrls.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative aspect-square overflow-hidden bg-muted">
        {isVideo(mediaUrls[currentIndex]) ? (
          <video
            src={mediaUrls[currentIndex]}
            controls
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={mediaUrls[currentIndex]}
            alt={`Media ${currentIndex + 1}`}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {mediaUrls.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-background/80 rounded-full shadow-md hover:bg-background transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-background/80 rounded-full shadow-md hover:bg-background transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {mediaUrls.map((_, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  currentIndex === index ? "bg-primary" : "bg-background/60"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
