/// frontend/src/pages/SignupPage.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await signUp(form);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Signup gagal.");
      return;
    }
    // Redirect akan ditangani oleh AuthOnly setelah state auth stabil.
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Signup Google gagal.");
      return;
    }
    // Redirect akan ditangani oleh AuthOnly setelah state auth stabil.
  };

  return (
    <section className="mx-auto grid min-h-[76vh] max-w-6xl overflow-hidden rounded-3xl border border-cyan-400/20 bg-zinc-950/90 shadow-2xl md:grid-cols-2">
      <div className="hidden bg-[radial-gradient(circle_at_30%_18%,rgba(244,114,182,.35),transparent_35%),radial-gradient(circle_at_78%_12%,rgba(56,189,248,.3),transparent_38%),linear-gradient(145deg,#020617,#121b31)] p-8 md:block">
        <div className="animate-float rounded-2xl border border-cyan-400/20 bg-black/35 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Create account</p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-white">Buat akun dan mulai sekarang.</h2>
          <p className="mt-4 text-sm text-zinc-300">Daftar via email/password atau akun Google.</p>
        </div>
      </div>
      <div className="p-6 sm:p-10">
        <h1 className="font-heading text-3xl font-bold text-white">Daftar</h1>
        <p className="mt-2 text-sm text-zinc-300">Bikin akun untuk akses penuh website.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border border-zinc-700 bg-black/60 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            required
          />
          <input
            type="email"
            className="w-full rounded-xl border border-zinc-700 bg-black/60 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
          <input
            type="password"
            className="w-full rounded-xl border border-zinc-700 bg-black/60 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            required
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Loading..." : "Daftar"}
          </button>
          <button
            type="button"
            onClick={onGoogle}
            disabled={loading}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-60"
          >
            Lanjut dengan Google
          </button>
        </form>
        <p className="mt-4 text-sm text-zinc-300">
          Sudah punya akun?{" "}
          <Link to="/login" className="font-semibold text-cyan-200 underline">
            Masuk
          </Link>
        </p>
      </div>
    </section>
  );
}
