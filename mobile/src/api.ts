import * as SecureStore from "expo-secure-store";
import type { Session } from "./types";

const SESSION_KEY = "educatech.session.v1";
const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
if (!baseUrl || (!baseUrl.startsWith("https://") && !__DEV__))
  throw new Error(
    "Configure EXPO_PUBLIC_API_URL. Builds de produção exigem HTTPS.",
  );
let session: Session | null = null;
let refreshing: Promise<Session> | null = null;
let onExpired: (() => void) | null = null;
export const getSession = () => session;
export const assetUrl = (path: string) => new URL(path, baseUrl).toString();
export const onSessionExpired = (callback: () => void) => {
  onExpired = callback;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function fetchJson<T>(
  path: string,
  method: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-EducaTech-Client": "native",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      data.title || "Não foi possível concluir a solicitação.",
      response.status,
    );
  return data as T;
}
async function persist(value: Session) {
  // Uma única chave reduz inconsistência entre o refresh token e os dados da sessão.
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  session = value;
  return value;
}
export async function login(email: string, password: string) {
  return persist(
    await fetchJson<Session>("/auth/login", "POST", { email, password }),
  );
}
export async function register(name: string, email: string, password: string) {
  return persist(
    await fetchJson<Session>("/auth/register", "POST", {
      name,
      email,
      password,
    }),
  );
}
export async function refresh(): Promise<Session> {
  if (!refreshing)
    refreshing = (async () => {
      if (!session) throw new ApiError("Entre novamente.", 401);
      try {
        return await persist(
          await fetchJson<Session>("/auth/refresh", "POST", {
            refreshToken: session.refreshToken,
          }),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          session = null;
          await SecureStore.deleteItemAsync(SESSION_KEY);
          onExpired?.();
        }
        throw error;
      }
    })().finally(() => {
      refreshing = null;
    });
  return refreshing;
}
export async function restoreSession() {
  const saved = await SecureStore.getItemAsync(SESSION_KEY);
  if (!saved) return null;
  try {
    session = JSON.parse(saved) as Session;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
  try {
    return await refresh();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    return session; // Sem rede: permite leitura do cache, sem autorizar operações no servidor.
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  retry = true,
): Promise<T> {
  const expectedUser = session?.user.id;
  try {
    const result = await fetchJson<T>(path, method, body, session?.accessToken);
    if (expectedUser !== session?.user.id)
      throw new ApiError("A conta foi alterada durante a solicitação.", 409);
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && retry && session) {
      if (expectedUser !== session.user.id)
        throw new ApiError("A conta foi alterada.", 409);
      await refresh();
      return api<T>(path, method, body, false);
    }
    throw error;
  }
}
export async function logout() {
  try {
    await fetchJson("/auth/logout", "POST", {
      refreshToken: session?.refreshToken,
    });
  } finally {
    session = null;
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}
