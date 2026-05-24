type SePayCheckoutResponse = {
  checkoutCode: string;
  planKey: string;
  planName: string;
  amount: number;
  qrPayload: string;
  qrImageUrl: string;
  status: string;
};

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

export async function createSePayCheckout(input: {
  planKey: string;
  checkoutCode?: string;
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
