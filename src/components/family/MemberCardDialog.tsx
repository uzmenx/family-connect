import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FamilyMember } from '@/hooks/useFamilyTree';
import { cn } from '@/lib/utils';
import { Send, Trash2, User, MessageCircle, Link as LinkIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Relation labels mapping
const relationLabels: Record<string, string> = {
  father: 'Ota',
  mother: 'Ona',
  grandfather: 'Bobo',
  grandmother: 'Momo',
  brother: 'Aka',
  younger_brother: 'Ukasi',
  sister: 'Opa',
  younger_sister: 'Singil',
  son: "O'g'il",
  daughter: 'Qiz',
  husband: 'Er',
  wife: 'Xotin',
  uncle: "Tog'a/Amaki",
  aunt: 'Xola/Amma',
  nephew: 'Jiyan',
  niece: 'Jiyan',
  grandson: 'Nevara',
  granddaughter: 'Nevara',
  sibling: 'Aka/Uka/Opa/Singil',
  child: 'Farzand',
  spouse: "Turmush o'rtog'i",
  grandparent: 'Buvi/Bobiyo',
  grandchild: 'Nevara',
  cousin: 'Amakivachcha',
};

interface MemberCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: FamilyMember | null;
  isOwner: boolean;
  onSendInvitation: () => void;
  onDelete: () => void;
}

export const MemberCardDialog = ({
  open,
  onOpenChange,
  member,
  isOwner,
  onSendInvitation,
  onDelete,
}: MemberCardDialogProps) => {
  const navigate = useNavigate();

  if (!member) return null;

  const getGenderColors = (gender: 'male' | 'female' | null | undefined) => {
    if (gender === 'male') {
      return { ring: 'ring-sky-400', bg: 'bg-sky-500', border: 'border-sky-400' };
    } else if (gender === 'female') {
      return { ring: 'ring-pink-400', bg: 'bg-pink-500', border: 'border-pink-400' };
    }
    return { ring: 'ring-muted', bg: 'bg-muted', border: 'border-muted' };
  };

  const colors = getGenderColors(member.gender || member.linked_profile?.gender as any);
  const displayName = member.linked_profile?.name || member.member_name;
  const displayAvatar = member.linked_profile?.avatar_url || member.avatar_url;
  const isLinked = !!member.linked_user_id;

  const handleViewProfile = () => {
    if (member.linked_user_id) {
      navigate(`/user/${member.linked_user_id}`);
      onOpenChange(false);
    }
  };

  const handleSendMessage = () => {
    if (member.linked_user_id) {
      navigate(`/chat/${member.linked_user_id}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>A'zo ma'lumotlari</DialogTitle>
        </DialogHeader>

        {/* Header background */}
        <div className="h-24 bg-gradient-to-b from-emerald-500/30 via-teal-500/30 to-green-500/30" />
        
        {/* Avatar - overlapping header */}
        <div className="flex flex-col items-center -mt-14 pb-4 px-4">
          <div className={cn("rounded-full p-1 bg-background", colors.ring, "ring-4")}>
            <Avatar className={cn("h-24 w-24 border-2", colors.border)}>
              <AvatarImage src={displayAvatar || undefined} />
              <AvatarFallback className={cn(colors.bg, "text-white text-2xl")}>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Name and relation */}
          <div className="text-center mt-3">
            <h3 className="text-xl font-bold">{displayName}</h3>
            <Badge variant="secondary" className="mt-1">
              {relationLabels[member.relation_type] || member.relation_type}
            </Badge>
            {member.linked_profile?.username && (
              <p className="text-sm text-muted-foreground mt-1">
                @{member.linked_profile.username}
              </p>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 mt-3">
            {isLinked ? (
              <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                <LinkIcon className="h-3 w-3 mr-1" />
                Ulangan
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30">
                Bo'sh profil
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="w-full space-y-2 mt-6">
            {isLinked ? (
              <>
                <Button
                  className="w-full"
                  onClick={handleViewProfile}
                >
                  <User className="h-4 w-4 mr-2" />
                  Profilni ko'rish
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSendMessage}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Xabar yuborish
                </Button>
              </>
            ) : isOwner ? (
              <Button
                className="w-full"
                onClick={() => {
                  onSendInvitation();
                  onOpenChange(false);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Taklifnoma yuborish
              </Button>
            ) : null}

            {isOwner && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  onDelete();
                  onOpenChange(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                O'chirish
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
