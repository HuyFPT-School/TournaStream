'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState, useEffect } from 'react';
import { syncTournamentToBackend } from '@/app/lib/tournaments';
import { getSession } from '@/app/lib/authStorage';
import { buildSingleEliminationBracket, buildDoubleEliminationBracket } from '@/app/lib/bracketEngine';

type TeamRef = { id?: string; name?: string };

function buildInitialBracket(teams: TeamRef[]) {
  const list = [...teams];
  if (list.length % 2 !== 0) {
    list.push({ id: 'bye', name: 'BYE' });
  }
  const roundOne = [] as Array<{
    teamA?: TeamRef;
    teamB?: TeamRef;
    scoreA: number | null;
    scoreB: number | null;
    isFinished: boolean;
    winner?: TeamRef;
  }>;

  for (let i = 0; i < list.length; i += 2) {
    const isBye = list[i + 1]?.id === 'bye';
    roundOne.push({
      teamA: list[i],
      teamB: list[i + 1],
      scoreA: isBye ? 1 : null,
      scoreB: isBye ? 0 : null,
      isFinished: isBye,
      winner: isBye ? list[i] : undefined,
    });
  }

  return {
    rounds: [roundOne],
    currentRound: 0,
    currentMatch: 0,
    isFinished: false,
  };
}

function buildRoundRobinMatches(groupTeams: TeamRef[], groupIdx: number) {
  const list = [...groupTeams];
  const matches: any[] = [];
  const n = list.length;
  if (n < 2) return [];

  const hasBye = n % 2 !== 0;
  if (hasBye) {
    list.push({ id: 'bye', name: 'BYE' });
  }
  const numTeams = list.length;
  const roundsCount = numTeams - 1;
  const matchesPerRound = numTeams / 2;

  let matchCounter = 0;
  for (let round = 0; round < roundsCount; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const teamA = list[i];
      const teamB = list[numTeams - 1 - i];

      if (teamA.id !== 'bye' && teamB.id !== 'bye') {
        matches.push({
          id: `g-${groupIdx}-${matchCounter++}`,
          teamA,
          teamB,
          scoreA: null,
          scoreB: null,
          isFinished: false,
          roundIndex: round
        });
      }
    }
    const rotated = [list[0], list[numTeams - 1], ...list.slice(1, numTeams - 1)];
    for (let idx = 0; idx < numTeams; idx++) {
      list[idx] = rotated[idx];
    }
  }
  return matches;
}



