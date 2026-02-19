import { Home, Users, PlusCircle, MessageCircle, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';
import { useNotifications } from '@/hooks/useNotifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';

export const BottomNav = () => {
  const location = useLocation();
  const { totalUnread } = useConversations();
  const { unreadCount: notifUnread } = useNotifications();
  const { t } = useLanguage();

  const navItems = [
    { icon: Home, label: t('home'), path: '/' },
    { icon: Users, label: t('relativesNav'), path: '/relatives' },
    { icon: PlusCircle, label: t('addNav'), path: '/create' },
    { icon: MessageCircle, label: t('messagesNav'), path: '/messages', badgeType: 'messages' as const },
    { icon: User, label: t('profileNav'), path: '/profile' },
  ];

  const getBadgeCount = (badgeType?: 'messages' | 'notifications') => {
    if (badgeType === 'messages') return totalUnread;
    if (badgeType === 'notifications') return notifUnread;
    return 0;
  };

  return (
    <nav className="fixed bottom-1 left-3 right-3 z-50">
      <div className="h-[52px] max-w-lg mx-auto rounded-2xl bg-background/20 backdrop-blur-2xl border border-white/8 shadow-lg flex items-center justify-around px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const badgeCount = getBadgeCount(item.badgeType);
          const Icon = item.icon;
          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl min-w-[48px]">
              <motion.div
                className={cn(
                  "relative flex items-center justify-center transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Icon className={cn("h-5 w-5", item.path === '/create' && "h-[22px] w-[22px]")} />
                {badgeCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1.5 -right-2 z-20 h-3.5 w-3.5 p-0 flex items-center justify-center text-[8px] min-w-3.5 border border-background/40"
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Badge>
                )}
              </motion.div>
              <span className={cn("text-[10px] leading-tight transition-all duration-200 text-center", isActive ? "font-semibold text-primary" : "text-muted-foreground")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
