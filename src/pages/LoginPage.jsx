/// frontend/src/pages/LoginPage.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { signIn, signInWithGoogle, canUseGoogleAuth, isWebView } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await signIn(form);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Login gagal.");
      return;
    }
    // Redirect akan ditangani oleh AuthOnly setelah state auth stabil.
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Login Google gagal.");
      return;
    }
    // Redirect akan ditangani oleh AuthOnly setelah state auth stabil.
  };

  return (
    <section className="mx-auto grid min-h-[76vh] max-w-6xl overflow-hidden rounded-3xl border border-cyan-400/20 bg-zinc-950/90 shadow-2xl md:grid-cols-2">
      <div className="hidden bg-[radial-gradient(circle_at_65%_22%,rgba(217,70,239,.35),transparent_35%),radial-gradient(circle_at_20%_78%,rgba(34,211,238,.4),transparent_35%),linear-gradient(155deg,#020617,#131a2f)] p-8 md:block">
        <div className="animate-float rounded-2xl border border-cyan-400/20 bg-black/35 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">DonghuaX Streaming</p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-white">Masuk untuk lanjut nonton.</h2>
          <p className="mt-4 text-sm text-zinc-300">Gunakan email/password atau akun Google.</p>
        </div>
      </div>
      <div className="p-6 sm:p-10">
        <h1 className="font-heading text-3xl font-bold text-white">Login</h1>
        <p className="mt-2 text-sm text-zinc-300">Akses akun untuk membuka katalog donghua.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
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
            {loading ? "Loading..." : "Login"}
          </button>
          {canUseGoogleAuth ? (
            <button
              type="button"
              onClick={onGoogle}
              disabled={loading}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-60"
            >
              Login dengan Google
            </button>
          ) : null}
          {isWebView ? (
            <p className="text-xs text-amber-300">Google login tidak tersedia di APK/WebView. Gunakan email/password atau browser eksternal.</p>
          ) : null}
        </form>
        <p className="mt-4 text-sm text-zinc-300">
          Belum punya akun?{" "}
          <Link to="/signup" className="font-semibold text-cyan-200 underline">
            Daftar
          </Link>
        </p>
      </div>
    </section>
  );
}
