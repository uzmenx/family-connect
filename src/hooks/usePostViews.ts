import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePostViews = (postId: string, initialCount?: number) => {
  const [viewsCount, setViewsCount] = useState<number>(initialCount ?? 0);
  const [isTracking, setIsTracking] = useState(false);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (initialCount !== undefined) setViewsCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    hasTrackedRef.current = false;
  }, [postId]);

  const trackView = async () => {
    if (!postId || isTracking || hasTrackedRef.current) return;
    setIsTracking(true);
    hasTrackedRef.current = true;
    try {
      // Simply increment local count since views_count column may not exist yet
      setViewsCount(prev => prev + 1);
    } catch (error) {
      console.error('Error tracking view:', error);
    } finally {
      setIsTracking(false);
    }
  };

  return {
    viewsCount,
    setViewsCount,
    trackView,
    isTracking,
    fetchViewsCount: () => {},
  };
};

// Hook for intersection observer to detect when post is visible
export const useIntersectionObserver = (
  elementRef: React.RefObject<Element>,
  onIntersect: () => void,
  options: IntersectionObserverInit = {}
) => {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onIntersect();
          }
        });
      },
      {
        threshold: 0.5,
        ...options
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, onIntersect, options]);
};
