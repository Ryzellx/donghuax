import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Hls from "hls.js";
import { useAuth } from "../context/AuthContext";
import { ANIME_PROVIDER, api, extractEpisodeList, extractObject, extractVideoList } from "../lib/api";

function toSafeText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function normalizeUrl(url) {
  const value = toSafeText(url).trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return "";
}

function toPlayableEmbedUrl(url) {
  if (!url || typeof url !== "string") return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) return parsed.toString();
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : "";
      }
    }

    if (host === "youtu.be") {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    if (
      host.includes("ok.ru") ||
      host.includes("dailymotion.com") ||
      host.includes("rumble.com") ||
      host.includes("vidhide") ||
      host.includes("rubyvid") ||
      host.includes("listeamed.net") ||
      host.includes("vidguard") ||
      host.includes("streamwish") ||
      host.includes("filemoon") ||
      host.includes("dood") ||
      host.includes("mixdrop") ||
      host.includes("streamtape") ||
      host.includes("mp4upload") ||
      host.includes("turbovidhls.com") ||
      /^\/e\/[^/]+/i.test(parsed.pathname) ||
      parsed.pathname.includes("/embed") ||
      parsed.pathname.includes("videoembed")
    ) {
      return parsed.toString();
    }
    return "";
  } catch {
    return "";
  }
}

function isDirectMediaUrl(url) {
  const value = toSafeText(url);
  return /\.(m3u8|mp4|webm)(\?|$)/i.test(value);
}

function collectUrlsDeep(value, found = new Set(), depth = 0) {
  if (depth > 8 || value == null) return found;

  if (typeof value === "string") {
    const normalized = normalizeUrl(value);
    if (normalized) found.add(normalized);
    return found;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectUrlsDeep(item, found, depth + 1));
    return found;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      const keyLower = key.toLowerCase();
      if (typeof item === "string") {
        const normalized = normalizeUrl(item);
        if (
          normalized &&
          (keyLower.includes("url") ||
            keyLower.includes("src") ||
            keyLower.includes("file") ||
            keyLower.includes("embed") ||
            keyLower.includes("stream") ||
            keyLower.includes("video") ||
            keyLower.includes("link"))
        ) {
          found.add(normalized);
        }
      }
      collectUrlsDeep(item, found, depth + 1);
    });
  }

  return found;
}

function mergeLinks(...groups) {
  const flat = groups.flat().filter(Boolean);
  const seen = new Set();
  const merged = [];

  flat.forEach((item) => {
    const url = normalizeUrl(item?.url);
    if (!url || seen.has(url)) return;
    seen.add(url);
    merged.push({ id: item.id || url, name: item.name || "Source", url });
  });

  return merged;
}

function pickDirectVideoUrl(streams) {
  const candidates = streams.map((item) => item.url);
  return candidates.find((url) => /\.(mp4|webm)(\?|$)/i.test(url)) || "";
}

function extractServerOptions(payload) {
  const base = payload?.data || {};
  const categories = ["sub", "dub", "raw"];
  const out = { sub: [], dub: [], raw: [] };

  categories.forEach((category) => {
    const list = Array.isArray(base?.[category]) ? base[category] : [];
    out[category] = list
      .map((server, idx) => {
        const id = toSafeText(server?.serverName || server?.server_name || server?.serverId || server?.server_id);
        if (!id) return null;
        return {
          id,
          name: toSafeText(server?.serverName || server?.server_name || server?.name, `Server ${idx + 1}`),
        };
      })
      .filter(Boolean);
  });

  return out;
}

function rankServerName(name) {
  const key = toSafeText(name).trim().toLowerCase();
  if (!key) return 999;
  if (key.includes("ok.ru") || key === "ok.ru" || key.includes("okru")) return 1;
  if (key.includes("dailymotion")) return 2;
  if (key.includes("rumble")) return 3;
  if (key === "hd-2") return 1;
  if (key === "hd-1") return 2;
  if (key === "hd-3") return 3;
  if (key.includes("vid")) return 6;
  if (key.includes("mega")) return 7;
  return 50;
}

