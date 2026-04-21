export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export type Opportunity = {
  id: string;
  title: string;
  difficulty: Difficulty;
  skills: string[];
  commitment: string;
  spots: number;
  description: string;
};

export type Building = {
  id: string;
  name: string;
  pi: string;
  tags: string[];
  opportunities: Opportunity[];
};

export type DistrictId = "nce" | "ywcc" | "csla" | "hcad" | "mtsm";

export type District = {
  id: DistrictId;
  name: string;
  short: string;
  color: string;
  buildings: Building[];
};

export type DistrictMeta = {
  name: string;
  short: string;
  color: string;
};

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Beginner: "#10B981",
  Intermediate: "#F59E0B",
  Advanced: "#EF4444",
};

export const DIST_META: Record<DistrictId, DistrictMeta> = {
  nce: { name: "Newark College of Engineering", short: "NCE", color: "#ef4444" },
  ywcc: { name: "Ying Wu College of Computing", short: "YWCC", color: "#3b82f6" },
  csla: { name: "College of Science & Liberal Arts", short: "CSLA", color: "#8b5cf6" },
  hcad: { name: "Hillier College of Architecture", short: "HCAD", color: "#14b8a6" },
  mtsm: { name: "Martin Tuchman School of Management", short: "MTSM", color: "#f59e0b" },
};

const o = (
  id: string,
  title: string,
  difficulty: Difficulty,
  skills: string[],
  commitment: string,
  spots: number,
  description: string,
): Opportunity => ({ id, title, difficulty, skills, commitment, spots, description });

