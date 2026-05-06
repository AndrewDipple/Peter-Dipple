"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type TourStep = {
  title: string;
  body: string;
  accent: "emerald" | "navy" | "gold" | "neutral";
};

const STEPS: TourStep[] = [
  {
    title: "Welcome to Peter Training and Nutrition",
    body:
      "This app is your home for everything Peter has set up for you — your training programme, your meals, your progress. Let's take a quick tour so you know where everything lives. It only takes a minute.",
    accent: "neutral",
  },
  {
    title: "Your Dashboard",
    body:
      "Your home page shows everything that matters today. Today's workout, what you've eaten, your steps, your water target. Tap any of the cards to dig in. The dashboard is where you'll spend most of your time.",
    accent: "neutral",
  },
  {
    title: "Workouts",
    body:
      "On the Workout page, you'll see today's session — exercises, sets, reps, target weights. Tick off each set as you complete it. A rest timer pops up between sets. You can swap exercises if equipment isn't available, and add custom ones if you want to do extra.",
    accent: "navy",
  },
  {
    title: "Nutrition",
    body:
      "The Nutrition page shows what you've eaten today and what you have planned. Use the Meal Planner to build your week ahead. Log meals from your plan with one tap, or add custom meals when life happens. The shopping list pulls from your meal plan automatically.",
    accent: "emerald",
  },
  {
    title: "Stats & Progress",
    body:
      "The Stats page is where you'll see your journey. Weight, body measurements, progress photos, and personal bests on lifts. Log these regularly — even small changes matter, and seeing them helps you stay motivated.",
    accent: "gold",
  },
  {
    title: "Your Companion",
    body:
      "If you'd like a small sidekick along for the journey, you can choose a companion that grows alongside you. They earn Bond XP as you engage with the app — totally optional and never pushy. You'll find the option on your dashboard.",
    accent: "neutral",
  },
  {
    title: "You're set",
    body:
      "If you have any questions, ask Peter directly. The app will save your progress automatically as you go. Have fun, be honest with your tracking, and trust the process. Let's get started.",
    accent: "neutral",
  },
];

const accentBorderClass: Record<TourStep["accent"], string> = {
  navy: "border-l-4 border-l-navy",
  emerald: "border-l-4 border-l-emerald",
  gold: "border-l-4 border-l-gold",
  neutral: "border-l-4 border-l-border-subtle",
};

const accentDotClass: Record<TourStep["accent"], string> = {
  navy: "bg-navy",
  emerald: "bg-emerald",
  gold: "bg-gold",
  neutral: "bg-emerald",
};

type TourModalProps = {
  clientId: string;
  onComplete: () => void;
};

export default function TourModal({ clientId, onComplete }: TourModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [closing, setClosing] = useState(false);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];

  const markCompleted = async () => {
    setClosing(true);
    await supabase
      .from("clients")
      .update({ tour_completed_at: new Date().toISOString() })
      .eq("id", clientId);
    setClosing(false);
    onComplete();
  };

  const handleNext = () => {
    if (isLast) {
      markCompleted();
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirst) setStepIndex(stepIndex - 1);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div
        className={`relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ${accentBorderClass[step.accent]}`}
        style={{ backgroundColor: "#ffffff" }}
      >
        <button
          type="button"
          onClick={markCompleted}
          disabled={closing}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          aria-label="Skip tour"
        >
          <X size={20} />
        </button>

        <div className="pr-8">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">{step.title}</h2>
          <p className="mt-3 text-gray-700">{step.body}</p>
        </div>

        {/* Step indicator dots */}
        <div className="mt-6 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${
                i === stepIndex ? accentDotClass[step.accent] : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={isFirst || closing}
            className={`${styles.buttonSecondary} flex items-center gap-2 disabled:opacity-30`}
          >
            <ChevronLeft size={16} /> Back
          </button>

          <button
            type="button"
            onClick={markCompleted}
            disabled={closing}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-50"
          >
            Skip
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={closing}
            className={`${styles.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
          >
            {isLast ? "Get Started" : (
              <>
                Next <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}