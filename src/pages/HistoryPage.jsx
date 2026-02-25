import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function HistoryPage() {
  const { watchHistory } = useAuth();

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
        <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">Riwayat Tontonan</h1>
        <p className="mt-1 text-sm text-slate-300">Episode yang pernah kamu buka akan muncul di sini.</p>
      </div>

      {watchHistory.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada riwayat tontonan.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {watchHistory.map((item) => {
            const query = [
              item.slug ? `slug=${encodeURIComponent(item.slug)}` : "",
              item.episodeNumber ? `ep=${encodeURIComponent(item.episodeNumber)}` : "",
              item.episodeId ? `epid=${encodeURIComponent(item.episodeId)}` : "",
            ]
              .filter(Boolean)
              .join("&");
            const target = `/watch/${encodeURIComponent(item.source || "anichin")}/${encodeURIComponent(
              item.animeId
            )}${query ? `?${query}` : ""}`;

            return (
              <Link
                key={item.id}
                to={target}
              className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 transition hover:border-cyan-300/60"
            >
              <div className="flex gap-3">
                <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                  {item.poster ? <img src={item.poster} alt={item.title} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-cyan-200">
                    Episode {item.episodeNumber || "?"} {item.episodeTitle ? `- ${item.episodeTitle}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {item.watchedAt ? new Date(item.watchedAt).toLocaleString("id-ID") : ""}
                  </p>
                </div>
              </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
