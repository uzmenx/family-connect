import { BaseEdge, EdgeProps, getStraightPath } from '@xyflow/react';
import { Heart } from 'lucide-react';

export const CoupleEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
}: EdgeProps) => {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  // Calculate center point for heart
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge 
        id={id} 
        path={edgePath} 
        style={{
          ...style,
          stroke: 'hsl(350, 70%, 55%)',
          strokeWidth: 2,
          strokeDasharray: '6 4',
        }} 
      />
      {/* Heart icon at center */}
      <foreignObject
        x={centerX - 10}
        y={centerY - 10}
        width={20}
        height={20}
        className="overflow-visible pointer-events-none"
      >
        <div className="w-5 h-5 flex items-center justify-center">
          <Heart className="w-4 h-4 fill-red-500 text-red-500 animate-pulse" />
        </div>
      </foreignObject>
    </>
  );
};
