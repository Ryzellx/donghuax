/// frontend/src/pages/AccountPage.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function AccountPage() {
  const { user, updateProfile } = useAuth();
  const [username, setUsername] = useState(user.username || "");
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState(user.password || "");
  const [message, setMessage] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    const result = updateProfile({ username, email, password });
    setMessage(result.ok ? "Profile berhasil diupdate." : result.error);
  };

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-cyan-400/20 bg-zinc-950/90 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">Account</h1>
          <p className="mt-1 text-sm text-zinc-300">Ubah profil akun kapan saja.</p>
        </div>
        <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-cyan-400/20 bg-zinc-900">
          {user?.photoUrl ? <img src={user.photoUrl} alt={username || "Profile"} className="h-full w-full object-cover" /> : null}
          <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            {user?.premium?.active ? user.premium.plan : "Free"}
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <label className="block text-sm text-zinc-300">
          Username
          <input
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-black/60 px-4 py-2.5 text-zinc-100 outline-none focus:border-cyan-300/60"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-black/60 px-4 py-2.5 text-zinc-100 outline-none focus:border-cyan-300/60"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Password
          <input
            type="text"
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-black/60 px-4 py-2.5 text-zinc-100 outline-none focus:border-cyan-300/60"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <p className="text-xs text-zinc-400">Foto profil dikunci otomatis oleh sistem avatar random donghua.</p>
        {message ? <p className="text-sm text-cyan-200">{message}</p> : null}
        <button
          className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          type="submit"
        >
          Save Changes
        </button>
      </form>
    </section>
  );
}
