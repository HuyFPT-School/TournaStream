'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState } from 'react';

const SPORT_ICONS: Record<string, React.ReactNode> = {
  moba: (
    <svg className="w-8 h-8 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 3l-6 6m0 0V4m0 5h5M3 21l6-6m0 0v5m0-5H4M3 3l18 18" />
    </svg>
  ),
  fps: (
    <svg className="w-8 h-8 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
    </svg>
  ),
  fighting_sports: (
    <svg className="w-8 h-8 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h4M8 10v4m8-2h.01M19 12h.01" />
    </svg>
  ),
  battle_royale: (
    <svg className="w-8 h-8 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
};

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  single_elimination: (
    <svg className="w-6 h-6 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v5m-3 0h6M4 7h16M4 7a3 3 0 003 3h10a3 3 0 003-3M4 7V4a1 1 0 011-1h14a1 1 0 011 1v3M4 7a4 4 0 004 4h8a4 4 0 004-4" />
    </svg>
  ),
  round_robin: (
    <svg className="w-6 h-6 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  double_elimination: (
    <svg className="w-6 h-6 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m-7-5h3m-3 4h3m-6 2a9 9 0 1118 0v1.5a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 14.5V13z" />
    </svg>
  ),
};

const sports = [
  { id: 'moba', name: 'Game MOBA (Liên Quân, LOL, Tốc Chiến...)' },
  { id: 'fps', name: 'Game Bắn súng đối kháng (Valorant, CS, Đột Kích...)' },
  { id: 'fighting_sports', name: 'Game Đối kháng / FIFA' },
  { id: 'battle_royale', name: 'Game Sinh tồn (PUBG, Free Fire...)' },
];

const formats = [
  { id: 'single_elimination', name: 'Loại trực tiếp', desc: 'Thua 1 trận là bị loại ngay lập tức' },
  { id: 'round_robin', name: 'Vòng bảng & Knockout', desc: 'Chia bảng đấu tính điểm và lấy đội đi tiếp đấu Knockout' },
  { id: 'double_elimination', name: 'Nhánh thắng - Nhánh thua', desc: 'Esport chuyên nghiệp, thua 1 lần vẫn còn cơ hội sửa sai' },
];

