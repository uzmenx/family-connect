import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useConversations } from '@/hooks/useConversations';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';

interface FollowUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

const Messages = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { conversations, isLoading, totalUnread } = useConversations();
  const [activeTab, setActiveTab] = useState<'chats' | 'followers' | 'following'>('chats');
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user?.id) return;

    const fetchFollowUsers = async () => {
      // Fetch followers
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);

      if (followersData) {
        const followerIds = followersData.map(f => f.follower_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', followerIds);
        setFollowers(profiles || []);
      }

      // Fetch following
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followingData) {
        const followingIds = followingData.map(f => f.following_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', followingIds);
        setFollowing(profiles || []);
      }
    };

    fetchFollowUsers();
  }, [user?.id]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: uz });
  };

  const handleUserClick = (userId: string) => {
    navigate(`/chat/${userId}`);
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const name = conv.otherUser.name?.toLowerCase() || '';
    const username = conv.otherUser.username?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  const filteredFollowers = followers.filter(f => {
    if (!searchQuery) return true;
    const name = f.name?.toLowerCase() || '';
    const username = f.username?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  const filteredFollowing = following.filter(f => {
    if (!searchQuery) return true;
    const name = f.name?.toLowerCase() || '';
    const username = f.username?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  return (
    <AppLayout>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold flex-1">Xabarlar</h1>
            {totalUnread > 0 && (
              <Badge variant="destructive" className="rounded-full">
                {totalUnread}
              </Badge>
            )}
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="w-full rounded-none border-b bg-transparent p-0">
              <TabsTrigger 
                value="chats" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Chatlar
              </TabsTrigger>
              <TabsTrigger 
                value="followers" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Kuzatuvchilar
              </TabsTrigger>
              <TabsTrigger 
                value="following" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Kuzatilmoqda
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        <div className="divide-y divide-border">
          {activeTab === 'chats' && (
            <>
              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Yuklanmoqda...</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Hozircha chatlar yo'q</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Kuzatuvchilar yoki Kuzatilmoqda bo'limidan chat boshlang
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => handleUserClick(conv.otherUser.id)}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conv.otherUser.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(conv.otherUser.name)}</AvatarFallback>
                      </Avatar>
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold truncate">
                          {conv.otherUser.name || conv.otherUser.username || 'Foydalanuvchi'}
                        </h3>
                        {conv.lastMessage && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(conv.lastMessage.created_at)}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                          {conv.lastMessage.sender_id === user?.id ? 'Siz: ' : ''}
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'followers' && (
            <>
              {filteredFollowers.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-muted-foreground">Kuzatuvchilar yo'q</p>
                </div>
              ) : (
                filteredFollowers.map((follower) => (
                  <div
                    key={follower.id}
                    onClick={() => handleUserClick(follower.id)}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={follower.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(follower.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {follower.name || 'Foydalanuvchi'}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        @{follower.username || 'username'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Xabar
                    </Button>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'following' && (
            <>
              {filteredFollowing.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-muted-foreground">Hech kimni kuzatmayapsiz</p>
                </div>
              ) : (
                filteredFollowing.map((following) => (
                  <div
                    key={following.id}
                    onClick={() => handleUserClick(following.id)}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={following.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(following.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {following.name || 'Foydalanuvchi'}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        @{following.username || 'username'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Xabar
                    </Button>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Messages;
