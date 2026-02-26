import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { useAuth } from "./context/AuthContext";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import AnimeDetailPage from "./pages/AnimeDetailPage";
import ContactPage from "./pages/ContactPage";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import AboutPage from "./pages/AboutPage";
import PremiumPage from "./pages/PremiumPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import SignupPage from "./pages/SignupPage";
import WatchPage from "./pages/WatchPage";
import WatchlistPage from "./pages/WatchlistPage";

function GateLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-cyan-300" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { isLoggedIn, ready } = useAuth();
  if (!ready) return <GateLoading />;
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { isAdmin, ready } = useAuth();
  if (!ready) return <GateLoading />;
  return isAdmin ? children : <Navigate to="/" replace />;
}

function AuthOnly({ children }) {
  const { isLoggedIn, ready } = useAuth();
  if (!ready) return <GateLoading />;
  return isLoggedIn ? <Navigate to="/" replace /> : children;
}

function resolveWhatsAppLink() {
  const direct = String(import.meta.env.VITE_WHATSAPP_LINK || "").trim();
  if (direct) {
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(direct);
    return hasProtocol ? direct : `https://${direct.replace(/^\/+/, "")}`;
  }

  const numberRaw = String(import.meta.env.VITE_WHATSAPP_NUMBER || "")
    .trim()
    .replace(/[^\d]/g, "");
  if (numberRaw) return `https://wa.me/${numberRaw}`;

  return "https://wa.me/628990870271";
}

function GlobalAnnouncement() {
  const [visible, setVisible] = useState(false);
  const waLink = useMemo(() => resolveWhatsAppLink(), []);
  const sessionShownKey = "animex_announcement_shown_session";

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(sessionShownKey) === "1";
    if (!alreadyShown) {
      setVisible(true);
      sessionStorage.setItem(sessionShownKey, "1");
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950 p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Announcement</p>
        <h2 className="mt-2 font-heading text-2xl font-bold text-white">Open Penempatan Iklan</h2>
        <p className="mt-3 text-sm text-slate-300">
          Penempatan iklan di website/aplikasi ini sedang dibuka. Jika ingin pasang iklan, hubungi WhatsApp admin.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Hubungi WhatsApp
          </a>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-slate-100 hover:bg-white/10"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-bg font-body text-text">
      <GlobalAnnouncement />
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <div key={location.pathname} className="animate-page-in">
          <Routes>
            <Route
              path="/signup"
              element={
                <AuthOnly>
                  <SignupPage />
                </AuthOnly>
              }
            />
            <Route
              path="/login"
              element={
                <AuthOnly>
                  <LoginPage />
                </AuthOnly>
              }
            />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route
              path="/anime/:animeId"
              element={
                <RequireAuth>
                  <AnimeDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/anime/:source/:animeId"
              element={
                <RequireAuth>
                  <AnimeDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/watch/:animeId"
              element={
                <RequireAuth>
                  <WatchPage />
                </RequireAuth>
              }
            />
            <Route
              path="/watch/:source/:animeId"
              element={
                <RequireAuth>
                  <WatchPage />
                </RequireAuth>
              }
            />
            <Route
              path="/history"
              element={
                <RequireAuth>
                  <HistoryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/watchlist"
              element={
                <RequireAuth>
                  <WatchlistPage />
                </RequireAuth>
              }
            />
            <Route
              path="/premium"
              element={
                <RequireAuth>
                  <PremiumPage />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <AccountPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <AdminPage />
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}
