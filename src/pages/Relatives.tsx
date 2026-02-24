import { AppLayout } from '@/components/layout/AppLayout';
import { FamilyTreeV2 } from '@/components/family-v2';

const Relatives = () => {
  return (
    <AppLayout>
      <div className="w-full relative min-h-screen">
        <FamilyTreeV2 />
      </div>
    </AppLayout>
  );
};

export default Relatives;
