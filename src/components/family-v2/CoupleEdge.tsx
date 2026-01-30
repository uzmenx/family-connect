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
  
  // Node dimensions (must match FamilyMemberNode avatar size)
  const nodeWidth = 80;
  const nodeHeight = 80;
  
  // Calculate handle positions (right edge of source, left edge of target)
  const sourceX = sourceNode.position.x + nodeWidth; // Right edge of male avatar
  const sourceY = sourceNode.position.y + nodeHeight / 2; // Center Y
  
  const targetX = targetNode.position.x; // Left edge of female avatar
  const targetY = targetNode.position.y + nodeHeight / 2; // Center Y
  
  // Center point for heart
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;

  // Create path from source to target (straight line through heart)
  const path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;

  // Generate animated dots
  const dots = [];
  const numDots = 3;
  for (let i = 0; i < numDots; i++) {
    dots.push(
      <circle
        key={`dot-couple-${id}-${i}`}
        r="2.5"
        fill="hsl(340, 80%, 60%)"
        opacity={0.9}
      >
        <animateMotion
          dur={`${2 + i * 0.5}s`}
          repeatCount="indefinite"
          begin={`${i * 0.4}s`}
        >
          <mpath href={`#couple-path-${id}`} />
        </animateMotion>
      </circle>
    );
  }

  return (
    <g>
      {/* Definitions */}
      <defs>
        <filter id={`glow-couple-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`couple-gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(340, 70%, 55%)" />
          <stop offset="50%" stopColor="hsl(350, 80%, 60%)" />
          <stop offset="100%" stopColor="hsl(340, 70%, 55%)" />
        </linearGradient>
      </defs>

      {/* Hidden path for motion animation */}
      <path
        id={`couple-path-${id}`}
        d={path}
        fill="none"
        stroke="none"
      />

      {/* Background glow */}
      <path
        d={path}
        fill="none"
        stroke="hsl(340, 60%, 50%)"
        strokeWidth={6}
        strokeOpacity={0.25}
        filter={`url(#glow-couple-${id})`}
        strokeLinecap="round"
      />

      {/* Main gradient line */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={`url(#couple-gradient-${id})`}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      {/* Animated particles */}
      {dots}

      {/* Heart icon in center */}
      <foreignObject
        x={centerX - 14}
        y={centerY - 14}
        width={28}
        height={28}
        className="overflow-visible pointer-events-none"
      >
        <div 
          className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-lg animate-pulse-heart"
          style={{
            boxShadow: '0 0 12px rgba(236, 72, 153, 0.6)',
          }}
        >
          <Heart className="w-4 h-4 text-white fill-white" />
        </div>
      </foreignObject>
    </g>
  );
};
