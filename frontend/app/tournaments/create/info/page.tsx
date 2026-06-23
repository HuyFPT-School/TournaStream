'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState } from 'react';

const sports = [
  { id: 'moba', name: 'Game MOBA (Liên Quân, LOL, Tốc Chiến...)', icon: '⚔️' },
  { id: 'fps', name: 'Game Bắn súng đối kháng (Valorant, CS, Đột Kích...)', icon: '🔫' },
  { id: 'fighting_sports', name: 'Game Đối kháng / FIFA', icon: '🎮' },
  { id: 'battle_royale', name: 'Game Sinh tồn (PUBG, Free Fire...)', icon: '🪂' },
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
  const [matchDuration, setMatchDuration] = useState(data.matchDuration || 1);
  const [allowExtraTime, setAllowExtraTime] = useState(data.allowExtraTime || false);
  const [format, setFormat] = useState<'single_elimination' | 'round_robin' | 'double_elimination' | 'league'>(data.format || 'single_elimination');
  const [groupsCount, setGroupsCount] = useState<number>(data.groupsCount || 1);
  const [advancingCount, setAdvancingCount] = useState<number>(data.advancingCount || 2);
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
      setTournamentInfo(name, sport, matchDuration, allowExtraTime, format, groupsCount, advancingCount, leagueMatchesCount, pointRules);
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
          <p className="text-white/60">Điền thông tin cơ bản cho giải đấu Esports của bạn</p>
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
              className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none ${
                errors.name ? 'border-red-500' : 'border-white/[0.06] focus:border-[#22c55e]'
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
                  className={`p-4 rounded-lg border transition-all duration-200 text-center flex flex-col items-center justify-center ${
                    sport === s.id
                      ? 'border-[#22c55e] bg-[#1a1f2e]'
                      : 'border-white/[0.06] bg-[#0f1419] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="text-3xl mb-2">{s.icon}</div>
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
          )}

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
    </main>
  );
}
