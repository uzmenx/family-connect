import { ReactNode, useEffect } from 'react';
import { BottomNav } from './BottomNav';
import { useTheme } from '@/contexts/ThemeContext';
import { enableSmoothScrolling } from '@/utils/scrollBehavior';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

const bgClassMap: Record<string, string> = {
  none: '',
  aurora: 'bg-aurora',
  sunset: 'bg-sunset',
  ocean: 'bg-ocean',
};

export const AppLayout = ({ children, showNav = true }: AppLayoutProps) => {
  const { bgTheme } = useTheme();
  const bgClass = bgClassMap[bgTheme] || '';

  // Enable smooth scrolling globally
  useEffect(() => {
    enableSmoothScrolling();
  }, []);

  return (
    <div className={cn('min-h-screen', bgClass || 'bg-background')}>
      <div
        className={cn(
          'fixed top-0 left-0 right-0 z-[60] pointer-events-none h-[env(safe-area-inset-top,0px)]',
          bgClass || 'bg-background'
        )}
      />
      <main className={showNav ? "pb-20" : ""}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
};
