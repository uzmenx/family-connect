import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, X, Users, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserResult {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface PostResult {
  id: string;
  content: string | null;
  media_urls: string[] | null;
  created_at: string;
  user_id: string;
  profile?: UserResult;
}

export const SearchSheet = ({ open, onOpenChange }: SearchSheetProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'users' | 'posts'>('users');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUsers([]);
      setPosts([]);
      return;
    }
    setIsLoading(true);
    try {
      const searchTerm = `%${q.trim()}%`;

      const [usersRes, postsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, name, avatar_url')
          .or(`username.ilike.${searchTerm},name.ilike.${searchTerm}`)
          .limit(20),
        supabase
          .from('posts')
          .select('id, content, media_urls, created_at, user_id')
          .ilike('content', searchTerm)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setUsers(usersRes.data || []);
      
      const postData = postsRes.data || [];
      if (postData.length > 0) {
        const userIds = [...new Set(postData.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, name, avatar_url')
          .in('id', userIds);
        
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        setPosts(postData.map(p => ({ ...p, profile: profileMap.get(p.user_id) })));
      } else {
        setPosts([]);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setUsers([]);
      setPosts([]);
    }
  }, [open]);

  const goToUser = (userId: string) => {
    onOpenChange(false);
    navigate(`/user/${userId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-base">Qidirish</SheetTitle>
        </SheetHeader>

        {/* Search input */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ism, username yoki post qidiring..."
              className="pl-9 pr-9 h-10 rounded-xl"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'users' | 'posts')} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mb-2 grid grid-cols-2 h-9">
            <TabsTrigger value="users" className="text-xs gap-1">
              <Users className="h-3.5 w-3.5" />
              Odamlar {users.length > 0 && `(${users.length})`}
            </TabsTrigger>
            <TabsTrigger value="posts" className="text-xs gap-1">
              <FileText className="h-3.5 w-3.5" />
              Postlar {posts.length > 0 && `(${posts.length})`}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-4">
            <TabsContent value="users" className="mt-0 space-y-1">
              {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Qidirilmoqda...</p>}
              {!isLoading && query && users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Hech narsa topilmadi</p>
              )}
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => goToUser(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback>{(u.name || u.username || 'U')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{u.name || u.username}</p>
                    {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                  </div>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="posts" className="mt-0 space-y-1">
              {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Qidirilmoqda...</p>}
              {!isLoading && query && posts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Hech narsa topilmadi</p>
              )}
              {posts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onOpenChange(false); /* could navigate to post */ }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  {p.media_urls?.[0] && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img src={p.media_urls[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={p.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px]">U</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">@{p.profile?.username || '...'}</span>
                    </div>
                    {p.content && (
                      <p className="text-xs mt-0.5 truncate">{p.content}</p>
                    )}
                  </div>
                </button>
              ))}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
