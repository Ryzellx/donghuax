import { Link } from "react-router-dom";

function toSafeText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function toAnimePath(anime) {
  const source = toSafeText(anime?.source);
  const animeId = toSafeText(anime?.animeId || anime?.id);
  const slug = toSafeText(anime?.animeSlug);
  if (!animeId) return "#";
  if (source) {
    return `/anime/${encodeURIComponent(source)}/${encodeURIComponent(animeId)}${
      slug ? `?slug=${encodeURIComponent(slug)}` : ""
    }`;
  }
  return `/anime/${encodeURIComponent(animeId)}`;
}

export default function AnimeCard({ anime }) {
  const mediaType = "donghua";
  const title = toSafeText(anime?.title, toSafeText(anime?.name, `Untitled ${mediaType}`));
  const poster = toSafeText(anime?.poster, toSafeText(anime?.thumbnail, toSafeText(anime?.image, "")));
  const subtitle =
    toSafeText(anime?.episodesText) ||
    toSafeText(anime?.status) ||
    (typeof anime?.score === "number" ? `Score ${anime.score}` : "No score yet");

  const detailPath = toAnimePath(anime);

  return (
    <Link
      to={detailPath}
      className="group w-36 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/50 sm:w-40 md:w-44 lg:w-52"
    >
      <div className="relative aspect-[3/4] w-full bg-slate-800">
        {poster ? (
          <img src={poster} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
        <p className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
          {mediaType}
        </p>
      </div>
      <div className="p-2.5 sm:p-3">
        <p className="line-clamp-2 text-sm font-semibold text-slate-100">{title}</p>
        <p className="mt-1 text-xs text-cyan-200/85">{subtitle}</p>
      </div>
    </Link>
  );
}
