'use client';

import Link from "next/link";
import React from "react";

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  single_elimination: (
    <svg className="w-full h-full text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v5m-3 0h6M4 7h16M4 7a3 3 0 003 3h10a3 3 0 003-3M4 7V4a1 1 0 011-1h14a1 1 0 011 1v3M4 7a4 4 0 004 4h8a4 4 0 004-4" />
    </svg>
  ),
  double_elimination: (
    <svg className="w-full h-full text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m-7-5h3m-3 4h3m-6 2a9 9 0 1118 0v1.5a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 14.5V13z" />
    </svg>
  ),
  round_robin: (
    <svg className="w-full h-full text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  battle_royale: (
    <svg className="w-full h-full text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  )
};

const FORMATS_GUIDE = [
  {
    id: "single_elimination",
    title: "Loại trực tiếp (Single Elimination)",
    subtitle: "Đấu Knock-out một lần thua",
    desc: "Mỗi trận đấu gồm 2 đội đấu loại trực tiếp. Đội thua sẽ bị loại khỏi giải đấu ngay lập tức, đội thắng tiếp tục đi tiếp vào các vòng trong.",
    rules: [
      "Bốc thăm ngẫu nhiên hoặc xếp hạt giống chia cặp thi đấu.",
      "Đội thua dừng bước ngay lập tức, không có cơ hội sửa sai.",
      "Tỉ số hòa: Phải có hiệp phụ hoặc đá luân lưu (nếu cấu hình) để tìm ra đội thắng.",
      "Số lượng đội tối ưu: 2, 4, 8, 16, 32..."
    ],
    tip: "Phù hợp cho các giải đấu cần sự kịch tính cao độ, thời gian tổ chức ngắn hoặc số lượng đội tham gia quá lớn."
  },
  {
    id: "double_elimination",
    title: "Nhánh thắng - Nhánh thua (Double Elimination)",
    subtitle: "Cơ hội sửa sai lần hai",
    desc: "Mọi đội tuyển đều bắt đầu ở Nhánh Thắng. Đội thua ở Nhánh Thắng sẽ rơi xuống Nhánh Thua để tiếp tục thi đấu. Chỉ khi thua trận ở Nhánh Thua mới bị loại hoàn toàn.",
    rules: [
      "Nhánh Thắng (Upper Bracket): Đấu trực tiếp như Single Elimination.",
      "Nhánh Thua (Lower Bracket): Gom các đội thua từ Nhánh Thắng để đấu tiếp.",
      "Chung kết tổng (Grand Final): Vô địch Nhánh Thắng gặp Vô địch Nhánh Thua. Đội từ Nhánh Thua phải thắng 2 loạt trận liên tiếp (Bracket Reset) mới giành cúp vô địch.",
      "Đảm bảo các đội mạnh nhất không bị loại sớm do một trận đấu sẩy chân."
    ],
    tip: "Thích hợp cho các giải đấu Esports chuyên nghiệp, đòi hỏi chuyên môn cao như DOTA 2, League of Legends, Fighting Games."
  },
  {
    id: "round_robin",
    title: "Vòng bảng & Knock-out (Round Robin)",
    subtitle: "Đấu vòng tròn tích điểm tìm đội đi tiếp",
    desc: "Chia các đội thành 1, 2 hoặc 4 bảng đấu. Các đội trong cùng một bảng đấu vòng tròn một lượt để tính điểm (Thắng 3đ/1đ, Hòa 1đ, Thua 0đ). Top đội đứng đầu bảng đấu (thường là Top 2) đi tiếp vào vòng Loại trực tiếp.",
    rules: [
      "BTC có thể tùy chỉnh số bảng đấu và số lượng đội đi tiếp mỗi bảng.",
      "Thứ hạng dựa trên: Tổng điểm tích lũy -> Hiệu số bàn thắng -> Đối đầu trực tiếp.",
      "Kết thúc vòng bảng, hệ thống hỗ trợ sinh lịch đấu Knock-out tự động từ kết quả xếp hạng."
    ],
    tip: "Phù hợp cho các giải đấu bóng đá phong trào, bóng rổ hoặc các giải đấu kéo dài để mọi đội đều có cơ hội thi đấu tối thiểu 3 trận."
  },
  {
    id: "battle_royale",
    title: "Giải đấu Sinh tồn (Battle Royale / PUBG)",
    subtitle: "Đua điểm thứ hạng & điểm hạ gục",
    desc: "Nhiều đội (thường từ 12-24 đội) cùng thi đấu đồng thời trong một bản đồ qua nhiều trận đấu (Match). Điểm số của mỗi đội sau mỗi trận là tổng của Điểm Hạng (Placement Points) và Điểm Hạ Gục (Kill Points).",
    rules: [
      "Điểm Hạng tiêu chuẩn: Hạng 1 (10đ), Hạng 2 (6đ), Hạng 3 (5đ), Hạng 4 (4đ), Hạng 5 (3đ), Hạng 6-7 (2đ), Hạng 8-12 (1đ). Hạng 13-16 (0đ).",
      "Điểm Hạ Gục: Mỗi mạng tiêu diệt đối thủ (Kill) = +1 điểm.",
      "Nhà vô địch: Đội tích lũy tổng điểm cao nhất sau tất cả các trận đấu.",
      "Hỗ trợ cập nhật điểm số trực quan cho từng trận đấu trên thời gian thực."
    ],
    tip: "Đặc thù cho các tựa game bắn súng sinh tồn như PUBG, PUBG Mobile, Free Fire, Apex Legends."
  }
];

export default function GuidePage() {
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
          Hướng dẫn các
          <br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #22c55e 0%, #4ade80 100%)" }}>
            Thể thức thi đấu
          </span>
        </h1>
        <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto">
          Tìm hiểu cách hoạt động, luật thi đấu và cách hệ thống tự động hóa xử lý bảng đấu cho giải đấu của bạn.
        </p>
      </section>

      {/* Guides Grid */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-20 space-y-12">
        {FORMATS_GUIDE.map((fg) => (
          <div
            key={fg.title}
            className="group rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 md:p-10 hover:border-[#22c55e]/30 hover:bg-[#22c55e]/[0.02] transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 w-28 h-28 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-300">
              {FORMAT_ICONS[fg.id]}
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              <div className="md:w-1/3">
                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-[#22c55e]/15 p-3 mb-4">
                  {FORMAT_ICONS[fg.id]}
                </div>
                <h3 className="text-xl font-black mb-1 text-white">{fg.title}</h3>
                <p className="text-xs text-[#22c55e] font-semibold uppercase tracking-wider mb-3">{fg.subtitle}</p>
                <p className="text-sm text-white/50 leading-relaxed">{fg.desc}</p>
              </div>

              <div className="md:w-2/3 border-t md:border-t-0 md:border-l border-white/[0.06] pt-6 md:pt-0 md:pl-8 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-white/40 tracking-widest mb-3">Luật thi đấu & Cách tính điểm</h4>
                  <ul className="space-y-2.5">
                    {fg.rules.map((rule, rIdx) => (
                      <li key={rIdx} className="flex items-start gap-2.5 text-sm text-white/70">
                        <span className="text-[#22c55e] mt-1 text-xs">•</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-[#22c55e]/5 border border-[#22c55e]/10 text-xs text-white/60 flex items-start gap-2">
                  <svg className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <div>
                    <strong className="text-[#22c55e]">Mẹo tổ chức:</strong> {fg.tip}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 text-center text-white/20 text-xs">
        © 2026 Tournament Flow · Built for champions
      </footer>
    </main>
  );
}
