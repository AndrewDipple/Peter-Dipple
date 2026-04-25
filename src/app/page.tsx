import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Fitness Tracker</h1>
        <p className="mt-2 text-slate-800">
          Trainer and client app MVP
        </p>

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