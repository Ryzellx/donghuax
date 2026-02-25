import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, isLoggedIn, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const navClass = ({ isActive }) =>
    `rounded-full px-3 py-1.5 text-sm transition ${
      isActive ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="font-heading text-xl font-bold tracking-tight text-white">
          Donghua<span className="bg-gradient-to-r from-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">X</span>
        </Link>

        <button
          type="button"
          className="rounded-lg border border-white/15 p-2 text-slate-300 md:hidden"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <span className="sr-only">Toggle menu</span>
          {menuOpen ? "x" : "menu"}
        </button>

        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/" className={navClass}>
            Donghua
          </NavLink>
          <NavLink to="/history" className={navClass}>
            Riwayat
          </NavLink>
          <NavLink to="/watchlist" className={navClass}>
            Watchlist
          </NavLink>

          {isLoggedIn ? (
            <details className="relative ml-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1.5">
                <div className="h-8 w-8 overflow-hidden rounded-full border border-white/20 bg-slate-800">
                  {user?.photoUrl ? (
                    <img src={user.photoUrl} alt={user.username || "Profile"} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <span className="max-w-40 truncate text-sm font-semibold text-white">
                  {user?.username || user?.email}
                </span>
              </summary>

              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/15 bg-slate-950/95 p-2 shadow-xl">
                <div className="mb-1 rounded-xl bg-white/5 px-3 py-2">
                  <p className="text-xs text-slate-300">{user?.email}</p>
                  {user?.premium?.active ? (
                    <p className="mt-1 text-xs font-semibold text-amber-300">{user.premium.plan}</p>
                  ) : (
                    <p className="mt-1 text-xs font-semibold text-slate-400">Free Plan</p>
                  )}
                </div>
                <Link to="/account" className="block rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
                  Account
                </Link>
                <Link to="/premium" className="block rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
                  Premium
                </Link>
                {isAdmin ? (
                  <Link to="/admin" className="block rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
                    Admin Panel
                  </Link>
                ) : null}
                <button
                  onClick={() => {
                    signOut();
                    navigate("/login");
                  }}
                  className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
                  type="button"
                >
                  Logout
                </button>
              </div>
            </details>
          ) : (
            <NavLink
              to="/login"
              className="rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white"
            >
              Login
            </NavLink>
          )}
        </nav>
      </div>

      {menuOpen ? (
        <div className="border-t border-white/10 bg-slate-950/95 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-2">
            <NavLink to="/" className={navClass} onClick={() => setMenuOpen(false)}>
              Donghua
            </NavLink>
            <NavLink to="/history" className={navClass} onClick={() => setMenuOpen(false)}>
              Riwayat
            </NavLink>
            <NavLink to="/watchlist" className={navClass} onClick={() => setMenuOpen(false)}>
              Watchlist
            </NavLink>

            {isLoggedIn ? (
              <>
                <NavLink to="/account" className={navClass} onClick={() => setMenuOpen(false)}>
                  Account
                </NavLink>
                <NavLink to="/premium" className={navClass} onClick={() => setMenuOpen(false)}>
                  Premium
                </NavLink>
                {isAdmin ? (
                  <NavLink to="/admin" className={navClass} onClick={() => setMenuOpen(false)}>
                    Admin Panel
                  </NavLink>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                    navigate("/login");
                  }}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-left text-sm text-slate-200 transition hover:bg-white/10"
                >
                  Logout
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white"
              >
                Login
              </NavLink>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}