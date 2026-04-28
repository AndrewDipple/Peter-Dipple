import Image from "next/image";

type Props = {
  variant?: "white" | "black" | "gold";
  className?: string;
};

export default function Logo({ variant = "black", className = "" }: Props) {
  const src = `/logo-${variant}.png`;

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