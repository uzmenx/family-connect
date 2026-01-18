import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FamilyInvitation } from '@/hooks/useFamilyTree';
import { Check, X } from 'lucide-react';

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

interface InvitationCardProps {
  invitation: FamilyInvitation;
  onAccept: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export const InvitationCard = ({
  invitation,
  onAccept,
  onReject,
  isLoading,
}: InvitationCardProps) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={invitation.sender_profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {invitation.sender_profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {invitation.sender_profile?.name || 'Foydalanuvchi'}
            </p>
            <p className="text-sm text-muted-foreground">
              Sizni <span className="font-medium text-foreground">
                {relationLabels[invitation.relation_type] || invitation.relation_type}
              </span> sifatida oila daraxtiga taklif qilmoqda
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={onReject}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-1" />
            Rad etish
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-green-500 hover:bg-green-600"
            onClick={onAccept}
            disabled={isLoading}
          >
            <Check className="h-4 w-4 mr-1" />
            Qabul qilish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
