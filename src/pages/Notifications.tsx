import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';

const Notifications = () => {
  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border p-4 z-40">
          <h1 className="text-xl font-bold">Bildirishnomalar</h1>
        </header>
        
        <div className="p-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Hozircha bildirishnomalar yo'q</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Notifications;
