import React, { useMemo } from 'react';

interface Speck {
  id: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkle: boolean;
  speed: number;
}

interface GraphEnvironmentProps {
  viewMode: "2d" | "3d";
  motionTier: "full" | "balanced" | "performance";
  ambientFxRef: React.RefObject<HTMLDivElement>;
  ambientFarRef: React.RefObject<HTMLDivElement>;
  ambientMidRef: React.RefObject<HTMLDivElement>;
  ambientNearRef: React.RefObject<HTMLDivElement>;
  ambientGrainRef: React.RefObject<HTMLDivElement>;
  energyDensityRef: React.RefObject<HTMLDivElement>;
  energyCoreRef: React.RefObject<HTMLDivElement>;
  scanSweepRef: React.RefObject<HTMLDivElement>;
}

const GraphEnvironment: React.FC<GraphEnvironmentProps> = ({
  viewMode,
  motionTier,
  ambientFxRef,
  ambientFarRef,
  ambientMidRef,
  ambientNearRef,
  ambientGrainRef,
  energyDensityRef,
  energyCoreRef,
  scanSweepRef
}) => {
  const ambientSpecks = useMemo(() => {
    const counts = motionTier === "performance"
      ? { far: 10, mid: 8, near: 6, twinkleChance: 0.1 }
      : motionTier === "balanced"
        ? { far: 20, mid: 16, near: 12, twinkleChance: 0.2 }
        : { far: 28, mid: 24, near: 18, twinkleChance: 0.32 };

    const makeLayer = (prefix: string, count: number, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number, speed: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${prefix}-${i}`,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: minSize + Math.random() * (maxSize - minSize),
        opacity: minOpacity + Math.random() * (maxOpacity - minOpacity),
        twinkle: Math.random() < counts.twinkleChance,
        speed: speed * (0.8 + Math.random() * 0.4),
      })) as Speck[];
    return {
      far: makeLayer("far", counts.far, 0.6, 1.1, 0.12, 0.28, 0.002),
      mid: makeLayer("mid", counts.mid, 0.9, 1.6, 0.2, 0.4, 0.005),
      near: makeLayer("near", counts.near, 1.2, 2.2, 0.25, 0.55, 0.012),
    };
  }, [motionTier]);

  return (
    <div 
      ref={ambientFxRef} 
      className={`graphAmbientFx${viewMode === "3d" ? " graphAmbientFx--hidden" : ""}`} 
      aria-hidden="true"
    >
      <div className="graphAmbientLayer graphAmbientLayer--far" ref={ambientFarRef}>
        {ambientSpecks.far.map((speck) => (
          <span
            key={speck.id}
            className={`graphSpeck${speck.twinkle ? " graphSpeck--twinkle" : ""}`}
            style={{
              left: `${speck.x}%`,
              top: `${speck.y}%`,
              width: `${speck.size}px`,
              height: `${speck.size}px`,
              opacity: speck.opacity,
            }}
          />
        ))}
      </div>
      <div className="graphAmbientLayer graphAmbientLayer--mid" ref={ambientMidRef}>
        {ambientSpecks.mid.map((speck) => (
          <span
            key={speck.id}
            className={`graphSpeck graphSpeck--mid${speck.twinkle ? " graphSpeck--twinkle" : ""}`}
            style={{
              left: `${speck.x}%`,
              top: `${speck.y}%`,
              width: `${speck.size}px`,
              height: `${speck.size}px`,
              opacity: speck.opacity,
            }}
          />
        ))}
      </div>
      <div className="graphAmbientLayer graphAmbientLayer--near" ref={ambientNearRef}>
        {ambientSpecks.near.map((speck) => (
          <span
            key={speck.id}
            className={`graphSpeck graphSpeck--near${speck.twinkle ? " graphSpeck--twinkle" : ""}`}
            style={{
              left: `${speck.x}%`,
              top: `${speck.y}%`,
              width: `${speck.size}px`,
              height: `${speck.size}px`,
              opacity: speck.opacity,
            }}
          />
        ))}
      </div>
      <div className="graphAmbientGrain" ref={ambientGrainRef} />
      <div className="graphEnergyField graphEnergyField--density" ref={energyDensityRef} />
      <div className="graphEnergyField graphEnergyField--core" ref={energyCoreRef} />
      <div className="graphAmbientFog graphAmbientFog--core" />
      <div className="graphAmbientFog graphAmbientFog--secondary" />
      <div className="graphAmbientSpecks" />
      <div className="graphScanSweep" ref={scanSweepRef} />
    </div>
  );
};

export default GraphEnvironment;
