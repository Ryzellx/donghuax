import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ANIME_PROVIDER,
  api,
  extractCharacterList,
  extractEpisodeList,
  extractObject,
  extractRecommendationList,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";

function parseNumberish(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").replace(",", ".");
  const match = text.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const num = Number.parseFloat(match[1]);
  return Number.isFinite(num) ? num : null;
}

export default function AnimeDetailPage() {
  const { watchlist, addToWatchlist, removeFromWatchlist, watchedEpisodes, markEpisodeWatched } = useAuth();
  const { animeId, source } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const slug = new URLSearchParams(location.search).get("slug") || "";
  const rawSource = source || ANIME_PROVIDER;
  const animeSource = rawSource === "hianime" ? ANIME_PROVIDER : rawSource;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState({});
  const [episodes, setEpisodes] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");

        const [detailRes, episodesRes, charsRes, recRes] = await Promise.allSettled([
          api.getAnimeDetail(animeId, { source: animeSource, slug }),
          api.getAnimeEpisodes(animeId, 1, { source: animeSource, slug }),
          api.getAnimeCharacters(animeId, { source: animeSource, slug }),
          api.getAnimeRecommendations(animeId, { source: animeSource, slug }),
        ]);

        if (!active) return;

        const normalizedDetail =
          detailRes.status === "fulfilled"
            ? extractObject(detailRes.value, "anime")
            : {
                animeId,
                title: String(animeId || "").replace(/[-_]+/g, " ").trim() || animeId,
                source: animeSource,
                synopsis: "",
              };
        setDetail(normalizedDetail);
        setEpisodes(episodesRes.status === "fulfilled" ? extractEpisodeList(episodesRes.value) : []);
        setCharacters(charsRes.status === "fulfilled" ? extractCharacterList(charsRes.value) : []);
        setRecommendations(recRes.status === "fulfilled" ? extractRecommendationList(recRes.value, "anime") : []);

        if (detailRes.status === "rejected") {
          setError("Detail donghua belum lengkap, menampilkan data fallback sementara.");
        }
      } catch (err) {
        setError(err.message || "Gagal load detail donghua.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [animeId, animeSource, slug]);

  const synopsisText = useMemo(() => detail.synopsis || "No synopsis available.", [detail]);
  const animeSlug = detail.animeSlug || slug;
  const inWatchlist = useMemo(
    () => watchlist.some((item) => String(item?.animeId) === String(detail.animeId || animeId)),
    [watchlist, detail.animeId, animeId]
  );
  const watchedKeys = useMemo(() => {
    const key = String(detail.animeId || animeId);
    const list = watchedEpisodes?.[key];
    return new Set(Array.isArray(list) ? list.map((item) => String(item)) : []);
  }, [watchedEpisodes, detail.animeId, animeId]);
  const displayScore = useMemo(() => {
    const score = parseNumberish(detail?.score ?? detail?.moreInfo?.malscore ?? detail?.jikan?.score);
    return score == null ? "N/A" : score.toFixed(2);
  }, [detail]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-cyan-300" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
      >
        Kembali
      </button>

      <div className="grid gap-6 rounded-3xl border border-white/10 bg-slate-900/60 p-4 md:grid-cols-[220px,1fr]">
        <div className="overflow-hidden rounded-2xl bg-slate-800">
          {detail.poster ? <img src={detail.poster} alt={detail.title || "Donghua"} className="h-full w-full object-cover" /> : null}
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">{detail.title || animeId}</h1>
          <p className="mt-2 text-sm text-slate-300">{synopsisText}</p>

          <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">Status: {detail.status || "Unknown"}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">Episodes: {detail.episodes || "?"}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">Score: {displayScore}</div>
          </div>

          <Link
            to={`/watch/${encodeURIComponent(animeSource)}/${encodeURIComponent(detail.animeId || animeId)}${
              animeSlug ? `?slug=${encodeURIComponent(animeSlug)}` : ""
            }`}
            className="mt-4 inline-flex rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Open Streaming Links
          </Link>
          <button
            type="button"
            onClick={() => {
              if (inWatchlist) {
                removeFromWatchlist(detail.animeId || animeId);
                return;
              }
              addToWatchlist({
                animeId: detail.animeId || animeId,
                title: detail.title || animeId,
                poster: detail.poster || "",
                source: animeSource,
                slug: animeSlug,
              });
            }}
            className="ml-2 mt-4 inline-flex rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {inWatchlist ? "Remove Watchlist" : "Add Watchlist"}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
        <h2 className="font-heading text-xl font-bold text-white">Episodes</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {episodes.map((episode) => (
            <Link
              key={episode.id || episode.title}
              onClick={() =>
                markEpisodeWatched({
                  animeId: detail.animeId || animeId,
                  episodeId: episode.episodeId || "",
                  episodeNumber: episode.number || null,
                  title: detail.title || animeId,
                  episodeTitle: episode.title || "",
                  poster: detail.poster || "",
                  source: animeSource,
                  slug: animeSlug,
                })
              }
              to={`/watch/${encodeURIComponent(animeSource)}/${encodeURIComponent(detail.animeId || animeId)}${
                animeSlug ? `?slug=${encodeURIComponent(animeSlug)}` : ""
              }${episode.number ? `${animeSlug ? "&" : "?"}ep=${encodeURIComponent(episode.number)}` : ""}${
                episode.episodeId ? `${animeSlug || episode.number ? "&" : "?"}epid=${encodeURIComponent(episode.episodeId)}` : ""
              }`}
              className={`rounded-xl border px-3 py-2 text-sm transition hover:border-cyan-300/60 ${
                watchedKeys.has(String(episode.episodeId || episode.number || ""))
                  ? "border-white/10 bg-slate-950/40 text-slate-500"
                  : "border-white/10 bg-slate-950 text-white"
              }`}
            >
              {episode.title}
            </Link>
          ))}
          {episodes.length === 0 ? (
            <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
              <p>Daftar episode belum tersedia.</p>
              <Link
                to={`/watch/${encodeURIComponent(animeSource)}/${encodeURIComponent(detail.animeId || animeId)}${
                  animeSlug ? `?slug=${encodeURIComponent(animeSlug)}` : ""
                }`}
                className="inline-flex rounded-full border border-amber-300/50 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/10"
              >
                Coba Buka Halaman Nonton
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {characters.length > 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
          <h2 className="font-heading text-xl font-bold text-white">Characters</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {characters.slice(0, 12).map((character) => (
              <div key={character.id} className="rounded-2xl border border-white/10 bg-black/20 p-2">
                {character.image ? (
                  <img src={character.image} alt={character.name} className="aspect-[3/4] w-full rounded-lg object-cover" />
                ) : null}
                <p className="mt-2 line-clamp-2 text-xs font-semibold text-white">{character.name}</p>
                <p className="text-[11px] text-slate-400">{character.role || "Character"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
          <h2 className="font-heading text-xl font-bold text-white">Recommendations</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {recommendations.slice(0, 10).map((item) => (
              <Link
                key={item.animeId}
                to={`/anime/${encodeURIComponent(item.source || animeSource)}/${encodeURIComponent(item.animeId)}${
                  item.animeSlug ? `?slug=${encodeURIComponent(item.animeSlug)}` : ""
                }`}
                className="rounded-xl border border-white/10 bg-black/20 p-2"
              >
                {item.poster ? <img src={item.poster} alt={item.title} className="aspect-[3/4] w-full rounded-lg object-cover" /> : null}
                <p className="mt-2 line-clamp-2 text-xs font-semibold text-white">{item.title}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
