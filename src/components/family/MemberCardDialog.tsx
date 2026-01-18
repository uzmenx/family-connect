import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FamilyMember } from '@/hooks/useFamilyTree';
import { cn } from '@/lib/utils';
import { Send, Trash2, User } from 'lucide-react';
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

  const handleViewProfile = () => {
    if (member.linked_user_id) {
      navigate(`/user/${member.linked_user_id}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">A'zo ma'lumotlari</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className={cn("rounded-full p-1", colors.ring, "ring-4")}>
            <Avatar className={cn("h-24 w-24 border-2", colors.border)}>
              <AvatarImage src={displayAvatar || undefined} />
              <AvatarFallback className={cn(colors.bg, "text-white text-2xl")}>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center">
            <h3 className="text-xl font-bold">{displayName}</h3>
            <p className="text-muted-foreground">
              {relationLabels[member.relation_type] || member.relation_type}
            </p>
            {member.linked_profile?.username && (
              <p className="text-sm text-muted-foreground">
                @{member.linked_profile.username}
              </p>
            )}
          </div>

          <div className="w-full space-y-2 pt-4">
            {member.linked_user_id ? (
              <Button
                className="w-full"
                onClick={handleViewProfile}
              >
                <User className="h-4 w-4 mr-2" />
                Profilni ko'rish
              </Button>
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
