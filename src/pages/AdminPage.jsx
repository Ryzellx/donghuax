import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function AdminPage() {
  const { users, user: currentUser, adminUpdateUser, adminSetPremiumByEmail, adSlot, adminSetAdSlot, adLink, adminSetAdLink } =
    useAuth();
  const managedUsers = useMemo(
    () => users.filter((item) => item.role !== "admin" || item.id === currentUser?.id),
    [users, currentUser?.id]
  );
  const [activeUserId, setActiveUserId] = useState(managedUsers[0]?.id || "");
  const [message, setMessage] = useState("");
  const [premiumForm, setPremiumForm] = useState({ email: "", days: 30 });
  const [adLinkInput, setAdLinkInput] = useState(adLink || "");

  const activeUser = useMemo(
    () => managedUsers.find((item) => item.id === activeUserId) || null,
    [managedUsers, activeUserId]
  );

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const syncForm = (target) => {
    setForm({
      username: target?.username || "",
      email: target?.email || "",
      password: target?.password || "",
    });
    setPremiumForm({
      email: target?.email || "",
      days: Number(target?.premium?.days || 30),
    });
  };

  const onSelectUser = (nextId) => {
    setActiveUserId(nextId);
    setMessage("");
  };

  useEffect(() => {
    if (!managedUsers.length) return;
    if (!activeUserId || !managedUsers.some((item) => item.id === activeUserId)) {
      setActiveUserId(managedUsers[0].id);
      return;
    }
    const target = managedUsers.find((item) => item.id === activeUserId);
    syncForm(target);
  }, [managedUsers, activeUserId]);

  const onSaveUser = (e) => {
    e.preventDefault();
    if (!activeUser) return;
    const result = adminUpdateUser(activeUser.id, {
      username: form.username,
      email: form.email,
      password: form.password,
    });
    setMessage(result.ok ? "User berhasil diupdate." : result.error);
  };

  const onSetPremium = () => {
    const result = adminSetPremiumByEmail({
      email: premiumForm.email,
      days: Number(premiumForm.days),
    });
    setMessage(result.ok ? "Premium plan berhasil diupdate." : result.error);
  };

  const adSlotOptions = [
    { value: "top-center", label: "Atas Tengah" },
    { value: "bottom-right", label: "Kanan Bawah" },
    { value: "bottom-left", label: "Kiri Bawah" },
    { value: "middle-right", label: "Kanan Tengah" },
    { value: "middle-left", label: "Kiri Tengah" },
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur xl:p-7">
        <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">Admin Panel</h1>
        <p className="mt-2 text-sm text-slate-300">
          Kelola data user, reset password, update email/username, dan atur premium plan.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">User List</p>
          <div className="space-y-2">
            {managedUsers.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectUser(item.id)}
                className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                  activeUserId === item.id
                    ? "border-cyan-300/60 bg-cyan-400/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <p className="font-semibold text-white">{item.username}</p>
                <p className="text-xs text-slate-400">{item.email}</p>
                <p className="mt-1 text-[11px] text-amber-300">
                  {item.premium?.active ? `${item.premium.plan} (${item.premium.days} hari)` : "Free Plan"}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          {!activeUser ? (
            <p className="text-sm text-slate-400">Pilih user terlebih dahulu.</p>
          ) : (
            <form onSubmit={onSaveUser} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-300">
                  Username
                  <input
                    value={form.username}
                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 outline-none focus:border-cyan-300/60"
                    required
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 outline-none focus:border-cyan-300/60"
                    required
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Password
                  <input
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 outline-none focus:border-cyan-300/60"
                    required
                  />
                </label>
              </div>
              <p className="text-xs text-slate-400">Foto profil dikunci otomatis (random donghua avatar) dan tidak bisa diubah admin.</p>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Premium Plan</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,120px,auto]">
                  <input
                    value={premiumForm.email}
                    onChange={(e) => setPremiumForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 outline-none focus:border-cyan-300/60"
                    placeholder="email user"
                  />
                  <input
                    type="number"
                    min="0"
                    value={premiumForm.days}
                    onChange={(e) => setPremiumForm((prev) => ({ ...prev, days: e.target.value }))}
                    className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 outline-none focus:border-cyan-300/60"
                  />
                  <button
                    type="button"
                    onClick={onSetPremium}
                    className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Set Premium
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Advertisement Slot</p>
                <p className="mt-1 text-xs text-slate-400">
                  Posisi overlay iklan untuk user Free Plan di halaman watch.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    value={adSlot}
                    onChange={(e) => {
                      const result = adminSetAdSlot(e.target.value);
                      setMessage(result.ok ? "Posisi iklan berhasil diupdate." : result.error);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 outline-none focus:border-cyan-300/60 sm:max-w-xs"
                  >
                    {adSlotOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-300">Posisi aktif: {adSlot}</p>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    value={adLinkInput}
                    onChange={(e) => setAdLinkInput(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 outline-none focus:border-cyan-300/60"
                    placeholder="https://sponsor.com/promo"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const result = adminSetAdLink(adLinkInput);
                      setMessage(result.ok ? "Link iklan berhasil diupdate." : result.error);
                    }}
                    className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                  >
                    Simpan Link
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-300">Link aktif: {adLink || "-"}</p>

                <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Tutorial</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-300">
                    <li>Pilih posisi slot iklan dari dropdown.</li>
                    <li>Isi URL iklan pada box link, lalu klik Simpan Link.</li>
                    <li>Perubahan tersimpan otomatis dan langsung aktif di Watch Page.</li>
                    <li>User Free melihat iklan sesuai posisi ini, user Premium tidak melihat iklan.</li>
                  </ol>
                </div>
              </div>

              {message ? <p className="text-sm text-cyan-200">{message}</p> : null}

              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Save User Changes
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
