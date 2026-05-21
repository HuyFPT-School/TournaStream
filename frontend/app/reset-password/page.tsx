"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Toast } from "@/app/components/Toast";
import { resetPassword } from "@/app/lib/authStorage";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ToastState = {
  id: string;
  kind: "success" | "error";
  title?: string;
  message: string;
};

function makeToastId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const openToast = (next: Omit<ToastState, "id">) => {
    setToast({ id: makeToastId(), ...next });
  };

  useEffect(() => {
    const queryEmail = searchParams.get("email") || "";
    const queryToken = searchParams.get("token") || "";
    setEmail(queryEmail);
    setToken(queryToken);
  }, [searchParams]);

  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    const hideTimer = setTimeout(() => setToastVisible(false), 5000);
    const clearTimer = setTimeout(() => setToast(null), 5300);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [toast?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const newErrors: Record<string, string> = {};
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      newErrors.email = "Email khong hop le";
    }

    if (!token) {
      newErrors.token = "Thieu ma dat lai";
    }

    if (!password) {
      newErrors.password = "Vui long nhap mat khau";
    } else if (password.length < 8) {
      newErrors.password = "Mat khau toi thieu 8 ky tu";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Vui long nhap lai mat khau";
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = "Mat khau khong trung khop";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      await resetPassword({
        email: normalizedEmail,
        token,
        newPassword: password,
      });
      openToast({
        kind: "success",
        title: "Dat lai thanh cong",
        message: "Ban co the dang nhap voi mat khau moi.",
      });
      setTimeout(() => router.push("/login"), 1200);
    } catch (error) {
      openToast({
        kind: "error",
        title: "Dat lai that bai",
        message: "Lien ket khong hop le hoac da het han.",
      });
    }
  };

  const dismissToast = () => {
    setToastVisible(false);
    setTimeout(() => setToast(null), 200);
  };

  return (
    <main className="min-h-screen bg-[#080b10] text-white font-sans">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      <nav className="relative z-20 flex items-center justify-between px-8 py-4 border-b border-white/[0.06] backdrop-blur-md bg-[#080b10]/60">
        <Link
          href="/"
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-[#22c55e] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1L10 6.5H15.5L11 9.5L13 15L8 11.5L3 15L5 9.5L0.5 6.5H6L8 1Z"
                fill="#080b10"
              />
            </svg>
          </div>
          <span className="text-[15px] font-bold tracking-tight">
            TournaStream
          </span>
        </Link>
        <Link
          href="/login"
          className="px-5 py-2 rounded-lg bg-white text-[#080b10] text-sm font-bold hover:bg-[#22c55e] transition-all duration-200"
        >
          Dang nhap
        </Link>
      </nav>

      <section className="relative z-10 max-w-md mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2">Dat lai mat khau</h1>
          <p className="text-white/50">Nhap mat khau moi de tiep tuc.</p>
        </div>

        <div className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#22c55e]/35 via-white/10 to-red-500/30 blur-xl opacity-70" />
          <form
            onSubmit={handleSubmit}
            className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] space-y-5"
          >
            <div>
              <label className="block text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (errors.email) setErrors({ ...errors, email: "" });
                }}
                placeholder="you@example.com"
                className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none ${
                  errors.email
                    ? "border-red-500"
                    : "border-white/[0.06] focus:border-[#22c55e]"
                }`}
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Ma dat lai
              </label>
              <input
                type="text"
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                  if (errors.token) setErrors({ ...errors, token: "" });
                }}
                placeholder="Token"
                className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none ${
                  errors.token
                    ? "border-red-500"
                    : "border-white/[0.06] focus:border-[#22c55e]"
                }`}
              />
              {errors.token && (
                <p className="text-red-500 text-sm mt-1">{errors.token}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Mat khau moi
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (errors.password) setErrors({ ...errors, password: "" });
                }}
                placeholder="********"
                className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none ${
                  errors.password
                    ? "border-red-500"
                    : "border-white/[0.06] focus:border-[#22c55e]"
                }`}
                autoComplete="new-password"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Nhap lai mat khau
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  if (errors.confirmPassword)
                    setErrors({ ...errors, confirmPassword: "" });
                }}
                placeholder="********"
                className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none ${
                  errors.confirmPassword
                    ? "border-red-500"
                    : "border-white/[0.06] focus:border-[#22c55e]"
                }`}
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
            >
              Dat lai mat khau
            </button>
          </form>
        </div>
      </section>

      {toast && (
        <Toast
          key={toast.id}
          kind={toast.kind}
          title={toast.title}
          message={toast.message}
          visible={toastVisible}
          onClose={dismissToast}
        />
      )}
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center">
          <p>Dang tai...</p>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
