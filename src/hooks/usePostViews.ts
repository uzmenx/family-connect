import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePostViews = (postId: string, initialCount?: number) => {
  const [viewsCount, setViewsCount] = useState<number>(initialCount ?? 0);
  const [isTracking, setIsTracking] = useState(false);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (initialCount !== undefined) setViewsCount(initialCount);
  }, [initialCount]);

  const fetchViewsCount = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('views_count')
        .eq('id', postId)
        .single();
      if (!error && data?.views_count != null) {
        setViewsCount(data.views_count);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchViewsCount();
  }, [postId]);

  useEffect(() => {
    hasTrackedRef.current = false;
  }, [postId]);

  const trackView = async () => {
    if (!postId || isTracking || hasTrackedRef.current) return;
    setIsTracking(true);
    hasTrackedRef.current = true;
    try {
      const { data, error } = await supabase.rpc('increment_post_views', {
        post_id: postId,
      });
      if (!error && typeof data === 'number') {
        setViewsCount(data);
      }
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
    fetchViewsCount,
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
