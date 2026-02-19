import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Search, X, User, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserResult {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface UserSearchPickerProps {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  title: string;
  maxSelection?: number;
}

export const UserSearchPicker = ({
  open,
  onClose,
  selectedIds,
  onSelectionChange,
  title,
  maxSelection = 10,
}: UserSearchPickerProps) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load selected users info on open
  useEffect(() => {
    if (open && selectedIds.length > 0) {
      supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', selectedIds)
        .then(({ data }) => {
          if (data) setSelectedUsers(data);
        });
    }
  }, [open, selectedIds]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
          .neq('id', user?.id || '')
          .limit(20);
        setResults(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, user?.id]);

  const toggleUser = (u: UserResult) => {
    const isSelected = selectedIds.includes(u.id);
    if (isSelected) {
      const next = selectedIds.filter(id => id !== u.id);
      onSelectionChange(next);
      setSelectedUsers(prev => prev.filter(p => p.id !== u.id));
    } else if (selectedIds.length < maxSelection) {
      onSelectionChange([...selectedIds, u.id]);
      setSelectedUsers(prev => [...prev, u]);
    }
  };

  const renderUser = (u: UserResult) => {
    const isSelected = selectedIds.includes(u.id);
    return (
      <button
        key={u.id}
        onClick={() => toggleUser(u)}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
          isSelected ? "bg-primary/10" : "hover:bg-muted"
        )}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={u.avatar_url || undefined} />
          <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
        </Avatar>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium truncate">{u.name || 'Foydalanuvchi'}</p>
          <p className="text-xs text-muted-foreground truncate">@{u.username || 'user'}</p>
        </div>
        {isSelected && (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        )}
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="mt-3 space-y-3">
          {/* Selected chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.filter(u => selectedIds.includes(u.id)).map(u => (
                <div
                  key={u.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-full text-sm"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">{u.name || u.username}</span>
                  <button onClick={() => toggleUser(u)} className="ml-0.5">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ism yoki username qidiring..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="overflow-y-auto max-h-[50vh] space-y-1">
            {isSearching && <p className="text-center text-sm text-muted-foreground py-4">Qidirilmoqda...</p>}
            {!isSearching && query && results.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">Topilmadi</p>
            )}
            {results.map(renderUser)}
          </div>

          <Button onClick={onClose} className="w-full">
            Tayyor ({selectedIds.length})
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
