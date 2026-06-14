'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState } from 'react';

const sports = [
  { id: 'soccer', name: 'Bóng đá', icon: '⚽' },
  { id: 'basketball', name: 'Bóng rổ', icon: '🏀' },
  { id: 'volleyball', name: 'Bóng chuyền', icon: '🏐' },
  { id: 'tennis', name: 'Cầu lông', icon: '🏸' },
  { id: 'esports', name: 'Esport', icon: '🎮' },
];

const formats = [
  { id: 'single_elimination', name: 'Loại trực tiếp', desc: 'Thua 1 trận là bị loại ngay lập tức', icon: '🏆' },
  { id: 'round_robin', name: 'Vòng bảng & Knockout', desc: 'Chia bảng đấu tính điểm và lấy đội đi tiếp đấu Knockout', icon: '⚽' },
  { id: 'double_elimination', name: 'Nhánh thắng - Nhánh thua', desc: 'Esport chuyên nghiệp, thua 1 lần vẫn còn cơ hội sửa sai', icon: '🎮' },
];

export default function TournamentInfoPage() {
  const router = useRouter();
  const { data, setTournamentInfo } = useTournament();
  const [name, setName] = useState(data.name || '');
  const [sport, setSport] = useState(data.sport || '');
  const [matchDuration, setMatchDuration] = useState(data.matchDuration || 45);
  const [allowExtraTime, setAllowExtraTime] = useState(data.allowExtraTime || false);
  const [format, setFormat] = useState<'single_elimination' | 'round_robin' | 'double_elimination'>(data.format || 'single_elimination');
  const [groupsCount, setGroupsCount] = useState<number>(data.groupsCount || 1);
  const [advancingCount, setAdvancingCount] = useState<number>(data.advancingCount || 2);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleContinue = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Vui lòng nhập tên giải đấu';
    }
    if (!sport) {
      newErrors.sport = 'Vui lòng chọn loại môn thể thao';
    }
    if (matchDuration <= 0) {
      newErrors.matchDuration = 'Thời gian hiệp phải > 0';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setTournamentInfo(name, sport, matchDuration, allowExtraTime, format, groupsCount, advancingCount);
      router.push('/tournaments/create/teams');
    }
  };

  return (
    <main className="min-h-screen bg-[#080b10] text-white font-sans">
      {/* Noise overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Navbar */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-4 border-b border-white/[0.06] backdrop-blur-md bg-[#080b10]/60">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-[#22c55e] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L10 6.5H15.5L11 9.5L13 15L8 11.5L3 15L5 9.5L0.5 6.5H6L8 1Z" fill="#080b10" />
            </svg>
          </div>
          <span className="text-[15px] font-bold tracking-tight">TournaStream</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/tournaments"
            className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5"
          >
            Quay lại
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-sm text-white/60 overflow-x-auto pb-2">
          <button className="text-white/40 hover:text-white transition-colors whitespace-nowrap">Gói dịch vụ</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <button className="text-[#22c55e] whitespace-nowrap">Thông tin</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-white/40 whitespace-nowrap">Danh sách đội</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-white/40 whitespace-nowrap">Thành viên</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-white/40 whitespace-nowrap">Sắp xếp & Tạo</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-1">Tên giải đấu</h1>
          <p className="text-white/60">Điền thông tin cơ bản cho giải đấu của bạn</p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Tournament Name */}
          <div>
            <label className="block text-sm font-semibold mb-2">Tên giải đấu</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              placeholder="VD: Giải bóng đá mùa hè 2026"
              className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none ${
                errors.name ? 'border-red-500' : 'border-white/[0.06] focus:border-[#22c55e]'
              }`}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Sport Selection */}
          <div>
            <label className="block text-sm font-semibold mb-3">Loại môn thể thao</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {sports.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSport(s.id);
                    if (errors.sport) setErrors({ ...errors, sport: '' });
                  }}
                  className={`p-4 rounded-lg border transition-all duration-200 text-center ${
                    sport === s.id
                      ? 'border-[#22c55e] bg-[#1a1f2e]'
                      : 'border-white/[0.06] bg-[#0f1419] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <div className="text-sm font-medium">{s.name}</div>
                </button>
              ))}
            </div>
            {errors.sport && <p className="text-red-500 text-sm mt-1">{errors.sport}</p>}
          </div>

          {/* Thể thức Selection */}
          <div>
            <label className="block text-sm font-semibold mb-3">Thể thức thi đấu</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {formats.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id as any)}
                  className={`p-4 rounded-lg border transition-all duration-200 text-left flex flex-col justify-between h-full ${
                    format === f.id
                      ? 'border-[#22c55e] bg-[#1a1f2e]'
                      : 'border-white/[0.06] bg-[#0f1419] hover:border-white/[0.12]'
                  }`}
                >
                  <div>
                    <div className="text-2xl mb-2">{f.icon}</div>
                    <div className="text-sm font-semibold mb-1">{f.name}</div>
                    <div className="text-[11px] text-white/50 leading-relaxed">{f.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Group Stage Config (Round Robin Sub-options) */}
          {format === 'round_robin' && (
            <div className="p-5 rounded-lg bg-[#0f1419] border border-white/[0.06] space-y-4">
              <h4 className="text-sm font-bold text-[#22c55e]">Cấu hình Vòng bảng</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/60 mb-2 font-medium">Số bảng đấu</label>
                  <div className="flex gap-2">
                    {[1, 2, 4].map((num) => (
                      <button
                        key={num}
                        onClick={() => setGroupsCount(num)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all duration-200 ${
                          groupsCount === num
                            ? 'border-[#22c55e] bg-[#1a1f2e] text-[#22c55e]'
                            : 'border-white/[0.06] bg-[#080b10] hover:border-white/[0.12]'
                        }`}
                      >
                        {num} Bảng
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-2 font-medium">Số đội đi tiếp mỗi bảng</label>
                  <div className="flex gap-2">
                    {[1, 2].map((num) => (
                      <button
                        key={num}
                        onClick={() => setAdvancingCount(num)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all duration-200 ${
                          advancingCount === num
                            ? 'border-[#22c55e] bg-[#1a1f2e] text-[#22c55e]'
                            : 'border-white/[0.06] bg-[#080b10] hover:border-white/[0.12]'
                        }`}
                      >
                        Top {num} Đội
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-white/40">
                Tổng số đội vào vòng Knock-out: <span className="text-[#22c55e] font-bold">{groupsCount * advancingCount} đội</span>.
              </p>
            </div>
          )}

          {/* Match Duration */}
          <div>
            <label className="block text-sm font-semibold mb-2">Thời gian mỗi hiệp (phút)</label>
            <input
              type="number"
              value={matchDuration}
              onChange={(e) => {
                setMatchDuration(Number(e.target.value));
                if (errors.matchDuration) setErrors({ ...errors, matchDuration: '' });
              }}
              min="1"
              className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white focus:outline-none ${
                errors.matchDuration ? 'border-red-500' : 'border-white/[0.06] focus:border-[#22c55e]'
              }`}
            />
            {errors.matchDuration && <p className="text-red-500 text-sm mt-1">{errors.matchDuration}</p>}
          </div>

          {/* Extra Time */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <input
              type="checkbox"
              id="extraTime"
              checked={allowExtraTime}
              onChange={(e) => setAllowExtraTime(e.target.checked)}
              className="w-5 h-5 rounded accent-[#22c55e] cursor-pointer"
            />
            <label htmlFor="extraTime" className="flex-1 text-sm font-medium cursor-pointer">
              Cho phép hiệp phụ khi hòa?
            </label>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4 mt-12">
          <Link
            href="/tournaments/create"
            className="flex-1 px-6 py-3 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200 text-center"
          >
            Quay lại
          </Link>
          <button
            onClick={handleContinue}
            className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
          >
            Tiếp tục
          </button>
        </div>
      </section>
    </main>
  );
}
