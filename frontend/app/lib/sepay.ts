type SePayCheckoutResponse = {
  checkoutCode: string;
  planKey: string;
  planName: string;
  amount: number;
  qrPayload: string;
  qrImageUrl: string;
  status: string;
};

import { getApiBaseUrl, getAccessToken } from "./authStorage";

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

export async function createSePayCheckout(input: {
  planKey: string;
  checkoutCode?: string;
  couponCode?: string;
}) {
  return requestJson<SePayCheckoutResponse>("/payments/sepay/checkout", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getSePayTransactionStatus(checkoutCode: string) {
  return requestJson<{ checkoutCode: string; status: string; paidAt: string | null }>(
    `/payments/sepay/status/${checkoutCode}`,
    {
      method: "GET",
    }
  );
}
