const TOKEN_KEY = "nordflow_token";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const { method = "GET", body, form, signal } = options;
  const headers = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, { method, headers, body: payload, signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Не удалось связаться с сервером", 0);
  }

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/login")) {
      clearToken();
      window.dispatchEvent(new Event("nordflow:unauthorized"));
    }
    throw new ApiError(data?.error || "Ошибка запроса", response.status, data);
  }

  return data;
}

export function uploadFile(path, file, field = "file") {
  const form = new FormData();
  form.append(field, file);
  return api(path, { method: "POST", form });
}
