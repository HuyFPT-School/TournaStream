"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toast } from "@/app/components/Toast";
import { changePassword, getSession } from "@/app/lib/authStorage";

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

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const openToast = (next: Omit<ToastState, "id">) => {
    setToast({ id: makeToastId(), ...next });
  };

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
    }
  }, [router]);

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

    if (!currentPassword) {
      newErrors.currentPassword = "Vui long nhap mat khau hien tai";
    }

    if (!newPassword) {
      newErrors.newPassword = "Vui long nhap mat khau moi";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Mat khau toi thieu 8 ky tu";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Vui long nhap lai mat khau";
    } else if (confirmPassword !== newPassword) {
      newErrors.confirmPassword = "Mat khau khong trung khop";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      await changePassword({ currentPassword, newPassword });
      openToast({
        kind: "success",
        title: "Doi mat khau thanh cong",
        message: "Mat khau da duoc cap nhat.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      openToast({
        kind: "error",
        title: "Doi mat khau that bai",
        message: "Mat khau hien tai khong dung hoac token het han.",
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
          href="/tournaments"
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
          href="/tournaments"
          className="px-5 py-2 rounded-lg bg-white text-[#080b10] text-sm font-bold hover:bg-[#22c55e] transition-all duration-200"
        >
          Quay lai
        </Link>
      </nav>

      <section className="relative z-10 max-w-md mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2">Doi mat khau</h1>
          <p className="text-white/50">
            Cap nhat mat khau cho tai khoan cua ban.
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#22c55e]/35 via-white/10 to-red-500/30 blur-xl opacity-70" />
          <form
            onSubmit={handleSubmit}
            className="relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] space-y-5"
          >
            <div>
              <label className="block text-sm font-semibold mb-2">
                Mat khau hien tai
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  if (errors.currentPassword)
                    setErrors({ ...errors, currentPassword: "" });
                }}
                placeholder="********"
                className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none ${
                  errors.currentPassword
                    ? "border-red-500"
                    : "border-white/[0.06] focus:border-[#22c55e]"
                }`}
                autoComplete="current-password"
              />
              {errors.currentPassword && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.currentPassword}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Mat khau moi
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  if (errors.newPassword)
                    setErrors({ ...errors, newPassword: "" });
                }}
                placeholder="********"
                className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none ${
                  errors.newPassword
                    ? "border-red-500"
                    : "border-white/[0.06] focus:border-[#22c55e]"
                }`}
                autoComplete="new-password"
              />
              {errors.newPassword && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.newPassword}
                </p>
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
              Cap nhat mat khau
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
