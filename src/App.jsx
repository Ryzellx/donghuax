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

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-bg font-body text-text">
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