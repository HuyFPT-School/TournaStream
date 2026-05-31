'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament, Team } from '@/app/contexts/TournamentContext';
import { useState } from 'react';

export default function TeamsPage() {
  const router = useRouter();
  const { data, addTeam, removeTeam } = useTournament();
  const [teamName, setTeamName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const maxTeams = data.packageId === 'free' ? 8 : data.packageId === 'basic' ? 16 : 32;

  const handleAddTeam = () => {
    const newErrors: Record<string, string> = {};

    if (!teamName.trim()) {
      newErrors.teamName = 'Vui lòng nhập tên đội';
    }

    if (data.teams.some(t => t.name.toLowerCase() === teamName.toLowerCase())) {
      newErrors.teamName = 'Tên đội này đã tồn tại';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const newTeam: Team = {
        id: Date.now().toString(),
        name: teamName,
        members: [],
      };
      addTeam(newTeam);
      setTeamName('');
      setShowForm(false);
    }
  };

  const isPowerOfTwo = (n: number) => {
    return n > 1 && (n & (n - 1)) === 0;
  };

  const handleContinue = () => {
    if (data.teams.length < 2) {
      alert('Vui lòng thêm ít nhất 2 đội');
      return;
    }
    if (!isPowerOfTwo(data.teams.length)) {
      alert('Số lượng đội thi đấu phải là lũy thừa của 2 (2, 4, 8, 16, 32...) để có sơ đồ thi đấu hợp lệ.');
      return;
    }
    router.push('/tournaments/create/members');
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
          <button className="text-white/40 hover:text-white transition-colors whitespace-nowrap">Thông tin</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <button className="text-[#22c55e] whitespace-nowrap">Danh sách đội</button>
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
          <h1 className="text-3xl font-black mb-1">Danh sách đội ({data.teams.length}/{maxTeams})</h1>
          <p className="text-white/60">Có thể thêm tối đa {maxTeams} đội</p>
        </div>

        {/* Teams Grid */}
        <div className="space-y-3 mb-8">
          {data.teams.map((team, idx) => (
            <div
              key={team.id}
              className="flex items-center justify-between p-4 rounded-lg bg-[#0f1419] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 group"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="text-white/40 font-semibold flex-shrink-0">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{team.name}</h3>
                  <p className="text-sm text-white/50">{team.members.length} thành viên</p>
                </div>
              </div>
              <button
                onClick={() => removeTeam(team.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M15 5L5 15M5 5L15 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add Team Form */}
        {showForm ? (
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06] mb-8">
            <label className="block text-sm font-semibold mb-2">Tên đội</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                if (errors.teamName) setErrors({ ...errors, teamName: '' });
              }}
              placeholder="VD: Team A, FC Barcelona..."
              className={`w-full px-4 py-3 rounded-lg bg-[#080b10] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none mb-3 ${
                errors.teamName ? 'border-red-500' : 'border-white/[0.06] focus:border-[#22c55e]'
              }`}
              autoFocus
            />
            {errors.teamName && <p className="text-red-500 text-sm mb-3">{errors.teamName}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowForm(false);
                  setTeamName('');
                  setErrors({});
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200"
              >
                Hủy
              </button>
              <button
                onClick={handleAddTeam}
                className="flex-1 px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
              >
                Thêm đội
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            disabled={data.teams.length >= maxTeams}
            className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-white/[0.06] text-white font-semibold hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
          >
            + Thêm đội
          </button>
        )}

        {/* Invalid team count warning */}
        {!isPowerOfTwo(data.teams.length) && data.teams.length > 0 && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm mb-6 flex items-start gap-2.5">
            <span className="text-base">⚠️</span>
            <div>
              <div className="font-semibold mb-0.5">Số lượng đội không hợp lệ</div>
              Sơ đồ thi đấu loại trực tiếp yêu cầu số lượng đội phải là lũy thừa của 2 (2, 4, 8, 16 hoặc 32 đội). Hiện tại bạn đang có {data.teams.length} đội.
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex gap-4">
          <Link
            href="/tournaments/create/info"
            className="flex-1 px-6 py-3 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200 text-center"
          >
            Quay lại
          </Link>
          <button
            onClick={handleContinue}
            disabled={data.teams.length < 2 || !isPowerOfTwo(data.teams.length)}
            className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tiếp tục
          </button>
        </div>
      </section>
    </main>
  );
}
