'use client';

import Link from "next/link";

const FEATURES = [
  {
    emoji: "🏆",
    title: "Sinh bracket tự động",
    desc: "Nhập đội, hệ thống tự tạo bảng đấu loại trực tiếp theo chuẩn quốc tế.",
    details: "Hỗ trợ đầy đủ các kiểu giải đấu: single elimination, double elimination, round-robin và custom brackets.",
  },
  {
    emoji: "📺",
    title: "Trình chiếu trên TV",
    desc: "Link public read-only với font lớn, tối ưu cho màn hình chiếu hội trường.",
    details: "Tự động cập nhật theo thời gian thực. Không cần làm gì cả, chỉ cần để màn hình chạy.",
  },
  {
    emoji: "⚡",
    title: "Đồng bộ realtime",
    desc: "Admin cập nhật → tất cả màn hình thay đổi ngay tức thì, không cần reload.",
    details: "Sử dụng WebSocket để đồng bộ dữ liệu ngay tức thì trên tất cả thiết bị.",
  },
  {
    emoji: "👥",
    title: "Quản lý đội",
    desc: "Thêm/xóa đội, quản lý thành viên và thông tin cơ bản.",
    details: "Import hàng loạt từ Excel, quản lý xếp hạng và thống kê từng cầu thủ.",
  },
  {
    emoji: "📊",
    title: "Thống kê chi tiết",
    desc: "Theo dõi thống kê trận đấu, bảng xếp hạng và lịch sử.",
    details: "Xuất báo cáo PDF, chia sẻ kết quả qua social media.",
  },
  {
    emoji: "🔐",
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
              <div className="mb-4 w-12 h-12 flex items-center justify-center rounded-xl bg-[#22c55e]/15 text-2xl">
                {f.emoji}
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