export default function TournamentInfoPage() {
  const router = useRouter();
  const { data, setTournamentInfo } = useTournament();
  const [name, setName] = useState(data.name || '');
  const [sport, setSport] = useState(data.sport || '');
  const [matchDuration, setMatchDuration] = useState(data.matchDuration || 1);
  const [allowExtraTime, setAllowExtraTime] = useState(data.allowExtraTime || false);
  const [format, setFormat] = useState<'single_elimination' | 'round_robin' | 'double_elimination' | 'battle_royale' | 'league'>(data.format || 'single_elimination');
  const [groupsCount, setGroupsCount] = useState<number>(data.groupsCount || 1);
  const [advancingCount, setAdvancingCount] = useState<number>(data.advancingCount || 2);
  const [matchesCount, setMatchesCount] = useState<number>(data.matchesCount || 5);
  const [leagueMatchesCount, setLeagueMatchesCount] = useState<number>(data.leagueMatchesCount || 5);
  const [pointRules, setPointRules] = useState<Record<string, number>>(data.pointRules || {
    "1": 10,
    "2": 6,
    "3": 5,
    "4": 4,
    "5": 3,
    "6": 2,
    "7": 2,
    "8": 1,
    "9": 1,
    "10": 1,
    "11": 1,
    "12": 1
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showManualModal, setShowManualModal] = useState(false);

  const updatePointRule = (rankKey: string, val: number) => {
    setPointRules(prev => {
      const next = { ...prev };
      if (rankKey === '6-7') {
        next['6'] = val;
        next['7'] = val;
      } else if (rankKey === '8-12') {
        for (let r = 8; r <= 12; r++) {
          next[r.toString()] = val;
        }
      } else {
        next[rankKey] = val;
      }
      return next;
    });
  };

  const handleContinue = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Vui lòng nhập tên giải đấu';
    }
    if (!sport) {
      newErrors.sport = 'Vui lòng chọn thể loại game';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const finalFormat = sport === 'battle_royale' ? 'battle_royale' : format;
      const finalMatchesCount = sport === 'battle_royale' ? leagueMatchesCount : matchesCount;
      setTournamentInfo(
        name,
        sport,
        matchDuration,
        allowExtraTime,
        finalFormat as any,
        groupsCount,
        advancingCount,
        finalMatchesCount,
        leagueMatchesCount,
        pointRules
      );
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

          <span className="text-white/40 whitespace-nowrap">Quản lý đội</span>
          {sport !== 'battle_royale' && format !== 'league' && (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-white/40 whitespace-nowrap">Sắp xếp & Tạo đội</span>
            </>
          )}

        </div>

        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-black mb-1">Tên giải đấu</h1>
            <p className="text-white/60">Điền thông tin cơ bản cho giải đấu Esports của bạn</p>
          </div>
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-[#22c55e] hover:text-[#22c55e] font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            <svg className="w-3.5 h-3.5 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Hướng dẫn thể thức
          </button>
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
              placeholder="VD: Giải đấu Liên Quân Mobile Pro Cup 2026"
              className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none ${errors.name ? 'border-red-500' : 'border-white/[0.06] focus:border-[#22c55e]'
                }`}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Sport Selection */}
          <div>
            <label className="block text-sm font-semibold mb-3">Thể loại Game Esports</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {sports.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSport(s.id);
                    if (s.id === 'battle_royale') {
                      setFormat('league');
                    } else if (format === 'league') {
                      setFormat('single_elimination');
                    }
                    if (errors.sport) setErrors({ ...errors, sport: '' });
                  }}
                  className={`p-4 rounded-lg border transition-all duration-200 text-center flex flex-col items-center justify-center ${sport === s.id
                    ? 'border-[#22c55e] bg-[#1a1f2e]'
                    : 'border-white/[0.06] bg-[#0f1419] hover:border-white/[0.12]'
                    }`}
                >
                  <div className="w-12 h-12 mb-2 flex items-center justify-center text-[#22c55e]">{SPORT_ICONS[s.id]}</div>
                  <div className="text-xs font-semibold">{s.name}</div>
                </button>
              ))}
            </div>
            {errors.sport && <p className="text-red-500 text-sm mt-1">{errors.sport}</p>}
          </div>

          {/* Thể thức Selection */}
          {sport !== 'battle_royale' && (
            <div>
              <label className="block text-sm font-semibold mb-3">Thể thức thi đấu</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {formats.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id as any)}
                    className={`p-4 rounded-lg border transition-all duration-200 text-left flex flex-col justify-between h-full ${format === f.id
                      ? 'border-[#22c55e] bg-[#1a1f2e]'
                      : 'border-white/[0.06] bg-[#0f1419] hover:border-white/[0.12]'
                      }`}
                  >
                    <div>
                    <div className="w-8 h-8 mb-2 flex items-center justify-center text-[#22c55e]">{FORMAT_ICONS[f.id]}</div>
                      <div className="text-sm font-semibold mb-1">{f.name}</div>
                      <div className="text-[11px] text-white/50 leading-relaxed">{f.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Group Stage Config (Round Robin Sub-options) */}
          {sport !== 'battle_royale' && format === 'round_robin' && (
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
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all duration-200 ${groupsCount === num
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
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all duration-200 ${advancingCount === num
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



          {/* League Config Options */}
          {format === 'league' && (
            <div className="p-5 rounded-lg bg-[#0f1419] border border-white/[0.06] space-y-4">
              <h4 className="text-sm font-bold text-[#22c55e]">
                {sport === 'battle_royale' ? 'Cấu hình Giải đấu Sinh tồn (PUBG, Free Fire...)' : 'Cấu hình Đường đua điểm số (League)'}
              </h4>
              <div>
                <label className="block text-xs text-white/60 mb-2 font-medium">Số lượng trận đấu</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setLeagueMatchesCount(prev => Math.max(1, prev - 1)); }}
                    className="w-10 h-10 rounded-lg bg-[#080b10] border border-white/[0.06] flex items-center justify-center font-bold text-lg hover:border-white/[0.12] transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={leagueMatchesCount}
                    onChange={(e) => setLeagueMatchesCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 py-2 rounded-lg bg-[#080b10] border border-white/[0.06] text-white font-bold text-center focus:outline-none focus:border-[#22c55e]"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setLeagueMatchesCount(prev => Math.min(50, prev + 1)); }}
                    className="w-10 h-10 rounded-lg bg-[#080b10] border border-white/[0.06] flex items-center justify-center font-bold text-lg hover:border-white/[0.12] transition-colors"
                  >
                    +
                  </button>
                  <span className="text-[11px] text-white/40 font-medium">Trận (Tối đa 50)</span>
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-4">
                <label className="block text-xs text-white/60 mb-3 font-medium">Cấu hình Điểm Hạng (Placement Points)</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Top 1 (Hạng 1)', key: '1' },
                    { label: 'Top 2 (Hạng 2)', key: '2' },
                    { label: 'Top 3 (Hạng 3)', key: '3' },
                    { label: 'Top 4 (Hạng 4)', key: '4' },
                    { label: 'Top 5 (Hạng 5)', key: '5' },
                    { label: 'Top 6-7', key: '6-7', displayVal: pointRules['6'] },
                    { label: 'Top 8-12', key: '8-12', displayVal: pointRules['8'] },
                  ].map((rule) => (
                    <div key={rule.key} className="bg-[#080b10] border border-white/[0.04] p-3 rounded-lg flex flex-col gap-1.5">
                      <span className="text-[10px] text-white/50 font-semibold">{rule.label}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={rule.displayVal !== undefined ? rule.displayVal : (pointRules[rule.key] ?? 0)}
                          onChange={(e) => updatePointRule(rule.key, Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-2 py-1 rounded bg-[#0f1419] border border-white/[0.06] text-sm text-[#22c55e] font-black text-center focus:outline-none focus:border-[#22c55e]"
                        />
                        <span className="text-[10px] text-white/30 font-bold">Pts</span>
                      </div>
                    </div>
                  ))}
                  <div className="bg-[#080b10]/40 border border-dashed border-white/[0.04] p-3 rounded-lg flex flex-col justify-center items-center text-center">
                    <span className="text-[9px] text-[#22c55e] font-bold">1 Kill hạ gục</span>
                    <span className="text-[12px] font-black text-white mt-0.5">1 Điểm</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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

      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setShowManualModal(false)}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1118] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Hướng dẫn các thể thức thi đấu
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-6 text-sm text-white/80 leading-relaxed overflow-y-auto pr-2 max-h-[60vh]">
              {/* Thể thức 1 */}
              <div className="space-y-2">
                <h4 className="font-bold text-[#22c55e] flex items-center gap-2 text-base">
                  <svg className="w-5 h-5 text-[#22c55e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v5m-3 0h6M4 7h16M4 7a3 3 0 003 3h10a3 3 0 003-3M4 7V4a1 1 0 011-1h14a1 1 0 011 1v3M4 7a4 4 0 004 4h8a4 4 0 004-4" />
                  </svg>
                  1. Loại trực tiếp (Single Elimination)
                </h4>
                <p>
                  Đội thua một trận đấu sẽ bị loại ngay lập tức khỏi giải đấu. Đội thắng sẽ đi tiếp vào các vòng trong.
                </p>
                <div className="text-xs text-white/50 flex items-start gap-1">
                  <svg className="w-3.5 h-3.5 text-white/40 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Phù hợp cho giải đấu có nhiều đội tham gia, thời gian tổ chức ngắn và cần sự kịch tính cao.</span>
                </div>
              </div>

              {/* Thể thức 2 */}
              <div className="space-y-2 border-t border-white/[0.06] pt-4">
                <h4 className="font-bold text-[#22c55e] flex items-center gap-2 text-base">
                  <svg className="w-5 h-5 text-[#22c55e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m-7-5h3m-3 4h3m-6 2a9 9 0 1118 0v1.5a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 14.5V13z" />
                  </svg>
                  2. Nhánh thắng - Nhánh thua (Double Elimination)
                </h4>
                <p>
                  Các đội có 2 cơ hội thi đấu (2 &quot;mạng&quot;). Đội thua ở Nhánh Thắng sẽ rơi xuống Nhánh Thua để thi đấu tiếp. Đội thua ở Nhánh Thua mới chính thức bị loại.
                </p>
                <p>
                  Trận chung kết diễn ra giữa đội đứng đầu Nhánh Thắng và Nhánh Thua. Đội từ Nhánh Thua phải thắng 2 loạt trận liên tiếp mới vô địch.
                </p>
                <div className="text-xs text-white/50 flex items-start gap-1">
                  <svg className="w-3.5 h-3.5 text-white/40 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Thể thức tiêu chuẩn của Esport chuyên nghiệp, đảm bảo tính công bằng tối đa.</span>
                </div>
              </div>

              {/* Thể thức 3 */}
              <div className="space-y-2 border-t border-white/[0.06] pt-4">
                <h4 className="font-bold text-[#22c55e] flex items-center gap-2 text-base">
                  <svg className="w-5 h-5 text-[#22c55e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  3. Vòng bảng & Knock-out (Round Robin + Knockout)
                </h4>
                <p>
                  Các đội thi đấu vòng tròn tính điểm tại các bảng đấu. Những đội đứng đầu bảng đấu (thường là Top 2) sẽ giành quyền đi tiếp vào vòng Loại trực tiếp (Knock-out).
                </p>
                <div className="text-xs text-white/50 flex items-start gap-1">
                  <svg className="w-3.5 h-3.5 text-white/40 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Giúp các đội có cơ hội cọ xát tối thiểu 2-3 trận tại vòng bảng trước khi bước vào các trận sinh tử.</span>
                </div>
              </div>

              {/* Thể thức 4 */}
              <div className="space-y-2 border-t border-white/[0.06] pt-4">
                <h4 className="font-bold text-[#22c55e] flex items-center gap-2 text-base">
                  <svg className="w-5 h-5 text-[#22c55e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  4. Giải đấu Sinh tồn (Battle Royale / PUBG)
                </h4>
                <p>
                  Nhiều đội cùng thi đấu đồng thời trong một hoặc nhiều trận đấu. Sau mỗi trận, các đội nhận được điểm số tích lũy bao gồm <strong>Điểm Thứ Hạng</strong> và <strong>Điểm Hạ Gục (Kill Points)</strong>. Đội có tổng điểm cao nhất sau tất cả các trận sẽ giành chức vô địch.
                </p>
                <div className="text-xs text-white/50 flex items-start gap-1">
                  <svg className="w-3.5 h-3.5 text-white/40 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Điểm thứ hạng PUBG tiêu chuẩn: Top 1 (10đ), Top 2 (6đ), Top 3 (5đ), Top 4 (4đ), Top 5 (3đ), Top 6-7 (2đ), Top 8-12 (1đ). Mỗi kill được +1 điểm.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
