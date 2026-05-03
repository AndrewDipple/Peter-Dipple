import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <div className="flex flex-col items-center">
          <Image
            src="/logo-white.png"
            alt="Peter Training App"
            width={300}
            height={300}
            className="mb-4"
            priority
          />
          <h1 className="text-2xl font-bold">Peter Training</h1>
          <p className="mt-2 text-center text-slate-800">
            Your personal training and nutrition companion
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <Link href="/login">
            <button className="w-full rounded-xl bg-black px-4 py-3 text-white">
              Login
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}