export default function BracketPage() {
  const router = useRouter();
  const { data, loadTournamentData, resetTournament } = useTournament();
  const [orderedTeams, setOrderedTeams] = useState(data.teams);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (data.format === 'league' || data.format === 'battle_royale') {
      router.replace('/tournaments/create/finalize');
      return;
    }
    setOrderedTeams(data.teams);
  }, [data.teams, data.format, router]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;

    const newTeams = [...orderedTeams];
    const draggedTeam = newTeams[draggedIndex];
    newTeams.splice(draggedIndex, 1);
    newTeams.splice(index, 0, draggedTeam);

    setOrderedTeams(newTeams);
    setDraggedIndex(null);
  };

  const handleShuffle = () => {
    const shuffled = [...orderedTeams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrderedTeams(shuffled);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newTeams = [...orderedTeams];
    [newTeams[index], newTeams[index - 1]] = [newTeams[index - 1], newTeams[index]];
    setOrderedTeams(newTeams);
  };

  const handleMoveDown = (index: number) => {
    if (index === orderedTeams.length - 1) return;
    const newTeams = [...orderedTeams];
    [newTeams[index], newTeams[index + 1]] = [newTeams[index + 1], newTeams[index]];
    setOrderedTeams(newTeams);
  };

  const getGroupsOfTeams = (teams: any[], groupsCount: number) => {
    const groups: any[][] = Array.from({ length: groupsCount }, () => []);
    teams.forEach((team, idx) => {
      const groupIdx = idx % groupsCount;
      groups[groupIdx].push(team);
    });
    return groups;
  };

  const handleCreate = async () => {
    if (isSubmitting) return;
    if (!orderedTeams || orderedTeams.length < 2) {
      alert("Cần ít nhất 2 đội tham gia để tạo giải đấu!");
      return;
    }
    setIsSubmitting(true);

    try {
      const tournamentId = data.id || 'tourn_' + Date.now();

      let bracket = null;
      let groups: any[] | null = null;
      let stage = null;

      if (data.format === 'round_robin') {
        const groupsCount = data.groupsCount || 1;
        groups = Array.from({ length: groupsCount }, (_, gIdx) => ({
          name: `Bảng ${String.fromCharCode(65 + gIdx)}`,
          teams: [] as TeamRef[],
          matches: [] as any[]
        }));
        orderedTeams.forEach((team, idx) => {
          const gIdx = idx % groupsCount;
          groups![gIdx].teams.push(team);
        });

        groups!.forEach((group, gIdx) => {
          group.matches = buildRoundRobinMatches(group.teams, gIdx);
        });
        stage = 'group';
      } else if (data.format === 'double_elimination') {
        bracket = buildDoubleEliminationBracket(orderedTeams);
      } else {
        bracket = buildSingleEliminationBracket(orderedTeams);
      }

      const mockTournament = {
        id: tournamentId,
        ...data,
        teams: orderedTeams,
        orderedTeams: orderedTeams,
        bracketSeeded: true,
        bracket,
        groups,
        stage: stage || 'bracket',
        createdAt: new Date().toISOString(),
      };

      try {
        await syncTournamentToBackend(mockTournament);
      } catch (err) {
        console.error('Error syncing tournament to backend:', err);
      }

      const session = getSession();
      const tournamentsKey = session ? `tournaments_${session.id}` : 'tournaments';
      const currentTournamentKey = session ? `currentTournament_${session.id}` : 'currentTournament';
      const draftKey = session ? `tournamentDraft_${session.id}` : 'tournamentDraft';

      const savedList = localStorage.getItem(tournamentsKey);
      let list: any[] = [];
      if (savedList) {
        try {
          list = JSON.parse(savedList);
          if (!Array.isArray(list)) list = [];
        } catch {
          list = [];
        }
      }
      const index = list.findIndex((t: any) => t.id === mockTournament.id);
      if (index > -1) {
        list[index] = mockTournament;
      } else {
        list.push(mockTournament);
      }
      localStorage.setItem(tournamentsKey, JSON.stringify(list));
      localStorage.setItem(currentTournamentKey, JSON.stringify(mockTournament));
      localStorage.removeItem(draftKey);
      resetTournament();
      
      router.push(`/tournaments/${mockTournament.id}`);
    } catch (error) {
      console.error('Error starting tournament:', error);
      alert('Đã xảy ra lỗi khi tạo giải đấu.');
    } finally {
      setIsSubmitting(false);
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
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-16">
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
          <button className="text-white/40 hover:text-white transition-colors whitespace-nowrap">Thành viên</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <button className="text-white/40 hover:text-white transition-colors whitespace-nowrap" onClick={() => router.push('/tournaments/create/finalize')}>Quản lý đội</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-[#22c55e] whitespace-nowrap font-semibold">Sắp xếp & Tạo đội</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black mb-1">Sắp xếp đội hình thi đấu</h1>
            <p className="text-white/60">Kéo thả hoặc dùng nút mũi tên để sắp xếp. Bấm xáo trộn để trộn ngẫu nhiên.</p>
          </div>
          <button
            onClick={handleShuffle}
            className="px-4 py-2.5 rounded-lg bg-[#0f1419] border border-white/[0.06] text-white font-semibold hover:border-white/[0.12] transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 6L4 4M4 4L2 2M4 4H10C12.2091 4 14 5.79086 14 8C14 10.2091 12.2091 12 10 12H4M14 10L12 12M12 12L14 14M12 12H6C3.79086 12 2 10.2091 2 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Xáo trộn
          </button>
        </div>

        {/* Teams List */}
        <div className="space-y-2 mb-8">
          {orderedTeams.map((team, index) => (
            <div
              key={team.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all duration-200 cursor-move ${
                draggedIndex === index
                  ? 'opacity-50 border-[#22c55e] bg-[#1a1f2e]'
                  : 'border-white/[0.06] bg-[#0f1419] hover:border-white/[0.12]'
              }`}
            >
              {/* Drag Handle */}
              <div className="flex-shrink-0 text-white/40">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="5" cy="5" r="2" />
                  <circle cx="5" cy="10" r="2" />
                  <circle cx="5" cy="15" r="2" />
                  <circle cx="15" cy="5" r="2" />
                  <circle cx="15" cy="10" r="2" />
                  <circle cx="15" cy="15" r="2" />
                </svg>
              </div>

              {/* Team Info */}
              <div className="flex-1">
                <div className="text-sm font-semibold text-white/40">#{index + 1}</div>
                <div className="font-semibold">{team.name}</div>
                <div className="text-sm text-white/50">{team.members.length} thành viên</div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 2V14M3 7L8 2L13 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === orderedTeams.length - 1}
                  className="p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 14V2M3 9L8 14L13 9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Seeding Info Preview */}
        {data.format === 'round_robin' ? (
          <div className="p-6 rounded-lg bg-[#0f1419] border border-white/[0.06] mb-8 space-y-4">
            <div className="flex gap-3 items-center pb-3 border-b border-white/[0.06]">
              <svg className="w-5 h-5 text-[#22c55e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
              <div className="font-semibold text-sm">Xem trước phân chia bảng đấu ({data.groupsCount} bảng)</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getGroupsOfTeams(orderedTeams, data.groupsCount || 1).map((groupTeams, gIdx) => (
                <div key={gIdx} className="p-4 rounded-lg bg-[#080b10] border border-white/[0.04] space-y-2">
                  <div className="text-xs font-bold text-[#22c55e]">BẢNG {String.fromCharCode(65 + gIdx)}</div>
                  <div className="space-y-1.5">
                    {groupTeams.map((team, tIdx) => (
                      <div key={team.id} className="text-xs flex justify-between text-white/80">
                        <span>{tIdx + 1}. {team.name}</span>
                        <span className="text-white/30">{team.members.length} TV</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : data.format === 'double_elimination' ? (
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06] mb-8">
            <div className="flex gap-3 items-start">
              <svg className="w-5 h-5 text-[#22c55e] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="flex-1">
                <div className="font-semibold mb-1">THỂ THỨC NHÁNH THẮNG - NHÁNH THUA</div>
                <div className="text-sm text-white/60">
                  Vòng 1 Nhánh thắng: {orderedTeams[0]?.name} vs {orderedTeams[1]?.name}, {orderedTeams[2]?.name} vs {orderedTeams[3]?.name}...
                </div>
                <div className="text-xs text-white/50 mt-1">Đội thua trận đầu tiên sẽ rơi xuống Nhánh thua để thi đấu tiếp.</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06] mb-8">
            <div className="flex gap-3 items-start">
              <svg className="w-5 h-5 text-[#22c55e] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="flex-1">
                <div className="font-semibold mb-1">THỂ THỨC LOẠI TRỰC TIẾP</div>
                <div className="text-sm text-white/60">
                  Cặp 1: {orderedTeams[0]?.name} vs {orderedTeams[1]?.name}
                </div>
                <div className="text-xs text-white/50 mt-1">Thua 1 trận sẽ bị loại khỏi giải đấu ngay lập tức.</div>
              </div>
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex gap-4">
          <Link
            href="/tournaments/create/finalize"
            className="flex-1 px-6 py-3 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200 text-center"
          >
            Quay lại
          </Link>
          <button
            onClick={handleCreate}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Đang tạo...' : 'Bắt đầu Giải đấu'}
          </button>
        </div>
      </section>
    </main>
  );
}
