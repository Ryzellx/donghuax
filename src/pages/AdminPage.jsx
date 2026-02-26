import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function levenshteinDistance(a, b) {
  const s = normalizeText(a);
  const t = normalizeText(b);
  if (!s) return t.length;
  if (!t) return s.length;

  const dp = Array.from({ length: s.length + 1 }, () => Array(t.length + 1).fill(0));
  for (let i = 0; i <= s.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[s.length][t.length];
}

function getRemainingDays(endAt) {
  const endTime = new Date(endAt).getTime();
  if (!Number.isFinite(endTime)) return 0;
  const diff = endTime - Date.now();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

export default function AdminPage() {
  const {
    users,
    user: currentUser,
    adminUpdateUser,
    adminSetPremiumByEmail,
    adSlot,
    adminSetAdSlot,
    adLinks,
    adminSetAdLink,
    adminSetAdLinkSlot,
  } = useAuth();

  const managedUsers = useMemo(
    () => users.filter((item) => item.role !== "admin" || item.id === currentUser?.id),
    [users, currentUser?.id]
  );
  const [activeUserId, setActiveUserId] = useState(managedUsers[0]?.id || "");
  const [message, setMessage] = useState("");
  const [premiumForm, setPremiumForm] = useState({ email: "", days: 30 });
  const [searchQuery, setSearchQuery] = useState("");
  const [adDrafts, setAdDrafts] = useState([]);

  const normalizedSearch = useMemo(() => normalizeText(searchQuery), [searchQuery]);
  const searchWords = useMemo(
    () => normalizedSearch.split(" ").map((item) => item.trim()).filter(Boolean),
    [normalizedSearch]
  );
  const validWordCount = searchWords.length >= 2 && searchWords.length <= 3;

  const filteredUsers = useMemo(() => {
    if (!normalizedSearch) return managedUsers;
    return managedUsers.filter((item) => {
      const name = normalizeText(item.username);
      if (!name) return false;
      return searchWords.every((word) => name.includes(word));
    });
  }, [managedUsers, normalizedSearch, searchWords]);

  const searchSuggestions = useMemo(() => {
    if (!normalizedSearch || filteredUsers.length > 0) return [];
    const compactQuery = normalizedSearch.replace(/\s+/g, "");
    const maxDistance = Math.max(2, Math.floor(compactQuery.length * 0.4));

    return managedUsers
      .map((item) => {
        const username = normalizeText(item.username);
        const compactName = username.replace(/\s+/g, "");
        const directMatch = username.includes(normalizedSearch) || username.startsWith(normalizedSearch);
        const distance = levenshteinDistance(compactQuery, compactName);
        return { item, distance, directMatch };
      })
      .filter((entry) => entry.directMatch || entry.distance <= maxDistance)
      .sort((a, b) => {
        if (a.directMatch && !b.directMatch) return -1;
        if (!a.directMatch && b.directMatch) return 1;
        return a.distance - b.distance;
      })
      .slice(0, 5)
      .map((entry) => entry.item);
  }, [managedUsers, normalizedSearch, filteredUsers.length]);

  const listUsers = normalizedSearch ? filteredUsers : managedUsers;

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
      const target = listUsers[0] || managedUsers[0];
      if (target?.id) setActiveUserId(target.id);
      return;
    }
    const target = managedUsers.find((item) => item.id === activeUserId);
    syncForm(target);
  }, [managedUsers, activeUserId, listUsers]);

  useEffect(() => {
    setAdDrafts(
      (Array.isArray(adLinks) ? adLinks : []).map((entry) => ({
        slot: Number(entry?.slot || 0),
        link: entry?.url || "",
        imageUrl: entry?.imageUrl || "",
        durationDays: Number(entry?.durationDays || 7),
      }))
    );
  }, [adLinks]);

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

  const updateAdDraft = (slot, patch) => {
    setAdDrafts((prev) =>
      prev.map((item) => (item.slot === slot ? { ...item, ...patch } : item))
    );
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
          Kelola user, premium plan, dan 10 slot link iklan dengan durasi aktif.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">User List</p>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nickname (2-3 kata)"
            className="mb-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60"
          />
          {normalizedSearch && !validWordCount ? (
            <p className="mb-3 text-xs text-amber-300">Rekomendasi optimal: pakai 2-3 kata pencarian.</p>
          ) : null}
          <div className="space-y-2">
            {listUsers.map((item) => (
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
            {normalizedSearch && !listUsers.length ? (
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                Tidak ada user yang cocok.
              </p>
            ) : null}
          </div>

          {searchSuggestions.length ? (
            <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Rekomendasi Search</p>
              <div className="mt-2 space-y-2">
                {searchSuggestions.map((item) => (
                  <button
                    key={`suggest-${item.id}`}
                    type="button"
                    onClick={() => {
                      setSearchQuery(item.username || "");
                      onSelectUser(item.id);
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-left text-xs text-slate-200 hover:border-cyan-300/50"
                  >
                    {item.username}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
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
                <p className="text-sm font-semibold text-white">Advertisement Slot Position</p>
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
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">10 Slot Link Ads (Random + Durasi)</p>
                <p className="mt-1 text-xs text-slate-400">
                  Saat user klik iklan di Watch Page, sistem memilih random dari slot yang masih aktif.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {adDrafts.map((entry) => {
                    const savedSlot = (adLinks || []).find((item) => item.slot === entry.slot);
                    const remaining = getRemainingDays(savedSlot?.endAt);
                    const isActive = Boolean(savedSlot?.url) && remaining > 0;
                    return (
                      <div key={`ad-slot-${entry.slot}`} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Slot {entry.slot}</p>
                        <input
                          value={entry.link}
                          onChange={(e) => updateAdDraft(entry.slot, { link: e.target.value })}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                          placeholder="https://sponsor.com/promo"
                        />
                        <input
                          value={entry.imageUrl || ""}
                          onChange={(e) => updateAdDraft(entry.slot, { imageUrl: e.target.value })}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                          placeholder="https://cdn.sponsor.com/banner.jpg"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={entry.durationDays}
                            onChange={(e) => updateAdDraft(entry.slot, { durationDays: e.target.value })}
                            className="w-24 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                          />
                          <span className="text-xs text-slate-300">hari</span>
                          <button
                            type="button"
                            onClick={() => {
                              const result = adminSetAdLinkSlot({
                                slot: entry.slot,
                                link: entry.link,
                                imageUrl: entry.imageUrl,
                                durationDays: Number(entry.durationDays),
                              });
                              setMessage(
                                result.ok
                                  ? `Slot ${entry.slot} tersimpan.`
                                  : result.error
                              );
                            }}
                            className="ml-auto rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
                          >
                            Simpan
                          </button>
                        </div>
                        <p className={`mt-2 text-xs ${isActive ? "text-emerald-300" : "text-slate-400"}`}>
                          {isActive
                            ? `Aktif (${remaining} hari lagi)`
                            : savedSlot?.url
                              ? "Expired"
                              : "Belum diisi"}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Tutorial</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-300">
                    <li>Isi URL iklan pada slot 1-10.</li>
                    <li>Tentukan durasi aktif (hari), lalu klik Simpan.</li>
                    <li>Saat iklan di klik user, link aktif dipilih random.</li>
                    <li>Jika durasi habis, slot otomatis tidak dipakai.</li>
                  </ol>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-300">
                  Kompatibilitas lama: tombol ini set ke slot 1.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const slot1 = adDrafts.find((item) => item.slot === 1);
                    const result = adminSetAdLink(slot1?.link || "");
                    setMessage(result.ok ? "Link slot 1 berhasil diupdate." : result.error);
                  }}
                  className="mt-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
                >
                  Simpan Slot 1 (Legacy)
                </button>
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
