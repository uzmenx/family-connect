import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Camera, Users, Megaphone, Crown, UserMinus, Link, Copy, Check, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  profile?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'group' | 'channel';
  visibility: 'public' | 'private';
  owner_id: string;
  invite_link: string | null;
}

interface GroupSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupInfo: GroupInfo;
  onGroupUpdated: () => void;
}

export const GroupSettingsSheet = ({ 
  open, 
  onOpenChange, 
  groupInfo,
  onGroupUpdated 
}: GroupSettingsSheetProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(groupInfo.name);
  const [description, setDescription] = useState(groupInfo.description || '');
  const [avatarUrl, setAvatarUrl] = useState(groupInfo.avatar_url || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const isOwner = groupInfo.owner_id === user?.id;

  useEffect(() => {
    if (open) {
      setName(groupInfo.name);
      setDescription(groupInfo.description || '');
      setAvatarUrl(groupInfo.avatar_url || '');
      fetchMembers();
    }
  }, [open, groupInfo]);

  const fetchMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const { data: membersData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupInfo.id);

      if (membersData) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        setMembers(membersData.map(m => ({
          ...m,
          profile: profileMap.get(m.user_id)
        })));
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${groupInfo.id}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('group-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('group-avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Rasm yuklanmadi');
    }
  };

  const handleUpdate = async () => {
    if (!name.trim()) {
      toast.error('Nomni kiriting');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('group_chats')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          avatar_url: avatarUrl || null
        })
        .eq('id', groupInfo.id);

      if (error) throw error;

      toast.success('Ma\'lumotlar yangilandi');
      onGroupUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('A\'zo o\'chirildi');
      fetchMembers();
      onGroupUpdated();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm(`${groupInfo.type === 'group' ? 'Guruh' : 'Kanal'}ni o'chirishni xohlaysizmi?`)) {
      return;
    }

    try {
      // Delete all messages first
      await supabase
        .from('group_messages')
        .delete()
        .eq('group_id', groupInfo.id);

      // Delete all members
      await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupInfo.id);

      // Delete the group
      const { error } = await supabase
        .from('group_chats')
        .delete()
        .eq('id', groupInfo.id);

      if (error) throw error;

      toast.success(`${groupInfo.type === 'group' ? 'Guruh' : 'Kanal'} o'chirildi`);
      navigate('/messages');
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Xatolik yuz berdi');
    }
  };

  const copyInviteLink = async () => {
    if (!groupInfo.invite_link) return;
    
    const fullLink = `${window.location.origin}/join/${groupInfo.invite_link}`;
    await navigator.clipboard.writeText(fullLink);
    setLinkCopied(true);
    toast.success('Havola nusxalandi');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle>
            {groupInfo.type === 'group' ? 'Guruh sozlamalari' : 'Kanal sozlamalari'}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-6">
            {/* Avatar & Name */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-2xl bg-primary/10">
                    {groupInfo.type === 'group' ? (
                      <Users className="h-10 w-10 text-primary" />
                    ) : (
                      <Megaphone className="h-10 w-10 text-primary" />
                    )}
                  </AvatarFallback>
                </Avatar>
                {isOwner && (
                  <label className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Editable fields */}
            {isOwner ? (
              <div className="space-y-4">
                <div>
                  <Label>Nomi</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={groupInfo.type === 'group' ? 'Guruh nomi' : 'Kanal nomi'}
                  />
                </div>
                <div>
                  <Label>Tavsif</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Qisqacha tavsif..."
                    rows={3}
                  />
                </div>
                <Button onClick={handleUpdate} disabled={isUpdating} className="w-full">
                  {isUpdating ? 'Saqlanmoqda...' : 'Saqlash'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{groupInfo.name}</h3>
                {groupInfo.description && (
                  <p className="text-muted-foreground">{groupInfo.description}</p>
                )}
              </div>
            )}

            {/* Invite Link */}
            {groupInfo.visibility === 'public' && groupInfo.invite_link && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Link className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Taklif havolasi</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background p-2 rounded truncate">
                    {window.location.origin}/join/{groupInfo.invite_link}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyInviteLink}
                  >
                    {linkCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Members */}
            <div>
              <h3 className="font-semibold mb-3">A'zolar</h3>
              <div className="space-y-2">
                {/* Owner */}
                <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/5">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      <Crown className="h-4 w-4 text-yellow-500" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Egasi</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.id === groupInfo.owner_id ? 'Siz' : 'Admin'}
                    </p>
                  </div>
                </div>

                {/* Members list */}
                {isLoadingMembers ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Yuklanmoqda...
                  </p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Boshqa a'zolar yo'q
                  </p>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(member.profile?.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {member.profile?.name || 'Foydalanuvchi'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{member.profile?.username || 'username'}
                        </p>
                      </div>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Delete Group */}
            {isOwner && (
              <div className="pt-4 border-t border-border">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDeleteGroup}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {groupInfo.type === 'group' ? 'Guruhni o\'chirish' : 'Kanalni o\'chirish'}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
