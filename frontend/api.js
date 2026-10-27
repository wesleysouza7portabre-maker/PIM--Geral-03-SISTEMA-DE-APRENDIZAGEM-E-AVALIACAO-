export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
let session = null;
let refreshing = null;
export const getSession = () => session;
const authHeaders = {
  "Content-Type": "application/json",
  "X-EducaTech-Client": "web",
};
async function decode(response) {
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      data.title || "Não foi possível concluir a operação.",
      response.status,
    );
  return data;
}
export async function authenticate(action, body) {
  const response = await fetch(`/api/v1/auth/${action}`, {
    method: "POST",
    headers: authHeaders,
    credentials: "same-origin",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  session = await decode(response);
  return session;
}
export async function restore() {
  const refresh = () => authenticate("refresh", {});
  if (!refreshing)
    refreshing = (
      navigator.locks
        ? navigator.locks.request("educatech-refresh", refresh)
        : refresh()
    ).finally(() => {
      refreshing = null;
    });
  return refreshing;
}
export async function logout() {
  try {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: authHeaders,
      credentials: "same-origin",
      body: "{}",
      signal: AbortSignal.timeout(15000),
    });
  } finally {
    session = null;
  }
}
export async function api(path, { method = "GET", body, retry = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401 && retry && session) {
    try {
      await restore();
    } catch {
      session = null;
      window.dispatchEvent(new Event("session-expired"));
      throw new ApiError("Sessão expirada. Entre novamente.", 401);
    }
    return api(path, { method, body, retry: false });
  }
  return decode(response);
}