export const DISTRICTS: District[] = [
  {
    id: "nce",
    name: "Newark College of Engineering",
    short: "Engineering",
    color: "#EF4444",
    buildings: [
      { id: "ece-ctr", name: "ECE Center", pi: "Dr. Papageorgiou", tags: ["Electrical", "Computer Eng"], opportunities: [
        o("ece-1", "Embedded AI Systems", "Advanced", ["FPGA", "C++", "TensorFlow Lite"], "10 hrs/wk", 2, "Design neural network inference pipelines for embedded MCU platforms for real-time edge AI applications."),
        o("ece-2", "Smart Grid Security", "Intermediate", ["Power Systems", "Cybersecurity", "Python"], "8 hrs/wk", 1, "Analyze vulnerabilities in modern power grid SCADA systems and develop mitigation strategies."),
        o("ece-3", "VLSI & Chip Design", "Advanced", ["VLSI", "Cadence", "Verilog"], "12 hrs/wk", 2, "Full-custom chip layout and tape-out on 28nm process nodes at the NJIT fabrication facility."),
        o("ece-4", "5G mmWave Antenna Design", "Intermediate", ["RF", "HFSS", "Electromagnetics"], "8 hrs/wk", 2, "Design and characterize phased antenna arrays for 5G millimeter-wave communication systems."),
      ]},
      { id: "fenster", name: "Fenster Hall", pi: "Dr. Metghalchi", tags: ["Thermofluids", "Energy Systems"], opportunities: [
        o("fen-1", "Combustion Research RA", "Intermediate", ["MATLAB", "Thermodynamics", "LabView"], "10 hrs/wk", 2, "Measure laminar burning velocity in premixed gas-air mixtures using a spherical combustion vessel."),
        o("fen-2", "EV Battery Thermal Management", "Intermediate", ["FEA", "ANSYS", "Heat Transfer"], "8 hrs/wk", 1, "Model and optimize thermal management systems for lithium-ion battery packs in electric vehicles."),
      ]},
      { id: "colton", name: "Colton Hall", pi: "Dr. Ozguner", tags: ["Civil", "Structural Engineering"], opportunities: [
        o("col-1", "Structural Health Monitoring", "Intermediate", ["IoT", "ML", "Civil Eng"], "8 hrs/wk", 2, "Deploy sensor networks and ML models for real-time bridge condition assessment."),
      ]},
      { id: "faculty-memorial", name: "Faculty Memorial Hall", pi: "Dr. Schmalzel", tags: ["Research", "Instrumentation"], opportunities: [
        o("fac-1", "Research Bridge Program", "Beginner", ["Research Methods", "Any Major"], "6 hrs/wk", 5, "Cross-departmental pairing of undergrads with faculty for semester-long research experiences."),
        o("fac-2", "Precision Instrumentation RA", "Beginner", ["Lab Safety", "Calibration", "Documentation"], "8 hrs/wk", 2, "Calibrate and maintain precision measurement equipment; support lab operations and safety."),
      ]},
      { id: "mechanical", name: "Mechanical Engineering Center", pi: "Dr. Bhattacharyya", tags: ["Robotics", "Manufacturing"], opportunities: [
        o("mec-1", "Soft Robotics & Biomechanics", "Advanced", ["Robotics", "Biology", "CAD"], "12 hrs/wk", 2, "Develop soft pneumatic actuators inspired by biological muscle tissue for assistive robotics."),
        o("mec-2", "4D Printing Research", "Intermediate", ["3D Printing", "Materials", "SolidWorks"], "10 hrs/wk", 2, "Shape-memory polymer additive manufacturing for self-morphing structural components."),
        o("mec-3", "Model Predictive Control", "Advanced", ["MATLAB", "Simulink", "Control Theory"], "10 hrs/wk", 1, "Implement MPC algorithms for multi-axis robot arm coordination in manufacturing."),
      ]},
      { id: "microelectronics", name: "Microelectronics Center", pi: "Dr. Ravindra", tags: ["Nano", "Semiconductors"], opportunities: [
        o("mic-1", "MEMS Sensor Fabrication", "Advanced", ["Clean Room", "Lithography", "MEMS"], "12 hrs/wk", 1, "Fabricate micro-electromechanical pressure sensors using photolithography and wet etching."),
        o("mic-2", "Perovskite Solar Cell Research", "Intermediate", ["Chemistry", "Solar PV", "Spectroscopy"], "10 hrs/wk", 2, "Synthesize novel perovskite absorber layers for next-generation photovoltaic cells."),
      ]},
      { id: "york", name: "York Center", pi: "Dr. Dorsinville", tags: ["Photonics", "Optics"], opportunities: [
        o("yor-1", "Fiber Optics & Photonics Lab", "Advanced", ["Optics", "Laser Physics", "Python"], "10 hrs/wk", 1, "Study nonlinear optical effects in photonic crystal fibers for ultrafast pulse generation."),
      ]},
    ],
  },
  {
    id: "ywcc",
    name: "Ying Wu College of Computing",
    short: "Computing",
    color: "#3B82F6",
    buildings: [
      { id: "gitc", name: "GITC", pi: "Dr. Yi Chen", tags: ["AI", "Systems", "Data", "HCI"], opportunities: [
        o("git-1", "Graph Neural Network Research", "Advanced", ["ML", "PyTorch", "Graph Theory"], "12 hrs/wk", 2, "GNN architectures for social network analysis and next-gen recommendation systems."),
        o("git-2", "Distributed Systems Lab", "Intermediate", ["Go", "Systems", "Networking"], "10 hrs/wk", 2, "Fault-tolerant consensus protocols for edge computing and IoT environments."),
        o("git-3", "Cybersecurity Research Group", "Advanced", ["Security", "C", "Binary Analysis"], "10 hrs/wk", 1, "Automated vulnerability discovery in open-source software via fuzzing and static analysis."),
        o("git-4", "HCI & Accessibility Lab", "Beginner", ["UX Research", "Figma", "User Testing"], "8 hrs/wk", 3, "Design and evaluate assistive technology interfaces for users with motor and cognitive disabilities."),
        o("git-5", "Multilingual NLP Research", "Advanced", ["NLP", "Transformers", "Python"], "12 hrs/wk", 2, "Cross-lingual semantic parsing and transfer learning for low-resource language pairs."),
        o("git-6", "Protein Structure Prediction", "Intermediate", ["Bioinformatics", "Python", "ML"], "10 hrs/wk", 2, "Apply deep learning to protein folding; analyze AlphaFold2 outputs for novel proteins."),
      ]},
    ],
  },
  {
    id: "csla",
    name: "College of Science & Liberal Arts",
    short: "Sciences & Arts",
    color: "#8B5CF6",
    buildings: [
      { id: "life-sci", name: "Life Sciences & Engineering Center", pi: "Dr. Federici", tags: ["Biology", "Biomedical", "Genomics"], opportunities: [
        o("ls-1", "Neural Circuit Imaging", "Advanced", ["Neuroscience", "Confocal", "Python"], "12 hrs/wk", 1, "Calcium imaging in C. elegans to map complete neural connectivity under behavioral stimuli."),
        o("ls-2", "Single-Cell RNA Sequencing", "Intermediate", ["R", "Bioinformatics", "Genomics"], "10 hrs/wk", 2, "Pipeline development for scRNA-seq analysis of tumor microenvironments in pancreatic cancer."),
        o("ls-3", "Passaic River Microbiome Study", "Beginner", ["Microbiology", "Field Work", "PCR"], "8 hrs/wk", 3, "Sample and characterize microbial communities in Passaic River sediment to assess remediation."),
        o("ls-4", "Cancer Cell Motility Study", "Intermediate", ["Cell Biology", "Microscopy", "ImageJ"], "10 hrs/wk", 2, "Fluorescence microscopy of cytoskeletal dynamics in invasive breast cancer cell migration."),
      ]},
      { id: "cullimore", name: "Cullimore Hall", pi: "Dr. Petropoulos", tags: ["Mathematics", "Physics"], opportunities: [
        o("cul-1", "PDE Numerical Methods", "Advanced", ["MATLAB", "Numerical Analysis", "C++"], "10 hrs/wk", 2, "Adaptive mesh refinement schemes for solving nonlinear partial differential equations."),
        o("cul-2", "Quantum Error Correction", "Advanced", ["Qiskit", "Linear Algebra", "Python"], "12 hrs/wk", 1, "Benchmark variational quantum eigensolvers and error correction codes on IBM quantum hardware."),
        o("cul-3", "Turbulence FEM Simulation", "Intermediate", ["FEM", "MATLAB", "Physics"], "8 hrs/wk", 2, "Finite element modeling of turbulent flow using Navier-Stokes for environmental applications."),
      ]},
      { id: "king", name: "Central King Building", pi: "Dr. Lungu", tags: ["Liberal Arts", "Science Policy"], opportunities: [
        o("kng-1", "Technology & Society Research", "Beginner", ["Writing", "Research", "Policy"], "6 hrs/wk", 4, "Analyze policy impacts of emerging technology on underserved Newark communities."),
      ]},
      { id: "tiernan", name: "Tiernan Hall", pi: "Dr. Aldykiewicz", tags: ["Chemistry", "Environmental"], opportunities: [
        o("tie-1", "Green Chemistry Synthesis", "Intermediate", ["Organic Chemistry", "NMR", "Green Solvents"], "10 hrs/wk", 2, "Solvent-free synthesis routes for pharmaceutical intermediates using mechanochemical activation."),
        o("tie-2", "Nanomaterial Water Purification", "Advanced", ["Nano", "Environmental Eng", "Chemistry"], "10 hrs/wk", 1, "Iron-oxide nanoparticle composites for heavy metal removal from contaminated water."),
      ]},
      { id: "kupfrian", name: "Kupfrian Hall", pi: "Dr. Mitra", tags: ["Applied Sciences", "Physics Lab"], opportunities: [
        o("kup-1", "Teaching Lab Research Assistant", "Beginner", ["Physics", "Lab Safety", "Communication"], "6 hrs/wk", 3, "Support faculty in sophomore physics lab sections; assist students with experimental setups."),
      ]},
    ],
  },
  {
    id: "hcad",
    name: "Hillier College of Architecture & Design",
    short: "Architecture & Design",
    color: "#14B8A6",
    buildings: [
      { id: "weston", name: "Weston Hall", pi: "Dr. Kambouris", tags: ["Architecture", "Urban Systems"], opportunities: [
        o("wes-1", "Newark Urban Modeling", "Intermediate", ["Rhino", "Grasshopper", "GIS"], "10 hrs/wk", 2, "Parametric urban modeling for adaptive reuse of industrial buildings in the Ironbound district."),
        o("wes-2", "Generative Design Algorithms", "Advanced", ["Python", "Computation", "Architecture"], "10 hrs/wk", 1, "Evolutionary algorithms for sustainable building form optimization and passive energy design."),
      ]},
      { id: "campbell", name: "Campbell Hall", pi: "Dr. Yost", tags: ["Industrial Design", "HCD"], opportunities: [
        o("cam-1", "Inclusive Product Design", "Beginner", ["HCD", "Prototyping", "User Research"], "8 hrs/wk", 3, "Human-centered design research for assistive devices for older adults aging in place."),
        o("cam-2", "Sustainable Materials LCA", "Intermediate", ["Sustainability", "Life Cycle Analysis", "CAD"], "10 hrs/wk", 2, "Life cycle analysis and sustainable material selection for consumer electronics redesign."),
      ]},
      { id: "specht", name: "Specht Building", pi: "Dr. Schwartz", tags: ["Digital Fabrication", "Making"], opportunities: [
        o("spe-1", "Robotic Fabrication Lab", "Intermediate", ["Robotics", "Fabrication", "Rhino"], "10 hrs/wk", 2, "Program KUKA robot arms for architectural-scale fabrication of complex timber and concrete components."),
      ]},
    ],
  },
  {
    id: "mtsm",
    name: "Martin Tuchman School of Management",
    short: "Management",
    color: "#F59E0B",
    buildings: [
      { id: "eberhardt", name: "Eberhardt Hall", pi: "Dr. Agrawal", tags: ["Finance", "Entrepreneurship"], opportunities: [
        o("ebe-1", "Blockchain Supply Chain", "Intermediate", ["Blockchain", "Python", "Supply Chain"], "10 hrs/wk", 2, "Design blockchain-based provenance tracking for pharmaceutical supply chain integrity."),
        o("ebe-2", "Newark Venture Studio", "Beginner", ["Entrepreneurship", "Business Dev", "Any Major"], "6 hrs/wk", 5, "Mentor-in-residence program with Newark startup ecosystem; develop and pitch your own venture."),
        o("ebe-3", "Causal Inference in Business", "Advanced", ["Statistics", "R", "Econometrics"], "12 hrs/wk", 1, "Apply quasi-experimental methods to measure ROI of corporate sustainability programs."),
      ]},
      { id: "central-ave", name: "Central Avenue Building", pi: "Dr. Foropon", tags: ["Operations", "Supply Chain Analytics"], opportunities: [
        o("cav-1", "Supply Chain ML Forecasting", "Intermediate", ["ML", "Python", "Operations"], "10 hrs/wk", 2, "ML-based demand forecasting under uncertainty using real global supply chain data."),
        o("cav-2", "Last-Mile Delivery Optimization", "Intermediate", ["Algorithms", "Graph Theory", "Python"], "8 hrs/wk", 2, "Graph algorithm optimization of last-mile logistics routing for urban delivery fleets in Newark."),
      ]},
    ],
  },
];

