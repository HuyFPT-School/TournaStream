'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { fetchTournamentFromBackend } from '@/app/lib/tournaments';
import { getPusherClient } from '@/app/lib/pusher';

interface MatchState {
  team1Score: number;
  team2Score: number;
  time: number;
  hiep: number;
  isRunning?: boolean;
  isFinished?: boolean;
  team1SetPoints?: number;
  team2SetPoints?: number;
}

type TeamRef = { id?: string; name?: string };

type BracketState = {
  rounds: Array<
    Array<{
      teamA?: TeamRef;
      teamB?: TeamRef;
    }>
  >;
  currentRound: number;
  currentMatch: number;
};

interface BracketMatchCardProps {
  a: string;
  b: string;
  sa: number | null;
  sb: number | null;
  done: boolean;
  isLive: boolean;
  roundIdx: number;
  matchIdx: number;
  onSelect: (round: number, match: number) => void;
}

function BracketMatchCard({ a, b, sa, sb, done, isLive, roundIdx, matchIdx, onSelect }: BracketMatchCardProps) {
  const winA = sa !== null && sb !== null && sa > sb;
  const winB = sa !== null && sb !== null && sb > sa;
  
  return (
    <div className={`w-[160px] rounded-xl border overflow-hidden text-[12px] shadow-lg transition-all duration-300 ${
      isLive 
        ? 'border-[#22c55e] bg-[#22c55e]/[0.05] shadow-[0_0_15px_rgba(34,197,94,0.15)] scale-[1.03]' 
        : 'border-white/[0.08] bg-[#0f1419] hover:border-white/[0.15]'
    }`}>
      {/* Team A */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.04] transition-colors ${
        winA ? 'bg-[#22c55e]/10' : ''
      }`}>
        <span className={`font-semibold truncate max-w-[100px] ${
          winA ? 'text-[#22c55e]' : 'text-white/80'
        }`}>
          {a}
        </span>
        {sa !== null && (
          <span className={`font-bold ml-2 ${
            winA ? 'text-[#22c55e]' : 'text-white/40'
          }`}>
            {sa}
          </span>
        )}
      </div>

      {/* Team B */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 transition-colors ${
        winB ? 'bg-[#22c55e]/10' : ''
      }`}>
        <span className={`font-semibold truncate max-w-[100px] ${
          winB ? 'text-[#22c55e]' : 'text-white/80'
        }`}>
          {b}
        </span>
        {sb !== null && (
          <span className={`font-bold ml-2 ${
            winB ? 'text-[#22c55e]' : 'text-white/40'
          }`}>
            {sb}
          </span>
        )}
      </div>

      {/* Watch Live Button */}
      <button 
        onClick={() => onSelect(roundIdx, matchIdx)}
        className={`w-full py-1.5 border-t text-[10px] font-black tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1 ${
          isLive 
            ? 'bg-[#22c55e] text-[#080b10] border-[#22c55e]/50 hover:bg-[#16a34a]' 
            : 'bg-white/[0.02] text-white/50 border-white/[0.04] hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        {isLive ? 'Xem trực tiếp' : 'Xem chi tiết'}
      </button>
    </div>
  );
}

function buildBracketData(tournament: any, onSelect: (round: number, match: number) => void) {
  if (!tournament) return [];

  const teams = tournament.orderedTeams || tournament.teams || [];
  const numTeams = teams.length;
  if (numTeams < 2) return [];

  const numRounds = Math.ceil(Math.log2(numTeams));
  const roundsData: any[][] = [];

  const getMatchWinner = (roundIdx: number, matchIdx: number): any => {
    if (roundIdx < 0) return null;
    const roundMatches = tournament.bracket?.rounds?.[roundIdx] || [];
    const match = roundMatches[matchIdx];
    
    const isCurrentMatch = tournament.bracket?.currentRound === roundIdx && tournament.bracket?.currentMatch === matchIdx;
    const isLive = isCurrentMatch && tournament.matchState && !tournament.matchState.isFinished;
    if (isLive) return null;

    if (match) {
      if (match.isFinished && match.winner) return match.winner;
      if (match.isFinished && match.scoreA !== null && match.scoreB !== null) {
        return match.scoreA > match.scoreB ? match.teamA : match.teamB;
      }
      return null;
    }
    return null;
  };

  const getTeamForMatch = (roundIdx: number, matchIdx: number, slot: 'A' | 'B'): any => {
    if (roundIdx === 0) {
      const idx = matchIdx * 2 + (slot === 'A' ? 0 : 1);
      return teams[idx] || null;
    }

    const prevMatchIdx = matchIdx * 2 + (slot === 'A' ? 0 : 1);
    const roundMatches = tournament.bracket?.rounds?.[roundIdx] || [];
    const match = roundMatches[matchIdx];
    
    if (match) {
      const teamRef = slot === 'A' ? match.teamA : match.teamB;
      if (teamRef) {
        return tournament.teams?.find((t: any) => t.id === teamRef.id || t.name === teamRef.name) || teamRef;
      }
    }

    return getMatchWinner(roundIdx - 1, prevMatchIdx);
  };

  for (let r = 0; r < numRounds; r++) {
    const numMatchesInRound = Math.pow(2, numRounds - r - 1);
    const roundMatches: any[] = [];

    for (let m = 0; m < numMatchesInRound; m++) {
      const dbRound = tournament.bracket?.rounds?.[r] || [];
      const dbMatch = dbRound[m];

      const teamAObj = getTeamForMatch(r, m, 'A');
      const teamBObj = getTeamForMatch(r, m, 'B');

      const isLive = dbMatch?.matchState?.isRunning && !dbMatch?.isFinished && !dbMatch?.matchState?.isFinished;
      const isFinished = dbMatch ? !!dbMatch.isFinished : false;

      let scoreA: number | null = null;
      let scoreB: number | null = null;

      if (dbMatch?.matchState) {
        scoreA = dbMatch.matchState.team1Score ?? 0;
        scoreB = dbMatch.matchState.team2Score ?? 0;
      } else if (dbMatch) {
        scoreA = dbMatch.scoreA !== undefined ? dbMatch.scoreA : null;
        scoreB = dbMatch.scoreB !== undefined ? dbMatch.scoreB : null;
      }

      roundMatches.push({
        a: teamAObj?.name || '?',
        b: teamBObj?.name || '?',
        sa: scoreA,
        sb: scoreB,
        done: isFinished || (!isLive && dbMatch?.isFinished),
        isLive: isLive,
        roundIdx: r,
        matchIdx: m,
        onSelect,
      });
    }
    roundsData.push(roundMatches);
  }
  return roundsData;
}

const getRoundLabel = (r: number, totalRounds: number) => {
  if (r === totalRounds - 1) return "Chung kết";
  if (r === totalRounds - 2) return "Bán kết";
  if (r === totalRounds - 3) return "Tứ kết";
  return `Vòng ${r + 1}`;
};

function getFallbackTeams(tournament: any) {
  return tournament.orderedTeams || tournament.teams || [];
}

export default function TournamentLiveViewPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<any>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<{ round: number; match: number } | null>(null);
  const [matchState, setMatchState] = useState<MatchState>({
    team1Score: 0,
    team2Score: 0,
    time: 0,
    hiep: 1,
    isRunning: false,
    isFinished: false,
  });

  useEffect(() => {
    const loadTournament = async () => {
      try {
        const data = await fetchTournamentFromBackend(tournamentId);
        setTournament(data);
        const link = `${window.location.origin}/tournaments/${tournamentId}/live`;
        setShareLink(link);
        setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`);

        if (data.matchState) {
          setMatchState(prev => {
            const fetchedIsRunning = !!data.matchState.isRunning;
            const fetchedIsFinished = !!data.matchState.isFinished;
            const fetchedTime = data.matchState.time || 0;

            if (!fetchedIsRunning || fetchedIsFinished) {
              return {
                ...data.matchState,
                isRunning: fetchedIsRunning,
                isFinished: fetchedIsFinished,
              };
            }

            const diff = prev.time - fetchedTime;
            if (diff < 0 || diff > 18) {
              return {
                ...data.matchState,
                isRunning: fetchedIsRunning,
                isFinished: fetchedIsFinished,
              };
            }

            return {
              ...data.matchState,
              time: prev.time,
              isRunning: fetchedIsRunning,
              isFinished: fetchedIsFinished,
            };
          });
        }
      } catch (err) {
        console.error('Error fetching tournament from backend:', err);
      }
    };

    loadTournament();

    const pusher = getPusherClient();
    let channel: any = null;

    if (pusher) {
      channel = pusher.subscribe(tournamentId);

      channel.bind("tournament_updated", (data: any) => {
        console.log("Pusher received tournament update:", data);
        setTournament(data);
        if (data.matchState) {
          setMatchState(prev => {
            const fetchedIsRunning = !!data.matchState.isRunning;
            const fetchedIsFinished = !!data.matchState.isFinished;
            const fetchedTime = data.matchState.time || 0;

            if (!fetchedIsRunning || fetchedIsFinished) {
              return {
                ...data.matchState,
                isRunning: fetchedIsRunning,
                isFinished: fetchedIsFinished,
              };
            }

            const diff = prev.time - fetchedTime;
            if (diff < 0 || diff > 2) {
              return {
                ...data.matchState,
                isRunning: fetchedIsRunning,
                isFinished: fetchedIsFinished,
              };
            }

            return {
              ...data.matchState,
              time: prev.time,
              isRunning: fetchedIsRunning,
              isFinished: fetchedIsFinished,
            };
          });
        }
      });
    }

    return () => {
      if (pusher && channel) {
        channel.unbind("tournament_updated");
        pusher.unsubscribe(tournamentId);
      }
    };
  }, [tournamentId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const hasRunningMatches = tournament?.bracket?.rounds?.some((round: any) =>
      round.some((m: any) => m.matchState?.isRunning && !m.matchState.isFinished && !m.isFinished)
    );

    if (hasRunningMatches) {
      interval = setInterval(() => {
        setTournament((prev: any) => {
          if (!prev || !prev.bracket || !prev.bracket.rounds) return prev;
          
          const updatedBracket = { ...prev.bracket };
          updatedBracket.rounds = updatedBracket.rounds.map((round: any[]) =>
            round.map((m: any) => {
              if (m.matchState?.isRunning && !m.matchState.isFinished && !m.isFinished) {
                const nextTime = (m.matchState.time || 0) + 1;
                return {
                  ...m,
                  matchState: {
                    ...m.matchState,
                    time: nextTime,
                  },
                };
              }
              return m;
            })
          );

          // Update local matchState if it matches the currently selected match
          if (selectedMatch) {
            const { round: r, match: m } = selectedMatch;
            const activeMatch = updatedBracket.rounds[r]?.[m];
            if (activeMatch && activeMatch.matchState) {
              setMatchState(activeMatch.matchState);
            }
          }

          return {
            ...prev,
            bracket: updatedBracket,
          };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [tournament?.bracket?.rounds, selectedMatch]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Đã copy link vào clipboard!');
  };

  const handleSelectMatch = (round: number, match: number) => {
    setSelectedMatch({ round, match });
  };

  const getSelectedMatchDetails = () => {
    if (!selectedMatch || !tournament) return null;
    const r = selectedMatch.round;
    const m = selectedMatch.match;
    
    const dbRound = tournament.bracket?.rounds?.[r] || [];
    const dbMatch = dbRound[m];
    
    const isLive = dbMatch?.matchState?.isRunning && !dbMatch?.isFinished && !dbMatch?.matchState?.isFinished;
    const isFinished = dbMatch ? !!dbMatch.isFinished : false;
    
    const fallbackTeams = getFallbackTeams(tournament);
    
    const getTeamForMatch = (roundIdx: number, matchIdx: number, slot: 'A' | 'B'): any => {
      if (roundIdx === 0) {
        const idx = matchIdx * 2 + (slot === 'A' ? 0 : 1);
        return fallbackTeams[idx] || null;
      }
      
      const prevMatchIdx = matchIdx * 2 + (slot === 'A' ? 0 : 1);
      const roundMatches = tournament.bracket?.rounds?.[roundIdx] || [];
      const matchObj = roundMatches[matchIdx];
      
      if (matchObj) {
        const teamRef = slot === 'A' ? matchObj.teamA : matchObj.teamB;
        if (teamRef) {
          return tournament.teams?.find((t: any) => t.id === teamRef.id || t.name === teamRef.name) || teamRef;
        }
      }
      
      const getMatchWinner = (roundIdx2: number, matchIdx2: number): any => {
        if (roundIdx2 < 0) return null;
        const roundMatches2 = tournament.bracket?.rounds?.[roundIdx2] || [];
        const match2 = roundMatches2[matchIdx2];
        if (match2) {
          if (match2.isFinished && match2.winner) return match2.winner;
          if (match2.isFinished && match2.scoreA !== null && match2.scoreB !== null) {
            return match2.scoreA > match2.scoreB ? match2.teamA : match2.teamB;
          }
        }
        return null;
      };
      
      return getMatchWinner(roundIdx - 1, prevMatchIdx);
    };
    
    const teamA = getTeamForMatch(r, m, 'A');
    const teamB = getTeamForMatch(r, m, 'B');
    
    let scoreA = null;
    let scoreB = null;
    let time = 0;
    let hiep = 1;
    let team1SetPoints = null;
    let team2SetPoints = null;
    
    if (dbMatch && dbMatch.matchState) {
      scoreA = dbMatch.matchState.team1Score;
      scoreB = dbMatch.matchState.team2Score;
      time = dbMatch.matchState.time;
      hiep = dbMatch.matchState.hiep;
      team1SetPoints = dbMatch.matchState.team1SetPoints !== undefined ? dbMatch.matchState.team1SetPoints : null;
      team2SetPoints = dbMatch.matchState.team2SetPoints !== undefined ? dbMatch.matchState.team2SetPoints : null;
    } else if (dbMatch) {
      scoreA = dbMatch.scoreA;
      scoreB = dbMatch.scoreB;
      time = dbMatch.time || 0;
      hiep = dbMatch.hiep || 1;
      team1SetPoints = dbMatch.team1SetPoints !== undefined ? dbMatch.team1SetPoints : null;
      team2SetPoints = dbMatch.team2SetPoints !== undefined ? dbMatch.team2SetPoints : null;
    }
    
    return {
      team1: teamA,
      team2: teamB,
      scoreA,
      scoreB,
      time,
      hiep,
      team1SetPoints,
      team2SetPoints,
      isLive,
      isFinished,
      dbMatch,
    };
  };

  if (!tournament) {
    return (
      <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📺</div>
          <p className="text-xl font-semibold">Giải đấu chưa bắt đầu</p>
          <p className="text-white/60 mt-2">Vui lòng quay lại sau</p>
        </div>
      </main>
    );
  }

  const selectedDetails = getSelectedMatchDetails();

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

      {/* Header Navbar */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-4 border-b border-white/[0.06] backdrop-blur-md bg-[#080b10]/60 sticky top-0">
        <Link 
          href="/" 
          className="flex items-center gap-2 hover:opacity-80 transition-opacity text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span className="text-[16px] font-black tracking-tight ml-2">{tournament.name}</span>
        </Link>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQrModal(true)}
            className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white text-xs font-bold transition-all duration-200 flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            QR
          </button>

          <button
            onClick={handleCopyLink}
            className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white text-xs font-bold transition-all duration-200 flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            Copy link
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        
        {/* Bracket Tree View */}
        <div className="w-full">
          {buildBracketData(tournament, handleSelectMatch).length === 0 ? (
            <div className="text-center py-20 bg-[#0f1419] rounded-2xl border border-white/[0.06]">
              <p className="text-white/60 text-lg">Không có dữ liệu sơ đồ cho giải đấu này</p>
            </div>
          ) : (
            <div className="flex items-stretch justify-center gap-8 overflow-x-auto pb-8 pt-4 min-h-[500px]">
              {buildBracketData(tournament, handleSelectMatch).map((roundMatches, roundIdx, arr) => (
                <div key={roundIdx} className="flex flex-col shrink-0 items-center w-[160px]">
                  <h3 className="text-xs font-black tracking-widest text-[#22c55e]/70 uppercase text-center mb-8">
                    {getRoundLabel(roundIdx, arr.length)}
                  </h3>
                  <div className="flex flex-col justify-around flex-1 h-full gap-4">
                    {roundMatches.map((m: any, matchIdx: number) => (
                      <div key={matchIdx} className="relative flex items-center justify-center py-2">
                        <BracketMatchCard {...m} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* QR Code Modal Overlay */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-[#080b10]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1419] border border-white/[0.08] p-8 rounded-2xl w-full max-w-sm text-center shadow-2xl relative">
            
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <h3 className="font-semibold text-white text-lg mb-6">Mã QR giải đấu</h3>
            
            <div className="flex items-center justify-center p-4 bg-white rounded-xl mb-6 max-w-[240px] mx-auto">
              <img src={qrCode} alt="Spectator Live View QR" className="w-full" />
            </div>
            
            <p className="text-xs text-white/50 mb-6 leading-relaxed">
              Quét mã QR bằng điện thoại hoặc máy chiếu để xem trực tiếp nhánh đấu realtime của giải đấu này.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-3 py-2 rounded-lg bg-[#080b10] border border-white/[0.06] text-white text-xs focus:outline-none select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] text-xs font-black hover:bg-[#16a34a] transition-all duration-200"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Details Modal Overlay */}
      {selectedMatch && selectedDetails && (
        <div className="fixed inset-0 z-50 bg-[#080b10]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1419] border border-white/[0.08] p-6 rounded-2xl w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedMatch(null)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Modal Title */}
            <div className="text-center mb-6 border-b border-white/[0.06] pb-4">
              <p className="text-xs font-black tracking-widest text-[#22c55e] uppercase mb-1">
                {getRoundLabel(selectedMatch.round, Math.ceil(Math.log2(getFallbackTeams(tournament).length)))} • Trận {selectedMatch.match + 1}
              </p>
              <div className="flex justify-center items-center gap-2 mt-2">
                {selectedDetails.isLive ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#22c55e]/10 border border-[#22c55e]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                    <span className="text-[#22c55e] text-[10px] font-bold">ĐANG DIỄN RA (LIVE)</span>
                  </div>
                ) : selectedDetails.isFinished ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-red-400 text-[10px] font-bold">ĐÃ KẾT THÚC</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.05] border border-white/[0.08]">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    <span className="text-white/50 text-[10px] font-bold">CHƯA BẮT ĐẦU</span>
                  </div>
                )}
              </div>
            </div>

            {/* Scoreboard Layout */}
            <div className="text-center mb-8">
              {/* Timer/Period */}
              <div className="text-sm font-semibold text-white/60 mb-2">
                {selectedDetails.isLive 
                  ? `Hiệp ${selectedDetails.hiep}` 
                  : selectedDetails.isFinished 
                  ? 'Chung cuộc' 
                  : 'Chờ bắt đầu'
                }
              </div>
              <div className="text-4xl font-black mb-6 font-mono tracking-wider text-white">
                {selectedDetails.isLive ? formatTime(selectedDetails.time) : '--:--'}
              </div>

              {/* Big Score Board */}
              <div className="grid grid-cols-3 items-center gap-4 max-w-lg mx-auto bg-[#080b10] border border-white/[0.05] p-6 rounded-xl">
                <div>
                  <h4 className="text-lg font-bold text-white truncate">{selectedDetails.team1?.name || 'Chờ xác định'}</h4>
                </div>
                
                {tournament?.sport === 'tennis' || tournament?.sport === 'volleyball' ? (
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="flex justify-center items-center gap-3 text-3xl font-black text-[#22c55e]">
                      <span>{selectedDetails.scoreA !== null ? selectedDetails.scoreA : '0'}</span>
                      <span className="text-white/20">:</span>
                      <span>{selectedDetails.scoreB !== null ? selectedDetails.scoreB : '0'}</span>
                    </div>
                    <div className="text-[9px] font-black text-white/30 uppercase tracking-wider">Tỉ số Set</div>
                    
                    {/* Points detail if live or available */}
                    {(selectedDetails.team1SetPoints !== null || selectedDetails.team2SetPoints !== null) && (
                      <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-xs font-bold font-mono mt-1 text-white/70">
                        <span>{selectedDetails.team1SetPoints ?? 0}</span>
                        <span className="text-white/20">:</span>
                        <span>{selectedDetails.team2SetPoints ?? 0}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center items-center gap-3 text-3xl font-black">
                    <span className={selectedDetails.scoreA !== null ? 'text-white' : 'text-white/20'}>
                      {selectedDetails.scoreA !== null ? selectedDetails.scoreA : '-'}
                    </span>
                    <span className="text-white/20">:</span>
                    <span className={selectedDetails.scoreB !== null ? 'text-white' : 'text-white/20'}>
                      {selectedDetails.scoreB !== null ? selectedDetails.scoreB : '-'}
                    </span>
                  </div>
                )}

                <div>
                  <h4 className="text-lg font-bold text-white truncate">{selectedDetails.team2?.name || 'Chờ xác định'}</h4>
                </div>
              </div>
            </div>

            {/* Team Lineups */}
            <div className="grid grid-cols-2 gap-8 border-t border-white/[0.06] pt-6">
              {/* Team 1 Members */}
              <div>
                <h5 className="text-xs font-black tracking-wider text-white/50 uppercase mb-4 text-center">
                  Đội hình {selectedDetails.team1?.name || ''}
                </h5>
                {selectedDetails.team1?.members && selectedDetails.team1.members.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDetails.team1.members.map((member: any) => (
                      <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#080b10] border border-white/[0.04]">
                        {member.image && (
                          <img src={member.image} alt={member.name} className="w-8 h-8 rounded object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate text-white">{member.name}</p>
                          <p className="text-[10px] text-white/40">{member.position}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/40 text-center py-4">Chưa có thông tin thành viên</p>
                )}
              </div>

              {/* Team 2 Members */}
              <div>
                <h5 className="text-xs font-black tracking-wider text-white/50 uppercase mb-4 text-center">
                  Đội hình {selectedDetails.team2?.name || ''}
                </h5>
                {selectedDetails.team2?.members && selectedDetails.team2.members.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDetails.team2.members.map((member: any) => (
                      <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#080b10] border border-white/[0.04]">
                        {member.image && (
                          <img src={member.image} alt={member.name} className="w-8 h-8 rounded object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate text-white">{member.name}</p>
                          <p className="text-[10px] text-white/40">{member.position}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/40 text-center py-4">Chưa có thông tin thành viên</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}
