import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FamilyMember } from '@/hooks/useFamilyTree';
import { cn } from '@/lib/utils';
import { Check, Plus, User } from 'lucide-react';

interface SelectMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: FamilyMember[];
  onSelectMember: (member: FamilyMember) => void;
  onCreateNew: () => void;
  targetUserName: string;
}

export const SelectMemberDialog = ({
  open,
  onOpenChange,
  members,
  onSelectMember,
  onCreateNew,
  targetUserName,
}: SelectMemberDialogProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter only placeholder members (not linked to any user)
  const placeholderMembers = members.filter(m => m.is_placeholder);

  const getGenderColors = (gender: 'male' | 'female' | null | undefined) => {
    if (gender === 'male') {
      return { ring: 'ring-sky-400', bg: 'bg-sky-500' };
    } else if (gender === 'female') {
      return { ring: 'ring-pink-400', bg: 'bg-pink-500' };
    }
    return { ring: 'ring-muted', bg: 'bg-muted' };
  };

  const handleConfirm = () => {
    const member = members.find(m => m.id === selectedId);
    if (member) {
      onSelectMember(member);
      setSelectedId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {targetUserName} uchun profil tanlang
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {placeholderMembers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Oila daraxtingizda bo'sh profil yo'q
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {placeholderMembers.map((member) => {
                const colors = getGenderColors(member.gender);
                const isSelected = selectedId === member.id;

                return (
                  <button
                    key={member.id}
                    onClick={() => setSelectedId(member.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                      isSelected 
                        ? "border-primary bg-primary/10" 
                        : "border-transparent hover:bg-muted"
                    )}
                  >
                    <div className={cn("rounded-full p-0.5 relative", colors.ring, "ring-2")}>
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className={cn(colors.bg, "text-white")}>
                          {member.member_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium text-center truncate w-full">
                      {member.member_name}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCreateNew}
            >
              <Plus className="h-4 w-4 mr-2" />
              Yangi yaratish
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedId}
              onClick={handleConfirm}
            >
              Taklif qilish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
