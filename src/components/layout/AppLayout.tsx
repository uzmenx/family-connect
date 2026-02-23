import { ReactNode, useEffect, useState } from 'react';
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
  const [forceHideNav, setForceHideNav] = useState(false);

  // Enable smooth scrolling globally
  useEffect(() => {
    enableSmoothScrolling();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ hide?: boolean } | undefined>;
      setForceHideNav(!!ce.detail?.hide);
    };
    window.addEventListener('app:forceHideNav', handler);
    return () => window.removeEventListener('app:forceHideNav', handler);
  }, []);

  const effectiveShowNav = showNav && !forceHideNav;

  return (
    <div className={cn('min-h-screen', bgClass || 'bg-background')}>
      <div
        className={cn(
          'fixed top-0 left-0 right-0 z-[60] pointer-events-none h-[env(safe-area-inset-top,0px)]',
          bgClass || 'bg-background'
        )}
      />
      <main className={effectiveShowNav ? "pb-20" : ""}>
        {children}
      </main>
      {effectiveShowNav && <BottomNav />}
    </div>
  );
};
