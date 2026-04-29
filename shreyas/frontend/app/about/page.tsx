import Link from "next/link";

export default function About() {
  return (
    <main className="min-h-screen p-6">
      <h2 className="text-2xl font-semibold mb-4">About</h2>
      <p className="mb-6">OTP-based maternal healthcare chatbot.</p>

      <Link href="/auth/login" className="text-blue-600 underline">
        Login / Sign Up
      </Link>
    </main>
  );
}
