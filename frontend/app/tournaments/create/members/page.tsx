'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState } from 'react';

export default function MembersPage() {
  const router = useRouter();
  const { data } = useTournament();
  const [selectedTeamId, setSelectedTeamId] = useState<string>(data.teams[0]?.id || '');

  const selectedTeam = data.teams.find(t => t.id === selectedTeamId);

  const handleContinue = () => {
    // Check if all teams have at least 1 member
    const allTeamsHaveMembers = data.teams.every(t => t.members.length > 0);
    
    if (!allTeamsHaveMembers) {
      alert('Vui lòng thêm ít nhất 1 thành viên cho mỗi đội');
      return;
    }

    router.push('/tournaments/create/bracket');
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
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
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
          <button className="text-white/40 hover:text-white transition-colors whitespace-nowrap">Danh sách đội</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <button className="text-[#22c55e] whitespace-nowrap">Thành viên</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-white/40 whitespace-nowrap">Sắp xếp & Tạo</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-1">Thành viên</h1>
          <p className="text-white/60">Thêm thành viên cho từng đội</p>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Team List */}
          <div className="md:col-span-1">
            <div className="sticky top-8">
              <h3 className="text-sm font-semibold mb-3 text-white/80">Chọn đội</h3>
              <div className="space-y-2">
                {data.teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`w-full p-3 rounded-lg text-left transition-all duration-200 border ${
                      selectedTeamId === team.id
                        ? 'border-[#22c55e] bg-[#1a1f2e]'
                        : 'border-white/[0.06] bg-[#0f1419] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="font-semibold">{team.name}</div>
                    <div className="text-sm text-white/50">{team.members.length} thành viên</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Members List */}
          <div className="md:col-span-2">
            {selectedTeam && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Thành viên — {selectedTeam.name}</h3>
                  <Link
                    href={`/tournaments/create/members/${selectedTeam.id}`}
                    className="px-3 py-1.5 rounded-lg bg-[#22c55e] text-[#080b10] text-sm font-semibold hover:bg-[#16a34a] transition-all duration-200"
                  >
                    + Thêm TV
                  </Link>
                </div>

                {selectedTeam.members.length === 0 ? (
                  <div className="p-8 rounded-lg bg-[#0f1419] border border-dashed border-white/[0.06] text-center">
                    <div className="text-4xl mb-3">👥</div>
                    <p className="text-white/60">Chưa có thành viên</p>
                    <Link
                      href={`/tournaments/create/members/${selectedTeam.id}`}
                      className="inline-block mt-4 px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] text-sm font-semibold hover:bg-[#16a34a] transition-all duration-200"
                    >
                      Thêm thành viên
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedTeam.members.map((member) => (
                      <div
                        key={member.id}
                        className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 flex items-start gap-4 group"
                      >
                        {member.image ? (
                          <img
                            src={member.image}
                            alt={member.name}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-[#1a1f2e] flex items-center justify-center flex-shrink-0 text-lg">
                            👤
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold">{member.name}</h4>
                          <p className="text-sm text-white/50">{member.position}</p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <Link
                            href={`/tournaments/create/members/${selectedTeam.id}/${member.id}`}
                            className="p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path
                                d="M2 14L12 4M12 4H7M12 4V9"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4 mt-12">
          <Link
            href="/tournaments/create/teams"
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
