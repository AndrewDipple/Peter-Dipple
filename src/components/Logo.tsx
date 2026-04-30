"use client";

import Image from "next/image";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  variant?: "white" | "black" | "gold" | "transparent" | "auto";
  className?: string;
};

export default function Logo({ variant = "auto", className = "" }: Props) {
  const { theme } = useTheme();
  
  // Auto-select based on theme: black for light mode, gold for dark mode
  const selectedVariant = variant === "auto" 
    ? (theme === "dark" ? "gold" : "black")
    : variant;
  
const logoMap = {
  black: '/logo-black.png',
  white: '/logo-white.png',
  gold: '/logo-gold.png',
  transparent: '/logo-transparent.svg',
};

const src = logoMap[selectedVariant];
  return (
    <Image
      src={src}
      alt="Peter Training Therapy"
      width={400}
      height={400}
      className={`h-full w-auto object-contain ${className}`}
      priority
    />
  );
}