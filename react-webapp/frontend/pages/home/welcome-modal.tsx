import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronRight, Sparkles } from "lucide-react";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: "Welcome to JitHub! 🎉",
      description: "Your all-in-one student platform for NJIT. Think of it as your personal operating system for campus life.",
      image: "🚀",
    },
    {
      title: "Discover Events",
      description: "Find events relevant to campus life and your interests. Never miss recruiting events, free food, or networking opportunities.",
      image: "📅",
    },
    {
      title: "Find Opportunities",
      description: "Access internships, scholarships, jobs, and research positions with clear details and deadline alerts.",
      image: "💼",
    },
    {
      title: "Build Your Network",
      description: "Connect with students who share your interests. Visualize your campus connections in an interactive network graph.",
      image: "🤝",
    },
  ];

  const currentStep = steps[step - 1];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl p-8 max-w-lg w-full relative overflow-hidden"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              {/* Gradient background */}
              <div className="absolute top-0 left-0 right-0 h-32 blur-3xl" style={{ background: "linear-gradient(135deg, rgba(215,25,32,0.18), rgba(186,123,176,0.18))" }} />

              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg transition-colors z-10"
              >
                <X className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
              </button>

              <div className="relative z-10">
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">{currentStep.image}</div>
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    {currentStep.title}
                  </h2>
                  <p style={{ color: "var(--text-muted)" }}>{currentStep.description}</p>
                </div>

                {/* Progress dots */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  {steps.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-2 rounded-full transition-all ${
                        idx + 1 === step
                          ? "w-8"
                          : "w-2 bg-white/20"
                      }`}
                      style={idx + 1 === step ? { background: "var(--brand-gradient)" } : undefined}
                    />
                  ))}
                </div>

                <div className="flex gap-3">
                  {step < steps.length ? (
                    <>
                      <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-white/5 text-white rounded-lg font-medium hover:bg-white/10 transition-colors"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => setStep(step + 1)}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-lg font-medium transition-all"
                        style={{ background: "var(--brand-gradient)", boxShadow: "var(--shadow-brand)" }}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={onClose}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 text-white rounded-lg font-medium transition-all"
                      style={{ background: "var(--brand-gradient)", boxShadow: "var(--shadow-brand)" }}
                    >
                      <Sparkles className="w-4 h-4" />
                      Get Started
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
