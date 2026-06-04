'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { syncTournamentToBackend, fetchTournamentFromBackend } from '@/app/lib/tournaments';
import { getSession } from '@/app/lib/authStorage';

interface MatchState {
  team1Score: number;
  team2Score: number;
  time: number;
  isRunning: boolean;
  hiep: number;
  isFinished?: boolean;
  team1SetPoints?: number;
  team2SetPoints?: number;
}

type TeamRef = { id?: string; name?: string };

type BracketMatch = {
  teamA?: TeamRef;
  teamB?: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
  isFinished: boolean;
  winner?: TeamRef;
};

type BracketState = {
  rounds: BracketMatch[][];
  currentRound: number;
  currentMatch: number;
  isFinished: boolean;
  activeMatches?: number[];
};

function buildInitialBracket(teams: TeamRef[]): BracketState {
  const roundOne: BracketMatch[] = [];
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

function getCurrentBracketMatch(bracket?: BracketState) {
  if (!bracket) return null;
  const round = bracket.rounds[bracket.currentRound];
  if (!round) return null;
  return round[bracket.currentMatch] || null;
}

function normalizeBracket(bracket: BracketState) {
  const roundIndex = Math.max(0, Math.min(bracket.currentRound, bracket.rounds.length - 1));
  const round = bracket.rounds[roundIndex] || [];
  const maxMatchIndex = Math.max(0, round.length - 1);
  const matchIndex = Math.max(0, Math.min(bracket.currentMatch, maxMatchIndex));

  if (roundIndex === bracket.currentRound && matchIndex === bracket.currentMatch) {
    return bracket;
  }

  return {
    ...bracket,
    currentRound: roundIndex,
    currentMatch: matchIndex,
  };
}

function getFallbackTeams(tournament: any) {
  return tournament.orderedTeams || tournament.teams || [];
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

function pickWinner(teamA: TeamRef | undefined, teamB: TeamRef | undefined, scoreA: number, scoreB: number) {
  if (!teamB) return teamA;
  if (!teamA) return teamB;
  if (scoreA > scoreB) return teamA;
  if (scoreB > scoreA) return teamB;
  return teamA;
}

function buildNextRound(winners: TeamRef[]) {
  const round: BracketMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    round.push({
      teamA: winners[i],
      teamB: winners[i + 1],
      scoreA: null,
      scoreB: null,
      isFinished: false,
    });
  }
  return round;
}

// Repairs old saved data where teamA/teamB/winner are missing names
function migrateBracketNames(tournament: any): any {
  if (!tournament?.bracket?.rounds?.length || !tournament?.teams?.length) return tournament;

  const teams: any[] = tournament.teams;

  function resolveRef(ref: any): any {
    if (!ref) return ref;
    if (ref.id && !ref.name) {
      const found = teams.find((t: any) => t.id === ref.id);
      if (found) return { id: found.id, name: found.name };
    }
    return ref;
  }

  const rounds = tournament.bracket.rounds.map((round: any[]) =>
    round.map((match: any) => ({
      ...match,
      teamA: resolveRef(match.teamA),
      teamB: resolveRef(match.teamB),
      winner: resolveRef(match.winner),
    }))
  );

  return {
    ...tournament,
    bracket: { ...tournament.bracket, rounds },
  };
}

function migrateTournamentData(t: any): any {
  if (!t) return t;
  if (!t.matchStates) {
    t.matchStates = {};
  }
  if (t.matchState && Object.keys(t.matchStates).length === 0) {
    const roundIdx = t.bracket?.currentRound ?? 0;
    const matchIdx = t.bracket?.currentMatch ?? 0;
    const key = `${roundIdx}-${matchIdx}`;
    t.matchStates[key] = t.matchState;
  }
  if (t.bracket && !t.bracket.activeMatches) {
    t.bracket.activeMatches = [];
    if (t.bracket.currentMatch !== undefined) {
      const currentMatchIdx = t.bracket.currentMatch;
      const round = t.bracket.rounds?.[t.bracket.currentRound] || [];
      const match = round[currentMatchIdx];
      if (match && !match.isFinished) {
        t.bracket.activeMatches.push(currentMatchIdx);
      }
    }
  }
  return t;
}

export default function LiveMatchPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<any>(null);
  const [matchKey, setMatchKey] = useState<string | null>(null);
  const localKeyRef = useRef<string | null>(null);
  const backendKeyRef = useRef<string | null>(null);
  const [matchState, setMatchState] = useState<MatchState>({
    team1Score: 0,
    team2Score: 0,
    time: 0,
    isRunning: false,
    hiep: 1,
    isFinished: false,
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [pendingFinishData, setPendingFinishData] = useState<{ bracket: BracketState; nextMatchState: MatchState; updatedTournament: any } | null>(null);
  const [finishedMatchInfo, setFinishedMatchInfo] = useState<{ teamA: string; teamB: string; scoreA: number; scoreB: number; roundLabel: string } | null>(null);

  const session = getSession();
  const tournamentsKey = session ? `tournaments_${session.id}` : 'tournaments';
  const currentTournamentKey = session ? `currentTournament_${session.id}` : 'currentTournament';

  const syncQueueRef = useRef<{
    isSyncing: boolean;
    pendingData: any;
    debounceTimeout: NodeJS.Timeout | null;
  }>({
    isSyncing: false,
    pendingData: null,
    debounceTimeout: null,
  });

  const triggerSync = (data: any) => {
    const queue = syncQueueRef.current;
    if (queue.debounceTimeout) {
      clearTimeout(queue.debounceTimeout);
    }
    queue.debounceTimeout = setTimeout(() => {
      queue.debounceTimeout = null;
      if (queue.isSyncing) {
        queue.pendingData = data;
        return;
      }
      executeSync(data);
    }, 300);
  };

  const executeSync = async (data: any) => {
    const queue = syncQueueRef.current;
    queue.isSyncing = true;
    try {
      await syncTournamentToBackend(data);
    } catch (err) {
      console.error('Error syncing tournament to backend:', err);
    } finally {
      queue.isSyncing = false;
      if (queue.pendingData) {
        const nextData = queue.pendingData;
        queue.pendingData = null;
        executeSync(nextData);
      }
    }
  };

  useEffect(() => {
    const loadTournament = async () => {
      let mKey = null;
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        mKey = searchParams.get('match');
        if (mKey) {
          setMatchKey(mKey);
        }
      }

      // 1. Try local storage first
      const saved = localStorage.getItem(currentTournamentKey);
      if (saved) {
        try {
          let parsed = JSON.parse(saved);
          if (parsed.id === tournamentId) {
            parsed = migrateTournamentData(parsed);
            setTournament(migrateBracketNames(parsed));
            
            if (!mKey && parsed.bracket) {
              const r = parsed.bracket.currentRound ?? 0;
              const m = parsed.bracket.currentMatch ?? 0;
              mKey = `${r}-${m}`;
              setMatchKey(mKey);
            }

            const mState = mKey ? parsed.matchStates?.[mKey] : parsed.matchState;
            if (mState) {
              setMatchState({
                ...mState,
                isRunning: false, // Pause on load for safety
                isFinished: !!mState.isFinished
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
        let data = await fetchTournamentFromBackend(tournamentId);
        data = migrateTournamentData(data);
        setTournament(migrateBracketNames(data));
        
        if (!mKey && data.bracket) {
          const r = data.bracket.currentRound ?? 0;
          const m = data.bracket.currentMatch ?? 0;
          mKey = `${r}-${m}`;
          setMatchKey(mKey);
        }

        const mState = mKey ? data.matchStates?.[mKey] : data.matchState;
        if (mState) {
          setMatchState({
            ...mState,
            isRunning: false, // Pause on load for safety
            isFinished: !!mState.isFinished
          });
        }
      } catch (err) {
        console.error('Error fetching tournament from backend:', err);
      }
      setIsLoaded(true);
    };

    loadTournament();
  }, [tournamentId, currentTournamentKey]);

  useEffect(() => {
    if (!tournament || tournament.bracket?.rounds?.length) return;

    const teams = getFallbackTeams(tournament);
    const bracket = buildInitialBracket(teams);
    const updatedTournament = {
      ...tournament,
      bracket,
    };

    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));
    syncTournamentToBackend(updatedTournament).catch(err => {
      console.error('Error syncing bracket to backend:', err);
    });
  }, [tournament, currentTournamentKey]);

  useEffect(() => {
    if (!tournament?.bracket?.rounds?.length) return;

    const normalized = normalizeBracket(tournament.bracket);
    if (normalized === tournament.bracket) return;

    const updatedTournament = {
      ...tournament,
      bracket: normalized,
    };

    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));
    syncTournamentToBackend(updatedTournament).catch(err => {
      console.error('Error syncing bracket index:', err);
    });
  }, [tournament, currentTournamentKey]);

  // Save matchState to currentTournament and tournaments list when it changes
  useEffect(() => {
    if (isLoaded && tournament && matchKey) {
      if (localKeyRef.current !== matchKey) {
        localKeyRef.current = matchKey;
        return;
      }

      const updatedMatchStates = {
        ...(tournament.matchStates || {}),
        [matchKey]: matchState
      };

      const updatedTournament = {
        ...tournament,
        matchStates: updatedMatchStates,
        matchState: matchState,
        anyMatchRunning: Object.values(updatedMatchStates).some((ms: any) => ms.isRunning && !ms.isFinished),
      };
      
      localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));
      
      const savedList = localStorage.getItem(tournamentsKey);
      if (savedList) {
        try {
          const list = JSON.parse(savedList);
          const index = list.findIndex((t: any) => t.id === tournament.id);
          if (index > -1) {
            list[index] = updatedTournament;
            localStorage.setItem(tournamentsKey, JSON.stringify(list));
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [matchState, tournament, isLoaded, currentTournamentKey, tournamentsKey, matchKey]);

  // Sync tournament state to backend on key changes and every 15 seconds of match time
  useEffect(() => {
    if (!isLoaded || !tournament || !matchKey) return;

    if (backendKeyRef.current !== matchKey) {
      backendKeyRef.current = matchKey;
      return;
    }

    const updatedMatchStates = {
      ...(tournament.matchStates || {}),
      [matchKey]: matchState
    };

    const updatedTournament = {
      ...tournament,
      matchStates: updatedMatchStates,
      matchState: matchState,
      anyMatchRunning: Object.values(updatedMatchStates).some((ms: any) => ms.isRunning && !ms.isFinished),
    };

    triggerSync(updatedTournament);
  }, [
    matchState.team1Score,
    matchState.team2Score,
    matchState.isRunning,
    matchState.hiep,
    matchState.isFinished,
    matchState.team1SetPoints,
    matchState.team2SetPoints,
    Math.floor(matchState.time / 15),
    tournament,
    isLoaded,
    matchKey
  ]);

  // Synchronize timer ticks for referee match state
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (matchState.isRunning && !matchState.isFinished) {
      interval = setInterval(() => {
        setMatchState(prev => {
          if (prev.isRunning && !prev.isFinished) {
            return { ...prev, time: prev.time + 1 };
          }
          return prev;
        });

        if (matchKey) {
          setTournament((prev: any) => {
            if (!prev || !prev.matchStates || !prev.matchStates[matchKey]) return prev;
            
            const nextStates = {
              ...prev.matchStates,
              [matchKey]: {
                ...prev.matchStates[matchKey],
                time: prev.matchStates[matchKey].time + 1
              }
            };
            
            return {
              ...prev,
              matchStates: nextStates,
              anyMatchRunning: Object.values(nextStates).some((ms: any) => ms.isRunning && !ms.isFinished)
            };
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [matchState.isRunning, matchState.isFinished, matchKey]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartStop = () => {
    setMatchState(prev => ({ ...prev, isRunning: true }));
  };

  const handleScoreChange = (team: 'team1' | 'team2', delta: number) => {
    const isSetBased = tournament?.sport === 'tennis' || tournament?.sport === 'volleyball';
    if (isSetBased) {
      setMatchState(prev => {
        const field = team === 'team1' ? 'team1SetPoints' : 'team2SetPoints';
        const currentPoints = prev[field] ?? 0;
        return {
          ...prev,
          [field]: Math.max(0, currentPoints + delta)
        };
      });
    } else {
      setMatchState(prev => ({
        ...prev,
        [team === 'team1' ? 'team1Score' : 'team2Score']: Math.max(
          0,
          prev[team === 'team1' ? 'team1Score' : 'team2Score'] + delta
        ),
      }));
    }
  };

  const checkSetWinCondition = (t1Points: number, t2Points: number) => {
    const target = tournament?.sport === 'volleyball' ? 25 : 21;
    const team1Wins = t1Points >= target && (t1Points - t2Points >= 2);
    const team2Wins = t2Points >= target && (t2Points - t1Points >= 2);
    if (team1Wins) return 'team1';
    if (team2Wins) return 'team2';
    return null;
  };

  const handleWinSet = (winner: 'team1' | 'team2') => {
    setMatchState(prev => {
      const isTeam1 = winner === 'team1';
      return {
        ...prev,
        team1Score: prev.team1Score + (isTeam1 ? 1 : 0),
        team2Score: prev.team2Score + (isTeam1 ? 0 : 1),
        team1SetPoints: 0,
        team2SetPoints: 0,
        hiep: prev.hiep + 1
      };
    });
  };

  const handleFinishMatch = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc trận đấu này không? Kết quả sẽ được lưu lại vĩnh viễn.')) {
      return;
    }

    if (!tournament || !matchKey) {
      return;
    }

    const baseTeams = getFallbackTeams(tournament);
    const bracket: BracketState = tournament.bracket?.rounds?.length
      ? JSON.parse(JSON.stringify(tournament.bracket))
      : buildInitialBracket(baseTeams);

    const [roundIndexStr, matchIndexStr] = matchKey.split('-');
    const roundIndex = parseInt(roundIndexStr, 10);
    const matchIndex = parseInt(matchIndexStr, 10);
    const round = bracket.rounds[roundIndex] || [];
    const match = round[matchIndex];

    if (!match) {
      return;
    }

    match.scoreA = matchState.team1Score;
    match.scoreB = matchState.team2Score;
    match.isFinished = true;

    // Resolve teamA/teamB to full { id, name } before saving (in case name was missing)
    if (match.teamA?.id && !match.teamA.name) {
      const resolved = tournament.teams?.find((t: any) => t.id === match.teamA!.id);
      if (resolved) match.teamA = { id: resolved.id, name: resolved.name };
    }
    if (match.teamB?.id && !match.teamB.name) {
      const resolved = tournament.teams?.find((t: any) => t.id === match.teamB!.id);
      if (resolved) match.teamB = { id: resolved.id, name: resolved.name };
    }

    // Always resolve winner to full { id, name } so later rounds have the name
    const rawWinner = pickWinner(match.teamA, match.teamB, matchState.team1Score, matchState.team2Score);
    match.winner = rawWinner?.id
      ? (tournament.teams?.find((t: any) => t.id === rawWinner.id) || rawWinner)
      : rawWinner;

    const nextMatchState: MatchState = {
      ...matchState,
      isRunning: false,
      isFinished: true,
    };

    const updatedMatchStates = {
      ...(tournament.matchStates || {}),
      [matchKey]: nextMatchState,
    };

    // Remove from active matches
    const activeMatches = (bracket.activeMatches || []).filter((idx: number) => idx !== matchIndex);
    bracket.activeMatches = activeMatches;

    // Check if all matches in current round are finished
    const allMatchesInRoundFinished = round.every((m: any, idx: number) => {
      return m.isFinished || idx === matchIndex;
    });

    if (allMatchesInRoundFinished) {
      const winners = round.map((m: any, idx: number) => {
        if (idx === matchIndex) {
          return pickWinner(m.teamA, m.teamB, matchState.team1Score, matchState.team2Score);
        }
        return m.winner;
      }).filter(Boolean) as TeamRef[];

      // Ensure each winner has name resolved from tournament.teams
      const resolvedWinners = winners.map(w =>
        w.id ? (tournament.teams?.find((t: any) => t.id === w.id) || w) : w
      );

      if (resolvedWinners.length > 1) {
        const nextRound = buildNextRound(resolvedWinners);
        if (bracket.rounds[roundIndex + 1]) {
          bracket.rounds[roundIndex + 1] = nextRound;
        } else {
          bracket.rounds.push(nextRound);
        }
        bracket.currentRound = roundIndex + 1;
        bracket.currentMatch = 0;
        bracket.activeMatches = []; // Reset active matches for new round
      } else {
        bracket.isFinished = true;
      }
    }

    const updatedTournament = {
      ...tournament,
      bracket,
      matchStates: updatedMatchStates,
      matchState: nextMatchState,
      anyMatchRunning: Object.values(updatedMatchStates).some((ms: any) => ms.isRunning && !ms.isFinished),
    };

    if (bracket.isFinished) {
      const numTeams = (tournament.orderedTeams || tournament.teams || []).length;
      const numRounds = Math.ceil(Math.log2(numTeams));
      const getRoundLbl = (r: number, total: number) => {
        if (r === total - 1) return 'Chung kết';
        if (r === total - 2) return 'Bán kết';
        if (r === total - 3) return 'Tứ kết';
        return `Vòng ${r + 1}`;
      };
      setFinishedMatchInfo({
        teamA: match.teamA?.name || 'Đội 1',
        teamB: match.teamB?.name || 'Đội 2',
        scoreA: matchState.team1Score,
        scoreB: matchState.team2Score,
        roundLabel: getRoundLbl(roundIndex, numRounds),
      });

      setPendingFinishData({ bracket, nextMatchState, updatedTournament });
      setFeedbackRating(0);
      setFeedbackHover(0);
      setFeedbackContent('');
      setShowFeedbackModal(true);
    } else {
      setTournament(updatedTournament);
      setMatchState(nextMatchState);
      localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));

      const savedList = localStorage.getItem(tournamentsKey);
      if (savedList) {
        try {
          const list = JSON.parse(savedList);
          const index = list.findIndex((t: any) => t.id === tournament.id);
          if (index > -1) {
            list[index] = updatedTournament;
            localStorage.setItem(tournamentsKey, JSON.stringify(list));
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
    }
  };

  const commitFinishMatch = async (feedback?: { rating: number; content: string }) => {
    if (!pendingFinishData || !tournament) return;

    const { bracket, nextMatchState, updatedTournament } = pendingFinishData;

    if (feedback && feedback.rating > 0) {
      const feedbackEntry = {
        rating: feedback.rating,
        content: feedback.content,
        createdAt: new Date().toISOString(),
      };
      updatedTournament.feedbacks = [...(tournament.feedbacks || []), feedbackEntry];
    }

    setTournament(updatedTournament);
    setMatchState(nextMatchState);

    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));

    const savedList = localStorage.getItem(tournamentsKey);
    if (savedList) {
      try {
        const list = JSON.parse(savedList);
        const index = list.findIndex((t: any) => t.id === tournament.id);
        if (index > -1) {
          list[index] = updatedTournament;
          localStorage.setItem(tournamentsKey, JSON.stringify(list));
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

    setPendingFinishData(null);
    setFinishedMatchInfo(null);
    setShowFeedbackModal(false);

    if (bracket.isFinished) {
      alert('Giải đấu đã kết thúc!');
      router.push(`/tournaments/${tournamentId}`);
    }
  };

  const handleFeedbackSubmit = async () => {
    setFeedbackSubmitting(true);
    try {
      await commitFinishMatch({ rating: feedbackRating, content: feedbackContent });
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleFeedbackSkip = async () => {
    await commitFinishMatch();
  };

  if (!tournament) {
    return (
      <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center">
        <p>Đang tải...</p>
      </main>
    );
  }

  const fallbackTeams = getFallbackTeams(tournament);
  const [roundIdxStr, matchIdxStr] = matchKey ? matchKey.split('-') : ['0', '0'];
  const roundIndex = parseInt(roundIdxStr, 10);
  const matchIndex = parseInt(matchIdxStr, 10);
  
  const getSelectedBracketMatch = () => {
    if (!tournament || !tournament.bracket) return null;
    const round = tournament.bracket.rounds[roundIndex];
    if (!round) return null;
    return round[matchIndex] || null;
  };

  const currentBracketMatch = getSelectedBracketMatch();
  const fallbackTeamA = fallbackTeams[matchIndex * 2];
  const fallbackTeamB = fallbackTeams[matchIndex * 2 + 1];
  const team1 = resolveTeamRef(tournament, currentBracketMatch?.teamA) || fallbackTeamA || tournament.teams[0];
  const team2 = resolveTeamRef(tournament, currentBracketMatch?.teamB) || fallbackTeamB || tournament.teams[1];
  const roundLabel = tournament.bracket
    ? `VÒNG ${roundIndex + 1} • TRẬN ${matchIndex + 1}`
    : 'VÒNG 1 • TRẬN 1';

  const winnableTeam = (tournament?.sport === 'tennis' || tournament?.sport === 'volleyball')
    ? checkSetWinCondition(matchState.team1SetPoints ?? 0, matchState.team2SetPoints ?? 0)
    : null;

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
          <div className="text-sm font-semibold text-[#22c55e] mb-2">{roundLabel}</div>
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
            {tournament?.sport === 'basketball' ? (
              <div className="flex flex-col gap-2 max-w-[180px] mx-auto">
                <button
                  onClick={() => handleScoreChange('team1', 1)}
                  className="w-full py-2 px-3 rounded-lg bg-[#22c55e]/15 hover:bg-[#22c55e]/25 border border-[#22c55e]/40 text-xs font-bold transition-all"
                >
                  +1 Ném phạt
                </button>
                <button
                  onClick={() => handleScoreChange('team1', 2)}
                  className="w-full py-2 px-3 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 border border-[#22c55e]/50 text-xs font-black transition-all"
                >
                  +2 Ghi điểm
                </button>
                <button
                  onClick={() => handleScoreChange('team1', 3)}
                  className="w-full py-2 px-3 rounded-lg bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 border border-[#3b82f6]/50 text-xs font-black transition-all"
                >
                  +3 Điểm
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleScoreChange('team1', 1)}
                className="w-full px-4 py-3 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 transition-all duration-200 border border-[#22c55e]/50 mb-3"
              >
                {tournament?.sport === 'tennis' || tournament?.sport === 'volleyball'
                  ? `+ Điểm Set ${matchState.hiep}`
                  : '+ Ghi bàn'}
              </button>
            )}
          </div>

          {/* Score & Time */}
          <div className="flex flex-col items-center justify-center">
            {/* Time */}
            <div className="text-5xl font-black mb-6 font-mono tracking-wide">
              {formatTime(matchState.time)}
            </div>

            {/* Score */}
            {tournament?.sport === 'tennis' || tournament?.sport === 'volleyball' ? (
              <div className="flex flex-col items-center gap-1 mb-6">
                <div className="text-[10px] font-black tracking-widest text-white/40 uppercase">Tỉ số Set</div>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-black text-[#22c55e]">{matchState.team1Score}</div>
                  <div className="text-3xl font-black text-white/20">−</div>
                  <div className="text-5xl font-black text-[#22c55e]">{matchState.team2Score}</div>
                </div>
                <div className="text-[9px] font-black tracking-wider text-white/30 uppercase mt-3">Điểm Set {matchState.hiep}</div>
                <div className="flex items-center gap-3 px-3 py-1 rounded bg-[#080b10] border border-white/[0.04] text-xl font-bold font-mono">
                  <div className="text-white/80">{matchState.team1SetPoints ?? 0}</div>
                  <div className="text-white/30">:</div>
                  <div className="text-white/80">{matchState.team2SetPoints ?? 0}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 mb-6">
                <div className="text-5xl font-black">{matchState.team1Score}</div>
                <div className="text-3xl font-black text-white/50">−</div>
                <div className="text-5xl font-black">{matchState.team2Score}</div>
              </div>
            )}

            {/* Start/Stop Button */}
            {matchState.isFinished ? (
              <div className="px-6 py-3 rounded-lg font-semibold bg-gray-500/20 border border-gray-500/30 text-gray-400 mb-4 cursor-not-allowed">
                🏁 Trận đấu đã kết thúc
              </div>
            ) : !matchState.isRunning ? (
              <button
                onClick={handleStartStop}
                className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 mb-4 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50"
              >
                ▶ Bắt đầu
              </button>
            ) : null}

            {/* Status */}
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
              matchState.isFinished
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : matchState.isRunning
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                matchState.isFinished ? 'bg-red-400' : matchState.isRunning ? 'bg-green-400' : 'bg-blue-400'
              }`} />
              {matchState.isFinished ? 'Đã kết thúc' : matchState.isRunning ? 'Đang thi đấu' : 'Sẵn sàng'}
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
            {tournament?.sport === 'basketball' ? (
              <div className="flex flex-col gap-2 max-w-[180px] mx-auto">
                <button
                  onClick={() => handleScoreChange('team2', 1)}
                  className="w-full py-2 px-3 rounded-lg bg-[#22c55e]/15 hover:bg-[#22c55e]/25 border border-[#22c55e]/40 text-xs font-bold transition-all"
                >
                  +1 Ném phạt
                </button>
                <button
                  onClick={() => handleScoreChange('team2', 2)}
                  className="w-full py-2 px-3 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 border border-[#22c55e]/50 text-xs font-black transition-all"
                >
                  +2 Ghi điểm
                </button>
                <button
                  onClick={() => handleScoreChange('team2', 3)}
                  className="w-full py-2 px-3 rounded-lg bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 border border-[#3b82f6]/50 text-xs font-black transition-all"
                >
                  +3 Điểm
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleScoreChange('team2', 1)}
                className="w-full px-4 py-3 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 transition-all duration-200 border border-[#22c55e]/50 mb-3"
              >
                {tournament?.sport === 'tennis' || tournament?.sport === 'volleyball'
                  ? `+ Điểm Set ${matchState.hiep}`
                  : '+ Ghi bàn'}
              </button>
            )}
          </div>
        </div>

        {/* Set Win Condition Banner */}
        {winnableTeam && !matchState.isFinished && (
          <div className="mb-12 p-5 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <span className="text-sm font-bold text-[#22c55e]">
                {(winnableTeam === 'team1' ? team1?.name : team2?.name) || 'Đội chơi'} đủ điều kiện thắng Set {matchState.hiep}!
              </span>
            </div>
            <button
              onClick={() => handleWinSet(winnableTeam)}
              className="px-5 py-2.5 rounded-lg bg-[#22c55e] text-black font-black text-xs hover:bg-[#16a34a] transition-all duration-200 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
            >
              Xác nhận thắng Set {matchState.hiep}
            </button>
          </div>
        )}

        {/* Score Adjustment Controls */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {/* Team 1 Adjustments */}
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm font-semibold mb-3 text-center">Điều chỉnh {team1?.name}</p>
            {tournament?.sport === 'tennis' || tournament?.sport === 'volleyball' ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleScoreChange('team1', -1)}
                    className="flex-1 px-2 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 font-semibold text-xs text-red-400"
                  >
                    − Điểm
                  </button>
                  <button
                    onClick={() => handleScoreChange('team1', 1)}
                    className="flex-1 px-2 py-1.5 rounded bg-[#22c55e]/20 hover:bg-[#22c55e]/30 border border-[#22c55e]/50 font-semibold text-xs text-green-400"
                  >
                    + Điểm
                  </button>
                </div>
                <div className="flex gap-2 mt-1 pt-2 border-t border-white/[0.04]">
                  <button
                    onClick={() => setMatchState(prev => ({ ...prev, team1Score: Math.max(0, prev.team1Score - 1) }))}
                    className="flex-1 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 font-semibold text-[10px]"
                  >
                    − Set
                  </button>
                  <button
                    onClick={() => setMatchState(prev => ({ ...prev, team1Score: prev.team1Score + 1 }))}
                    className="flex-1 px-2 py-1 rounded bg-[#22c55e]/10 hover:bg-[#22c55e]/20 border border-[#22c55e]/30 font-semibold text-[10px]"
                  >
                    + Set
                  </button>
                </div>
              </div>
            ) : (
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
            )}
          </div>

          {/* Middle Section */}
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm font-semibold mb-3 text-center">
              {tournament?.sport === 'tennis' || tournament?.sport === 'volleyball' ? 'Set' : 'Hiệp'}
            </p>
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
            {tournament?.sport === 'tennis' || tournament?.sport === 'volleyball' ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleScoreChange('team2', -1)}
                    className="flex-1 px-2 py-1.5 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 font-semibold text-xs text-red-400"
                  >
                    − Điểm
                  </button>
                  <button
                    onClick={() => handleScoreChange('team2', 1)}
                    className="flex-1 px-2 py-1.5 rounded bg-[#22c55e]/20 hover:bg-[#22c55e]/30 border border-[#22c55e]/50 font-semibold text-xs text-green-400"
                  >
                    + Điểm
                  </button>
                </div>
                <div className="flex gap-2 mt-1 pt-2 border-t border-white/[0.04]">
                  <button
                    onClick={() => setMatchState(prev => ({ ...prev, team2Score: Math.max(0, prev.team2Score - 1) }))}
                    className="flex-1 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 font-semibold text-[10px]"
                  >
                    − Set
                  </button>
                  <button
                    onClick={() => setMatchState(prev => ({ ...prev, team2Score: prev.team2Score + 1 }))}
                    className="flex-1 px-2 py-1 rounded bg-[#22c55e]/10 hover:bg-[#22c55e]/20 border border-[#22c55e]/30 font-semibold text-[10px]"
                  >
                    + Set
                  </button>
                </div>
              </div>
            ) : (
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
            )}
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

      {/* Feedback Modal Overlay */}
      {showFeedbackModal && finishedMatchInfo && (
        <div className="fixed inset-0 z-[60] bg-[#080b10]/85 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="bg-[#0f1419] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
            
            {/* Decorative top gradient */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#22c55e] via-[#3b82f6] to-[#a855f7]" />

            <div className="p-8">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🏁</div>
                <h3 className="text-xl font-black text-white mb-1">Trận đấu kết thúc!</h3>
                <p className="text-sm text-white/50">
                  {finishedMatchInfo.roundLabel} • {finishedMatchInfo.teamA} vs {finishedMatchInfo.teamB}
                </p>
              </div>

              {/* Score display */}
              <div className="flex items-center justify-center gap-4 mb-8 py-4 bg-[#080b10] rounded-xl border border-white/[0.04]">
                <div className="text-center">
                  <p className="text-xs text-white/50 mb-1 font-semibold truncate max-w-[100px]">{finishedMatchInfo.teamA}</p>
                  <p className={`text-3xl font-black ${finishedMatchInfo.scoreA > finishedMatchInfo.scoreB ? 'text-[#22c55e]' : 'text-white/60'}`}>
                    {finishedMatchInfo.scoreA}
                  </p>
                </div>
                <div className="text-xl font-bold text-white/20">−</div>
                <div className="text-center">
                  <p className="text-xs text-white/50 mb-1 font-semibold truncate max-w-[100px]">{finishedMatchInfo.teamB}</p>
                  <p className={`text-3xl font-black ${finishedMatchInfo.scoreB > finishedMatchInfo.scoreA ? 'text-[#22c55e]' : 'text-white/60'}`}>
                    {finishedMatchInfo.scoreB}
                  </p>
                </div>
              </div>

              {/* Star Rating */}
              <div className="mb-6">
                <label className="block text-xs font-black tracking-wider text-white/40 uppercase mb-3 text-center">
                  Đánh giá trận đấu
                </label>
                <div className="flex justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      onMouseEnter={() => setFeedbackHover(star)}
                      onMouseLeave={() => setFeedbackHover(0)}
                      className="group relative p-1 transition-transform duration-150 hover:scale-125 active:scale-95"
                    >
                      <svg 
                        width="32" 
                        height="32" 
                        viewBox="0 0 24 24" 
                        fill={(feedbackHover || feedbackRating) >= star ? '#facc15' : 'none'}
                        stroke={(feedbackHover || feedbackRating) >= star ? '#facc15' : '#ffffff30'}
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="transition-all duration-200 drop-shadow-sm"
                        style={(feedbackHover || feedbackRating) >= star ? { filter: 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.4))' } : {}}
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  ))}
                </div>
                {feedbackRating > 0 && (
                  <p className="text-center text-xs text-yellow-400/70 mt-2 font-semibold">
                    {feedbackRating === 1 ? 'Tệ' : feedbackRating === 2 ? 'Chưa tốt' : feedbackRating === 3 ? 'Bình thường' : feedbackRating === 4 ? 'Hay' : 'Xuất sắc!'}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div className="mb-8">
                <label className="block text-xs font-black tracking-wider text-white/40 uppercase mb-3">
                  Nhận xét (tùy chọn)
                </label>
                <textarea
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  placeholder="Viết nhận xét của bạn về trận đấu này..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-[#080b10] border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#22c55e]/40 focus:ring-1 focus:ring-[#22c55e]/20 transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleFeedbackSkip}
                  disabled={feedbackSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/50 font-semibold text-sm hover:bg-white/[0.06] hover:text-white/70 transition-all duration-200 disabled:opacity-50"
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  onClick={handleFeedbackSubmit}
                  disabled={feedbackSubmitting || feedbackRating === 0}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#22c55e] text-[#080b10] font-black text-sm hover:bg-[#16a34a] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {feedbackSubmitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                      </svg>
                      Đang gửi...
                    </>
                  ) : (
                    'Gửi đánh giá'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}