export type BuildingMaterial =
  | "red-brick"
  | "industrial-brick"
  | "gothic"
  | "stone-gray"
  | "tan-stone"
  | "glass-blue"
  | "modern-mix"
  | "low-brick";

export type BuildingFeature =
  | "none"
  | "ribbon"
  | "gothic-pavilion"
  | "atrium-cyl"
  | "curtain-wall"
  | "setback"
  | "parapet"
  | "spire"
  | "tower-crown"
  | "castellated";

export type GridBuilding = {
  id: string;
  dist: DistrictId;
  col: number;
  row: number;
  w: number;
  d: number;
  h: number;
  style: { mat: BuildingMaterial; feat: BuildingFeature };
};

export const BLDGS: GridBuilding[] = [
  { id: "cullimore",        dist: "csla", col: 0, row: 0,  w: 2, d: 1, h: 6,  style: { mat: "stone-gray",       feat: "ribbon"          } },
  { id: "king",             dist: "csla", col: 0, row: 2,  w: 3, d: 2, h: 7,  style: { mat: "gothic",           feat: "gothic-pavilion" } },
  { id: "life-sci",         dist: "csla", col: 0, row: 5,  w: 2, d: 2, h: 8,  style: { mat: "modern-mix",       feat: "atrium-cyl"      } },
  { id: "tiernan",          dist: "csla", col: 3, row: 0,  w: 1, d: 1, h: 5,  style: { mat: "glass-blue",       feat: "curtain-wall"    } },
  { id: "kupfrian",         dist: "csla", col: 3, row: 5,  w: 1, d: 1, h: 3,  style: { mat: "low-brick",        feat: "none"            } },

  { id: "fenster",          dist: "nce",  col: 7,  row: 0, w: 2, d: 1, h: 9,  style: { mat: "tan-stone",        feat: "setback"         } },
  { id: "colton",           dist: "nce",  col: 7,  row: 2, w: 1, d: 1, h: 5,  style: { mat: "industrial-brick", feat: "parapet"         } },
  { id: "york",             dist: "nce",  col: 9,  row: 2, w: 1, d: 1, h: 5,  style: { mat: "red-brick",        feat: "parapet"         } },
  { id: "faculty-memorial", dist: "nce",  col: 8,  row: 1, w: 1, d: 1, h: 4,  style: { mat: "red-brick",        feat: "none"            } },
  { id: "ece-ctr",          dist: "nce",  col: 11, row: 0, w: 2, d: 2, h: 14, style: { mat: "modern-mix",       feat: "setback"         } },
  { id: "mechanical",       dist: "nce",  col: 11, row: 2, w: 2, d: 1, h: 8,  style: { mat: "industrial-brick", feat: "parapet"         } },
  { id: "microelectronics", dist: "nce",  col: 10, row: 2, w: 1, d: 1, h: 4,  style: { mat: "tan-stone",        feat: "none"            } },

  { id: "gitc",             dist: "ywcc", col: 16, row: 0, w: 2, d: 2, h: 20, style: { mat: "glass-blue",       feat: "tower-crown"     } },

  { id: "eberhardt",        dist: "mtsm", col: 0, row: 8,  w: 3, d: 2, h: 5,  style: { mat: "gothic",           feat: "spire"           } },
  { id: "central-ave",      dist: "mtsm", col: 0, row: 11, w: 2, d: 1, h: 6,  style: { mat: "tan-stone",        feat: "setback"         } },

  { id: "weston",           dist: "hcad", col: 6, row: 8,  w: 2, d: 2, h: 6,  style: { mat: "modern-mix",       feat: "setback"         } },
  { id: "campbell",         dist: "hcad", col: 9, row: 8,  w: 1, d: 2, h: 4,  style: { mat: "red-brick",        feat: "parapet"         } },
  { id: "specht",           dist: "hcad", col: 6, row: 11, w: 2, d: 1, h: 4,  style: { mat: "red-brick",        feat: "parapet"         } },
];

