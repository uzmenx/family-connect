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
      <main className={showNav ? "pb-20" : ""}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
};
