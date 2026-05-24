'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { syncTournamentToBackend, fetchTournamentFromBackend } from '@/app/lib/tournaments';

interface MatchState {
  team1Score: number;
  team2Score: number;
  time: number;
  isRunning: boolean;
  hiep: number;
  isFinished?: boolean;
}

export default function LiveMatchPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<any>(null);
  const [matchState, setMatchState] = useState<MatchState>({
    team1Score: 0,
    team2Score: 0,
    time: 0,
    isRunning: false,
    hiep: 1,
    isFinished: false,
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTournament = async () => {
      // 1. Try local storage first
      const saved = localStorage.getItem('currentTournament');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.id === tournamentId) {
            setTournament(parsed);
            if (parsed.matchState) {
              setMatchState({
                ...parsed.matchState,
                isRunning: false, // Pause on load for safety
                isFinished: !!parsed.matchState.isFinished
              });
            }
            setIsLoaded(true);
            return;
          }
        } catch (e) {
          console.error('Error parsing currentTournament:', e);
        }
      }

      // 2. Fetch from backend if not found or ID mismatch
      try {
        const data = await fetchTournamentFromBackend(tournamentId);
        setTournament(data);
        if (data.matchState) {
          setMatchState({
            ...data.matchState,
            isRunning: false, // Pause on load for safety
            isFinished: !!data.matchState.isFinished
          });
        }
      } catch (err) {
        console.error('Error fetching tournament from backend:', err);
      }
      setIsLoaded(true);
    };

    loadTournament();
  }, [tournamentId]);

  // Save matchState to currentTournament and tournaments list when it changes
  useEffect(() => {
    if (isLoaded && tournament) {
      const updatedTournament = {
        ...tournament,
        matchState: matchState
      };
      
      localStorage.setItem('currentTournament', JSON.stringify(updatedTournament));
      
      const savedList = localStorage.getItem('tournaments');
      if (savedList) {
        try {
          const list = JSON.parse(savedList);
          const index = list.findIndex((t: any) => t.id === tournament.id);
          if (index > -1) {
            list[index] = updatedTournament;
            localStorage.setItem('tournaments', JSON.stringify(list));
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [matchState, tournament, isLoaded]);

  // Sync tournament state to backend on key changes and every 15 seconds of match time
  useEffect(() => {
    if (!isLoaded || !tournament) return;

    const updatedTournament = {
      ...tournament,
      matchState: matchState
    };

    syncTournamentToBackend(updatedTournament).catch(err => {
      console.error('Error syncing tournament to backend:', err);
    });
  }, [
    matchState.team1Score,
    matchState.team2Score,
    matchState.isRunning,
    matchState.hiep,
    matchState.isFinished,
    Math.floor(matchState.time / 15),
    tournament,
    isLoaded
  ]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (matchState.isRunning && !matchState.isFinished) {
      interval = setInterval(() => {
        setMatchState(prev => ({
          ...prev,
          time: prev.time + 1,
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [matchState.isRunning, matchState.isFinished]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartStop = () => {
    setMatchState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const handleScoreChange = (team: 'team1' | 'team2', delta: number) => {
    setMatchState(prev => ({
      ...prev,
      [team === 'team1' ? 'team1Score' : 'team2Score']: Math.max(
        0,
        prev[team === 'team1' ? 'team1Score' : 'team2Score'] + delta
      ),
    }));
  };

  const handleFinishMatch = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc trận đấu này không? Kết quả sẽ được lưu lại vĩnh viễn.')) {
      return;
    }

    const finalMatchState = {
      ...matchState,
      isRunning: false,
      isFinished: true,
    };

    setMatchState(finalMatchState);

    if (tournament) {
      const updatedTournament = {
        ...tournament,
        matchState: finalMatchState
      };
      
      localStorage.setItem('currentTournament', JSON.stringify(updatedTournament));
      
      const savedList = localStorage.getItem('tournaments');
      if (savedList) {
        try {
          const list = JSON.parse(savedList);
          const index = list.findIndex((t: any) => t.id === tournament.id);
          if (index > -1) {
            list[index] = updatedTournament;
            localStorage.setItem('tournaments', JSON.stringify(list));
          }
        } catch (e) {
          console.error(e);
        }
      }

      try {
        await syncTournamentToBackend(updatedTournament);
      } catch (err) {
        console.error('Error syncing final state to backend:', err);
      }

      alert('Trận đấu đã kết thúc thành công!');
      router.push(`/tournaments/${tournamentId}`);
    }
  };

  if (!tournament) {
    return (
      <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center">
        <p>Đang tải...</p>
      </main>
    );
  }

  const team1 = tournament.teams[0];
  const team2 = tournament.teams[1];

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
          <div className="text-sm text-white/50">
            {tournament.name} • {tournament.sport}
          </div>
          <Link
            href={`/tournaments/${tournamentId}`}
            className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5"
          >
            Quay lại
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        {/* Match Header */}
        <div className="text-center mb-12">
          <div className="text-sm font-semibold text-[#22c55e] mb-2">VÒNG 1 • TRẬN 1</div>
          <div className="text-lg font-bold mb-4">Hiệp {matchState.hiep}</div>
        </div>

        {/* Score Board */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {/* Team 1 */}
          <div className="text-center">
            <div className="mb-4">
              <h2 className="text-2xl font-black mb-2">{team1?.name || 'Team 1'}</h2>
              {team1?.members && team1.members.length > 0 && (
                <p className="text-sm text-white/60">{team1.members.length} thành viên</p>
              )}
            </div>
            <button
              onClick={() => handleScoreChange('team1', 1)}
              className="w-full px-4 py-3 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 transition-all duration-200 border border-[#22c55e]/50 mb-3"
            >
              + Ghi bàn
            </button>
          </div>

          {/* Score & Time */}
          <div className="flex flex-col items-center justify-center">
            {/* Time */}
            <div className="text-5xl font-black mb-6 font-mono tracking-wide">
              {formatTime(matchState.time)}
            </div>

            {/* Score */}
            <div className="flex items-center gap-4 mb-6">
              <div className="text-5xl font-black">{matchState.team1Score}</div>
              <div className="text-3xl font-black text-white/50">−</div>
              <div className="text-5xl font-black">{matchState.team2Score}</div>
            </div>

            {/* Start/Stop Button */}
            {matchState.isFinished ? (
              <div className="px-6 py-3 rounded-lg font-semibold bg-gray-500/20 border border-gray-500/30 text-gray-400 mb-4 cursor-not-allowed">
                🏁 Trận đấu đã kết thúc
              </div>
            ) : (
              <button
                onClick={handleStartStop}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 mb-4 ${
                  matchState.isRunning
                    ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50'
                    : 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50'
                }`}
              >
                {matchState.isRunning ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
              </button>
            )}

            {/* Status */}
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
              matchState.isFinished
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : matchState.isRunning
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-white/[0.05] text-white/60 border border-white/[0.06]'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                matchState.isFinished ? 'bg-red-400' : matchState.isRunning ? 'bg-green-400' : 'bg-white/40'
              }`} />
              {matchState.isFinished ? 'Đã kết thúc' : matchState.isRunning ? 'Đang thi đấu' : 'Tạm dừng'}
            </div>
          </div>

          {/* Team 2 */}
          <div className="text-center">
            <div className="mb-4">
              <h2 className="text-2xl font-black mb-2">{team2?.name || 'Team 2'}</h2>
              {team2?.members && team2.members.length > 0 && (
                <p className="text-sm text-white/60">{team2.members.length} thành viên</p>
              )}
            </div>
            <button
              onClick={() => handleScoreChange('team2', 1)}
              className="w-full px-4 py-3 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 transition-all duration-200 border border-[#22c55e]/50 mb-3"
            >
              + Ghi bàn
            </button>
          </div>
        </div>

        {/* Score Adjustment Controls */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {/* Team 1 Adjustments */}
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm font-semibold mb-3 text-center">Điều chỉnh {team1?.name}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleScoreChange('team1', -1)}
                className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-all duration-200 border border-red-500/50 font-semibold text-sm"
              >
                − Trừ
              </button>
              <button
                onClick={() => handleScoreChange('team1', 1)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 transition-all duration-200 border border-[#22c55e]/50 font-semibold text-sm"
              >
                + Cộng
              </button>
            </div>
          </div>

          {/* Middle Section */}
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm font-semibold mb-3 text-center">Hiệp</p>
            <div className="flex gap-2">
              <button
                onClick={() => setMatchState(prev => ({ ...prev, hiep: Math.max(1, prev.hiep - 1) }))}
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-all duration-200 border border-white/[0.06] font-semibold text-sm"
              >
                Trước
              </button>
              <button
                onClick={() => setMatchState(prev => ({ ...prev, hiep: prev.hiep + 1 }))}
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-all duration-200 border border-white/[0.06] font-semibold text-sm"
              >
                Sau
              </button>
            </div>
          </div>

          {/* Team 2 Adjustments */}
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm font-semibold mb-3 text-center">Điều chỉnh {team2?.name}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleScoreChange('team2', -1)}
                className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-all duration-200 border border-red-500/50 font-semibold text-sm"
              >
                − Trừ
              </button>
              <button
                onClick={() => handleScoreChange('team2', 1)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 transition-all duration-200 border border-[#22c55e]/50 font-semibold text-sm"
              >
                + Cộng
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Link
            href={`/tournaments/${tournamentId}`}
            className="flex-1 px-6 py-3 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200 text-center"
          >
            Quay lại Giải đấu
          </Link>
          {!matchState.isFinished && (
            <button
              onClick={handleFinishMatch}
              className="flex-1 px-6 py-3 rounded-lg bg-red-500/20 text-red-400 border border-red-500/50 font-semibold hover:bg-red-500/30 transition-all duration-200"
            >
              Kết thúc trận đấu
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
