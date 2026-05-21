"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Toast } from "@/app/components/Toast";
import { findUserByEmail } from "@/app/lib/authStorage";

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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const openToast = (next: Omit<ToastState, "id">) => {
    setToast({ id: makeToastId(), ...next });
  };

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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const newErrors: Record<string, string> = {};
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      newErrors.email = "Vui lòng nhập email";
    } else if (!emailRegex.test(normalizedEmail)) {
      newErrors.email = "Email không hợp lệ";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const user = findUserByEmail(normalizedEmail);
    if (!user) {
      setErrors({ email: "Email chưa được đăng ký" });
      openToast({
        kind: "error",
        title: "Không tìm thấy email",
        message: "Vui lòng kiểm tra lại hoặc tạo tài khoản mới.",
      });
      return;
    }

    setSubmitted(true);
    openToast({
      kind: "success",
      title: "Đã gửi hướng dẫn",
      message: "Kiểm tra email để đặt lại mật khẩu của bạn.",
    });
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
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(1200px 700px at 18% -10%, rgba(34,197,94,0.26), transparent 60%), radial-gradient(900px 520px at 82% 2%, rgba(248,113,113,0.2), transparent 65%), radial-gradient(1100px 600px at 50% 120%, rgba(15,23,42,0.9), rgba(8,11,16,1) 70%), linear-gradient(180deg, rgba(8,11,16,0.65) 0%, rgba(8,11,16,1) 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(60% 40% at 50% 12%, rgba(255,255,255,0.16), transparent 60%)",
          }}
        />
        <div className="auth-beam auth-beam-left" />
        <div className="auth-beam auth-beam-center" />
        <div className="auth-beam auth-beam-right" />
        <div className="auth-floor" />
        <div className="auth-floor-ring" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(120deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 40%, rgba(34,197,94,0.18) 60%, rgba(255,255,255,0) 100%)",
          }}
        />
        <div className="auth-grid" />
      </div>

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
          Quay lại đăng nhập
        </Link>
      </nav>

      <section className="relative z-10 max-w-md mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2">Quên mật khẩu</h1>
          <p className="text-white/50">
            Nhập email đã đăng ký để nhận hướng dẫn đặt lại mật khẩu.
          </p>
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

            <button
              type="submit"
              className="w-full px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
            >
              Gửi hướng dẫn
            </button>

            {submitted && (
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white/70">
                Nếu email đã đăng ký, bạn sẽ nhận được hướng dẫn đặt lại trong
                vài phút.
              </div>
            )}

            <p className="text-sm text-center text-white/50">
              Bạn đã nhớ mật khẩu?{" "}
              <Link
                href="/login"
                className="text-white hover:text-[#22c55e] transition-colors"
              >
                Đăng nhập ngay
              </Link>
            </p>
          </form>
        </div>
      </section>

      <style jsx global>{`
        .auth-beam {
          position: absolute;
          top: -30%;
          height: 140vh;
          width: 220px;
          filter: blur(50px);
          opacity: 0.55;
        }
        .auth-beam-left {
          left: -60px;
          background: linear-gradient(
            180deg,
            rgba(34, 197, 94, 0.45),
            rgba(34, 197, 94, 0.12) 55%,
            transparent
          );
          transform: rotate(-16deg);
          animation: auth-beam-left 10s ease-in-out infinite;
        }
        .auth-beam-center {
          left: 50%;
          width: 300px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.28),
            rgba(34, 197, 94, 0.06) 55%,
            transparent
          );
          transform: translateX(-50%) rotate(2deg);
          opacity: 0.4;
          animation: auth-beam-center 12s ease-in-out infinite 0.8s;
        }
        .auth-beam-right {
          right: -70px;
          background: linear-gradient(
            180deg,
            rgba(248, 113, 113, 0.4),
            rgba(248, 113, 113, 0.1) 55%,
            transparent
          );
          transform: rotate(18deg);
          animation: auth-beam-right 11s ease-in-out infinite 0.4s;
        }
        .auth-floor {
          position: absolute;
          bottom: -180px;
          left: 50%;
          width: 900px;
          height: 320px;
          transform: translateX(-50%);
          background: radial-gradient(
            closest-side,
            rgba(34, 197, 94, 0.22),
            rgba(8, 11, 16, 0) 70%
          );
          filter: blur(12px);
          opacity: 0.75;
        }
        .auth-floor-ring {
          position: absolute;
          bottom: -120px;
          left: 50%;
          width: 780px;
          height: 220px;
          transform: translateX(-50%);
          border-radius: 999px;
          border: 1px solid rgba(34, 197, 94, 0.22);
          opacity: 0.5;
        }
        .auth-grid {
          position: absolute;
          inset: 0;
          opacity: 0.06;
          background-image:
            repeating-linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.08) 0 1px,
              transparent 1px 90px
            ),
            repeating-linear-gradient(
              0deg,
              rgba(255, 255, 255, 0.05) 0 1px,
              transparent 1px 120px
            );
          mask-image: radial-gradient(
            60% 40% at 50% 70%,
            #000 10%,
            transparent 70%
          );
        }
        @keyframes auth-beam-left {
          0%,
          100% {
            transform: translateY(0) rotate(-16deg);
            opacity: 0.55;
          }
          50% {
            transform: translateY(24px) rotate(-14deg);
            opacity: 0.75;
          }
        }
        @keyframes auth-beam-center {
          0%,
          100% {
            transform: translateX(-50%) translateY(0) rotate(2deg);
            opacity: 0.4;
          }
          50% {
            transform: translateX(-50%) translateY(18px) rotate(4deg);
            opacity: 0.65;
          }
        }
        @keyframes auth-beam-right {
          0%,
          100% {
            transform: translateY(0) rotate(18deg);
            opacity: 0.5;
          }
          50% {
            transform: translateY(20px) rotate(16deg);
            opacity: 0.7;
          }
        }
      `}</style>

      {toast && (
        <Toast
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
