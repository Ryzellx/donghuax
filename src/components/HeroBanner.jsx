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

export default function HeroBanner({ anime }) {
  const title = toSafeText(anime?.title, toSafeText(anime?.name, "Welcome to DonghuaX"));
  const itemId = anime?.animeId || anime?.id || "";
  const image = toSafeText(anime?.poster, toSafeText(anime?.thumbnail, toSafeText(anime?.image, "")));
  const fallbackMeta = [toSafeText(anime?.episodesText), toSafeText(anime?.status), toSafeText(anime?.season)]
    .filter(Boolean)
    .join(" • ");
  const description =
    toSafeText(anime?.synopsis) ||
    toSafeText(anime?.description) ||
    toSafeText(anime?.plot) ||
    (fallbackMeta ? `${title} • ${fallbackMeta}` : `${title} sedang populer minggu ini.`);

  const detailPath = toAnimePath(anime);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 animate-fade-in">
      {image ? (
        <img src={image} alt={title} className="h-56 w-full object-cover opacity-60 sm:h-72 lg:h-96" />
      ) : (
        <div className="h-56 w-full bg-gradient-to-r from-slate-950 via-slate-800 to-slate-900 sm:h-72 lg:h-96" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-slate-950/30" />
      <div className="absolute inset-0 flex max-w-3xl flex-col justify-end p-4 sm:p-6 lg:p-8">
        <p className="mb-2 inline-flex w-fit rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-200">
          Featured Pick
        </p>
        <h1 className="font-heading text-2xl font-bold text-white sm:text-4xl lg:text-5xl">{title}</h1>
        <p className="mt-3 line-clamp-3 max-w-2xl text-sm text-slate-200 sm:line-clamp-none sm:text-base">{description}</p>
        {itemId ? (
          <Link
            to={detailPath}
            className="mt-5 inline-flex w-fit rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Lihat Detail
          </Link>
        ) : null}
      </div>
    </section>
  );
}