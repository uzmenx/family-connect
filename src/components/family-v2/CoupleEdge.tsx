import { EdgeProps, useStore } from '@xyflow/react';
import { Heart } from 'lucide-react';

export const CoupleEdge = ({
  id,
  source,
  target,
}: EdgeProps) => {
  // Subscribe to node changes to get real-time positions
  const sourceNode = useStore((state) => state.nodeLookup.get(source));
  const targetNode = useStore((state) => state.nodeLookup.get(target));
  
  if (!sourceNode || !targetNode) return null;
  
  // Node dimensions
  const nodeWidth = 80;
  const nodeHeight = 80;
  
  // Calculate edge positions at the sides of the avatar circles
  const sourceX = sourceNode.position.x + nodeWidth; // Right side of male
  const sourceY = sourceNode.position.y + nodeHeight / 2;
  
  const targetX = targetNode.position.x; // Left side of female
  const targetY = targetNode.position.y + nodeHeight / 2;
  
  // Calculate center point for heart
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;

  // Create smooth curved path for couple connection
  const controlOffset = Math.abs(targetX - sourceX) * 0.2;
  const path = `
    M ${sourceX} ${sourceY}
    Q ${sourceX + controlOffset} ${centerY},
      ${centerX} ${centerY}
    Q ${targetX - controlOffset} ${centerY},
      ${targetX} ${targetY}
  `;

  return (
    <>
      <defs>
        <linearGradient id={`couple-gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(350, 75%, 60%)" stopOpacity="0.8" />
          <stop offset="50%" stopColor="hsl(350, 80%, 55%)" />
          <stop offset="100%" stopColor="hsl(350, 75%, 60%)" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      {/* Glow layer */}
      <path
        d={path}
        fill="none"
        stroke="hsl(350, 70%, 55%)"
        strokeWidth="5"
        strokeOpacity="0.2"
        strokeLinecap="round"
      />
      {/* Dashed couple line */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={`url(#couple-gradient-${id})`}
        strokeWidth="2"
        strokeDasharray="8 5"
        strokeLinecap="round"
        style={{
          filter: 'drop-shadow(0 0 2px hsl(350, 70%, 55% / 0.4))',
        }}
      />
      {/* Heart icon at center */}
      <foreignObject
        x={centerX - 14}
        y={centerY - 14}
        width={28}
        height={28}
        className="overflow-visible pointer-events-none"
      >
        <div className="w-7 h-7 flex items-center justify-center bg-card rounded-full shadow-lg border-2 border-destructive/50">
          <Heart className="w-4 h-4 fill-destructive text-destructive" />
        </div>
      </foreignObject>
    </>
  );
};
