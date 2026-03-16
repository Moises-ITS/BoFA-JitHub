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
      description: "Find events tailored to your interests with AI-powered matching. Never miss recruiting events, free food, or networking opportunities.",
      image: "📅",
    },
    {
      title: "Find Opportunities",
      description: "Access internships, scholarships, jobs, and research positions. Get personalized match scores and deadline alerts.",
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
              className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-8 max-w-lg w-full relative overflow-hidden"
            >
              {/* Gradient background */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-[#C0392B]/20 to-[#E67E22]/20 blur-3xl" />

              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg transition-colors z-10"
              >
                <X className="w-5 h-5 text-[#9CA3AF]" />
              </button>

              <div className="relative z-10">
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">{currentStep.image}</div>
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    {currentStep.title}
                  </h2>
                  <p className="text-[#9CA3AF]">{currentStep.description}</p>
                </div>

                {/* Progress dots */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  {steps.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-2 rounded-full transition-all ${
                        idx + 1 === step
                          ? "w-8 bg-gradient-to-r from-[#C0392B] to-[#E67E22]"
                          : "w-2 bg-white/20"
                      }`}
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
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#C0392B] to-[#E74C3C] text-white rounded-lg font-medium hover:shadow-lg hover:shadow-[#C0392B]/30 transition-all"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={onClose}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#C0392B] to-[#E74C3C] text-white rounded-lg font-medium hover:shadow-lg hover:shadow-[#C0392B]/30 transition-all"
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
