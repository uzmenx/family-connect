import { BaseEdge, EdgeProps } from '@xyflow/react';
import { Heart } from 'lucide-react';

export const CoupleEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
}: EdgeProps) => {
  // Calculate center point for heart
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;

  // Create smooth curved path for couple connection
  const controlOffset = 20;
  const path = `
    M ${sourceX} ${sourceY}
    Q ${sourceX + controlOffset} ${centerY},
      ${centerX} ${centerY}
    Q ${targetX - controlOffset} ${centerY},
      ${targetX} ${targetY}
  `;

  return (
    <>
      {/* Dashed couple line */}
      <BaseEdge 
        id={id} 
        path={path}
        style={{
          ...style,
          stroke: 'hsl(350, 70%, 55%)',
          strokeWidth: 2,
          strokeDasharray: '8 5',
          strokeLinecap: 'round',
          filter: 'drop-shadow(0 0 2px hsl(350, 70%, 55% / 0.5))',
        }} 
      />
      {/* Heart icon at center */}
      <foreignObject
        x={centerX - 12}
        y={centerY - 12}
        width={24}
        height={24}
        className="overflow-visible pointer-events-none"
      >
        <div className="w-6 h-6 flex items-center justify-center bg-card rounded-full shadow-lg border border-border">
          <Heart className="w-4 h-4 fill-destructive text-destructive animate-pulse" />
        </div>
      </foreignObject>
    </>
  );
};
