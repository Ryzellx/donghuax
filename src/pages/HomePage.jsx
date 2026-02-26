import { useEffect, useMemo, useState } from "react";
import HeroBanner from "../components/HeroBanner";
import HorizontalRail from "../components/HorizontalRail";
import { api, extractGenreList, extractHomeLists, extractList } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const SEARCH_HISTORY_KEY = "donghuax_search_history_v1";
const SEARCH_HISTORY_LIMIT = 12;

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a, b) {
  const left = normalizeSearchText(a);
  const right = normalizeSearchText(b);
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[rows - 1][cols - 1];
}

function pickBestCorrection(query, items = []) {
  const base = normalizeSearchText(query);
  if (!base || !Array.isArray(items) || items.length === 0) return "";

  let best = "";
  let bestScore = Number.POSITIVE_INFINITY;

  items.forEach((item) => {
    const candidate = String(item || "").trim();
    if (!candidate) return;
    const normalizedCandidate = normalizeSearchText(candidate);
    if (!normalizedCandidate || normalizedCandidate === base) return;
    const dist = levenshteinDistance(base, normalizedCandidate);
    const maxLen = Math.max(base.length, normalizedCandidate.length, 1);
    const ratio = dist / maxLen;
    if (ratio < bestScore) {
      bestScore = ratio;
      best = candidate;
    }
  });

  return bestScore <= 0.45 ? best : "";
}

