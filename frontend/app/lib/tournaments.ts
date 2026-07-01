import { getAccessToken, getApiBaseUrl } from "./authStorage";

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    // Attempt session refresh if token expired
    try {
      const { refreshSession } = await import("./authStorage");
      const refreshResult = await refreshSession();
      const newToken = refreshResult.accessToken;
      
      const retryResponse = await fetch(`${getApiBaseUrl()}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(newToken ? { "Authorization": `Bearer ${newToken}` } : {}),
          ...(options.headers || {}),
        },
      });

      if (!retryResponse.ok) {
        throw new Error("Retry request failed after token refresh");
      }

      return (await retryResponse.json()) as T;
    } catch (refreshErr) {
      console.error("Session expired, logging out:", refreshErr);
      const { clearSession } = await import("./authStorage");
      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login?expired=1";
      }
      throw new Error("Session expired. Please log in again.");
    }
  }

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

export async function syncTournamentToBackend(tournamentData: any) {
  return requestJson<any>("/tournaments", {
    method: "POST",
    body: JSON.stringify(tournamentData),
  });
}

export async function fetchTournamentFromBackend(id: string) {
  return requestJson<any>(`/tournaments/${id}?t=${Date.now()}`, {
    method: "GET",
    headers: {
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    }
  });
}

export async function fetchUserTournamentsFromBackend() {
  return requestJson<any[]>("/tournaments", {
    method: "GET",
  });
}

export async function fetchLiveTournamentsFromBackend(limit = 8) {
  return requestJson<any[]>(`/tournaments/live?limit=${limit}&t=${Date.now()}`, {
    method: "GET",
    headers: {
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    }
  });
}
