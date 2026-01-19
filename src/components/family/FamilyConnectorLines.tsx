import { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface Connection {
  from: Position;
  to: Position;
  type: 'parent' | 'child' | 'spouse';
  fromMemberId?: string;
  toMemberId?: string;
}

interface FamilyConnectorLinesProps {
  containerRef: React.RefObject<HTMLDivElement>;
  connections: Connection[];
}

// Generate smooth curved path between two points
const generateCurvedPath = (from: Position, to: Position, type: 'parent' | 'child' | 'spouse'): string => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  if (type === 'spouse') {
    // For spouse - simple straight line with slight curve
    const midY = from.y;
    return `M ${from.x} ${from.y} Q ${from.x + dx / 2} ${midY - 10} ${to.x} ${to.y}`;
  }
  
  if (type === 'parent') {
    // For parent - curve going upward from member to parent
    const controlX1 = from.x;
    const controlY1 = from.y - Math.abs(dy) * 0.4;
    const controlX2 = to.x;
    const controlY2 = to.y + Math.abs(dy) * 0.4;
    
    return `M ${from.x} ${from.y} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${to.x} ${to.y}`;
  }
  
  // For child - curve going downward from heart to child
  const controlX1 = from.x;
  const controlY1 = from.y + Math.abs(dy) * 0.4;
  const controlX2 = to.x;
  const controlY2 = to.y - Math.abs(dy) * 0.4;
  
  return `M ${from.x} ${from.y} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${to.x} ${to.y}`;
};

export const FamilyConnectorLines = ({ containerRef, connections }: FamilyConnectorLinesProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.scrollWidth,
          height: containerRef.current.scrollHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, [containerRef, connections]);

  if (connections.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none z-0"
      width={dimensions.width}
      height={dimensions.height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Gradient for parent lines */}
        <linearGradient id="parentLineGradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.3" />
        </linearGradient>
        
        {/* Gradient for child lines */}
        <linearGradient id="childLineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.4" />
        </linearGradient>
        
        {/* Filter for glow effect */}
        <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {connections.map((connection, index) => {
        const path = generateCurvedPath(connection.from, connection.to, connection.type);
        
        return (
          <g key={`connection-${index}`}>
            {/* Shadow/glow path */}
            <path
              d={path}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="3"
              strokeOpacity="0.1"
              strokeLinecap="round"
            />
            
            {/* Main path */}
            <path
              d={path}
              fill="none"
              stroke={connection.type === 'child' ? 'url(#childLineGradient)' : 'url(#parentLineGradient)'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={connection.type === 'spouse' ? '0' : '0'}
              className="transition-all duration-300"
            />
          </g>
        );
      })}
    </svg>
  );
};

// Hook to calculate connection positions
export const useConnectionPositions = (
  containerRef: React.RefObject<HTMLDivElement>,
  memberElements: Map<string, HTMLElement | null>,
  members: any[],
  heartElements: Map<string, HTMLElement | null>
) => {
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    const calculateConnections = () => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newConnections: Connection[] = [];

      // Calculate parent connections
      members.forEach((member) => {
        const memberEl = memberElements.get(member.id);
        if (!memberEl) return;

        const memberRect = memberEl.getBoundingClientRect();
        const memberCenter = {
          x: memberRect.left - containerRect.left + memberRect.width / 2,
          y: memberRect.top - containerRect.top,
        };

        // Find fathers of this member
        const fathers = members.filter(m => 
          m.relation_type === `father_of_${member.id}` || 
          m.relation_type === `father_2_of_${member.id}`
        );

        fathers.forEach((father) => {
          const fatherEl = memberElements.get(father.id);
          if (fatherEl) {
            const fatherRect = fatherEl.getBoundingClientRect();
            newConnections.push({
              from: memberCenter,
              to: {
                x: fatherRect.left - containerRect.left + fatherRect.width / 2,
                y: fatherRect.top - containerRect.top + fatherRect.height,
              },
              type: 'parent',
              fromMemberId: member.id,
              toMemberId: father.id,
            });
          }
        });

        // Find mothers of this member
        const mothers = members.filter(m => 
          m.relation_type === `mother_of_${member.id}` || 
          m.relation_type === `mother_2_of_${member.id}`
        );

        mothers.forEach((mother) => {
          const motherEl = memberElements.get(mother.id);
          if (motherEl) {
            const motherRect = motherEl.getBoundingClientRect();
            newConnections.push({
              from: memberCenter,
              to: {
                x: motherRect.left - containerRect.left + motherRect.width / 2,
                y: motherRect.top - containerRect.top + motherRect.height,
              },
              type: 'parent',
              fromMemberId: member.id,
              toMemberId: mother.id,
            });
          }
        });
      });

      // Calculate child connections (from heart to child)
      heartElements.forEach((heartEl, parentMemberId) => {
        if (!heartEl) return;

        const heartRect = heartEl.getBoundingClientRect();
        const heartCenter = {
          x: heartRect.left - containerRect.left + heartRect.width / 2,
          y: heartRect.top - containerRect.top + heartRect.height,
        };

        // Find children of this member
        const childMembers = members.filter(m => 
          m.relation_type.startsWith(`child_of_${parentMemberId}`)
        );

        childMembers.forEach((child) => {
          const childEl = memberElements.get(child.id);
          if (childEl) {
            const childRect = childEl.getBoundingClientRect();
            newConnections.push({
              from: heartCenter,
              to: {
                x: childRect.left - containerRect.left + childRect.width / 2,
                y: childRect.top - containerRect.top,
              },
              type: 'child',
              fromMemberId: parentMemberId,
              toMemberId: child.id,
            });
          }
        });
      });

      setConnections(newConnections);
    };

    // Delay to ensure DOM is rendered
    const timer = setTimeout(calculateConnections, 100);
    
    // Recalculate on resize
    window.addEventListener('resize', calculateConnections);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateConnections);
    };
  }, [containerRef, memberElements, members, heartElements]);

  return connections;
};