export default function HomePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [home, setHome] = useState({
    spotlight: [],
    trending: [],
    latestEpisodes: [],
    topAiring: [],
    mostPopular: [],
    latestCompleted: [],
    topUpcoming: [],
  });
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [searchCorrection, setSearchCorrection] = useState("");
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [genreItems, setGenreItems] = useState([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setSearchHistory(Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, SEARCH_HISTORY_LIMIT) : []);
    } catch {
      setSearchHistory([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [homePayload, genrePayload] = await Promise.allSettled([api.getHome(), api.getGenres()]);
        if (!active) return;
        setHome(extractHomeLists(homePayload.status === "fulfilled" ? homePayload.value : {}));
        const parsedGenres = extractGenreList(genrePayload.status === "fulfilled" ? genrePayload.value : {});
        setGenres(parsedGenres);
        if (parsedGenres.length > 0) setSelectedGenre(parsedGenres[0].slug);
      } catch (err) {
        if (!active) return;
        setError(err.message || "Gagal load homepage donghua.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!selectedGenre) {
      setGenreItems([]);
      return undefined;
    }

    (async () => {
      try {
        setGenreLoading(true);
        const payload = await api.getGenreAnime(selectedGenre, 1);
        if (!active) return;
        setGenreItems(extractList(payload).slice(0, 18));
      } catch {
        if (!active) return;
        setGenreItems([]);
      } finally {
        if (active) setGenreLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedGenre]);

  const featuredPool = useMemo(() => {
    const merged = [
      ...(Array.isArray(home.spotlight) ? home.spotlight : []),
      ...(Array.isArray(home.trending) ? home.trending : []),
      ...(Array.isArray(home.latestEpisodes) ? home.latestEpisodes : []),
    ];
    const seen = new Set();
    return merged.filter((item) => {
      const id = String(item?.animeId || item?.id || item?.title || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [home.spotlight, home.trending, home.latestEpisodes]);

  useEffect(() => {
    setFeaturedIndex(0);
  }, [featuredPool.length]);

  useEffect(() => {
    if (featuredPool.length <= 1) return undefined;
    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredPool.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [featuredPool.length]);

  const featured = useMemo(
    () =>
      featuredPool[featuredIndex] || home.topAiring?.[0] || home.mostPopular?.[0] || home.latestEpisodes?.[0] || null,
    [featuredPool, featuredIndex, home.topAiring, home.mostPopular, home.latestEpisodes]
  );

  const filteredHistory = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return searchHistory.slice(0, 6);
    return searchHistory.filter((item) => normalizeSearchText(item).includes(q)).slice(0, 6);
  }, [searchHistory, query]);

  const writeSearchHistory = (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return;
    setSearchHistory((prev) => {
      const next = [cleaned, ...prev.filter((item) => normalizeSearchText(item) !== normalizeSearchText(cleaned))].slice(
        0,
        SEARCH_HISTORY_LIMIT
      );
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };

  const runSearch = async (rawQuery) => {
    const cleaned = String(rawQuery || "").trim();
    if (!cleaned) {
      setSearchResults([]);
      setSearchCorrection("");
      return;
    }

    try {
      setError("");
      setSearchCorrection("");
      const payload = await api.searchAnime(cleaned);
      const list = extractList(payload);
      setSearchResults(list);
      writeSearchHistory(cleaned);

      if (list.length > 0) {
        const localCorrection = pickBestCorrection(
          cleaned,
          list.map((item) => item?.title || item?.headline || "")
        );
        if (localCorrection) setSearchCorrection(localCorrection);
        return;
      }

      const fallbackToken = cleaned.split(/\s+/).find((token) => token.length >= 3) || "";
      if (fallbackToken && normalizeSearchText(fallbackToken) !== normalizeSearchText(cleaned)) {
        try {
          const fallbackPayload = await api.searchAnime(fallbackToken);
          const fallbackList = extractList(fallbackPayload);
          const fallbackCorrection = pickBestCorrection(
            cleaned,
            fallbackList.map((item) => item?.title || item?.headline || "")
          );
          if (fallbackCorrection) setSearchCorrection(fallbackCorrection);
        } catch {
          // ignore correction fetch failures
        }
      }
    } catch (err) {
      setError(err.message || "Search donghua gagal.");
      setSearchResults([]);
      setSearchCorrection("");
    }
  };

  const onSearch = async (e) => {
    e.preventDefault();
    await runSearch(query);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-cyan-300"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4 sm:space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Welcome</p>
          <p className="mt-1 text-base font-semibold text-white sm:text-lg">{user?.username || "User"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Account Plan</p>
          <p className="mt-1 text-base font-semibold text-amber-300 sm:text-lg">
            {user?.premium?.active ? user.premium.plan : "Free Plan"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Donghua Catalog</p>
          <p className="mt-1 text-base font-semibold text-cyan-200 sm:text-lg">Live</p>
        </div>
      </section>

      <div key={`featured-${featured?.animeId || featured?.id || featuredIndex}`}>
        <HeroBanner anime={featured} />
      </div>

      <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
        <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-4 py-3 text-sm outline-none transition focus:border-cyan-300/60"
            placeholder="Cari donghua favorit..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
          >
            Search
          </button>
        </form>
        {filteredHistory.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-400">Riwayat</span>
            {filteredHistory.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setQuery(item);
                  runSearch(item);
                }}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-300/50 hover:text-white"
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        {searchCorrection ? (
          <p className="mt-3 text-xs text-amber-300">
            Mungkin maksud kamu:{" "}
            <button
              type="button"
              className="font-semibold underline underline-offset-2"
              onClick={() => {
                setQuery(searchCorrection);
                runSearch(searchCorrection);
              }}
            >
              {searchCorrection}
            </button>
          </p>
        ) : null}
      </section>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {searchResults.length > 0 ? <HorizontalRail title="Hasil Pencarian Donghua" items={searchResults} /> : null}

      {genres.length > 0 ? (
        <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-heading text-xl font-bold text-white">Pilih Genre</h2>
            {genreLoading ? <p className="text-xs text-slate-400">Loading genre...</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {genres.slice(0, 24).map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => setSelectedGenre(item.slug)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  selectedGenre === item.slug
                    ? "bg-cyan-300 text-slate-950"
                    : "border border-white/15 bg-white/5 text-slate-300 hover:border-cyan-300/50"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedGenre && genreItems.length > 0 ? (
        <HorizontalRail
          title={`Genre: ${genres.find((item) => item.slug === selectedGenre)?.name || selectedGenre}`}
          items={genreItems}
        />
      ) : null}

      <HorizontalRail title="Terbaru Rilis" items={home.latestEpisodes} />
      <HorizontalRail title="Populer Hari Ini" items={home.mostPopular} />
      <HorizontalRail title="Rekomendasi Donghua" items={home.spotlight} />
      <HorizontalRail title="Movie Donghua" items={home.trending} />
      <HorizontalRail title="Upcoming Donghua" items={home.topUpcoming} />
    </div>
  );
}
