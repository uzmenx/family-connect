import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';
import { useNotifications } from '@/hooks/useNotifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const iconStroke = 1.8;

const NavHomeIcon = ({ active, className }: { active: boolean; className?: string }) => (
  <motion.svg
    key={active ? 'home-a' : 'home-i'}
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={iconStroke}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <motion.path
      d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.45 : 0.2, ease: 'easeOut' }}
    />
    <motion.path
      d="M9.5 21.5V14.5h5v7"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.45 : 0.2, delay: active ? 0.05 : 0, ease: 'easeOut' }}
    />
  </motion.svg>
);

const NavFamilyIcon = ({ active, className }: { active: boolean; className?: string }) => (
  <motion.svg
    key={active ? 'family-a' : 'family-i'}
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={iconStroke}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <motion.path
      d="M12 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 12Z"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.45 : 0.2, ease: 'easeOut' }}
    />
    <motion.path
      d="M5.5 21c.4-3.3 3.4-5.8 6.5-5.8s6.1 2.5 6.5 5.8"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.45 : 0.2, delay: active ? 0.05 : 0, ease: 'easeOut' }}
    />
    <motion.path
      d="M15.6 12.9c.9-.9 2.3-.9 3.2 0 .9.9.9 2.3 0 3.2l-1.6 1.6-1.6-1.6c-.9-.9-.9-2.3 0-3.2Z"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.5 : 0.2, delay: active ? 0.08 : 0, ease: 'easeOut' }}
    />
  </motion.svg>
);

const NavUsersIcon = ({ active, className }: { active: boolean; className?: string }) => (
  <motion.svg
    key={active ? 'users-a' : 'users-i'}
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={iconStroke}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <motion.path
      d="M16.5 21c0-2.5-2.2-4.5-4.9-4.5S6.7 18.5 6.7 21"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.45 : 0.2, ease: 'easeOut' }}
    />
    <motion.path
      d="M11.6 13.3a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.45 : 0.2, delay: active ? 0.05 : 0, ease: 'easeOut' }}
    />
  </motion.svg>
);

const NavAddIcon = ({ active, className }: { active: boolean; className?: string }) => (
  <motion.svg
    key={active ? 'add-a' : 'add-i'}
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={iconStroke}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <motion.path
      d="M12 6v12"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.4 : 0.2, ease: 'easeOut' }}
    />
    <motion.path
      d="M6 12h12"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.4 : 0.2, delay: active ? 0.05 : 0, ease: 'easeOut' }}
    />
  </motion.svg>
);

const NavChatIcon = ({ active, className }: { active: boolean; className?: string }) => (
  <motion.svg
    key={active ? 'chat-a' : 'chat-i'}
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={iconStroke}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <motion.path
      d="M20 14.5a4.5 4.5 0 0 1-4.5 4.5H9l-4.5 2V7.5A4.5 4.5 0 0 1 9 3h6.5A4.5 4.5 0 0 1 20 7.5v7Z"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.45 : 0.2, ease: 'easeOut' }}
    />
    <motion.path
      d="M8.5 9.5h7"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.35 : 0.2, delay: active ? 0.05 : 0, ease: 'easeOut' }}
    />
  </motion.svg>
);

const NavProfileIcon = ({ active, className }: { active: boolean; className?: string }) => (
  <motion.svg
    key={active ? 'profile-a' : 'profile-i'}
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={iconStroke}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <motion.path
      d="M12 12.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.45 : 0.2, ease: 'easeOut' }}
    />
    <motion.path
      d="M20 21a8 8 0 0 0-16 0"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: active ? 0.45 : 0.2, delay: active ? 0.05 : 0, ease: 'easeOut' }}
    />
  </motion.svg>
);

export const BottomNav = () => {
  const location = useLocation();
  const { totalUnread } = useConversations();
  const { unreadCount: notifUnread } = useNotifications();
  const { t } = useLanguage();
  const { profile } = useAuth();

  const navItems = [
    { icon: NavHomeIcon, label: t('home'), path: '/' },
    { icon: NavFamilyIcon, label: t('relativesNav'), path: '/relatives' },
    { icon: NavAddIcon, label: t('addNav'), path: '/create' },
    { icon: NavChatIcon, label: t('messagesNav'), path: '/messages', badgeType: 'messages' as const },
    { icon: NavProfileIcon, label: t('profileNav'), path: '/profile' },
  ];

  const getBadgeCount = (badgeType?: 'messages' | 'notifications') => {
    if (badgeType === 'messages') return totalUnread;
    if (badgeType === 'notifications') return notifUnread;
    return 0;
  };

  return (
    <nav className="fixed bottom-1 left-3 right-3 z-[70]">
      <div className="isolate h-[52px] max-w-lg mx-auto rounded-2xl bg-background/20 backdrop-blur-2xl border border-white/8 shadow-lg flex items-center justify-around px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const badgeCount = getBadgeCount(item.badgeType);
          const Icon = item.icon;
          const isProfileItem = item.path === '/profile';
          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl min-w-[48px]">
              <motion.div
                className={cn(
                  "relative flex items-center justify-center transition-colors duration-200",
                  isProfileItem
                    ? "mix-blend-normal"
                    : (isActive ? "text-primary" : "text-white mix-blend-difference")
                )}
                whileTap={isActive ? { scale: 0.92 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                {isProfileItem ?
                <div className={cn(
                  "rounded-full p-[1px] transition-colors",
                  isActive ? "bg-primary" : "bg-transparent"
                )}>
                    <div className={cn("rounded-full", isActive ? "p-[1px]" : "p-0")}>
                      <Avatar className={cn(
                        "h-5 w-5",
                        isActive ? "ring-2 ring-primary ring-offset-1 ring-offset-transparent" : "ring-0"
                      )}>
                        <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                        <AvatarFallback className="text-[10px]">
                        {(profile?.name || profile?.username || 'P')[0]}
                      </AvatarFallback>
                      </Avatar>
                    </div>
                  </div> :
                <Icon
                  active={isActive}
                  className={cn("h-5 w-5", item.path === '/create' && "h-[22px] w-[22px]")}
                />
                }
                {badgeCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1.5 -right-2 z-20 h-3.5 w-3.5 p-0 flex items-center justify-center text-[8px] min-w-3.5 border border-background/40"
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Badge>
                )}
              </motion.div>
              <span className={cn(
                "text-[10px] leading-tight transition-all duration-200 text-center",
                isProfileItem
                  ? (isActive ? "font-semibold text-primary" : "text-muted-foreground")
                  : (isActive ? "font-semibold text-primary" : "text-white mix-blend-difference")
              )}>
                {isProfileItem ? t('you') : item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
