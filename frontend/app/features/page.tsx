'use client';

import Link from "next/link";
import React from "react";

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  trophy: (
    <svg className="w-full h-full text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v5m-3 0h6M4 7h16M4 7a3 3 0 003 3h10a3 3 0 003-3M4 7V4a1 1 0 011-1h14a1 1 0 011 1v3M4 7a4 4 0 004 4h8a4 4 0 004-4" />
    </svg>
  ),
  tv: (
    <svg className="w-full h-full text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4" />
    </svg>
  ),
  realtime: (
    <svg className="w-full h-full text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  groups: (
    <svg className="w-full h-full text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  stats: (
    <svg className="w-full h-full text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
    </svg>
  ),
  security: (
    <svg className="w-full h-full text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
};

const FEATURES = [
  {
    id: "trophy",
    title: "Sinh bracket tự động",
    desc: "Nhập đội, hệ thống tự tạo bảng đấu loại trực tiếp theo chuẩn quốc tế.",
    details: "Hỗ trợ đầy đủ các kiểu giải đấu: single elimination, double elimination, round-robin và custom brackets.",
  },
  {
    id: "tv",
    title: "Trình chiếu trên TV",
    desc: "Link public read-only với font lớn, tối ưu cho màn hình chiếu hội trường.",
    details: "Tự động cập nhật theo thời gian thực. Không cần làm gì cả, chỉ cần để màn hình chạy.",
  },
  {
    id: "realtime",
    title: "Đồng bộ realtime",
    desc: "Admin cập nhật → tất cả màn hình thay đổi ngay tức thì, không cần reload.",
    details: "Sử dụng WebSocket để đồng bộ dữ liệu ngay tức thì trên tất cả thiết bị.",
  },
  {
    id: "groups",
    title: "Quản lý đội",
    desc: "Thêm/xóa đội, quản lý thành viên và thông tin cơ bản.",
    details: "Import hàng loạt từ Excel, quản lý xếp hạng và thống kê từng cầu thủ.",
  },
  {
    id: "stats",
    title: "Thống kê chi tiết",
    desc: "Theo dõi thống kê trận đấu, bảng xếp hạng và lịch sử.",
    details: "Xuất báo cáo PDF, chia sẻ kết quả qua social media.",
  },
  {
    id: "security",
    title: "Bảo mật & quyền hạn",
    desc: "Kiểm soát ai có thể xem, chỉnh sửa hoặc quản lý giải đấu.",
    details: "Tạo link read-only cho khán giả, link edit cho trọng tài, admin full control.",
  },
];

export default function FeaturesPage() {
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
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-black mb-4 tracking-tight">
          Tính năng đầy đủ cho
          <br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #22c55e 0%, #4ade80 100%)" }}>
            giải đấu chuyên nghiệp
          </span>
        </h1>
        <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto">
          Toàn bộ công cụ bạn cần để quản lý, tổ chức và truyền trực tiếp giải đấu của mình.
        </p>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 hover:border-[#22c55e]/30 hover:bg-[#22c55e]/[0.04] transition-all duration-300 hover:-translate-y-1"
            >
              <div className="mb-4 w-12 h-12 flex items-center justify-center rounded-xl bg-[#22c55e]/15 p-3">
                {FEATURE_ICONS[f.id]}
              </div>
              <h3 className="text-lg font-bold mb-2 text-white/90">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed mb-3">{f.desc}</p>
              <p className="text-xs text-white/30 leading-relaxed border-t border-white/[0.05] pt-3">
                {f.details}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-12 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-white/50 mb-6">Sẵn sàng tạo giải đấu của bạn?</p>
          <Link
            href="/tournaments/create"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#22c55e] text-[#080b10] text-base font-bold hover:bg-[#16a34a] transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L10 6.5H15.5L11 9.5L13 15L8 11.5L3 15L5 9.5L0.5 6.5H6L8 1Z" fill="currentColor" />
            </svg>
            Tạo giải đấu ngay
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 text-center text-white/20 text-xs">
        © 2026 Tournament Flow · Built for champions
      </footer>
    </main>
  );
}
