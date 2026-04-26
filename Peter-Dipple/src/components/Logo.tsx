import Image from "next/image";

export default function Logo() {
  return (
    <div className="flex items-center">
      <Image
        src="/logo-white.png"
        alt="Peter Training Therapy"
  width={400}
  height={400}
        className="h-24 w-auto object-contain"
        priority
      />
    </div>
  );
}