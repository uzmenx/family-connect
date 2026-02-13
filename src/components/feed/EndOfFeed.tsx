import { CheckCircle2 } from 'lucide-react';

export const EndOfFeed = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <CheckCircle2 className="h-12 w-12 mb-3 text-primary/50" />
      <p className="font-medium">Bu siz birinchi joylagan post</p>
      <p className="text-sm mt-1">Yangi postlar uchun yuqoriga torting</p>
    </div>);

};