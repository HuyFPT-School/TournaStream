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

async function requestJson<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
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

export async function syncTournamentToBackend(tournamentData: any) {
  return requestJson<any>("/tournaments", {
    method: "POST",
    body: JSON.stringify(tournamentData),
  });
}

export async function fetchTournamentFromBackend(id: string) {
  return requestJson<any>(`/tournaments/${id}`, {
    method: "GET",
  });
}
