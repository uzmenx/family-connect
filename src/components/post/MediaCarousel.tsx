import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setCurrentPlayingVideo } from '@/utils/videoManager';

interface MediaCarouselProps {
  mediaUrls: string[];
  className?: string;
}

export const MediaCarousel = ({ mediaUrls, className }: MediaCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = (url: string) => {
    return url.includes('.mp4') || url.includes('.mov') || url.includes('.webm');
  };

  // Intersection Observer for auto-play/pause
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.5);
      },
      { threshold: [0, 0.5, 1] }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Auto-play/pause video based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo(mediaUrls[currentIndex])) return;

    if (isVisible) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isVisible, currentIndex, mediaUrls]);

  // Reset video when switching slides
  useEffect(() => {
    const video = videoRef.current;
    if (video && isVideo(mediaUrls[currentIndex]) && isVisible) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [currentIndex]);

  if (!mediaUrls || mediaUrls.length === 0) return null;

  const goTo = (index: number) => {
    setCurrentIndex(index);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => prev === 0 ? mediaUrls.length - 1 : prev - 1);
  };

  const goNext = () => {
    setCurrentIndex((prev) => prev === mediaUrls.length - 1 ? 0 : prev + 1);
  };

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (video) {
      // Pause all other videos when this one starts playing
      setCurrentPlayingVideo(mediaUrls[currentIndex]);
      
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative w-full overflow-hidden bg-white/10 backdrop-blur-[10px] border border-white/20 flex items-center justify-center" style={{ maxHeight: '80vh', minHeight: '200px' }}>
        {isVideo(mediaUrls[currentIndex]) ?
        <video
          ref={videoRef}
          src={mediaUrls[currentIndex]}
          className="w-full h-auto object-contain cursor-pointer"
          style={{ maxHeight: '80vh', maxWidth: '100%' }}
          loop
          playsInline
          onClick={handleVideoClick} /> :


        <img
          src={mediaUrls[currentIndex]}
          alt={`Media ${currentIndex + 1}`}
          className="w-full h-auto object-contain"
          style={{ maxHeight: '80vh', maxWidth: '100%' }} />

        }
      </div>

      {mediaUrls.length > 1 &&
      <>
          <button
          onClick={goPrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/20 backdrop-blur-[10px] border border-white/30 rounded-full shadow-md hover:bg-white/30 transition-colors mr-0 px-px opacity-75">

            <ChevronLeft className="h-[15px] w-[15px] text-white" />
          </button>
          <button
          onClick={goNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/20 backdrop-blur-[10px] border border-white/30 rounded-full shadow-md hover:bg-white/30 transition-colors px-px opacity-75">

            <ChevronRight className="h-[15px] w-[15px] text-white" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {mediaUrls.map((_, index) =>
          <button
            key={index}
            onClick={() => goTo(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              currentIndex === index ? "bg-white" : "bg-white/40"
            )} />

          )}
          </div>
        </>
      }
    </div>);

};