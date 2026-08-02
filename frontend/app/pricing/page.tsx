"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createSePayCheckout } from "../lib/sepay";

type PricingTier = {
  id: string;
  name: string;
  price: string;
  subtitle: string;
  badge: string | null;
  planKey: string;
  features: string[];
};

type CheckoutState = {
  checkoutCode: string;
  planName: string;
  amount: number;
  qrPayload: string;
  qrImageUrl: string;
  status: string;
};

const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Dùng thử",
    price: "Miễn phí",
    subtitle: "giải đấu đầu tiên",
    badge: null,
    planKey: "free",
    features: [
      "Tạo giải đấu đầu tiên miễn phí",
      "Đầy đủ tính năng",
      "Tối đa 8 đội",
    ],
  },
  {
    id: "basic",
    name: "Cơ bản",
    price: "49.000đ",
    subtitle: "/ giải đấu",
    badge: "Phổ biến",
    planKey: "basic",
    features: [
      "Không giới hạn thời gian",
      "Tối đa 16 đội",
      "Quản lý thành viên đội",
      "Chia sẻ link trực tiếp",
    ],
  },
  {
    id: "premium",
    name: "Cao cấp",
    price: "99.000đ",
    subtitle: "/ giải đấu",
    badge: null,
    planKey: "premium",
    features: [
      "Không giới hạn thời gian",
      "Tối đa 32 đội",
      "Tất cả tính năng cơ bản",
      "Hiệp phụ & bù giải nâng cao",
      "Hỗ trợ ưu tiên",
    ],
  },
];

export default function PricingPage() {
  const [activeCheckout, setActiveCheckout] = useState<CheckoutState | null>(
    null,
  );
  const [loadingPlanKey, setLoadingPlanKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedLabel = useMemo(() => {
    if (!activeCheckout) return "";
    return `${activeCheckout.planName} · ${activeCheckout.amount.toLocaleString("vi-VN")}đ`;
  }, [activeCheckout]);

  async function handleChooseTier(tier: PricingTier) {
    setErrorMessage("");

    if (tier.planKey === "free") {
      window.location.href = "/register";
      return;
    }

    setLoadingPlanKey(tier.planKey);
    try {
      const checkout = await createSePayCheckout({ planKey: tier.planKey });
      setActiveCheckout(checkout);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không tạo được QR thanh toán",
      );
    } finally {
      setLoadingPlanKey(null);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <main className="min-h-screen bg-[#080b10] text-white font-sans overflow-x-hidden">
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
            Tournament Flow
          </span>
        </Link>
        <Link
          href="/"
          className="px-5 py-2 rounded-lg bg-white text-[#080b10] text-sm font-bold hover:bg-[#22c55e] transition-all duration-200"
        >
          ← Quay lại
        </Link>
      </nav>

      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-black mb-4 tracking-tight">Bảng giá</h1>
        <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto">
          Chọn gói phù hợp cho giải đấu của bạn. Giải đấu đầu tiên miễn phí!
        </p>
      </section>

      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-3xl border p-8 transition-all duration-300 group ${
                tier.badge
                  ? "border-[#22c55e]/50 bg-[#22c55e]/[0.08] ring-2 ring-[#22c55e]/20 md:scale-[1.05]"
                  : "border-white/[0.1] bg-white/[0.04] hover:border-white/20"
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-3 right-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22c55e] text-[#080b10] text-xs font-black tracking-wide">
                  {tier.badge}
                </div>
              )}

              <h3 className="text-2xl font-black mb-1 text-white/90">
                {tier.name}
              </h3>

              <div className="mb-6">
                <div className="text-4xl font-black text-white mb-1 tracking-tight">
                  {tier.price}
                </div>
                <div className="text-xs text-white/40">{tier.subtitle}</div>
              </div>

              <button
                onClick={() => handleChooseTier(tier)}
                disabled={loadingPlanKey === tier.planKey}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm mb-6 transition-all duration-200 ${
                  tier.badge
                    ? "bg-[#22c55e] text-[#080b10] hover:bg-[#16a34a]"
                    : "bg-white/10 text-white hover:bg-white/20 border border-white/[0.1]"
                } ${loadingPlanKey === tier.planKey ? "opacity-70 cursor-wait" : ""}`}
              >
                {loadingPlanKey === tier.planKey
                  ? "Đang tạo QR..."
                  : tier.planKey === "free"
                    ? "Bắt đầu miễn phí"
                    : "Thanh toán bằng SePay"}
              </button>

              <div className="space-y-3">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="mt-0.5 shrink-0"
                    >
                      <path
                        d="M13 4L6 11L3 8"
                        stroke="#22c55e"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-sm text-white/60">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {errorMessage && (
          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] p-6 text-center flex items-center justify-center gap-2">
          <svg className="w-5 h-5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <p className="text-sm text-white/60">
            <span className="font-bold text-white">
              Miễn phí cho giải đấu đầu tiên!
            </span>
            <span className="text-white/40 ml-1">
              Tối đa 8 đội, đầy đủ tính năng.
            </span>
          </p>
        </div>
      </section>

      {activeCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Đóng"
            onClick={() => setActiveCheckout(null)}
          />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0c1118] shadow-[0_30px_120px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#22c55e]">
                  SePay checkout
                </p>
                <h3 className="mt-1 text-xl font-black text-white">
                  Quét QR để thanh toán
                </h3>
              </div>
              <button
                onClick={() => setActiveCheckout(null)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-white/10 bg-white p-4">
                <img
                  src={activeCheckout.qrImageUrl}
                  alt="Mã QR thanh toán SePay"
                  className="h-auto w-full rounded-xl"
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Gói đã chọn
                  </p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {selectedLabel}
                  </p>
                  <p className="mt-1 text-sm text-white/50">
                    Trạng thái checkout: {activeCheckout.status}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-white/40">
                        Mã nội dung chuyển khoản
                      </p>
                      <p className="font-mono text-lg font-bold text-[#22c55e]">
                        {activeCheckout.checkoutCode}
                      </p>
                    </div>
                    <button
                      onClick={() => copyText(activeCheckout.checkoutCode)}
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                    >
                      Copy
                    </button>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">Số tiền</p>
                    <p className="text-xl font-black text-white">
                      {activeCheckout.amount.toLocaleString("vi-VN")}đ
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-white/40">Chuỗi QR tạo ra</p>
                    <p className="break-all rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-white/70">
                      {activeCheckout.qrPayload}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#22c55e]/20 bg-[#22c55e]/10 p-4 text-sm text-[#d8ffe5]">
                  Sau khi chuyển khoản, SePay sẽ gọi webhook để cập nhật trạng
                  thái thanh toán tự động.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="relative z-10 border-t border-white/[0.06] py-6 text-center text-white/20 text-xs mt-12">
        © 2026 Tournament Flow · Built for champions
      </footer>
    </main>
  );
}
