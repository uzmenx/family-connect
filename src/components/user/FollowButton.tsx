import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface FollowButtonProps {
  targetUserId: string;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export const FollowButton = ({ targetUserId, size = 'default', className }: FollowButtonProps) => {
  const { user } = useAuth();
  const { isFollowing, isLoading, toggleFollow } = useFollow(targetUserId);
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (user?.id === targetUserId) return null;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples((p) => [...p, { x, y, id }]);
      setTimeout(() => setRipples((p) => p.filter((r) => r.id !== id)), 600);
    }
    toggleFollow();
  };

  return (
    <Button
      ref={btnRef}
      variant={isFollowing ? "default" : "outline"}
      size={size}
      onClick={handleClick}
      disabled={isLoading || !user}
      className={cn(
        "min-w-[100px] relative overflow-hidden transition-all duration-300",
        isFollowing
          ? "bg-primary hover:bg-primary/90"
          : "border-primary text-primary hover:bg-primary/10 hover:border-primary/80 hover:text-primary",
        className
      )}
    >
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          className="absolute rounded-full bg-white/40"
          style={{ left: r.x, top: r.y, width: 8, height: 8, marginLeft: -4, marginTop: -4 }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 25, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        "Kuzatilmoqda"
      ) : (
        "Kuzatish"
      )}
    </Button>
  );
};
