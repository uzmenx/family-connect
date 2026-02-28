import { AppLayout } from '@/components/layout/AppLayout';
import { FamilyTreeV2 } from '@/components/family-v2';
import { TreeRatings } from '@/components/family-v2/TreeRatings';
import { FamilyCalendarSheet } from '@/components/family-v2/FamilyCalendarSheet';

const Relatives = () => {
  return (
    <AppLayout>
      <div className="w-full relative min-h-screen">
        {/* Top controls */}
        <div className="absolute top-2 right-2 z-30 flex items-center gap-2">
          <FamilyCalendarSheet />
          <TreeRatings />
        </div>
        <FamilyTreeV2 />
      </div>
    </AppLayout>
  );
};

export default Relatives;
