import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface NetworkIntroProps {
  onComplete: () => void;
}

const NODES = [
  { cx: 150, cy: 60, r: 6, color: "#3498DB", delay: 0 },
  { cx: 240, cy: 120, r: 5, color: "#5DADE2", delay: 0.06 },
  { cx: 220, cy: 220, r: 5, color: "#2ECC71", delay: 0.12 },
  { cx: 120, cy: 240, r: 4.5, color: "#E67E22", delay: 0.18 },
  { cx: 60, cy: 160, r: 5, color: "#9B59B6", delay: 0.24 },
  { cx: 150, cy: 150, r: 8, color: "#C0392B", delay: 0.08 },
];

const LINES = [
  [150, 60, 240, 120],
  [240, 120, 220, 220],
  [220, 220, 120, 240],
  [120, 240, 60, 160],
  [60, 160, 150, 60],
  [150, 60, 150, 150],
  [240, 120, 150, 150],
  [220, 220, 150, 150],
  [120, 240, 150, 150],
  [60, 160, 150, 150],
];

export function NetworkIntro({ onComplete }: NetworkIntroProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Short overlay — fade out quickly so the D3 pan-out/zoom animation is visible
    const t1 = setTimeout(() => setVisible(false), 900);
    const t2 = setTimeout(onComplete, 1300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="intro-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: "#0a0a0f",
          }}
        >
          {/* Radial glow */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              position: "absolute",
              width: 400,
              height: 400,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(52,152,219,0.3) 0%, rgba(52,152,219,0) 70%)",
            }}
          />

          {/* Constellation */}
          <svg width="300" height="300" viewBox="0 0 300 300">
            {/* Lines as paths for pathLength animation */}
            {LINES.map(([x1, y1, x2, y2], i) => (
              <motion.path
                key={`line-${i}`}
                d={`M${x1},${y1} L${x2},${y2}`}
                stroke="#3498DB"
                strokeWidth="1.5"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              />
            ))}

            {/* Nodes */}
            {NODES.map((node, i) => (
              <motion.circle
                key={`node-${i}`}
                cx={node.cx}
                cy={node.cy}
                fill={node.color}
                initial={{ opacity: 0, r: 0 }}
                animate={{ opacity: 1, r: node.r }}
                transition={{
                  duration: 0.3,
                  delay: node.delay,
                  ease: "backOut",
                }}
              />
            ))}

            {/* Glow rings */}
            {[
              { cx: 150, cy: 150, color: "#C0392B" },
              { cx: 150, cy: 60, color: "#3498DB" },
            ].map((ring, i) => (
              <motion.circle
                key={`ring-${i}`}
                cx={ring.cx}
                cy={ring.cy}
                fill="none"
                stroke={ring.color}
                strokeWidth="2"
                initial={{ r: 6, opacity: 0.8 }}
                animate={{ r: 30, opacity: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              />
            ))}
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
