export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  loginAt: string;
};

type AuthResponse = {
  accessToken: string;
  user: { id: string; fullName: string; email: string };
};

const SESSION_KEY = "ts_session";
const ACCESS_TOKEN_KEY = "ts_access_token";

function canUseStorage() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocalHost) {
      return "http://localhost:4000/api";
    }
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
}

async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function setSession(session: SessionUser) {
  writeJson(SESSION_KEY, session);
}

export function getSession(): SessionUser | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  return safeParseJson<SessionUser | null>(raw, null);
}

export function clearSession() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export async function registerUser(input: {
  fullName: string;
  email: string;
  password: string;
}) {
  return apiRequest<{
    user: { id: string; fullName: string; email: string };
    requiresVerification: boolean;
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function loginUser(input: { email: string; password: string }) {
  const result = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setAccessToken(result.accessToken);
  setSession({
    id: result.user.id,
    fullName: result.user.fullName,
    email: result.user.email,
    loginAt: new Date().toISOString(),
  });
  return result;
}

export async function logoutUser() {
  try {
    await apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
  }
}

export async function requestPasswordReset(email: string) {
  return apiRequest<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(input: {
  email: string;
  token: string;
  newPassword: string;
}) {
  return apiRequest<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  const token = getAccessToken();
  return apiRequest<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function refreshSession() {
  const result = await apiRequest<AuthResponse>("/auth/refresh", {
    method: "POST",
  });
  setAccessToken(result.accessToken);
  setSession({
    id: result.user.id,
    fullName: result.user.fullName,
    email: result.user.email,
    loginAt: new Date().toISOString(),
  });
  return result;
}
