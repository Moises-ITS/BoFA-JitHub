import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import { X } from "lucide-react";

interface Node {
  id: string;
  name: string;
  major: string;
  year: string;
  clubs: string[];
  interests: string[];
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type: string;
}

interface NetworkGraphProps {
  nodes: Node[];
  onNodeClick?: (node: Node) => void;
}

export function NetworkGraph({ nodes, onNodeClick }: NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const simulationRef = useRef<any>(null);
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current?.parentElement) {
        const rect = canvasRef.current.parentElement.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Generate links based on shared clubs or interests
    const links: Link[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const sharedClubs = nodes[i].clubs.filter(c => nodes[j].clubs.includes(c));
        const sharedInterests = nodes[i].interests.filter(int => nodes[j].interests.includes(int));
        
        if (sharedClubs.length > 0) {
          links.push({ source: nodes[i].id, target: nodes[j].id, type: 'club' });
        } else if (sharedInterests.length > 0 && Math.random() > 0.3) {
          links.push({ source: nodes[i].id, target: nodes[j].id, type: 'interest' });
        }
      }
    }

    nodesRef.current = nodes.map(n => ({ ...n }));
    linksRef.current = links;

    const simulation = forceSimulation(nodesRef.current)
      .force("link", forceLink(linksRef.current).id((d: any) => d.id).distance(100))
      .force("charge", forceManyBody().strength(-300))
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collide", forceCollide(30));

    simulationRef.current = simulation;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw links
      linksRef.current.forEach(link => {
        const source = link.source as Node;
        const target = link.target as Node;
        
        ctx.beginPath();
        ctx.moveTo(source.x!, source.y!);
        ctx.lineTo(target.x!, target.y!);
        ctx.strokeStyle = link.type === 'club' 
          ? 'rgba(215, 25, 32, 0.24)' 
          : 'rgba(122, 132, 240, 0.2)';
        ctx.lineWidth = link.type === 'club' ? 2 : 1;
        ctx.stroke();
      });

      // Draw nodes
      nodesRef.current.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, node.id === 'user' ? 20 : 15, 0, 2 * Math.PI);
        
        if (node.id === 'user') {
          const gradient = ctx.createLinearGradient(node.x! - 20, node.y! - 20, node.x! + 20, node.y! + 20);
          gradient.addColorStop(0, '#D71920');
          gradient.addColorStop(1, '#BA7BB0');
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = hoveredNode?.id === node.id ? '#F36F6F' : 'rgba(255, 255, 255, 0.1)';
        }
        
        ctx.fill();
        ctx.strokeStyle = node.id === 'user' ? 'rgba(215, 25, 32, 0.42)' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw initials
        ctx.fillStyle = 'white';
        ctx.font = node.id === 'user' ? 'bold 12px Inter' : '11px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = node.name.split(' ').map(n => n[0]).join('');
        ctx.fillText(initials, node.x!, node.y!);
      });
    };

    simulation.on("tick", render);

    // Mouse interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let found = false;
      for (const node of nodesRef.current) {
        const dx = x - node.x!;
        const dy = y - node.y!;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < (node.id === 'user' ? 20 : 15)) {
          setHoveredNode(node);
          canvas.style.cursor = 'pointer';
          found = true;
          break;
        }
      }
      
      if (!found) {
        setHoveredNode(null);
        canvas.style.cursor = 'default';
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (hoveredNode) {
        setSelectedNode(hoveredNode);
        onNodeClick?.(hoveredNode);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      simulation.stop();
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [nodes, dimensions, hoveredNode, onNodeClick]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
      
      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-4 left-4 rounded-lg p-3 pointer-events-none z-10 shadow-xl"
            style={{ backgroundColor: "var(--bg-canvas)", border: "1px solid var(--border-strong)" }}
          >
            <p className="font-semibold text-white">{hoveredNode.name}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hoveredNode.major} • {hoveredNode.year}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {hoveredNode.clubs.slice(0, 2).map((club, idx) => (
                <span key={idx} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "var(--brand-primary-soft)", color: "var(--brand-primary)" }}>
                  {club}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected node drawer */}
      <AnimatePresence>
        {selectedNode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20"
              onClick={() => setSelectedNode(null)}
            />
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="absolute right-0 top-0 bottom-0 w-80 p-6 overflow-y-auto z-30"
              style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border-strong)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">{selectedNode.name}</h3>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{selectedNode.major}</p>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Year</p>
                  <p className="text-sm text-white">{selectedNode.year}</p>
                </div>

                <div>
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Clubs</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.clubs.map((club, idx) => (
                      <span key={idx} className="text-xs px-2.5 py-1 rounded-md" style={{ backgroundColor: "var(--brand-primary-soft)", color: "var(--brand-primary)" }}>
                        {club}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Interests</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.interests.map((interest, idx) => (
                      <span key={idx} className="text-xs px-2.5 py-1 rounded-md" style={{ backgroundColor: "var(--accent-networking-soft)", color: "var(--accent-networking)" }}>
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                {selectedNode.id !== 'user' && (
                  <button className="w-full py-2 text-white rounded-lg font-medium transition-all" style={{ background: "var(--brand-gradient)", boxShadow: "var(--shadow-brand)" }}>
                    Connect
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
