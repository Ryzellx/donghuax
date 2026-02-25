/// frontend/src/pages/PremiumPage.jsx
import { useAuth } from "../context/AuthContext";

export default function PremiumPage() {
  const { user } = useAuth();
  const expireDate = user?.premium?.expireAt
    ? new Date(user.premium.expireAt).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "-";

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
        <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">Premium</h1>
        <p className="mt-2 text-sm text-slate-300">
          Aktivasi via admin. Admin bisa atur plan + durasi hari langsung dari Admin Panel.
        </p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-300">Status saat ini</p>
          <p className="mt-1 text-lg font-semibold text-amber-300">
            {user?.premium?.active ? user.premium.plan : "Free Plan"}
          </p>
          <p className="text-sm text-slate-400">Expired: {expireDate}</p>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li>No ads saat play episode.</li>
          <li>Badge premium di profile.</li>
          <li>Prioritas support dari admin.</li>
        </ul>
        <a
          href="https://wa.me/6280000000000"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Hubungi WhatsApp Admin
        </a>
      </div>
    </section>
  );
}
