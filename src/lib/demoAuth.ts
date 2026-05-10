// Demo-only auth used when Supabase isn't configured. Stores a fake "vendor"
// session in localStorage so the admin pages can be browsed end-to-end
// without a backend. Mutations are writeable but their persistence is also
// local — replace with a real Supabase project for multi-device data.

const DEMO_USER_KEY = "bookit.demo.user";

export interface DemoUser {
  id: string;
  email: string;
  createdAt: string;
  isDemo: true;
}

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

export function getDemoUser(): DemoUser | null {
  const w = safeWindow();
  if (!w) return null;
  try {
    const raw = w.localStorage.getItem(DEMO_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoUser;
  } catch {
    return null;
  }
}

export function setDemoUser(email: string): DemoUser {
  const w = safeWindow();
  const user: DemoUser = {
    id: `demo-${cryptoRandom()}`,
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    isDemo: true,
  };
  if (w) w.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  notifyAuthChange();
  return user;
}

export function clearDemoUser() {
  const w = safeWindow();
  if (w) w.localStorage.removeItem(DEMO_USER_KEY);
  notifyAuthChange();
}

function cryptoRandom(): string {
  // Random id without depending on crypto.randomUUID (older Safari).
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// Fire a custom event so the auth hook can react in real time without polling.
const AUTH_EVENT = "bookit:auth-change";

function notifyAuthChange() {
  const w = safeWindow();
  if (!w) return;
  w.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export function onDemoAuthChange(handler: () => void): () => void {
  const w = safeWindow();
  if (!w) return () => {};
  w.addEventListener(AUTH_EVENT, handler);
  // also react to localStorage changes from other tabs
  const storageHandler = (e: StorageEvent) => {
    if (e.key === DEMO_USER_KEY) handler();
  };
  w.addEventListener("storage", storageHandler);
  return () => {
    w.removeEventListener(AUTH_EVENT, handler);
    w.removeEventListener("storage", storageHandler);
  };
}
