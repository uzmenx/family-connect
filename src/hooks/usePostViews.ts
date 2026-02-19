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
      // Call the database function to increment views
      const { data, error } = await supabase.rpc('increment_post_views', {
        post_id: postId
      });

      if (error) {
        console.error('Error incrementing views:', error);
        return;
      }

      // Update local state with new count
      if (data !== null && typeof data === 'number') {
        setViewsCount(data);
      }
    } catch (error) {
      console.error('Error tracking view:', error);
    } finally {
      setIsTracking(false);
    }
  };

  // Fetch current views count
  const fetchViewsCount = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('views_count')
        .eq('id', postId)
        .single();

      if (error) {
        console.error('Error fetching views count:', error);
        return;
      }

      if (data && data.views_count !== null) {
        setViewsCount(data.views_count);
      }
    } catch (error) {
      console.error('Error fetching views count:', error);
    }
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
