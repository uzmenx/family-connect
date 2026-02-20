import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePostViews = (postId: string) => {
  const [viewsCount, setViewsCount] = useState<number>(0);
  const [isTracking, setIsTracking] = useState(false);
  const hasTrackedRef = useRef(false);

  // Increment view count when post becomes visible
  const trackView = async () => {
    if (isTracking || hasTrackedRef.current) return;
    
    setIsTracking(true);
    hasTrackedRef.current = true;

    try {
      // Views tracking is a no-op until the DB function and column exist
      console.log('View tracking skipped - not yet configured');
    } catch (error) {
      console.error('Error tracking view:', error);
    } finally {
      setIsTracking(false);
    }
  };

  // Fetch current views count
  const fetchViewsCount = async () => {
    // views_count column doesn't exist yet, skip
  };

  useEffect(() => {
    fetchViewsCount();
  }, [postId]);

  return {
    viewsCount,
    trackView,
    isTracking
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
        threshold: 0.5, // Trigger when 50% of element is visible
        ...options
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, onIntersect, options]);
};
