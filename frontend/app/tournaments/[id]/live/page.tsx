'use client';

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

function getCurrentBracketMatch(bracket?: BracketState) {
  if (!bracket) return null;
  const round = bracket.rounds[bracket.currentRound];
  if (!round) return null;
  return round[bracket.currentMatch] || null;
}

function resolveTeamRef(tournament: any, team?: TeamRef) {
  if (!team) return null;
  if (team.id) {
    return tournament.teams?.find((t: any) => t.id === team.id) || team;
  }
  if (team.name) {
    return tournament.teams?.find((t: any) => t.name === team.name) || team;
  }
  return team;
}

function getFallbackTeams(tournament: any) {
  return tournament.orderedTeams || tournament.teams || [];
}

export default function TournamentLiveViewPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<any>(null);
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

    // Load initial data
    loadTournament();

    // Connect to Pusher channel
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
            // Calibrate immediately on websocket update if drift is more than 2 seconds
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

  const fallbackTeams = getFallbackTeams(tournament);
  const matchIndex = tournament.bracket?.currentMatch || 0;
  const fallbackTeamA = fallbackTeams[matchIndex * 2];
  const fallbackTeamB = fallbackTeams[matchIndex * 2 + 1];
  const currentBracketMatch = getCurrentBracketMatch(tournament.bracket);
  const team1 = resolveTeamRef(tournament, currentBracketMatch?.teamA) || fallbackTeamA || tournament.teams[0];
  const team2 = resolveTeamRef(tournament, currentBracketMatch?.teamB) || fallbackTeamB || tournament.teams[1];

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

      {/* Header */}
      <div className="relative z-20 border-b border-white/[0.06] backdrop-blur-md bg-[#080b10]/60 sticky top-0">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-[#22c55e] mb-1">
                {matchState.isFinished ? 'TRẬN ĐẤU' : 'TRỰC TIẾP'}
              </p>
              <h1 className="text-2xl font-black">{tournament.name}</h1>
            </div>
            {matchState.isFinished ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/50">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-red-400">KẾT THÚC</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/50">
                <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="text-sm font-semibold text-[#22c55e]">LIVE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Match Display */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <div className="text-lg font-bold mb-4 text-white/80">
              {matchState.isFinished ? 'Chung cuộc' : `Hiệp ${matchState.hiep}`}
            </div>
            <div className="text-7xl font-black mb-8 font-mono tracking-wider">
              {formatTime(matchState.time)}
            </div>
          </div>

          {/* Scoreboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Team 1 */}
            <div className="text-center">
              <div className="mb-6">
                <h2 className="text-3xl font-black">{team1?.name || 'Team 1'}</h2>
              </div>
              <div className="p-8 rounded-lg bg-[#0f1419] border-2 border-white/[0.06]">
                <div className="text-6xl font-black">{matchState.team1Score}</div>
              </div>
              {team1?.members && team1.members.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-white/60 mb-3">Thành viên</p>
                  <div className="grid grid-cols-2 gap-2">
                    {team1.members.slice(0, 4).map((member: any) => (
                      <div
                        key={member.id}
                        className="p-2 rounded-lg bg-[#0f1419] border border-white/[0.06]"
                      >
                        {member.image && (
                          <img
                            src={member.image}
                            alt={member.name}
                            className="w-full h-24 rounded-lg object-cover mb-2"
                          />
                        )}
                        <p className="text-xs font-medium truncate">{member.name}</p>
                        <p className="text-xs text-white/50">{member.position}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* VS */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-4xl font-black text-white/30 mb-4">VS</div>
              <div className="space-y-3 w-full">
                <div className="p-3 rounded-lg bg-[#0f1419] border border-white/[0.06] text-center">
                  <p className="text-sm text-white/60">Thể loại</p>
                  <p className="font-semibold">{tournament.sport}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#0f1419] border border-white/[0.06] text-center">
                  <p className="text-sm text-white/60">Hiệp</p>
                  <p className="font-semibold">{tournament.matchDuration} phút</p>
                </div>
                <div className="p-3 rounded-lg bg-[#0f1419] border border-white/[0.06] text-center">
                  <p className="text-sm text-white/60">Hiệp phụ</p>
                  <p className="font-semibold">{tournament.allowExtraTime ? 'Có' : 'Không'}</p>
                </div>
              </div>
            </div>

            {/* Team 2 */}
            <div className="text-center">
              <div className="mb-6">
                <h2 className="text-3xl font-black">{team2?.name || 'Team 2'}</h2>
              </div>
              <div className="p-8 rounded-lg bg-[#0f1419] border-2 border-white/[0.06]">
                <div className="text-6xl font-black">{matchState.team2Score}</div>
              </div>
              {team2?.members && team2.members.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-white/60 mb-3">Thành viên</p>
                  <div className="grid grid-cols-2 gap-2">
                    {team2.members.slice(0, 4).map((member: any) => (
                      <div
                        key={member.id}
                        className="p-2 rounded-lg bg-[#0f1419] border border-white/[0.06]"
                      >
                        {member.image && (
                          <img
                            src={member.image}
                            alt={member.name}
                            className="w-full h-24 rounded-lg object-cover mb-2"
                          />
                        )}
                        <p className="text-xs font-medium truncate">{member.name}</p>
                        <p className="text-xs text-white/50">{member.position}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* All Teams Info */}
        <div className="border-t border-white/[0.06] pt-8">
          <h3 className="text-lg font-black mb-4">Đội tham gia ({tournament.teams.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tournament.teams.map((team: any, idx: number) => (
              <div key={team.id} className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
                <div className="font-semibold mb-2">#{idx + 1} {team.name}</div>
                <p className="text-sm text-white/60">{team.members.length} thành viên</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
