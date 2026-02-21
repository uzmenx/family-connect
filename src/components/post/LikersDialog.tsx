import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LikeUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface LikersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: LikeUser[];
  likesCount: number;
}

export const LikersDialog = ({ open, onOpenChange, users, likesCount }: LikersDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm screen-likes">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Yoqtirishlar
            <span className="likes-bg-soft likes-accent text-xs font-semibold px-2 py-0.5 rounded-full">
              {likesCount}
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px]">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Hozircha yoqtirishlar yo'q
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="likes-bg-soft likes-accent">
                      {user.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.name || 'Foydalanuvchi'}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user.username || 'user'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
