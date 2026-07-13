'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState, useEffect } from 'react';
import { syncTournamentToBackend } from '@/app/lib/tournaments';
import { getSession } from '@/app/lib/authStorage';

type TeamRef = { id?: string; name?: string };

function buildInitialBracket(teams: TeamRef[]) {
  const roundOne = [] as Array<{
    teamA?: TeamRef;
    teamB?: TeamRef;
    scoreA: number | null;
    scoreB: number | null;
    isFinished: boolean;
  }>;

  for (let i = 0; i < teams.length; i += 2) {
    roundOne.push({
      teamA: teams[i],
      teamB: teams[i + 1],
      scoreA: null,
      scoreB: null,
      isFinished: false,
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
    // Rotate: keep list[0] fixed, rotate the rest clockwise
    const rotated = [list[0], list[numTeams - 1], ...list.slice(1, numTeams - 1)];
    for (let idx = 0; idx < numTeams; idx++) {
      list[idx] = rotated[idx];
    }
  }
  return matches;
}

function buildDoubleEliminationBracket(teams: TeamRef[]) {
  const n = teams.length; // power of 2, e.g. 4, 8, 16, 32
  const numUpperRounds = Math.ceil(Math.log2(n));

  // 1. Upper Rounds
  const upperRounds: any[][] = [];
  // Upper Round 0 matches
  const u0Matches: any[] = [];
  for (let i = 0; i < n; i += 2) {
    u0Matches.push({
      teamA: teams[i],
      teamB: teams[i + 1],
      scoreA: null,
      scoreB: null,
      isFinished: false,
    });
  }
  upperRounds.push(u0Matches);

  // Remaining Upper Rounds (with placeholders '?' for names)
  for (let r = 1; r < numUpperRounds; r++) {
    const matchesInRound = n / Math.pow(2, r + 1);
    const roundMatches: any[] = [];
    for (let m = 0; m < matchesInRound; m++) {
      roundMatches.push({
        teamA: { id: '', name: '?' },
        teamB: { id: '', name: '?' },
        scoreA: null,
        scoreB: null,
        isFinished: false,
      });
    }
    upperRounds.push(roundMatches);
  }

  // 2. Lower Rounds
  const lowerRounds: any[][] = [];
  const totalLowerRounds = 2 * numUpperRounds - 2;
  for (let r = 0; r < totalLowerRounds; r++) {
    const k = Math.floor(r / 2);
    const matchesInRound = n / Math.pow(2, k + 2);
    const roundMatches: any[] = [];
    for (let m = 0; m < matchesInRound; m++) {
      roundMatches.push({
        teamA: { id: '', name: '?' },
        teamB: { id: '', name: '?' },
        scoreA: null,
        scoreB: null,
        isFinished: false,
      });
    }
    lowerRounds.push(roundMatches);
  }

  // 3. Grand Final (up to 2 matches for bracket reset)
  const grandFinal = [
    {
      teamA: { id: '', name: '?' },
      teamB: { id: '', name: '?' },
      scoreA: null,
      scoreB: null,
      isFinished: false,
    }
  ];

  return {
    upperRounds,
    lowerRounds,
    grandFinal,
    currentRound: 0,
    currentMatch: 0,
    isFinished: false,
    activeMatches: []
  };
}

export default function FinalizeCreatePage() {
  const router = useRouter();
  const { data, resetTournament } = useTournament();
  const [tournament, setTournament] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [shareLink, setShareLink] = useState<string>('');

  useEffect(() => {
    if (tournament) return; // Prevent regenerating ID and details if already set

    // Generate a mock tournament ID
    const tournamentId = data.id || 'tourn_' + Date.now();

    if (data.isPublicRegistration) {
      const mockTournament = {
        id: tournamentId,
        ...data,
        isPublicRegistration: true,
        registrationOpen: true,
        maxTeams: data.maxTeams || 8,
        teams: data.teams || [],
        bracketSeeded: false,
        shuffled: false,
        bracket: null,
        groups: null,
        leagueMatches: null,
        stage: 'registration',
        matches: null,
        createdAt: new Date().toISOString(),
      };
      setTournament(mockTournament);
      syncTournamentToBackend(mockTournament).catch(err => {
        console.error('Error auto-syncing public registration tournament to backend:', err);
      });
      const link = `${window.location.origin}/tournaments/${tournamentId}/live`;
      setShareLink(link);
      setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`);
      return;
    }

    let bracket = null;
    let groups: any[] | null = null;
    let leagueMatches: any[] | null = null;
    let stage = null;
    let matches: any[] | null = null;

    if (data.sport === 'battle_royale') {
      stage = 'battle_royale';
      const matchesCount = data.matchesCount || 5;
      matches = Array.from({ length: matchesCount }, (_, idx) => ({
        id: `br-${idx}`,
        name: `Trận ${idx + 1}`,
        isFinished: false,
        results: data.teams.map((t: any) => ({
          teamId: t.id || t.name,
          teamName: t.name,
          rank: null,
          placement: null,
          kills: 0,
          placementPoints: 0,
          killPoints: 0,
          totalPoints: 0,
          pts: 0,
        })),
      }));
    } else if (data.format === 'round_robin') {
      const groupsCount = data.groupsCount || 1;
      groups = Array.from({ length: groupsCount }, (_, gIdx) => ({
        name: `Bảng ${String.fromCharCode(65 + gIdx)}`,
        teams: [] as TeamRef[],
        matches: [] as any[]
      }));
      data.teams.forEach((team, idx) => {
        const gIdx = idx % groupsCount;
        groups![gIdx].teams.push(team);
      });

      groups!.forEach((group, gIdx) => {
        group.matches = buildRoundRobinMatches(group.teams, gIdx);
      });
      stage = 'group';
    } else if (data.format === 'double_elimination') {
      bracket = buildDoubleEliminationBracket(data.teams);
    } else if (data.format === 'league') {
      const matchesCount = data.leagueMatchesCount || 5;
      leagueMatches = Array.from({ length: matchesCount }, (_, mIdx) => ({
        id: `league-match-${mIdx}`,
        name: `Trận ${mIdx + 1}`,
        isFinished: false,
        results: data.teams.map((team) => ({
          teamId: team.id,
          teamName: team.name,
          placement: null,
          kills: 0,
          placementPoints: 0,
          killPoints: 0,
          totalPoints: 0,
          win: false
        }))
      }));
      stage = 'league';
    } else {
      bracket = buildInitialBracket(data.teams);
    }

    const mockTournament = {
      id: tournamentId,
      ...data,
      orderedTeams: data.teams,
      bracket,
      groups,
      leagueMatches,
      stage,
      matches,
      createdAt: new Date().toISOString(),
    };

    setTournament(mockTournament);
    syncTournamentToBackend(mockTournament).catch(err => {
      console.error('Error auto-syncing tournament to backend:', err);
    });

    // Generate mock QR code and share link
    const link = `${window.location.origin}/tournaments/${tournamentId}/live`;
    setShareLink(link);

    // In a real app, you would generate an actual QR code here
    // For now, we'll use a placeholder
    setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`);
  }, [data, tournament]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Đã copy link vào clipboard!');
  };

  const handleStartTournament = async () => {
    if (tournament) {
      try {
        // Sync to backend first so spectator page can load it instantly
        await syncTournamentToBackend(tournament);
      } catch (err: any) {
        console.error('Error syncing tournament to backend:', err);
        alert(err.message || 'Không thể đồng bộ giải đấu lên hệ thống. Vui lòng kiểm tra lại kết nối hoặc gói dịch vụ của bạn.');
        return;
      }

      const session = getSession();
      const tournamentsKey = session ? `tournaments_${session.id}` : 'tournaments';
      const currentTournamentKey = session ? `currentTournament_${session.id}` : 'currentTournament';
      const draftKey = session ? `tournamentDraft_${session.id}` : 'tournamentDraft';

      // Save tournament to localStorage list
      const savedList = localStorage.getItem(tournamentsKey);
      const list = savedList ? JSON.parse(savedList) : [];
      const index = list.findIndex((t: any) => t.id === tournament.id);
      if (index > -1) {
        list[index] = tournament;
      } else {
        list.push(tournament);
      }
      localStorage.setItem(tournamentsKey, JSON.stringify(list));

      // Also keep currentTournament for ongoing match compatibility
      localStorage.setItem(currentTournamentKey, JSON.stringify(tournament));
      
      // Remove draft as it is now finalized
      localStorage.removeItem(draftKey);
      resetTournament();
      router.push(`/tournaments/${tournament.id}`);
    }
  };

  if (!tournament) {
    return (
      <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center">
        <p>Đang tải...</p>
      </main>
    );
  }

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
          <button className="text-[#22c55e] whitespace-nowrap font-semibold">Quản lý đội</button>
          {!data.isPublicRegistration && data.sport !== 'battle_royale' && data.format !== 'league' && (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-white/40 whitespace-nowrap">Sắp xếp & Tạo đội</span>
            </>
          )}
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black mb-2">Giải đấu đã sẵn sàng! 🎉</h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Giải đấu "{tournament.name}" của bạn đã được tạo thành công. Chia sẻ mã QR hoặc link dưới đây để người khác có thể xem trực tiếp.
          </p>
        </div>

        {/* Tournament Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* QR Code */}
          <div className="p-6 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <h3 className="font-semibold mb-4 text-center">Mã QR</h3>
            <div className="flex items-center justify-center p-4 bg-white rounded-lg mb-4">
              <img src={qrCode} alt="QR Code" className="w-full max-w-xs" />
            </div>
            <p className="text-sm text-white/60 text-center">Quét mã để xem trực tiếp</p>
          </div>

          {/* Share Link */}
          <div className="p-6 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <h3 className="font-semibold mb-4">Đường link trực tiếp</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-3 py-2 rounded-lg bg-[#080b10] border border-white/[0.06] text-white text-sm text-white/70 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
              >
                Copy
              </button>
            </div>
            <p className="text-sm text-white/60">Dán vào trình duyệt để xem trực tiếp</p>
          </div>
        </div>

        {/* Tournament Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Giải đấu</p>
            <p className="font-semibold">{tournament.name}</p>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Môn thể thao</p>
            <p className="font-semibold">
              {tournament.sport === 'battle_royale' ? 'Game Sinh tồn (PUBG, Free Fire...)' : 
               tournament.sport === 'moba' ? 'Game MOBA' :
               tournament.sport === 'fps' ? 'Game FPS' : 
               tournament.sport === 'fighting_sports' ? 'Game Đối kháng / FIFA' : 
               tournament.sport}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Số đội</p>
            <p className="font-semibold">{tournament.teams.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Gói dịch vụ</p>
            <p className="font-semibold">{tournament.packageName}</p>
          </div>
        </div>

        {/* Team List */}
        <div className="mb-8">
          <h3 className="font-semibold mb-4">Danh sách đội ({tournament.teams.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
            {tournament.teams.map((team: any, idx: number) => {
              const initials = team.name.slice(0, 2).toUpperCase();
              const isEven = idx % 2 === 0;
              const avatarBg = isEven
                ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/30 text-[#22c55e]'
                : 'bg-gradient-to-br from-blue-500/20 to-indigo-500/30 text-blue-400';

              return (
                <div key={team.id} className="p-5 rounded-2xl bg-[#0f1419] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm tracking-tight ${avatarBg} border border-white/[0.06] flex-shrink-0`}>
                    {initials}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <h4 className="font-extrabold text-white text-base truncate">{team.name}</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {team.members && team.members.length > 0 ? (
                        team.members.map((m: any) => (
                          <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/60 text-[10px] font-semibold">
                            {m.image ? (
                              <img src={m.image} className="w-4 h-4 rounded-full object-cover flex-shrink-0 border border-white/[0.08]" alt={m.name} />
                            ) : (
                              <span>👤</span>
                            )}
                            <span>{m.name}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-white/30 italic">Chưa đăng ký thành viên</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4">
          <Link
            href="/tournaments/create/members"
            className="flex-1 px-6 py-3 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200 text-center"
          >
            Quay lại
          </Link>
          {(!data.isPublicRegistration && data.sport !== 'battle_royale' && data.format !== 'league') ? (
            <button
              onClick={() => router.push('/tournaments/create/bracket')}
              className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
            >
              Tiếp tục
            </button>
          ) : (
            <button
              onClick={handleStartTournament}
              className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
            >
              Bắt đầu Giải đấu
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
