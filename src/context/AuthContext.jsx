import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile as updateFirebaseProfile,
} from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db, googleProvider, hasConfig } from "../lib/firebase";
import { getRandomAnimeAvatar } from "../lib/randomAvatar";

const AuthContext = createContext(null);
const usersCollectionName = "users";
const legacyUsersStorageKey = "animex_users";
const adSlotStorageKey = "animex_ad_slot";
const adLinkStorageKey = "animex_ad_link";
const allowedAdSlots = new Set(["top-center", "bottom-right", "bottom-left", "middle-right", "middle-left"]);

function normalizeAdLink(link) {
  const raw = String(link || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function getAdminEmails() {
  const fromEnv = String(import.meta.env.VITE_FIREBASE_ADMIN_EMAILS || "admin@animex.local");
  return new Set(
    fromEnv
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isPremiumActive(premium) {
  if (!premium?.active || !premium?.expireAt) return false;
  return new Date(premium.expireAt).getTime() > Date.now();
}

function sanitizeUser(user) {
  const premiumActive = isPremiumActive(user?.premium);
  return {
    id: String(user?.id || ""),
    email: String(user?.email || "").trim().toLowerCase(),
    username: String(user?.username || "User"),
    photoUrl: String(user?.photoUrl || ""),
    role: user?.role === "admin" ? "admin" : "user",
    premium: {
      active: premiumActive,
      plan: premiumActive ? user?.premium?.plan || "" : "",
      days: premiumActive ? Number(user?.premium?.days || 0) : 0,
      expireAt: premiumActive ? user?.premium?.expireAt || "" : "",
    },
    watchHistory: Array.isArray(user?.watchHistory) ? user.watchHistory.slice(0, 200) : [],
    watchlist: Array.isArray(user?.watchlist) ? user.watchlist.slice(0, 200) : [],
    watchedEpisodes: user?.watchedEpisodes && typeof user.watchedEpisodes === "object" ? user.watchedEpisodes : {},
  };
}

function readLegacyUsers() {
  try {
    const raw = localStorage.getItem(legacyUsersStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(sanitizeUser) : [];
  } catch {
    return [];
  }
}

function getLegacyUser(uid, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const users = readLegacyUsers();
  return (
    users.find((item) => item.id === uid) ||
    users.find((item) => String(item.email || "").toLowerCase() === normalizedEmail) ||
    null
  );
}

function readAdSlot() {
  const slot = localStorage.getItem(adSlotStorageKey) || "top-center";
  return allowedAdSlots.has(slot) ? slot : "top-center";
}

function saveAdSlot(slot) {
  if (!allowedAdSlots.has(slot)) return;
  localStorage.setItem(adSlotStorageKey, slot);
}

function readAdLink() {
  return normalizeAdLink(localStorage.getItem(adLinkStorageKey) || "");
}

function saveAdLink(link) {
  localStorage.setItem(adLinkStorageKey, normalizeAdLink(link));
}

function mapAuthErrorMessage(error, fallback) {
  const code = String(error?.code || "");
  if (code === "auth/invalid-credential") {
    return "Mungkin Email/Password yang kamu masukkan salah";
  }
  if (code === "auth/operation-not-supported-in-this-environment") {
    return "Browser tidak mendukung popup login. Coba lagi, nanti otomatis pakai redirect.";
  }
  return error?.message || fallback;
}

function detectWebView() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = String(navigator.userAgent || "").toLowerCase();
  const isAndroidWebView = ua.includes("wv") || (ua.includes("android") && ua.includes("version/"));
  const iOSWebView = /iphone|ipad|ipod/.test(ua) && !ua.includes("safari");
  const genericWebView = ua.includes("; wv") || ua.includes("webview");
  return isAndroidWebView || iOSWebView || genericWebView;
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [adSlot, setAdSlot] = useState(() => readAdSlot());
  const [adLink, setAdLink] = useState(() => readAdLink());
  const adminEmails = useMemo(() => getAdminEmails(), []);
  const isWebView = useMemo(() => detectWebView(), []);
  const canUseGoogleAuth = !isWebView;

  const setOrReplaceUser = (nextUser) => {
    setUsers((prev) => {
      const idx = prev.findIndex((item) => item.id === nextUser.id);
      if (idx < 0) return [...prev, nextUser];
      return prev.map((item) => (item.id === nextUser.id ? nextUser : item));
    });
  };

  const syncUserToFirestore = (nextUser) => {
    if (!db || !nextUser?.id) return;
    setDoc(doc(db, usersCollectionName, nextUser.id), sanitizeUser(nextUser), { merge: true }).catch(() => {});
  };

  useEffect(() => {
    if (!hasConfig || !auth) {
      setReady(true);
      return;
    }

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser || null);
      if (!fbUser) {
        setUsers([]);
        setReady(true);
        return;
      }

      const email = String(fbUser.email || "").toLowerCase();
      const role = adminEmails.has(email) ? "admin" : "user";

      (async () => {
        let firestoreUser = null;
        if (db) {
          try {
            const snap = await getDoc(doc(db, usersCollectionName, fbUser.uid));
            if (snap.exists()) {
              firestoreUser = sanitizeUser({ ...snap.data(), id: fbUser.uid });
            }
          } catch {
            firestoreUser = null;
          }
        }

        const legacyUser = getLegacyUser(fbUser.uid, email);
        const base = sanitizeUser({
          id: fbUser.uid,
          email,
          username: fbUser.displayName || email.split("@")[0] || "User",
          photoUrl: getRandomAnimeAvatar(),
          role,
          premium: { active: false, plan: "", days: 0, expireAt: "" },
          watchHistory: [],
          watchlist: [],
          watchedEpisodes: {},
        });

        const merged = sanitizeUser({
          ...base,
          ...(legacyUser || {}),
          ...(firestoreUser || {}),
          id: fbUser.uid,
          email,
          username: fbUser.displayName || firestoreUser?.username || legacyUser?.username || base.username,
          role: firestoreUser?.role === "admin" || legacyUser?.role === "admin" || role === "admin" ? "admin" : "user",
        });

        setOrReplaceUser(merged);
        syncUserToFirestore(merged);
        setReady(true);
      })();
    });

    return () => unsub();
  }, [adminEmails]);

  const user = useMemo(() => {
    if (!firebaseUser) return null;
    return users.find((item) => item.id === firebaseUser.uid) || null;
  }, [users, firebaseUser]);

  useEffect(() => {
    if (!db || !firebaseUser?.uid) return;

    const email = String(firebaseUser.email || "").toLowerCase();
    const isAdminByEmail = adminEmails.has(email);
    const shouldReadAllUsers = isAdminByEmail || user?.role === "admin";

    if (shouldReadAllUsers) {
      return onSnapshot(
        collection(db, usersCollectionName),
        (snapshot) => {
          const nextUsers = snapshot.docs
            .map((entry) => sanitizeUser({ ...entry.data(), id: entry.id }))
            .filter((entry) => entry.id);
          setUsers(nextUsers);
        },
        () => {}
      );
    }

    return onSnapshot(
      doc(db, usersCollectionName, firebaseUser.uid),
      (snapshot) => {
        if (!snapshot.exists()) return;
        setUsers([sanitizeUser({ ...snapshot.data(), id: firebaseUser.uid })]);
      },
      () => {}
    );
  }, [firebaseUser?.uid, firebaseUser?.email, user?.role, adminEmails]);

  const guardConfig = () => {
    if (!hasConfig || !auth) {
      return { ok: false, error: "Layanan autentikasi belum tersedia. Coba lagi beberapa saat." };
    }
    if (!db) {
      return { ok: false, error: "Firestore belum aktif di aplikasi." };
    }
    return null;
  };

  const signUp = async ({ email, username, password }) => {
    const configErr = guardConfig();
    if (configErr) return configErr;

    try {
      const cred = await createUserWithEmailAndPassword(auth, String(email || "").trim(), String(password || ""));
      if (username) {
        await updateFirebaseProfile(cred.user, { displayName: String(username).trim() });
      }
      setFirebaseUser(cred.user);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || "Signup gagal." };
    }
  };

  const signIn = async ({ email, password }) => {
    const configErr = guardConfig();
    if (configErr) return configErr;

    try {
      const cred = await signInWithEmailAndPassword(auth, String(email || "").trim(), String(password || ""));
      await cred.user.reload();
      setFirebaseUser(auth.currentUser || cred.user);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: mapAuthErrorMessage(error, "Login gagal.") };
    }
  };

  const signInWithGoogle = async () => {
    const configErr = guardConfig();
    if (configErr) return configErr;
    if (!canUseGoogleAuth) {
      return { ok: false, error: "Google login tidak didukung di APK/WebView. Buka di browser eksternal." };
    }

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setFirebaseUser(cred.user);
      return { ok: true };
    } catch (error) {
      const code = String(error?.code || "");
      const canFallbackToRedirect =
        code === "auth/operation-not-supported-in-this-environment" ||
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user";

      if (canFallbackToRedirect) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return { ok: true };
        } catch (redirectError) {
          return { ok: false, error: mapAuthErrorMessage(redirectError, "Login Google gagal.") };
        }
      }

      return { ok: false, error: mapAuthErrorMessage(error, "Login Google gagal.") };
    }
  };

  const signOut = async () => {
    const configErr = guardConfig();
    if (configErr) return;
    await firebaseSignOut(auth);
  };

  const updateCurrentUser = (mapper) => {
    if (!user) return { ok: false, error: "User tidak ditemukan." };
    const nextUser = sanitizeUser(mapper(user));
    setOrReplaceUser(nextUser);
    syncUserToFirestore(nextUser);
    return { ok: true };
  };

  const updateProfile = async (patch) => {
    if (!user || !firebaseUser) return { ok: false, error: "User tidak ditemukan." };

    try {
      await updateFirebaseProfile(firebaseUser, {
        displayName: patch?.username ?? user.username,
      });

      if (patch?.password) {
        try {
          await updatePassword(firebaseUser, String(patch.password));
        } catch {
          return { ok: false, error: "Gagal update password. Login ulang lalu coba lagi." };
        }
      }

      return updateCurrentUser((current) => ({
        ...current,
        username: patch?.username ?? current.username,
      }));
    } catch (error) {
      return { ok: false, error: error?.message || "Update profile gagal." };
    }
  };

  const adminUpdateUser = (userId, patch) => {
    if (!user || user.role !== "admin") return { ok: false, error: "Akses admin dibutuhkan." };
    const target = users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: "User tidak ditemukan." };

    const nextTarget = sanitizeUser({
      ...target,
      username: patch?.username ?? target.username,
    });
    setOrReplaceUser(nextTarget);
    syncUserToFirestore(nextTarget);
    return { ok: true };
  };

  const adminSetPremium = (userId, { plan, days }) => {
    if (!user || user.role !== "admin") return { ok: false, error: "Akses admin dibutuhkan." };
    const target = users.find((u) => u.id === userId);
    if (!target) return { ok: false, error: "User tidak ditemukan." };

    const safeDays = Math.max(0, Number(days || 0));
    const expireAt = new Date(Date.now() + safeDays * 86400000).toISOString();
    const nextPremium =
      safeDays > 0
        ? { active: true, plan: String(plan || "Premium"), days: safeDays, expireAt }
        : { active: false, plan: "", days: 0, expireAt: "" };

    const nextTarget = sanitizeUser({
      ...target,
      premium: nextPremium,
    });
    setOrReplaceUser(nextTarget);
    syncUserToFirestore(nextTarget);
    return { ok: true };
  };

  const adminSetPremiumByEmail = ({ email, days }) => {
    if (!user || user.role !== "admin") return { ok: false, error: "Akses admin dibutuhkan." };
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const target = users.find((u) => String(u.email).toLowerCase() === normalizedEmail);
    if (!target) return { ok: false, error: "Email user tidak ditemukan." };
    return adminSetPremium(target.id, { plan: "Premium Plan", days });
  };

  const addToWatchlist = (entry) => {
    const animeId = String(entry?.animeId || "").trim();
    if (!animeId) return { ok: false, error: "animeId wajib ada." };

    return updateCurrentUser((current) => {
      const existing = Array.isArray(current.watchlist) ? current.watchlist : [];
      const filtered = existing.filter((item) => String(item?.animeId) !== animeId);
      return {
        ...current,
        watchlist: [
          {
            animeId,
            title: entry?.title || "Untitled Donghua",
            poster: entry?.poster || "",
            source: entry?.source || "anichin",
            slug: entry?.slug || "",
            addedAt: new Date().toISOString(),
          },
          ...filtered,
        ].slice(0, 200),
      };
    });
  };

  const removeFromWatchlist = (animeId) => {
    const key = String(animeId || "").trim();
    if (!key) return { ok: false, error: "animeId wajib ada." };
    return updateCurrentUser((current) => ({
      ...current,
      watchlist: (Array.isArray(current.watchlist) ? current.watchlist : []).filter(
        (item) => String(item?.animeId) !== key
      ),
    }));
  };

  const markEpisodeWatched = (entry) => {
    const animeId = String(entry?.animeId || "").trim();
    if (!animeId) return { ok: false, error: "animeId wajib ada." };
    const episodeKey = String(entry?.episodeId || entry?.episodeNumber || "").trim();
    if (!episodeKey) return { ok: false, error: "episodeId/episodeNumber wajib ada." };

    return updateCurrentUser((current) => {
      const watchedEpisodes = { ...(current?.watchedEpisodes || {}) };
      const currentList = Array.isArray(watchedEpisodes[animeId]) ? watchedEpisodes[animeId] : [];
      if (!currentList.includes(episodeKey)) watchedEpisodes[animeId] = [episodeKey, ...currentList].slice(0, 300);

      const history = Array.isArray(current?.watchHistory) ? current.watchHistory : [];
      const historyId = `${animeId}:${episodeKey}`;
      const nextItem = {
        id: historyId,
        animeId,
        episodeId: entry?.episodeId || "",
        episodeNumber: entry?.episodeNumber || null,
        title: entry?.title || "Untitled Donghua",
        episodeTitle: entry?.episodeTitle || "",
        poster: entry?.poster || "",
        source: entry?.source || "anichin",
        slug: entry?.slug || "",
        watchedAt: new Date().toISOString(),
      };

      return {
        ...current,
        watchedEpisodes,
        watchHistory: [nextItem, ...history.filter((item) => item?.id !== historyId)].slice(0, 200),
      };
    });
  };

  const adminSetAdSlot = (slot) => {
    if (!user || user.role !== "admin") return { ok: false, error: "Akses admin dibutuhkan." };
    if (!allowedAdSlots.has(slot)) return { ok: false, error: "Posisi slot tidak valid." };
    setAdSlot(slot);
    saveAdSlot(slot);
    return { ok: true };
  };

  const adminSetAdLink = (link) => {
    if (!user || user.role !== "admin") return { ok: false, error: "Akses admin dibutuhkan." };
    const normalized = normalizeAdLink(link);
    if (normalized && !/^https?:\/\/[^\s]+$/i.test(normalized)) {
      return { ok: false, error: "Format link iklan tidak valid." };
    }
    setAdLink(normalized);
    saveAdLink(normalized);
    return { ok: true };
  };

  const value = useMemo(
    () => ({
      user,
      users,
      ready,
      isLoggedIn: Boolean(firebaseUser?.uid),
      isAdmin: user?.role === "admin",
      isWebView,
      canUseGoogleAuth,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      updateProfile,
      adminUpdateUser,
      adminSetPremium,
      adminSetPremiumByEmail,
      watchHistory: Array.isArray(user?.watchHistory) ? user.watchHistory : [],
      watchlist: Array.isArray(user?.watchlist) ? user.watchlist : [],
      watchedEpisodes: user?.watchedEpisodes || {},
      addToWatchlist,
      removeFromWatchlist,
      markEpisodeWatched,
      adSlot,
      adminSetAdSlot,
      adLink,
      adminSetAdLink,
    }),
    [user, users, ready, adSlot, adLink, firebaseUser, isWebView, canUseGoogleAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
