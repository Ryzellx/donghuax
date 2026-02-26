const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = String(RAW_API_BASE).replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 20000;
const FRONTEND_CACHE_PREFIX = "donghuax_cache_v1";
const memoryCache = new Map();
const inflightRequests = new Map();
export const ANIME_PROVIDER = "anichin";
export const MANGA_PROVIDER = "";

function toSafeText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const raw = search.toString();
  return raw ? `?${raw}` : "";
}

function normalizeExternalUrl(url) {
  const value = toSafeText(url).trim().replace(/\\\//g, "/");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return "";
}

function normalizeSourceKey(value) {
  return cleanSourceName(value, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function deriveSeriesSlug(slug) {
  const raw = toSafeText(slug).trim();
  if (!raw) return "";
  return raw.replace(/-episode-\d+.*$/i, "").trim() || raw;
}

function parseEpisodeNumber(value) {
  const text = toSafeText(value);
  if (!text) return null;
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const num = Number.parseInt(match[1], 10);
  return Number.isFinite(num) ? num : null;
}

function parseNumberish(value) {
  const text = toSafeText(value).replace(",", ".");
  const match = text.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const num = Number.parseFloat(match[1]);
  return Number.isFinite(num) ? num : null;
}

function cleanSourceName(value, fallback = "Source") {
  let text = toSafeText(value, fallback).trim();
  if (!text) return fallback;

  text = text
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/\b(?:www\.)?anichin\.(?:care|club|moe)\b/gi, "")
    .replace(/\bmega\b/gi, "")
    .replace(/\[[^\]]*ads[^\]]*\]/gi, "")
    .replace(/\(.*?ads.*?\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return text || fallback;
}

function extractScheduleDay(text) {
  const raw = toSafeText(text).toLowerCase();
  if (!raw) return "";
  const dayMap = [
    { key: "senin", label: "Senin" },
    { key: "selasa", label: "Selasa" },
    { key: "rabu", label: "Rabu" },
    { key: "kamis", label: "Kamis" },
    { key: "jumat", label: "Jumat" },
    { key: "sabtu", label: "Sabtu" },
    { key: "minggu", label: "Minggu" },
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  const hit = dayMap.find((item) => raw.includes(item.key));
  return hit?.label || "";
}

function extractWeeklyFrequency(text) {
  const raw = toSafeText(text).toLowerCase();
  if (!raw) return "";

  const timesMatch = raw.match(/(\d+)\s*x\s*(seminggu|minggu|week)/i);
  if (timesMatch) return `${timesMatch[1]}x/minggu`;

  const perWeekMatch = raw.match(/(\d+)\s*(kali|times?)\s*(per|\/)?\s*(minggu|week)/i);
  if (perWeekMatch) return `${perWeekMatch[1]}x/minggu`;

  if (/\bdaily\b|setiap hari|harian/i.test(raw)) return "7x/minggu";
  if (/weekdays|senin\s*-\s*jumat/i.test(raw)) return "5x/minggu";
  if (/weekends|sabtu\s*-\s*minggu/i.test(raw)) return "2x/minggu";
  if (/weekly|mingguan|setiap minggu/i.test(raw)) return "1x/minggu";

  return "";
}

function deriveScheduleInfo(item) {
  const statusText = toSafeText(item?.status);
  const headlineText = toSafeText(item?.headline);
  const titleText = toSafeText(item?.title);
  const sourceText = [statusText, headlineText, titleText].filter(Boolean).join(" | ");

  const day = extractScheduleDay(sourceText);
  const perWeek = extractWeeklyFrequency(sourceText);
  const scheduleText =
    day || perWeek ? `Tayang ${day || "jadwal belum pasti"}${perWeek ? ` - ${perWeek}` : ""}` : "Tayang: belum diumumkan";

  return { day, perWeek, scheduleText };
}

function buildCacheKey(url) {
  return `${FRONTEND_CACHE_PREFIX}:${url}`;
}

function readCachedValue(cacheKey) {
  const now = Date.now();
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory && inMemory.expiresAt > now) return inMemory.value;

  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expiresAt <= now) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    memoryCache.set(cacheKey, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCachedValue(cacheKey, value, ttlMs) {
  const entry = {
    value,
    expiresAt: Date.now() + Math.max(ttlMs, 1000),
  };
  memoryCache.set(cacheKey, entry);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // ignore storage quota/unavailable
  }
}

async function fetchJson(path, params = {}, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS, cacheTtlMs = 0) {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE_URL belum diatur.");
  }

  const url = `${API_BASE}${path}${toQuery(params)}`;
  const cacheKey = buildCacheKey(url);
  const method = String(init?.method || "GET").toUpperCase();
  const canUseCache = method === "GET" && cacheTtlMs > 0;

  if (canUseCache) {
    const cached = readCachedValue(cacheKey);
    if (cached != null) return cached;
    const inflight = inflightRequests.get(cacheKey);
    if (inflight) return inflight;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const networkRequest = (async () => {
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(init.headers || {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Permintaan gagal (${response.status}).`);
      }

      const payload = await response.json();
      if (canUseCache) writeCachedValue(cacheKey, payload, cacheTtlMs);
      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Koneksi timeout. Coba lagi.");
      }
      if (canUseCache) {
        const stale = readCachedValue(cacheKey);
        if (stale != null) return stale;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (canUseCache) inflightRequests.delete(cacheKey);
    }
  })();

  if (canUseCache) inflightRequests.set(cacheKey, networkRequest);

  return networkRequest;
}

function normalizeAnimeItem(item) {
  if (!item || typeof item !== "object") return null;

  const rawSlug = toSafeText(item.slug || item.animeId || item.id);
  const animeId = deriveSeriesSlug(rawSlug) || rawSlug;
  const title =
    toSafeText(item.title) ||
    toSafeText(item.name) ||
    toSafeText(item.headline) ||
    "Untitled Donghua";
  const episodes = parseEpisodeNumber(item.eps || item.episode || item.status || "");
  const status = toSafeText(item.status || item.headline || item.type || "");
  const poster = normalizeExternalUrl(item.thumbnail || item.poster || item.image || "");
  const synopsisValue = item.sinopsis;
  const synopsis =
    typeof synopsisValue === "string"
      ? synopsisValue
      : Array.isArray(synopsisValue?.paragraphs)
      ? synopsisValue.paragraphs.join(" ")
      : toSafeText(item.synopsis || item.description || "");
  const schedule = deriveScheduleInfo(item);

  return {
    ...item,
    id: animeId || title,
    animeId: animeId || title,
    animeSlug: animeId || "",
    episodeSlug: rawSlug,
    mediaType: "anime",
    source: ANIME_PROVIDER,
    title,
    poster,
    synopsis,
    score: parseNumberish(item.rating || item.score),
    rank: null,
    status,
    scheduleDay: schedule.day,
    schedulePerWeek: schedule.perWeek,
    scheduleText: schedule.scheduleText,
    episodes,
    episodesText: episodes ? `${episodes} eps` : status || "Episode tersedia",
  };
}

function hasUsableDetailPayload(payload) {
  const result = payload?.result;
  if (!result || typeof result !== "object") return false;

  const name = toSafeText(result?.name).trim().toLowerCase();
  if (name && name !== "unknown title") return true;
  if (Array.isArray(result?.episode) && result.episode.length > 0) return true;
  if (toSafeText(result?.sinopsis).trim()) return true;
  if (Array.isArray(result?.sinopsis?.paragraphs) && result.sinopsis.paragraphs.length > 0) return true;

  return false;
}

function normalizeSectionCards(payload, sectionNames) {
  const sections = Array.isArray(payload?.results) ? payload.results : [];
  if (!sections.length) return [];

  const wanted = sectionNames.map((item) => String(item).toLowerCase());
  const selected = sections
    .filter((section) => wanted.includes(String(section?.section || "").toLowerCase()))
    .flatMap((section) => (Array.isArray(section?.cards) ? section.cards : []));

  if (selected.length) return selected.map(normalizeAnimeItem).filter(Boolean);

  return sections
    .flatMap((section) => (Array.isArray(section?.cards) ? section.cards : []))
    .map(normalizeAnimeItem)
    .filter(Boolean);
}

function dedupeByAnimeId(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).filter((item) => {
    const id = toSafeText(item?.animeId || item?.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function extractList(payload) {
  const list = Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.data)
    ? payload.data
    : [];
  return list.map(normalizeAnimeItem).filter(Boolean);
}

export function extractMangaList() {
  return [];
}

export function extractGenreList(payload) {
  const list = Array.isArray(payload?.genres) ? payload.genres : [];
  return list
    .map((item) => ({
      name: toSafeText(item?.name),
      slug: toSafeText(item?.slug),
    }))
    .filter((item) => item.name && item.slug);
}

export function extractObject(payload) {
  const result = payload?.result && typeof payload.result === "object" ? payload.result : {};
  const normalized = normalizeAnimeItem(result) || {};
  const sinopsisTitle = toSafeText(result?.sinopsis?.title);
  const sinopsisParagraphs = Array.isArray(result?.sinopsis?.paragraphs)
    ? result.sinopsis.paragraphs.filter(Boolean).join("\n\n")
    : "";

  return {
    ...normalized,
    animeId: normalized.animeId || toSafeText(result?.slug) || toSafeText(payload?.slug) || "",
    animeSlug: normalized.animeSlug || toSafeText(result?.slug) || toSafeText(payload?.slug) || "",
    title: normalized.title || toSafeText(result?.name) || "Untitled Donghua",
    poster: normalized.poster || normalizeExternalUrl(result?.thumbnail || ""),
    synopsis: [sinopsisTitle, sinopsisParagraphs, normalized.synopsis].filter(Boolean).join("\n\n"),
    status: normalized.status || toSafeText(result?.status || ""),
    episodes: Array.isArray(result?.episode) ? result.episode.length : normalized.episodes,
    score: normalized.score,
    genre: Array.isArray(result?.genre) ? result.genre : [],
  };
}

export function extractHomeLists(payload) {
  const latestEpisodes = normalizeSectionCards(payload, ["latest_release"]);
  const mostPopular = normalizeSectionCards(payload, ["popular_today"]);
  const spotlight = normalizeSectionCards(payload, ["recommendation"]);
  const topUpcoming = normalizeSectionCards(payload, ["upcoming_donghua"]);
  const topAiring = normalizeSectionCards(payload, ["dropped_project"]);
  const trending = normalizeSectionCards(payload, ["movie"]);

  return {
    spotlight: dedupeByAnimeId(spotlight).slice(0, 16),
    trending: dedupeByAnimeId(trending).slice(0, 16),
    latestEpisodes: dedupeByAnimeId(latestEpisodes).slice(0, 16),
    topAiring: dedupeByAnimeId(topAiring).slice(0, 16),
    mostPopular: dedupeByAnimeId(mostPopular).slice(0, 16),
    latestCompleted: dedupeByAnimeId(trending).slice(0, 16),
    topUpcoming: dedupeByAnimeId(topUpcoming).slice(0, 16),
  };
}

export function extractEpisodeList(payload) {
  const baseList = Array.isArray(payload?.result?.episode)
    ? payload.result.episode
    : Array.isArray(payload?.data?.episodes)
    ? payload.data.episodes
    : [];

  return baseList
    .map((episode) => {
      const episodeId = toSafeText(episode?.slug || episode?.episodeId || episode?.id);
      const number = parseEpisodeNumber(episode?.episode || episode?.subtitle || episode?.name || episodeId);
      const rawTitle = toSafeText(episode?.subtitle) || toSafeText(episode?.name);
      const fallbackNo = parseEpisodeNumber(episodeId) || 0;
      const episodeNo = number || fallbackNo;
      const title = rawTitle
        ? /^episode\s*\d+/i.test(rawTitle)
          ? rawTitle
          : episodeNo
          ? `Episode ${episodeNo} - ${rawTitle}`
          : rawTitle
        : episodeNo
        ? `Episode ${episodeNo}`
        : "Episode";

      return {
        ...episode,
        id: episodeId || title,
        episodeId,
        number,
        title,
        animeId: toSafeText(episode?.root || payload?.slug || ""),
        animeSlug: toSafeText(episode?.root || payload?.slug || ""),
      };
    })
    .filter((item) => item.episodeId || item.id);
}

export function extractCharacterList() {
  return [];
}

export function extractStreamingLinks() {
  return [];
}

export function extractVideoList() {
  return [];
}

export function extractRecommendationList() {
  return [];
}

function mapPlayersToServers(players) {
  if (!Array.isArray(players)) return [];
  return players
    .map((player, idx) => {
      const name = cleanSourceName(player?.name, `Server ${idx + 1}`);
      if (!name) return null;
      return { serverName: name, serverId: name, name };
    })
    .filter(Boolean);
}

function mapEpisodeSources(players, selectedServerName, videoPayload) {
  const sourcePlayers = Array.isArray(players) ? players : [];
  const wantedKey = normalizeSourceKey(selectedServerName);
  let filteredPlayers = sourcePlayers;

  if (wantedKey) {
    const exact = sourcePlayers.filter((player) => normalizeSourceKey(player?.name) === wantedKey);
    if (exact.length > 0) {
      filteredPlayers = exact;
    } else {
      const fuzzy = sourcePlayers.filter((player) => {
        const key = normalizeSourceKey(player?.name);
        return key && (key.includes(wantedKey) || wantedKey.includes(key));
      });
      filteredPlayers = fuzzy.length > 0 ? fuzzy : sourcePlayers;
    }
  }

  const playerSources = filteredPlayers
    .map((player, idx) => {
      const url = normalizeExternalUrl(player?.url || player?.src || player?.link || player?.file);
      if (!url) return null;
      const quality = cleanSourceName(player?.name, `Player ${idx + 1}`);
      return { quality, url };
    })
    .filter(Boolean);

  const mediaSources = Array.isArray(videoPayload?.medias)
    ? videoPayload.medias
        .map((media, idx) => {
          const url = normalizeExternalUrl(media?.url);
          if (!url) return null;
          const quality =
            cleanSourceName(media?.quality) ||
            toSafeText(media?.resolution) ||
            toSafeText(media?.format) ||
            `Media ${idx + 1}`;
          return { quality, url };
        })
        .filter(Boolean)
    : [];

  const seen = new Set();
  const merged = [...mediaSources, ...playerSources].filter((item) => {
    if (!item?.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  const rank = (item) => {
    const name = toSafeText(item?.quality).toLowerCase();
    const url = toSafeText(item?.url).toLowerCase();
    let score = 100;

    if (/\.(m3u8|mp4|webm)(\?|$)/i.test(url)) score -= 60;
    if (url.includes("ok.ru") || url.includes("dailymotion.com") || url.includes("rumble.com")) score -= 30;
    if (url.includes("videoembed") || url.includes("/embed")) score -= 20;
    if (name.includes("new player")) score -= 10;
    if (name.includes("ads") || url.includes("short.") || url.includes("rpmvid")) score += 25;

    return score;
  };

  return [...merged].sort((a, b) => rank(a) - rank(b));
}

export const api = {
  getHome: () => fetchJson("/", {}, {}, DEFAULT_TIMEOUT_MS, 120000),

  searchAnime: (query) =>
    fetchJson(`/search/${encodeURIComponent(query || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 180000),

  getSearchSuggestions: () => Promise.resolve({ data: [] }),
  getAzList: () => Promise.resolve({ data: [] }),
  getAnimeQtip: () => Promise.resolve({ data: {} }),
  getCategoryAnime: () => Promise.resolve({ data: [] }),
  getGenres: () => fetchJson("/genres", {}, {}, DEFAULT_TIMEOUT_MS, 21600000),
  getGenreAnime: (slug, page = 1) =>
    fetchJson(`/genre/${encodeURIComponent(slug || "")}`, { page }, {}, DEFAULT_TIMEOUT_MS, 300000),
  getProducerAnime: () => Promise.resolve({ data: [] }),
  getSchedule: () => Promise.resolve({ data: [] }),
  getNextEpisodeSchedule: () => Promise.resolve({ data: {} }),

  getAnimeDetail: async (animeId) => {
    const requestedSlug = toSafeText(animeId).trim();
    const seriesSlug = deriveSeriesSlug(requestedSlug) || requestedSlug;

    let detailPayload = null;
    try {
      detailPayload = await fetchJson(`/${encodeURIComponent(seriesSlug)}`, {}, {}, DEFAULT_TIMEOUT_MS, 600000);
    } catch {
      detailPayload = null;
    }

    if (!hasUsableDetailPayload(detailPayload)) {
      try {
        const episodePayload = await fetchJson(
          `/episode/${encodeURIComponent(requestedSlug)}`,
          {},
          {},
          DEFAULT_TIMEOUT_MS,
          300000
        );
        const rootSlug = deriveSeriesSlug(toSafeText(episodePayload?.result?.root)) || seriesSlug;
        const rootDetailPayload = await fetchJson(
          `/${encodeURIComponent(rootSlug)}`,
          {},
          {},
          DEFAULT_TIMEOUT_MS,
          600000
        );
        detailPayload = {
          ...(rootDetailPayload || {}),
          selectedEpisodeSlug: requestedSlug,
        };
      } catch {
        // keep original detail payload (or null) and let caller show fallback state
      }
    }

    const safePayload = detailPayload && typeof detailPayload === "object" ? detailPayload : { result: {} };
    return {
      ...safePayload,
      result: {
        ...(safePayload?.result || {}),
        slug: toSafeText(safePayload?.result?.slug || seriesSlug || requestedSlug),
      },
      slug: toSafeText(safePayload?.slug || seriesSlug || requestedSlug),
    };
  },

  getAnimeEpisodes: (animeId) => api.getAnimeDetail(animeId),

  getAnimeCharacters: () => Promise.resolve({ data: [] }),
  getAnimeStreaming: () => Promise.resolve({ data: [] }),
  getAnimeVideos: () => Promise.resolve({ data: [] }),
  getAnimeRecommendations: () => Promise.resolve({ data: [] }),

  getEpisodeServers: async (animeEpisodeId) => {
    const payload = await fetchJson(
      `/episode/${encodeURIComponent(animeEpisodeId)}`,
      {},
      {},
      DEFAULT_TIMEOUT_MS,
      300000
    );
    const players = Array.isArray(payload?.result?.players) ? payload.result.players : [];
    return {
      data: {
        sub: mapPlayersToServers(players),
        dub: [],
        raw: [],
      },
      payload,
    };
  },

  getEpisodeSources: async ({ animeEpisodeId, server = "" }) => {
    const episodePayload = await fetchJson(
      `/episode/${encodeURIComponent(animeEpisodeId)}`,
      {},
      {},
      DEFAULT_TIMEOUT_MS,
      300000
    );
    let videoPayload = null;

    try {
      videoPayload = await fetchJson(
        `/video-source/${encodeURIComponent(animeEpisodeId)}`,
        {},
        {},
        DEFAULT_TIMEOUT_MS,
        300000
      );
    } catch {
      videoPayload = null;
    }

    const players = Array.isArray(episodePayload?.result?.players) ? episodePayload.result.players : [];
    const sources = mapEpisodeSources(players, server, videoPayload);

    return {
      data: {
        sources,
      },
    };
  },

  getTopManga: () => Promise.resolve({ data: [] }),
  searchManga: () => Promise.resolve({ data: [] }),
  getMangaDetail: () => Promise.resolve({ data: {} }),
  getMangaCharacters: () => Promise.resolve({ data: [] }),
  getMangaRecommendations: () => Promise.resolve({ data: [] }),
};