function pickBestServer(servers) {
  if (!Array.isArray(servers) || servers.length === 0) return null;
  return [...servers].sort((a, b) => rankServerName(a?.name || a?.id) - rankServerName(b?.name || b?.id))[0] || null;
}

function extractSourceLinks(payload) {
  const sourceList = Array.isArray(payload?.data?.sources) ? payload.data.sources : [];
  const sourceLinks = sourceList
    .map((item, idx) => {
      const url = normalizeUrl(item?.url);
      if (!url) return null;
      const quality = toSafeText(item?.quality);
      return {
        id: `source-${idx}-${quality || "stream"}`,
        name: quality ? `Source ${quality}` : `Source ${idx + 1}`,
        url,
      };
    })
    .filter(Boolean);

  const nestedLinks = Array.from(collectUrlsDeep(payload)).map((url, idx) => ({
    id: `auto-${idx}`,
    name: `Auto ${idx + 1}`,
    url,
  }));

  return mergeLinks(sourceLinks, nestedLinks);
}

function pickEpisodeId(episodes, episodeIdFromQuery, episodeFromQuery) {
  const byId = toSafeText(episodeIdFromQuery).trim();
  if (byId) return byId;

  const epNo = Number(episodeFromQuery);
  if (Number.isFinite(epNo) && epNo > 0) {
    const hit = episodes.find((item) => Number(item?.number) === epNo);
    if (hit?.episodeId) return hit.episodeId;
  }

  if (!Array.isArray(episodes) || episodes.length === 0) return "";

  const byLowestNumber = [...episodes]
    .filter((item) => item?.episodeId)
    .sort((a, b) => Number(a?.number || 0) - Number(b?.number || 0))[0];

  if (byLowestNumber?.episodeId) return toSafeText(byLowestNumber.episodeId);

  return toSafeText(episodes?.[0]?.episodeId || episodes?.[episodes.length - 1]?.episodeId);
}

function formatEpisodeLabel(episode, index = 0) {
  const number = Number(episode?.number);
  const rawTitle = toSafeText(episode?.title).trim();
  const fallbackNo = index + 1;
  const episodeNo = Number.isFinite(number) && number > 0 ? number : fallbackNo;

  if (!rawTitle) return `Episode ${episodeNo}`;
  if (/^episode\s*\d+/i.test(rawTitle)) return rawTitle;
  return `Episode ${episodeNo} - ${rawTitle}`;
}

function sortEpisodesAscending(list = []) {
  return [...list].sort((a, b) => {
    const aNum = Number(a?.number);
    const bNum = Number(b?.number);
    const aHasNum = Number.isFinite(aNum) && aNum > 0;
    const bHasNum = Number.isFinite(bNum) && bNum > 0;

    if (aHasNum && bHasNum) return aNum - bNum;
    if (aHasNum) return -1;
    if (bHasNum) return 1;
    return formatEpisodeLabel(a).localeCompare(formatEpisodeLabel(b), "id", { sensitivity: "base" });
  });
}

function getYouTubeEmbed(detail, videos) {
  const candidates = [
    detail?.trailer?.embed_url,
    detail?.trailer?.url,
    videos.find((item) => item.embedUrl)?.embedUrl,
    videos.find((item) => item.url)?.url,
  ];

  for (const candidate of candidates) {
    const embed = toPlayableEmbedUrl(candidate || "");
    if (embed) return embed;
  }

  return "";
}

function buildCategoryCandidateOrder(selectedCategory, serverByCategory) {
  const baseOrder = [selectedCategory, "sub", "dub", "raw"];
  const seen = new Set();
  const ordered = [];

  baseOrder.forEach((item) => {
    const key = toSafeText(item).toLowerCase();
    if (!key || seen.has(key)) return;
    if (!Array.isArray(serverByCategory?.[key]) || serverByCategory[key].length === 0) return;
    seen.add(key);
    ordered.push(key);
  });

  return ordered;
}