export type TopPosition = {
  bldg: string;
  opp: string;
  match: number;
  why: string;
};

export const TOP_POSITION_IDS: TopPosition[] = [
  { bldg: "gitc",      opp: "git-4", match: 94, why: "Matches your UX research background" },
  { bldg: "life-sci",  opp: "ls-3",  match: 89, why: "Beginner-friendly — fits your availability" },
  { bldg: "ece-ctr",   opp: "ece-4", match: 86, why: "Aligns with your EM fundamentals coursework" },
  { bldg: "cullimore", opp: "cul-2", match: 82, why: "Recommended: quantum computing interest" },
];

export type Glow = "subtle" | "medium" | "vivid";
export type Floors = "on" | "off";
export type Camera = "steep" | "standard" | "low";
export type Tweaks = { glow: Glow; floors: Floors; camera: Camera };

export const DEFAULT_TWEAKS: Tweaks = { glow: "medium", floors: "on", camera: "steep" };

export type BuildingLookup = {
  gb: GridBuilding;
  building: Building;
  district: District;
  meta: DistrictMeta;
};

export function buildLookup(): Map<string, BuildingLookup> {
  const map = new Map<string, BuildingLookup>();
  for (const gb of BLDGS) {
    const district = DISTRICTS.find((d) => d.id === gb.dist);
    const building = district?.buildings.find((b) => b.id === gb.id);
    const meta = DIST_META[gb.dist];
    if (!district || !building || !meta) continue;
    map.set(gb.id, { gb, building, district, meta });
  }
  return map;
}
