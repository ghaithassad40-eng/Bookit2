// Customer-side authentication for Bookit.
//
// Distinct from the vendor / admin auth in `useAuth.ts` — customers
// authenticate to book and to keep a history of their bookings + reviews.
// They never reach the /admin shell. Today the implementation is
// localStorage-backed so the demo works without Supabase; production should
// swap signInCustomer / signUpCustomer to call `supabase.auth.signInWithPassword`
// against a customer-scoped table separate from the platform admin users.

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: number;
}

const STORAGE_KEY = "bookit.customer.current";
const REGISTRY_KEY = "bookit.customer.registry";
const PASSWORDS_KEY = "bookit.customer.passwords";

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function deleteKey(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

function getRegistry(): Record<string, CustomerProfile> {
  return readJson(REGISTRY_KEY, {});
}

function getPasswords(): Record<string, string> {
  return readJson(PASSWORDS_KEY, {});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getStoredCustomer(): CustomerProfile | null {
  return readJson<CustomerProfile | null>(STORAGE_KEY, null);
}

function setStoredCustomer(customer: CustomerProfile | null): void {
  if (customer) writeJson(STORAGE_KEY, customer);
  else deleteKey(STORAGE_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("bookit:customer-auth"));
  }
}

export type AuthError =
  | "email-taken"
  | "no-account"
  | "wrong-password"
  | "invalid-email"
  | "short-password";

export interface AuthResult {
  ok: boolean;
  error?: AuthError;
  customer?: CustomerProfile;
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function signInCustomer(email: string, password: string): AuthResult {
  const normalised = email.trim().toLowerCase();
  if (!validEmail(normalised)) return { ok: false, error: "invalid-email" };
  const registry = getRegistry();
  const customer = registry[normalised];
  if (!customer) return { ok: false, error: "no-account" };
  const passwords = getPasswords();
  if (passwords[normalised] !== password) return { ok: false, error: "wrong-password" };
  setStoredCustomer(customer);
  return { ok: true, customer };
}

export interface SignUpInput {
  name: string;
  email: string;
  phone?: string | null;
  password: string;
}

export function signUpCustomer(input: SignUpInput): AuthResult {
  const normalised = input.email.trim().toLowerCase();
  if (!validEmail(normalised)) return { ok: false, error: "invalid-email" };
  if (input.password.length < 6) return { ok: false, error: "short-password" };
  const registry = getRegistry();
  if (registry[normalised]) return { ok: false, error: "email-taken" };
  const customer: CustomerProfile = {
    id: `cust-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    email: normalised,
    phone: input.phone?.trim() || null,
    createdAt: Date.now(),
  };
  registry[normalised] = customer;
  writeJson(REGISTRY_KEY, registry);
  const passwords = getPasswords();
  passwords[normalised] = input.password;
  writeJson(PASSWORDS_KEY, passwords);
  setStoredCustomer(customer);
  return { ok: true, customer };
}

export function signOutCustomer(): void {
  setStoredCustomer(null);
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string | null;
}

/** Update the signed-in customer's profile fields. Returns the updated
 *  CustomerProfile or null when no customer is signed in. Email is not
 *  editable here — changing email is a security-sensitive operation
 *  that needs a re-auth + email-verification flow before it can ship. */
export function updateCustomerProfile(input: UpdateProfileInput): CustomerProfile | null {
  const current = getStoredCustomer();
  if (!current) return null;
  const registry = getRegistry();
  const existing = registry[current.email];
  if (!existing) return null;
  const next: CustomerProfile = {
    ...existing,
    name: input.name?.trim() ? input.name.trim() : existing.name,
    phone:
      input.phone === undefined
        ? existing.phone
        : input.phone?.trim()
          ? input.phone.trim()
          : null,
  };
  registry[current.email] = next;
  writeJson(REGISTRY_KEY, registry);
  setStoredCustomer(next);
  return next;
}

export type PasswordChangeError = "wrong-current" | "short-new" | "no-account";

export interface PasswordChangeResult {
  ok: boolean;
  error?: PasswordChangeError;
}

/** Change the signed-in customer's password. Requires the current
 *  password — same minimum length rule as sign-up (6 chars). */
export function changeCustomerPassword(
  current: string,
  next: string,
): PasswordChangeResult {
  const customer = getStoredCustomer();
  if (!customer) return { ok: false, error: "no-account" };
  if (next.length < 6) return { ok: false, error: "short-new" };
  const passwords = getPasswords();
  if (passwords[customer.email] !== current) {
    return { ok: false, error: "wrong-current" };
  }
  passwords[customer.email] = next;
  writeJson(PASSWORDS_KEY, passwords);
  return { ok: true };
}

/**
 * Subscribe to customer-auth changes. Fires when this tab signs in/out
 * (via our custom event) AND when another tab does (via the `storage` event).
 */
export function onCustomerAuthChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => cb();
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === STORAGE_KEY) cb();
  };
  window.addEventListener("bookit:customer-auth", onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("bookit:customer-auth", onLocal);
    window.removeEventListener("storage", onStorage);
  };
}
