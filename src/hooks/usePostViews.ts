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

  const fetchViewsCount = async () => {
    if (!postId) return;
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('views_count')
        .eq('id', postId)
        .single();
      if (!error && data) {
        setViewsCount((data as any).views_count ?? 0);
      }
    } catch (e) {
      // ignore
    }
  };

  const trackView = async () => {
    if (!postId || isTracking || hasTrackedRef.current) return;
    setIsTracking(true);
    hasTrackedRef.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setViewsCount(prev => prev + 1);
        return;
      }
      const { error } = await supabase
        .from('post_views')
        .insert({ post_id: postId, user_id: user.id });
      
      if (!error) {
        setViewsCount(prev => prev + 1);
      }
      // If unique constraint violation, user already viewed - that's fine
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