export default function WatchPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, markEpisodeWatched, adLink } = useAuth();

  const animeId = params.animeId || "";
  const sourceParam = params.source || ANIME_PROVIDER;
  const source = sourceParam === "hianime" ? ANIME_PROVIDER : sourceParam;
  const searchParams = new URLSearchParams(location.search);
  const episodeFromQuery = searchParams.get("ep") || "";
  const episodeIdFromQuery = searchParams.get("epid") || "";
  const slug = searchParams.get("slug") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState({});
  const [videos, setVideos] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState("");
  const [selectedEpisodeNumber, setSelectedEpisodeNumber] = useState(null);
  const [serverByCategory, setServerByCategory] = useState({ sub: [], dub: [], raw: [] });
  const [selectedCategory, setSelectedCategory] = useState("sub");
  const [selectedServerId, setSelectedServerId] = useState("");
  const [streamLinks, setStreamLinks] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedSourceUrl, setSelectedSourceUrl] = useState("");
  const [loadingSources, setLoadingSources] = useState(false);
  const [sponsorUnlocked, setSponsorUnlocked] = useState(false);
  const [canShowAdImage, setCanShowAdImage] = useState(true);
  const [watchedMeta, setWatchedMeta] = useState(null);
  const lastMarkedRef = useRef("");
  const failedSourceUrlsRef = useRef(new Set());
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const isPremium = useMemo(() => Boolean(user?.premium?.active), [user?.premium?.active]);
  const showAdOverlay = useMemo(() => !isPremium && !sponsorUnlocked, [isPremium, sponsorUnlocked]);
  const selectedCategoryServers = serverByCategory?.[selectedCategory] || [];
  const hasCategory = useMemo(
    () =>
      ["sub", "dub", "raw"].filter((key) => Array.isArray(serverByCategory?.[key]) && serverByCategory[key].length > 0),
    [serverByCategory]
  );

  useEffect(() => {
    setSponsorUnlocked(false);
    setCanShowAdImage(true);
  }, [animeId, source, episodeFromQuery, episodeIdFromQuery, slug]);

  useEffect(() => {
    if (!showAdOverlay) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showAdOverlay]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const [detailRes, episodesRes, videosRes] = await Promise.allSettled([
          api.getAnimeDetail(animeId, { source, slug }),
          api.getAnimeEpisodes(animeId, 1, { source, slug }),
          api.getAnimeVideos(animeId, { source, slug }),
        ]);

        if (!active) return;

        const normalizedDetail = detailRes.status === "fulfilled" ? extractObject(detailRes.value, "anime") : {};
        const parsedEpisodesUnsorted = episodesRes.status === "fulfilled" ? extractEpisodeList(episodesRes.value) : [];
        const parsedEpisodes = sortEpisodesAscending(parsedEpisodesUnsorted);
        const parsedVideos = videosRes.status === "fulfilled" ? extractVideoList(videosRes.value) : [];

        setDetail(normalizedDetail);
        setEpisodes(parsedEpisodes);
        setVideos(parsedVideos);

        const episodeId = pickEpisodeId(parsedEpisodes, episodeIdFromQuery, episodeFromQuery);
        if (!episodeId) {
          setSelectedEpisodeId("");
          setServerByCategory({ sub: [], dub: [], raw: [] });
          setStreamLinks([]);
          setError("Episode belum tersedia untuk donghua ini.");
          return;
        }

        setSelectedEpisodeId(episodeId);
        const currentEpisode = parsedEpisodes.find((item) => item?.episodeId === episodeId) || null;
        setSelectedEpisodeNumber(Number(currentEpisode?.number) || null);
        setWatchedMeta({
          animeId: normalizedDetail?.animeId || animeId,
          episodeId,
          episodeNumber: Number(currentEpisode?.number) || null,
          title: normalizedDetail?.title || animeId,
          episodeTitle: toSafeText(currentEpisode?.title),
          poster: normalizedDetail?.poster || "",
          source: source || ANIME_PROVIDER,
          slug,
        });

        if (source !== ANIME_PROVIDER) {
          setServerByCategory({ sub: [], dub: [], raw: [] });
          setSelectedServerId("");
          return;
        }

        const serversPayload = await api.getEpisodeServers(episodeId);
        if (!active) return;

        const serverOptions = extractServerOptions(serversPayload);
        setServerByCategory(serverOptions);

        const defaultCategory = ["sub", "dub", "raw"].find((key) => serverOptions[key]?.length > 0) || "sub";
        setSelectedCategory(defaultCategory);
        const defaultServer = pickBestServer(serverOptions[defaultCategory] || []);
        setSelectedServerId(defaultServer?.id || "");
      } catch (err) {
        setError(err.message || "Gagal memuat halaman watch.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [animeId, source, slug, episodeFromQuery, episodeIdFromQuery]);

  useEffect(() => {
    if (!watchedMeta?.animeId) return;
    const key = `${watchedMeta.animeId}:${watchedMeta.episodeId || watchedMeta.episodeNumber || ""}`;
    if (!key || lastMarkedRef.current === key) return;
    lastMarkedRef.current = key;
    markEpisodeWatched(watchedMeta);
  }, [watchedMeta, markEpisodeWatched]);

  useEffect(() => {
    if (!selectedCategoryServers.length) {
      setSelectedServerId("");
      return;
    }
    if (isPremium && selectedCategoryServers.some((item) => item.id === selectedServerId)) return;

    const best = pickBestServer(selectedCategoryServers);
    setSelectedServerId(best?.id || selectedCategoryServers[0].id);
  }, [selectedCategoryServers, selectedServerId, isPremium]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (source !== ANIME_PROVIDER || !selectedEpisodeId || !selectedServerId) {
        setStreamLinks([]);
        setSelectedSourceId("");
        setSelectedSourceUrl("");
        return;
      }

      try {
        setLoadingSources(true);
        const categoryOrder = isPremium
          ? [selectedCategory]
          : buildCategoryCandidateOrder(selectedCategory, serverByCategory);
        const candidatesByCategory = categoryOrder.map((category) => ({
          category,
          servers: (serverByCategory?.[category] || [])
            .filter((item) => item?.id)
            .sort((a, b) => rankServerName(a?.name || a?.id) - rankServerName(b?.name || b?.id))
            .map((item) => item.id),
        }));

        let loadedLinks = [];
        let pickedServer = selectedServerId;
        let pickedCategory = selectedCategory;
        let lastError = null;

        for (const group of candidatesByCategory) {
          const serverIds =
            isPremium && selectedServerId
              ? [selectedServerId]
              : group.servers;

          for (const serverId of serverIds) {
            try {
              const payload = await api.getEpisodeSources({
                animeEpisodeId: selectedEpisodeId,
                server: serverId,
                category: group.category,
              });
              const links = extractSourceLinks(payload);
              if (links.length > 0) {
                loadedLinks = links;
                pickedServer = serverId;
                pickedCategory = group.category;
                break;
              }
            } catch (err) {
              lastError = err;
            }
          }
          if (loadedLinks.length > 0) break;
        }

        if (loadedLinks.length > 0) {
          if (!isPremium && pickedCategory !== selectedCategory) {
            setSelectedCategory(pickedCategory);
          }
          if (!isPremium && pickedServer !== selectedServerId) {
            setSelectedServerId(pickedServer);
          }
          setError("");
        }

        if (!active) return;
        if (!loadedLinks.length) {
          throw lastError || new Error("Tidak ada source valid dari server yang tersedia.");
        }

        setStreamLinks(loadedLinks);
        setSelectedSourceId((current) => (loadedLinks.some((item) => item.id === current) ? current : loadedLinks[0]?.id || ""));
      } catch (err) {
        if (!active) return;
        setStreamLinks([]);
        setSelectedSourceId("");
        setSelectedSourceUrl("");
        setError(err.message || "Gagal memuat source episode.");
      } finally {
        if (active) setLoadingSources(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [source, selectedEpisodeId, selectedServerId, selectedCategory, selectedCategoryServers, isPremium]);

  useEffect(() => {
    if (!isPremium) {
      setSelectedSourceUrl("");
      return;
    }
    if (!selectedSourceId) {
      setSelectedSourceUrl(streamLinks[0]?.url || "");
      return;
    }
    const picked = streamLinks.find((item) => item.id === selectedSourceId);
    setSelectedSourceUrl(picked?.url || streamLinks[0]?.url || "");
  }, [streamLinks, selectedSourceId, isPremium]);

  const activeSourceUrl = isPremium ? selectedSourceUrl || streamLinks[0]?.url || "" : streamLinks[0]?.url || "";
  const directVideoUrl = pickDirectVideoUrl(streamLinks);
  const streamPlaybackUrl = normalizeUrl(activeSourceUrl || directVideoUrl);
  const canUseVideoTag = isDirectMediaUrl(streamPlaybackUrl);
  const youtubeEmbedUrl = getYouTubeEmbed(detail, videos);
  const streamEmbedUrl = canUseVideoTag ? "" : toPlayableEmbedUrl(streamPlaybackUrl);
  const embedUrl = streamEmbedUrl || youtubeEmbedUrl;
  const fallbackUrl =
    streamPlaybackUrl ||
    detail?.url ||
    detail?.trailer?.url ||
    (animeId ? `https://anichin.club/${encodeURIComponent(animeId)}` : "");
  const adImageCandidate = normalizeUrl(adLink);

  const tryFallbackSource = useCallback(
    (badUrl) => {
      const normalizedBad = normalizeUrl(badUrl);
      if (normalizedBad) failedSourceUrlsRef.current.add(normalizedBad);

      const currentIndex = streamLinks.findIndex((item) => normalizeUrl(item?.url) === normalizeUrl(activeSourceUrl));
      const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
      const next = streamLinks
        .slice(startIndex)
        .find((item) => item?.url && !failedSourceUrlsRef.current.has(normalizeUrl(item.url)));

      if (!next) {
        setError("Source stream error. Semua source yang tersedia sudah dicoba.");
        return;
      }

      setError(`Source error, pindah otomatis ke ${next.name || "source berikutnya"}.`);
      if (isPremium) {
        setSelectedSourceId(next.id);
      } else {
        setStreamLinks((prev) => {
          const idx = prev.findIndex((item) => item?.id === next.id);
          if (idx <= 0) return prev;
          const clone = [...prev];
          const [picked] = clone.splice(idx, 1);
          return [picked, ...clone];
        });
      }
    },
    [activeSourceUrl, isPremium, streamLinks]
  );

  useEffect(() => {
    failedSourceUrlsRef.current.clear();
  }, [selectedEpisodeId, selectedServerId, selectedCategory, streamLinks.length]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!streamPlaybackUrl || streamEmbedUrl || !canUseVideoTag) {
      video.removeAttribute("src");
      video.load();
      return undefined;
    }

    const isM3u8 = /\.m3u8(\?|$)/i.test(streamPlaybackUrl);
    if (!isM3u8) {
      video.src = streamPlaybackUrl;
      video.load();
      return undefined;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamPlaybackUrl;
      video.load();
      return undefined;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          tryFallbackSource(streamPlaybackUrl);
        }
      });
      hlsRef.current = hls;
      hls.loadSource(streamPlaybackUrl);
      hls.attachMedia(video);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamPlaybackUrl, streamEmbedUrl, canUseVideoTag, tryFallbackSource]);

  const unlockAndOpenSponsor = () => {
    setSponsorUnlocked(true);
    if (!adLink) return;
    try {
      window.open(adLink, "_blank", "noopener,noreferrer");
    } catch {
      // ignore popup failures, playback must continue
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-cyan-300" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
      >
        Kembali
      </button>

      {showAdOverlay ? (
        <div
          role="button"
          tabIndex={0}
          onClick={unlockAndOpenSponsor}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") unlockAndOpenSponsor();
          }}
          className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center bg-black/95 p-4 text-left"
        >
          <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/20 bg-zinc-950">
            {adImageCandidate && canShowAdImage ? (
              <img
                src={adImageCandidate}
                alt="Sponsor"
                className="max-h-[72vh] w-full object-contain bg-black"
                onError={() => setCanShowAdImage(false)}
              />
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_10%,rgba(239,68,68,.35),transparent_38%),linear-gradient(165deg,#050505,#18181b)] px-6 py-10 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Sponsored</p>
                <p className="mt-3 font-heading text-3xl font-bold text-white sm:text-4xl">Ketuk Untuk Lanjut Menonton</p>
                <p className="mt-2 text-sm text-zinc-300">
                  Sponsor harus dibuka dulu. Setelah disentuh, player akan otomatis tersedia.
                </p>
                {adLink ? <p className="mt-3 line-clamp-1 text-xs text-zinc-400">{adLink}</p> : null}
              </div>
            )}
            <div className="border-t border-white/10 bg-black/70 px-4 py-3 text-center text-xs text-zinc-300">
              Sentuh area iklan untuk lanjut menonton.
            </div>
            <div className="border-t border-white/10 bg-black/80 p-3 text-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  unlockAndOpenSponsor();
                }}
                className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white"
              >
                Lanjutkan Menonton
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
        <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">{detail.title || `Donghua ${animeId}`}</h1>
        {selectedEpisodeNumber ? <p className="mt-1 text-sm text-cyan-200">Episode #{selectedEpisodeNumber}</p> : null}
        <p className="mt-2 text-sm text-slate-300">Pilih episode, category, dan server, lalu mulai menonton.</p>
        <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          Note: jangan di pencet berkali kali, stream otomatis play.
        </p>
      </div>

      {error ? <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}

      {source === ANIME_PROVIDER ? (
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:grid-cols-2">
          <label className="text-sm text-slate-200 sm:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Episode</span>
            <select
              value={selectedEpisodeId}
              onChange={(e) => {
                const nextEpisodeId = e.target.value;
                setSelectedEpisodeId(nextEpisodeId);
                const episodeItem = episodes.find((item) => item?.episodeId === nextEpisodeId) || null;
                setSelectedEpisodeNumber(Number(episodeItem?.number) || null);
                setWatchedMeta({
                  animeId: detail?.animeId || animeId,
                  episodeId: nextEpisodeId,
                  episodeNumber: Number(episodeItem?.number) || null,
                  title: detail?.title || animeId,
                  episodeTitle: toSafeText(episodeItem?.title),
                  poster: detail?.poster || "",
                  source: source || ANIME_PROVIDER,
                  slug,
                });
              }}
              className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
            >
              {episodes.map((item, idx) => (
                <option key={item.episodeId || item.id || item.title} value={item.episodeId || ""}>
                  {formatEpisodeLabel(item, idx)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-200">
            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Category</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
            >
              {hasCategory.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-200">
            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Server</span>
            <select
              value={selectedServerId}
              onChange={(e) => {
                if (!isPremium) return;
                setSelectedServerId(e.target.value);
              }}
              disabled={!isPremium}
              className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
            >
              {selectedCategoryServers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          {isPremium ? (
            <label className="text-sm text-slate-200 sm:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Source</span>
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
              >
                {streamLinks.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-amber-300 sm:col-span-2">
              Free Plan: server dikunci otomatis ke yang paling stabil (auto fallback jika gagal).
            </p>
          )}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        {!showAdOverlay && loadingSources ? (
          <div className="absolute right-3 top-3 z-20 rounded-full bg-black/70 px-3 py-1 text-xs text-slate-300">
            Loading source...
          </div>
        ) : null}

        {streamPlaybackUrl && !streamEmbedUrl && canUseVideoTag ? (
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black"
            controls
            playsInline
            preload="metadata"
            onError={() => tryFallbackSource(streamPlaybackUrl)}
          />
        ) : embedUrl ? (
          <iframe
            className="aspect-video w-full"
            src={embedUrl}
            title={detail.title || "Streaming"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onError={() => tryFallbackSource(streamPlaybackUrl || embedUrl)}
          />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 text-sm text-slate-400">
            <p>Video player tidak tersedia untuk donghua ini.</p>
            {fallbackUrl ? (
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
              >
                Buka Streaming di Tab Baru
              </a>
            ) : null}
          </div>
        )}
      </div>

      {!streamPlaybackUrl && fallbackUrl ? (
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
        >
          Jika player kosong, buka stream di tab baru
        </a>
      ) : null}

      <Link
        to={`/anime/${encodeURIComponent(source || ANIME_PROVIDER)}/${encodeURIComponent(animeId)}${
          slug ? `?slug=${encodeURIComponent(slug)}` : ""
        }`}
        className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
      >
        Back to Detail
      </Link>
    </section>
  );
}
