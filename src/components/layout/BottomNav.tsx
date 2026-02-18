import { Home, Users, PlusCircle, MessageCircle, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Users, label: 'Relatives', path: '/relatives' },
  { icon: PlusCircle, label: 'Add', path: '/create' },
  { icon: MessageCircle, label: 'Messages', path: '/messages', badgeType: 'messages' as const },
  { icon: User, label: 'Profile', path: '/profile' },
];

export const BottomNav = () => {
  const location = useLocation();
  const { totalUnread } = useConversations();
  const { unreadCount: notifUnread } = useNotifications();

  const getBadgeCount = (badgeType?: 'messages' | 'notifications') => {
    if (badgeType === 'messages') return totalUnread;
    if (badgeType === 'notifications') return notifUnread;
    return 0;
  };

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50">
      <div className="h-16 max-w-lg mx-auto rounded-2xl bg-background/30 backdrop-blur-xl border border-white/10 shadow-xl flex items-center justify-center py-0 my-0 gap-1 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const badgeCount = getBadgeCount(item.badgeType);
          const Icon = item.icon;
          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center gap-1 p-2 rounded-xl min-w-[56px]">
              <motion.div
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-full transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-glow"
                    className="absolute inset-0 rounded-full bg-primary/30 shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                    style={{ padding: 4 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <motion.span
                  className="relative z-10 flex items-center justify-center"
                  animate={{
                    scale: isActive ? 1.1 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Icon className={cn("h-6 w-6", item.path === '/create' && "h-7 w-7")} />
                </motion.span>
                {badgeCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 z-20 h-4 w-4 p-0 flex items-center justify-center text-[10px] min-w-4 border-2 border-background/40"
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Badge>
                )}
              </motion.div>
              <span
                className={cn(
                  "text-xs transition-all duration-200 text-center",
                  isActive && "font-semibold text-primary"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};