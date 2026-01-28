import { useState } from 'react';
import { Search, Send, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FamilyMember } from '@/types/family';
import { cn } from '@/lib/utils';

interface SendInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember | null;
}

interface SearchResult {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export const SendInvitationModal = ({
  isOpen,
  onClose,
  member,
}: SendInvitationModalProps) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .or(`name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Xato",
        description: "Qidirishda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendInvitation = async (userId: string) => {
    if (!member) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('family_invitations')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          member_id: member.supabaseId || member.id,
          relation_type: 'family_member',
        });

      if (error) throw error;

      toast({
        title: "Yuborildi!",
        description: "Taklifnoma muvaffaqiyatli yuborildi",
      });
      onClose();
    } catch (error: any) {
      console.error('Send invitation error:', error);
      toast({
        title: "Xato",
        description: error.message || "Taklifnoma yuborishda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            Taklifnoma yuborish
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {member && (
            <div className="text-center text-muted-foreground text-sm">
              <span className="font-medium text-foreground">{member.name || "Noma'lum"}</span> uchun foydalanuvchi qidiring
            </div>
          )}

          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ism yoki username kiriting..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {/* Search Results */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {isSearching ? (
              <div className="text-center py-4 text-muted-foreground">
                Qidirilmoqda...
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={result.avatar_url || undefined} />
                      <AvatarFallback>
                        {result.name?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{result.name || "Noma'lum"}</p>
                      {result.username && (
                        <p className="text-sm text-muted-foreground">@{result.username}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSendInvitation(result.id)}
                    disabled={isSending}
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Yuborish
                  </Button>
                </div>
              ))
            ) : searchQuery && !isSearching ? (
              <div className="text-center py-4 text-muted-foreground">
                Foydalanuvchi topilmadi
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
