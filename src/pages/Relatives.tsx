import { AppLayout } from '@/components/layout/AppLayout';
import { FamilyTreeV2 } from '@/components/family-v2';

const Relatives = () => {
  return (
    <AppLayout>
      <div className="max-w-full mx-auto relative min-h-screen bg-gradient-to-b from-emerald-50 via-teal-50 to-green-50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-green-950/20">
        <FamilyTreeV2 />
      </div>
    </AppLayout>
  );
};

export default Relatives;
