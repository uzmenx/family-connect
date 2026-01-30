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

  // Create organic curved path with slight wave
  const controlOffset = 15;
  const path = `
    M ${sourceX} ${sourceY}
    C ${sourceX + 20} ${sourceY - controlOffset},
      ${targetX - 20} ${targetY + controlOffset},
      ${targetX} ${targetY}
  `;

  // Generate animated dots along the path
  const dots = [];
  const numDots = 5;
  for (let i = 0; i < numDots; i++) {
    dots.push(
      <circle
        key={`dot-${id}-${i}`}
        r="2.5"
        fill="hsl(350, 70%, 65%)"
        opacity={0.8}
      >
        <animateMotion
          dur={`${2 + i * 0.3}s`}
          repeatCount="indefinite"
          begin={`${i * 0.4}s`}
        >
          <mpath href={`#path-${id}`} />
        </animateMotion>
      </circle>
    );
  }

  return (
    <g>
      {/* Glow filter and gradient definitions */}
      <defs>
        <filter id={`glow-spouse-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`couple-gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(350, 80%, 70%)" />
          <stop offset="50%" stopColor="hsl(0, 85%, 65%)" />
          <stop offset="100%" stopColor="hsl(350, 80%, 70%)" />
        </linearGradient>
      </defs>

      {/* Hidden path for motion */}
      <path
        id={`path-${id}`}
        d={path}
        fill="none"
        stroke="none"
      />

      {/* Background glow line */}
      <path
        d={path}
        fill="none"
        stroke="hsl(350, 70%, 60%)"
        strokeWidth={6}
        strokeOpacity={0.3}
        filter={`url(#glow-spouse-${id})`}
        strokeLinecap="round"
      />

      {/* Main gradient line with animated dash */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={`url(#couple-gradient-${id})`}
        strokeWidth={2.5}
        strokeDasharray="8 4"
        strokeLinecap="round"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-24"
          dur="1s"
          repeatCount="indefinite"
        />
      </path>

      {/* Animated particles */}
      {dots}

      {/* Heart at center with pulse animation */}
      <foreignObject
        x={centerX - 16}
        y={centerY - 16}
        width={32}
        height={32}
        className="pointer-events-none overflow-visible"
      >
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(145deg, hsl(350, 80%, 65%), hsl(0, 75%, 55%))',
            boxShadow: '0 0 20px hsl(350, 80%, 60%), 0 4px 12px hsl(0, 0%, 0%, 0.2)',
            animation: 'pulse-heart 1.5s ease-in-out infinite',
          }}
        >
          <Heart className="w-4 h-4 text-white fill-white drop-shadow-sm" />
        </div>
      </foreignObject>
    </g>
  );
};
