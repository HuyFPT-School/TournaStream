"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { getApiBaseUrl } from "@/app/lib/authStorage";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      setStatus("error");
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch(
          `${getApiBaseUrl()}/auth/verify-email?token=${encodeURIComponent(
            token,
          )}&email=${encodeURIComponent(email)}`,
        );
        if (!response.ok) throw new Error("verify failed");
        setStatus("success");
      } catch {
        setStatus("error");
      }
    };

    verify();
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 text-center">
        {status === "idle" && <p>Dang xac thuc...</p>}
        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold mb-3">Xac thuc thanh cong</h1>
            <p className="text-white/60 mb-6">
              Ban co the dang nhap ngay bay gio.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-5 py-2 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold"
            >
              Dang nhap
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold mb-3">Khong the xac thuc</h1>
            <p className="text-white/60 mb-6">
              Lien ket khong hop le hoac da het han.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-5 py-2 rounded-lg bg-white text-[#080b10] font-semibold"
            >
              Tao tai khoan
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center px-6">
          <p>Dang tai...</p>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
