export interface Opportunity {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly difficulty: "Beginner" | "Intermediate" | "Advanced"
}

export interface District {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly color: string
  readonly glowColor: string
  readonly description: string
  readonly opportunities: readonly Opportunity[]
  readonly position: { readonly x: number; readonly y: number }
  readonly size: { readonly w: number; readonly h: number }
  readonly rotation: number
}

export const DISTRICTS: readonly District[] = [
  {
    id: "ai",
    name: "Artificial Intelligence",
    icon: "\u{1F9E0}",
    color: "#8B5CF6",
    glowColor: "rgba(139, 92, 246, 0.25)",
    description:
      "Explore the frontier of machine learning, neural networks, and intelligent systems. From NLP to computer vision, AI research at NJIT pushes boundaries.",
    position: { x: -28, y: -22 },
    size: { w: 220, h: 180 },
    rotation: -2,
    opportunities: [
      {
        id: "ai-1",
        title: "LLM Fine-Tuning for Scientific Papers",
        description:
          "Help fine-tune large language models to summarize and classify academic research papers across multiple domains.",
        difficulty: "Advanced",
      },
      {
        id: "ai-2",
        title: "Computer Vision for Campus Navigation",
        description:
          "Build a vision model that recognizes NJIT landmarks to power an AR campus navigation app.",
        difficulty: "Intermediate",
      },
      {
        id: "ai-3",
        title: "Intro to Neural Network Architectures",
        description:
          "Assist with documenting and benchmarking different neural network architectures on standard datasets.",
        difficulty: "Beginner",
      },
      {
        id: "ai-4",
        title: "Reinforcement Learning for Robotics",
        description:
          "Train RL agents in simulation to control robotic arms for pick-and-place tasks in the NJIT robotics lab.",
        difficulty: "Advanced",
      },
    ],
  },
  {
    id: "bio",
    name: "Biomedical Sciences",
    icon: "\u{1F9EC}",
    color: "#10B981",
    glowColor: "rgba(16, 185, 129, 0.25)",
    description:
      "Where biology meets engineering. Research spans genomics, biomedical devices, drug discovery, and computational biology.",
    position: { x: 26, y: -18 },
    size: { w: 200, h: 160 },
    rotation: 3,
    opportunities: [
      {
        id: "bio-1",
        title: "Genomic Data Pipeline Development",
        description:
          "Build bioinformatics pipelines to process and analyze next-generation sequencing data for cancer research.",
        difficulty: "Advanced",
      },
      {
        id: "bio-2",
        title: "Wearable Biosensor Prototyping",
        description:
          "Design and test low-power biosensors for continuous health monitoring using flexible electronics.",
        difficulty: "Intermediate",
      },
      {
        id: "bio-3",
        title: "Lab Data Entry & Analysis Assistant",
        description:
          "Help organize experimental data from wet-lab experiments and create visualizations for the research team.",
        difficulty: "Beginner",
      },
    ],
  },
  {
    id: "engineering",
    name: "Engineering",
    icon: "\u2699\uFE0F",
    color: "#F59E0B",
    glowColor: "rgba(245, 158, 11, 0.25)",
    description:
      "Mechanical, civil, and industrial engineering research. From sustainable structures to advanced manufacturing and smart materials.",
    position: { x: -32, y: 18 },
    size: { w: 240, h: 170 },
    rotation: 1,
    opportunities: [
      {
        id: "eng-1",
        title: "Structural Health Monitoring with IoT",
        description:
          "Deploy and analyze IoT sensor networks on campus infrastructure to detect structural degradation in real-time.",
        difficulty: "Advanced",
      },
      {
        id: "eng-2",
        title: "3D Printing Process Optimization",
        description:
          "Experiment with FDM and SLA printing parameters to optimize strength-to-weight ratios for aerospace components.",
        difficulty: "Intermediate",
      },
      {
        id: "eng-3",
        title: "CAD Modeling for Research Prototypes",
        description:
          "Create detailed CAD models in SolidWorks for mechanical prototypes used in ongoing faculty research.",
        difficulty: "Beginner",
      },
      {
        id: "eng-4",
        title: "Renewable Energy System Simulation",
        description:
          "Model and simulate hybrid solar-wind energy systems for urban environments using MATLAB/Simulink.",
        difficulty: "Intermediate",
      },
    ],
  },
  {
    id: "finance",
    name: "Finance & Analytics",
    icon: "\u{1F4CA}",
    color: "#3B82F6",
    glowColor: "rgba(59, 130, 246, 0.25)",
    description:
      "Quantitative finance, algorithmic trading, risk modeling, and data-driven economic analysis. Where math meets markets.",
    position: { x: 28, y: 14 },
    size: { w: 190, h: 155 },
    rotation: -3,
    opportunities: [
      {
        id: "fin-1",
        title: "Algorithmic Trading Strategy Backtesting",
        description:
          "Develop and backtest momentum-based trading strategies using Python and historical market data.",
        difficulty: "Advanced",
      },
      {
        id: "fin-2",
        title: "Risk Model Dashboard Development",
        description:
          "Build an interactive dashboard to visualize portfolio risk metrics including VaR and stress test scenarios.",
        difficulty: "Intermediate",
      },
      {
        id: "fin-3",
        title: "Financial Dataset Cleaning & Prep",
        description:
          "Clean, normalize, and prepare large financial datasets for use in faculty machine learning research.",
        difficulty: "Beginner",
      },
    ],
  },
  {
    id: "materials",
    name: "Materials Science",
    icon: "\u2697\uFE0F",
    color: "#EC4899",
    glowColor: "rgba(236, 72, 153, 0.25)",
    description:
      "Nanomaterials, polymers, composites, and smart materials. Discover what things are made of and engineer what comes next.",
    position: { x: -4, y: 32 },
    size: { w: 210, h: 160 },
    rotation: 2,
    opportunities: [
      {
        id: "mat-1",
        title: "Nanocomposite Characterization",
        description:
          "Use SEM and XRD to characterize novel nanocomposite materials and document their mechanical properties.",
        difficulty: "Advanced",
      },
      {
        id: "mat-2",
        title: "Polymer Recycling Process Research",
        description:
          "Investigate chemical recycling methods for mixed plastic waste and measure output material quality.",
        difficulty: "Intermediate",
      },
      {
        id: "mat-3",
        title: "Literature Review: Smart Materials",
        description:
          "Compile and summarize recent publications on shape-memory alloys and self-healing polymers.",
        difficulty: "Beginner",
      },
    ],
  },
  {
    id: "physics",
    name: "Physics & Astronomy",
    icon: "\u{1F30C}",
    color: "#6366F1",
    glowColor: "rgba(99, 102, 241, 0.25)",
    description:
      "From quantum mechanics to astrophysics. Explore the fundamental laws governing our universe through theory and experiment.",
    position: { x: 4, y: -32 },
    size: { w: 225, h: 170 },
    rotation: -1,
    opportunities: [
      {
        id: "phys-1",
        title: "Quantum Computing Error Correction",
        description:
          "Simulate and benchmark quantum error correction codes on IBM Qiskit for near-term quantum processors.",
        difficulty: "Advanced",
      },
      {
        id: "phys-2",
        title: "Gravitational Wave Signal Processing",
        description:
          "Apply signal processing techniques to LIGO open data to detect and classify gravitational wave events.",
        difficulty: "Intermediate",
      },
      {
        id: "phys-3",
        title: "Physics Simulation Visualizations",
        description:
          "Create interactive web-based visualizations of classic physics experiments for the department website.",
        difficulty: "Beginner",
      },
      {
        id: "phys-4",
        title: "Optical Metamaterials Fabrication",
        description:
          "Assist in fabricating and testing optical metamaterial samples with negative refractive index properties.",
        difficulty: "Advanced",
      },
    ],
  },
] as const

export const DIFFICULTY_COLORS: Record<Opportunity["difficulty"], string> = {
  Beginner: "#10B981",
  Intermediate: "#F59E0B",
  Advanced: "#EF4444",
}
