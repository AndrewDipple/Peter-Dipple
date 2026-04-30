"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { X, Trophy } from "lucide-react";

type Achievement = {
  icon: string;
  title: string;
  description: string;
};

type AchievementCelebrationProps = {
  achievement: Achievement | null;
  onClose: () => void;
};

export default function AchievementCelebration({
  achievement,
  onClose,
}: AchievementCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setIsVisible(true);
      
      // Trigger confetti
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = ["#D4AF37", "#FFD700", "#FFA500"];

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();

      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [achievement]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for fade out animation
  };

  if (!achievement) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-md transform rounded-2xl border-2 border-gold bg-gradient-to-br from-gold/20 to-amber-500/20 p-8 text-center shadow-2xl transition-all duration-300 ${
          isVisible ? "scale-100" : "scale-75"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X size={20} />
        </button>

        {/* Trophy Icon */}
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gold">
          <Trophy size={40} className="text-ink" />
        </div>

        {/* Achievement Icon */}
        <div className="mb-4 text-6xl animate-bounce">
          {achievement.icon}
        </div>

        {/* Achievement Title */}
        <h2 className="mb-2 text-2xl font-bold text-white">
          Achievement Unlocked!
        </h2>

        <h3 className="mb-2 text-xl font-semibold text-gold">
          {achievement.title}
        </h3>

        <p className="text-white/90">
          {achievement.description}
        </p>

        {/* Celebration Message */}
        <p className="mt-4 text-sm text-white/70">
          Keep up the amazing work! 🔥
        </p>
      </div>
    </div>
  );
}