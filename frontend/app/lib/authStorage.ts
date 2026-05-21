export type StoredUser = {
  id: string;
  fullName: string;
  email: string;
  password: string;
  createdAt: string;
};

export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  loginAt: string;
};

const USERS_KEY = "ts_users";
const SESSION_KEY = "ts_session";

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

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getUsers(): StoredUser[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(USERS_KEY);
  return safeParseJson<StoredUser[]>(raw, []);
}

export function saveUsers(users: StoredUser[]) {
  writeJson(USERS_KEY, users);
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  return getUsers().find((user) => user.email === normalized);
}

export function createUser(input: {
  fullName: string;
  email: string;
  password: string;
}): StoredUser {
  const newUser: StoredUser = {
    id: makeId("user"),
    fullName: input.fullName,
    email: input.email,
    password: input.password,
    createdAt: new Date().toISOString(),
  };
  const users = getUsers();
  users.push(newUser);
  saveUsers(users);
  return newUser;
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
}
