import { Home, Users, PlusCircle, MessageCircle, User, Bell } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Users, label: 'Relatives', path: '/relatives' },
  { icon: PlusCircle, label: 'Add', path: '/create-post' },
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
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto rounded-2xl bg-background/60 backdrop-blur-xl border border-border/30 shadow-lg">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const badgeCount = getBadgeCount(item.badgeType);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 relative",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <item.icon 
                  className={cn(
                    "h-6 w-6 transition-transform duration-200", 
                    item.path === '/create-post' && "h-7 w-7",
                    isActive && "scale-110"
                  )} 
                />
                {badgeCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px] min-w-4 border-2 border-background/60"
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-xs transition-all duration-200",
                isActive && "font-medium"
              )}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
