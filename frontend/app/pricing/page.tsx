'use client';

import Link from "next/link";

const PRICING_TIERS = [
  {
    name: "Dùng thử",
    price: "Miễn phí",
    subtitle: "giải đấu đầu tiên",
    badge: null,
    features: [
      "Tạo giải đấu đầu tiên miễn phí",
      "Đầy đủ tính năng",
      "Tối đa 8 đội",
    ],
  },
  {
    name: "Cơ bản",
    price: "49.000đ",
    subtitle: "/ giải đấu",
    badge: "Phổ biến",
    features: [
      "Không giới hạn thời gian",
      "Tối đa 16 đội",
      "Quản lý thành viên đội",
      "Chia sẻ link trực tiếp",
    ],
  },
  {
    name: "Cao cấp",
    price: "99.000đ",
    subtitle: "/ giải đấu",
    badge: null,
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
  return (
    <main className="min-h-screen bg-[#080b10] text-white font-sans overflow-x-hidden">
      {/* Noise overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* ── Navbar ── */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-4 border-b border-white/[0.06] backdrop-blur-md bg-[#080b10]/60">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-[#22c55e] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L10 6.5H15.5L11 9.5L13 15L8 11.5L3 15L5 9.5L0.5 6.5H6L8 1Z" fill="#080b10" />
            </svg>
          </div>
          <span className="text-[15px] font-bold tracking-tight">Tournament Flow</span>
        </Link>
        <Link
          href="/"
          className="px-5 py-2 rounded-lg bg-white text-[#080b10] text-sm font-bold hover:bg-[#22c55e] transition-all duration-200"
        >
          ← Quay lại
        </Link>
      </nav>

      {/* Header */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-black mb-4 tracking-tight">Bảng giá</h1>
        <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto">
          Chọn gói phù hợp cho giải đấu của bạn. Giải đấu đầu tiên miễn phí!
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-3xl border p-8 transition-all duration-300 group ${
                tier.badge
                  ? "border-[#22c55e]/50 bg-[#22c55e]/[0.08] ring-2 ring-[#22c55e]/20 md:scale-[1.05]"
                  : "border-white/[0.1] bg-white/[0.04] hover:border-white/20"
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-3 right-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22c55e] text-[#080b10] text-xs font-black tracking-wide">
                  {tier.badge}
                </div>
              )}

              {/* Title */}
              <h3 className="text-2xl font-black mb-1 text-white/90">{tier.name}</h3>

              {/* Price */}
              <div className="mb-6">
                <div className="text-4xl font-black text-white mb-1 tracking-tight">
                  {tier.price}
                </div>
                <div className="text-xs text-white/40">{tier.subtitle}</div>
              </div>

              {/* CTA */}
              <button
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm mb-6 transition-all duration-200 ${
                  tier.badge
                    ? "bg-[#22c55e] text-[#080b10] hover:bg-[#16a34a]"
                    : "bg-white/10 text-white hover:bg-white/20 border border-white/[0.1]"
                }`}
              >
                Lựa chọn
              </button>

              {/* Features */}
              <div className="space-y-3">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
                      <path d="M13 4L6 11L3 8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm text-white/60">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] p-6 text-center">
          <p className="text-sm text-white/60">
            <span className="text-lg mr-2">🎉</span>
            <span className="font-bold text-white">Miễn phí cho giải đấu đầu tiên!</span>
            <span className="text-white/40 ml-1">Tối đa 8 đội, đầy đủ tính năng.</span>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 text-center text-white/20 text-xs mt-12">
        © 2026 Tournament Flow · Built for champions
      </footer>
    </main>
  );
}
