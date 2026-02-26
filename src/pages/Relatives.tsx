import { AppLayout } from '@/components/layout/AppLayout';
import { FamilyTreeV2 } from '@/components/family-v2';
import { TreeRatings } from '@/components/family-v2/TreeRatings';

const Relatives = () => {
  return (
    <AppLayout>
      <div className="w-full relative min-h-screen">
        {/* Rating button at top */}
        <div className="absolute top-2 right-2 z-30">
          <TreeRatings />
        </div>
        <FamilyTreeV2 />
      </div>
    </AppLayout>
  );
};

export default Relatives;
