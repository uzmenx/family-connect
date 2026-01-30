import { EdgeProps, useInternalNode } from '@xyflow/react';
import { Heart } from 'lucide-react';

const SpouseEdge = ({
  id,
  source,
  target,
  style,
}: EdgeProps) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) {
    return null;
  }

  // Get node dimensions - match FamilyMemberNode avatar size
  const sourceWidth = sourceNode.measured?.width || 80;
  const sourceHeight = sourceNode.measured?.height || 120;
  const targetWidth = targetNode.measured?.width || 80;
  const targetHeight = targetNode.measured?.height || 120;

  // Calculate edge positions (from right side of source to left side of target)
  // Adjust Y to be at avatar center (avatar is 80x80, centered in node)
  const sourceX = sourceNode.internals.positionAbsolute.x + sourceWidth;
  const sourceY = sourceNode.internals.positionAbsolute.y + 40; // Center of 80px avatar
  const targetX = targetNode.internals.positionAbsolute.x;
  const targetY = targetNode.internals.positionAbsolute.y + 40; // Center of 80px avatar

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
        className="animate-pulse"
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
      {/* Glow filter */}
      <defs>
        <filter id={`glow-spouse-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`gradient-spouse-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
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
        style={style}
      />

      {/* Main gradient line */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={`url(#gradient-spouse-${id})`}
        strokeWidth={2.5}
        strokeDasharray="8 4"
        strokeLinecap="round"
        style={style}
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

      {/* Heart at center */}
      <foreignObject
        x={centerX - 16}
        y={centerY - 16}
        width={32}
        height={32}
        className="pointer-events-none overflow-visible"
      >
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center animate-pulse-heart"
          style={{
            background: 'linear-gradient(145deg, hsl(350, 80%, 65%), hsl(0, 75%, 55%))',
            boxShadow: '0 0 20px hsl(350, 80%, 60%), 0 4px 12px hsl(0, 0%, 0%, 0.2)',
          }}
        >
          <Heart className="w-4 h-4 text-white fill-white drop-shadow-sm" />
        </div>
      </foreignObject>
    </g>
  );
};

export default SpouseEdge;
