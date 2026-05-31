'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { fetchTournamentFromBackend, syncTournamentToBackend } from '@/app/lib/tournaments';
import { getSession } from '@/app/lib/authStorage';
import { getPusherClient } from '@/app/lib/pusher';

interface MatchState {
  team1Score: number;
  team2Score: number;
  time: number;
  isRunning: boolean;
  hiep: number;
  isFinished?: boolean;
  buGio?: number;
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
  time?: number;
  hiep?: number;
  buGio?: number;
};

type BracketState = {
  rounds: BracketMatch[][];
  currentRound: number;
  currentMatch: number;
  isFinished: boolean;
};

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

function getCurrentBracketMatch(bracket?: BracketState) {
  if (!bracket) return null;
  const round = bracket.rounds[bracket.currentRound];
  if (!round) return null;
  return round[bracket.currentMatch] || null;
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


interface BracketMatchCardProps {
  a: string;
  b: string;
  sa: number | null;
  sb: number | null;
  done: boolean;
  isLive: boolean;
  onClick: () => void;
}

function BracketMatchCard({ a, b, sa, sb, done, isLive, onClick }: BracketMatchCardProps) {
  const winA = sa !== null && sb !== null && sa > sb;
  const winB = sa !== null && sb !== null && sb > sa;
  
  return (
    <div 
      onClick={onClick}
      className={`w-[160px] rounded-xl border overflow-hidden text-[12px] shadow-lg transition-all duration-300 cursor-pointer ${
        isLive 
          ? 'border-[#22c55e] bg-[#22c55e]/[0.05] shadow-[0_0_15px_rgba(34,197,94,0.15)] scale-[1.03] hover:scale-[1.05]' 
          : 'border-white/[0.08] bg-[#0f1419] hover:border-white/[0.15] hover:scale-[1.02]'
      }`}
    >
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

      {/* Status Footer */}
      {isLive && (
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#22c55e]/20 border-t border-[#22c55e]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[#22c55e] text-[10px] font-black tracking-wider uppercase">ĐANG ĐẤU</span>
        </div>
      )}
      {!isLive && !done && (sa !== null || sb !== null) && (
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-yellow-500/10 border-t border-yellow-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          <span className="text-yellow-500 text-[10px] font-black tracking-wider uppercase">TẠM DỪNG</span>
        </div>
      )}
    </div>
  );
}

function buildBracketData(tournament: any) {
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

      const isCurrentMatch = tournament.bracket?.currentRound === r && tournament.bracket?.currentMatch === m;
      const isLive = isCurrentMatch && tournament.matchState && tournament.matchState.isRunning && !tournament.matchState.isFinished;
      const isFinished = dbMatch ? !!dbMatch.isFinished : false;

      let scoreA: number | null = null;
      let scoreB: number | null = null;

      if (isLive) {
        scoreA = tournament.matchState?.team1Score ?? 0;
        scoreB = tournament.matchState?.team2Score ?? 0;
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

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<any>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [matchState, setMatchState] = useState<MatchState>({
    team1Score: 0,
    team2Score: 0,
    time: 0,
    isRunning: false,
    hiep: 1,
    isFinished: false,
    buGio: 0,
  });
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

  useEffect(() => {
    let isOwnerUser = false;
    const savedList = localStorage.getItem(tournamentsKey);
    if (savedList) {
      try {
        const list = JSON.parse(savedList);
        if (list.some((t: any) => t.id === tournamentId)) {
          isOwnerUser = true;
          setIsOwner(true);
        }
      } catch (e) {
        console.error('Error parsing tournaments list:', e);
      }
    }

    const loadTournament = async () => {
      let loadedTournament = null;
      // 1. Try local storage first
      if (savedList) {
        try {
          const list = JSON.parse(savedList);
          const tourn = list.find((t: any) => t.id === tournamentId);
          if (tourn) {
            loadedTournament = tourn;
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (!loadedTournament) {
        const savedCurrent = localStorage.getItem(currentTournamentKey);
        if (savedCurrent) {
          try {
            const tourn = JSON.parse(savedCurrent);
            if (tourn.id === tournamentId) {
              loadedTournament = tourn;
            }
          } catch (e) {
            console.error(e);
          }
        }
      }

      // 2. Fallback to backend
      if (!loadedTournament) {
        try {
          const data = await fetchTournamentFromBackend(tournamentId);
          loadedTournament = data;
        } catch (err) {
          console.error('Error fetching tournament from backend:', err);
        }
      }

      if (loadedTournament) {
        setTournament(loadedTournament);
        if (loadedTournament.matchState) {
          setMatchState(loadedTournament.matchState);
        }
        localStorage.setItem(currentTournamentKey, JSON.stringify(loadedTournament));
        const link = `${window.location.origin}/tournaments/${tournamentId}/live`;
        setShareLink(link);
        setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`);
      }
      setIsLoaded(true);
    };

    loadTournament();
  }, [tournamentId, currentTournamentKey, tournamentsKey]);

  useEffect(() => {
    const pusher = getPusherClient();
    let channel: any = null;

    if (pusher) {
      channel = pusher.subscribe(tournamentId);
      channel.bind("tournament_updated", (data: any) => {
        console.log("Pusher received tournament update in dashboard:", data);
        setTournament(data);
        if (data.matchState) {
          setMatchState(data.matchState);
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

  // Synchronize timer ticks
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

  // Sync to local storage
  useEffect(() => {
    if (isLoaded && tournament) {
      const updatedTournament = {
        ...tournament,
        matchState: matchState
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
  }, [matchState, tournament, isLoaded, currentTournamentKey, tournamentsKey]);

  // Sync to backend on score/running/hiep/buGio changes and periodic time
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
    matchState.buGio,
    Math.floor(matchState.time / 15),
    tournament,
    isLoaded
  ]);

  const handleCopyLink = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    navigator.clipboard.writeText(shareLink);
    alert('Đã copy link vào clipboard!');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartStop = () => {
    setMatchState(prev => ({ ...prev, isRunning: !prev.isRunning }));
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

  const handleSaveScore = async () => {
    if (!tournament) return;
    try {
      const updatedTournament = {
        ...tournament,
        matchState: matchState
      };
      await syncTournamentToBackend(updatedTournament);
      alert('Đã lưu tỉ số thành công!');
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi lưu tỉ số.');
    }
  };

  const handleEndHalf = () => {
    if (matchState.hiep === 1) {
      if (window.confirm('Bạn có chắc chắn muốn kết thúc Hiệp 1 và chuyển sang Hiệp 2?')) {
        setMatchState(prev => ({
          ...prev,
          hiep: 2,
          time: 0,
          isRunning: false,
        }));
      }
    } else {
      handleFinishMatch();
    }
  };

  const handleFinishMatch = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc trận đấu này không? Kết quả sẽ được lưu lại vĩnh viễn.')) {
      return;
    }

    if (!tournament) return;

    const baseTeams = getFallbackTeams(tournament);
    const bracket: BracketState = tournament.bracket?.rounds?.length
      ? JSON.parse(JSON.stringify(tournament.bracket))
      : buildInitialBracket(baseTeams);

    const roundIndex = bracket.currentRound;
    const matchIndex = bracket.currentMatch;
    const round = bracket.rounds[roundIndex] || [];
    const match = round[matchIndex];

    if (!match) return;

    match.scoreA = matchState.team1Score;
    match.scoreB = matchState.team2Score;
    match.isFinished = true;

    // Resolve team details
    if (match.teamA?.id && !match.teamA.name) {
      const resolved = tournament.teams?.find((t: any) => t.id === match.teamA!.id);
      if (resolved) match.teamA = { id: resolved.id, name: resolved.name };
    }
    if (match.teamB?.id && !match.teamB.name) {
      const resolved = tournament.teams?.find((t: any) => t.id === match.teamB!.id);
      if (resolved) match.teamB = { id: resolved.id, name: resolved.name };
    }

    // Determine winner
    const rawWinner = pickWinner(match.teamA, match.teamB, matchState.team1Score, matchState.team2Score);
    match.winner = rawWinner?.id
      ? (tournament.teams?.find((t: any) => t.id === rawWinner.id) || rawWinner)
      : rawWinner;

    let nextMatchState: MatchState = {
      team1Score: 0,
      team2Score: 0,
      time: 0,
      isRunning: false,
      hiep: 1,
      isFinished: false,
      buGio: 0,
    };

    if (matchIndex + 1 < round.length) {
      bracket.currentMatch = matchIndex + 1;
    } else {
      const winners = round.map(m => m.winner).filter(Boolean) as TeamRef[];
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
      } else {
        bracket.isFinished = true;
        nextMatchState = {
          ...matchState,
          isRunning: false,
          isFinished: true,
          buGio: matchState.buGio,
        };
      }
    }

    const updatedTournament = {
      ...tournament,
      bracket,
      matchState: nextMatchState,
    };

    // Store match info for feedback modal
    const numRounds = Math.ceil(Math.log2((tournament.orderedTeams || tournament.teams || []).length));
    setFinishedMatchInfo({
      teamA: match.teamA?.name || 'Đội 1',
      teamB: match.teamB?.name || 'Đội 2',
      scoreA: matchState.team1Score,
      scoreB: matchState.team2Score,
      roundLabel: getRoundLabel(roundIndex, numRounds),
    });

    // Save pending data and show feedback modal
    setPendingFinishData({ bracket, nextMatchState, updatedTournament });
    setFeedbackRating(0);
    setFeedbackHover(0);
    setFeedbackContent('');
    setShowFeedbackModal(true);
  };

  const commitFinishMatch = async (feedback?: { rating: number; content: string }) => {
    if (!pendingFinishData || !tournament) return;

    const { bracket, nextMatchState, updatedTournament } = pendingFinishData;

    // Attach feedback to the finished match in the bracket
    if (feedback && feedback.rating > 0) {
      const roundIndex = tournament.bracket?.currentRound ?? 0;
      const matchIndex = tournament.bracket?.currentMatch ?? 0;
      const match = bracket.rounds?.[roundIndex]?.[matchIndex];
      if (match) {
        (match as any).feedback = {
          rating: feedback.rating,
          content: feedback.content,
          createdAt: new Date().toISOString(),
        };
      }
      // Also store in feedbacks array at tournament level
      const feedbackEntry = {
        round: roundIndex,
        match: matchIndex,
        teamA: finishedMatchInfo?.teamA || '',
        teamB: finishedMatchInfo?.teamB || '',
        scoreA: finishedMatchInfo?.scoreA ?? 0,
        scoreB: finishedMatchInfo?.scoreB ?? 0,
        rating: feedback.rating,
        content: feedback.content,
        createdAt: new Date().toISOString(),
      };
      updatedTournament.feedbacks = [...(tournament.feedbacks || []), feedbackEntry];
      updatedTournament.bracket = bracket;
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

  const handleStartPendingMatch = async (matchIdx: number) => {
    if (!tournament || !tournament.bracket) return;

    const round = tournament.bracket.rounds[tournament.bracket.currentRound];
    const match = round[matchIdx];
    if (!match) return;

    const team1Name = match.teamA?.name || 'Đội 1';
    const team2Name = match.teamB?.name || 'Đội 2';

    if (!window.confirm(`Bạn có chắc chắn muốn bắt đầu trận đấu giữa ${team1Name} và ${team2Name}?`)) {
      return;
    }

    const updatedBracket = {
      ...tournament.bracket,
      currentMatch: matchIdx,
    };

    const initialMatchState: MatchState = {
      team1Score: 0,
      team2Score: 0,
      time: 0,
      isRunning: true,
      hiep: 1,
      isFinished: false,
      buGio: 0,
    };

    const updatedTournament = {
      ...tournament,
      bracket: updatedBracket,
      matchState: initialMatchState,
    };

    setTournament(updatedTournament);
    setMatchState(initialMatchState);

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
      console.error('Error starting pending match:', err);
    }
  };

  const handleMatchCardClick = (roundIdx: number, matchIdx: number) => {
    if (!isOwner) {
      router.push(`/tournaments/${tournamentId}/live`);
      return;
    }

    if (!tournament || !tournament.bracket) return;
    const dbRound = tournament.bracket.rounds?.[roundIdx] || [];
    const dbMatch = dbRound[matchIdx];
    if (!dbMatch) return;

    if (!dbMatch.teamA || !dbMatch.teamB || dbMatch.teamA.name === '?' || dbMatch.teamB.name === '?') {
      alert('Không thể chọn trận đấu chưa xác định đủ đội hình.');
      return;
    }

    const updatedBracket = {
      ...tournament.bracket,
      currentRound: roundIdx,
      currentMatch: matchIdx,
    };

    let newMatchState: MatchState = {
      team1Score: dbMatch.scoreA !== null ? dbMatch.scoreA : 0,
      team2Score: dbMatch.scoreB !== null ? dbMatch.scoreB : 0,
      time: dbMatch.time || 0,
      isRunning: false,
      hiep: dbMatch.hiep || 1,
      isFinished: !!dbMatch.isFinished,
      buGio: dbMatch.buGio || 0,
    };

    if (tournament.bracket.currentRound === roundIdx && tournament.bracket.currentMatch === matchIdx && tournament.matchState) {
      newMatchState = tournament.matchState;
    }

    const updatedTournament = {
      ...tournament,
      bracket: updatedBracket,
      matchState: newMatchState,
    };

    setTournament(updatedTournament);
    setMatchState(newMatchState);

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

    syncTournamentToBackend(updatedTournament).catch(err => {
      console.error('Error syncing selected match:', err);
    });

    // Smooth scroll to the controller
    setTimeout(() => {
      const controllerEl = document.getElementById('match-controller');
      if (controllerEl) {
        controllerEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const getPendingMatches = () => {
    if (!tournament || !tournament.bracket || tournament.bracket.isFinished) return [];
    
    const round = tournament.bracket.rounds?.[tournament.bracket.currentRound] || [];
    return round.map((m: any, idx: number) => {
      const isCurrentMatch = tournament.bracket.currentMatch === idx;
      const isLive = isCurrentMatch && tournament.matchState && !tournament.matchState.isFinished && tournament.matchState.isRunning;
      const done = m.isFinished || (isCurrentMatch && tournament.matchState?.isFinished);
      const hasTeams = m.teamA && m.teamB && m.teamA.name !== '?' && m.teamB.name !== '?';
      
      return {
        match: m,
        matchIdx: idx,
        isLive,
        done,
        hasTeams
      };
    }).filter((item: any) => item.hasTeams && !item.done && !item.isLive);
  };

  const scrollToController = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const controllerEl = document.getElementById('match-controller');
    if (controllerEl) {
      controllerEl.scrollIntoView({ behavior: 'smooth' });
    }
  };


  if (!tournament) {
    return (
      <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center">
        <p>Đang tải...</p>
      </main>
    );
  }

  const isLiveMatchActive = tournament.matchState?.isRunning && !tournament.matchState?.isFinished;
  const currentBracketMatch = getCurrentBracketMatch(tournament?.bracket);
  const matchIndex = tournament?.bracket?.currentMatch || 0;
  const fallbackTeams = getFallbackTeams(tournament);
  const fallbackTeamA = fallbackTeams[matchIndex * 2];
  const fallbackTeamB = fallbackTeams[matchIndex * 2 + 1];
  const team1 = tournament ? (resolveTeamRef(tournament, currentBracketMatch?.teamA) || fallbackTeamA) : null;
  const team2 = tournament ? (resolveTeamRef(tournament, currentBracketMatch?.teamB) || fallbackTeamB) : null;
  
  const showActiveMatch = tournament && tournament.bracket && currentBracketMatch && 
                         team1 && team2 && team1.name !== '?' && team2.name !== '?';

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

      {/* Header Navbar */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-4 border-b border-white/[0.06] backdrop-blur-md bg-[#080b10]/60 sticky top-0">
        <Link 
          href={isOwner ? "/tournaments" : "/"} 
          className="flex items-center gap-2 hover:opacity-80 transition-opacity text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span className="text-[16px] font-black tracking-tight ml-2">{tournament.name}</span>
        </Link>
        
        <div className="flex items-center gap-3">
          {isLiveMatchActive && isOwner && (
            <button
              type="button"
              onClick={scrollToController}
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.35)] animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              Trận đang đấu (1)
            </button>
          )}
          
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowQrModal(true); }}
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
            type="button"
            onClick={(e) => handleCopyLink(e)}
            className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white text-xs font-bold transition-all duration-200 flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            Copy link
          </button>

          <Link
            href={`/tournaments/${tournamentId}/live`}
            target="_blank"
            className="px-4 py-2 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] text-[#080b10] text-xs font-bold transition-all duration-200 flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            Xem
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        
        {/* Bracket Diagram Container */}
        <div className="w-full">
          {buildBracketData(tournament).length === 0 ? (
            <div className="text-center py-20 bg-[#0f1419] rounded-2xl border border-white/[0.06]">
              <p className="text-white/60 text-lg">Không có dữ liệu sơ đồ cho giải đấu này</p>
            </div>
          ) : (
            <div className="flex items-stretch justify-center gap-8 overflow-x-auto pb-8 pt-4 min-h-[500px]">
              {buildBracketData(tournament).map((roundMatches, roundIdx, arr) => (
                <div key={roundIdx} className="flex flex-col shrink-0 items-center w-[160px]">
                  <h3 className="text-xs font-black tracking-widest text-[#22c55e]/70 uppercase text-center mb-8">
                    {getRoundLabel(roundIdx, arr.length)}
                  </h3>
                  <div className="flex flex-col justify-around flex-1 h-full gap-4">
                    {roundMatches.map((m: any, matchIdx: number) => (
                      <div key={matchIdx} className="relative flex items-center justify-center py-2">
                        <BracketMatchCard 
                          {...m} 
                          onClick={() => handleMatchCardClick(roundIdx, matchIdx)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bảng điều khiển trận đấu (Active Match Controls) */}
        {showActiveMatch && (
          <div id="match-controller" className="mt-12 bg-[#0f1419] border border-white/[0.06] rounded-2xl p-8 max-w-2xl mx-auto shadow-2xl relative">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <h3 className="text-sm font-black tracking-widest text-[#22c55e] uppercase">Đang thi đấu</h3>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Hiệp {matchState.hiep} • {formatTime(matchState.time)}
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 text-lg font-bold mb-6 text-white/90">
                <span>{team1?.name}</span>
                <span className="text-white/20">vs</span>
                <span>{team2?.name}</span>
              </div>

              <div className="text-[11px] font-black tracking-wider text-white/40 uppercase mb-4">
                Hiệp {matchState.hiep}
              </div>

              {/* Dynamic Score Controls based on Sport */}
              <div className="flex items-center justify-center gap-8 mb-6">
                {/* Team 1 scoring area */}
                {tournament?.sport === 'basketball' ? (
                  <div className="flex flex-col gap-1 items-center">
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team1', -1); }}
                        className="w-6 h-6 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white/50 text-xs flex items-center justify-center"
                      >
                        −1
                      </button>
                      <div className="w-12 h-12 rounded-xl bg-[#080b10] border border-white/[0.06] flex items-center justify-center font-black text-xl text-white">
                        {matchState.team1Score}
                      </div>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team1', 1); }}
                        className="w-6 h-6 rounded bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] text-xs flex items-center justify-center font-bold"
                      >
                        +1
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team1', 2); }}
                        className="px-2 py-0.5 rounded bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] text-[9px] font-black"
                      >
                        +2
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team1', 3); }}
                        className="px-2 py-0.5 rounded bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 text-[#3b82f6] text-[9px] font-black"
                      >
                        +3
                      </button>
                    </div>
                  </div>
                ) : tournament?.sport === 'tennis' || tournament?.sport === 'volleyball' ? (
                  <div className="flex flex-col gap-1.5 items-center">
                    <div className="text-[9px] font-black tracking-wider text-white/40 uppercase">Set {matchState.hiep} Pts</div>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team1', -1); }}
                        className="w-6 h-6 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white/50 text-xs flex items-center justify-center"
                      >
                        −
                      </button>
                      <div className="w-10 h-10 rounded-lg bg-[#080b10] border border-white/[0.06] flex items-center justify-center font-bold text-sm text-white">
                        {matchState.team1SetPoints ?? 0}
                      </div>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team1', 1); }}
                        className="w-6 h-6 rounded bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] text-xs flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-[8px] font-semibold text-white/30 uppercase mt-1">Set Wins: {matchState.team1Score}</div>
                    <div className="flex gap-1">
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMatchState(prev => ({ ...prev, team1Score: Math.max(0, prev.team1Score - 1) })); }}
                        className="px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[8px]"
                      >
                        − Set
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMatchState(prev => ({ ...prev, team1Score: prev.team1Score + 1 })); }}
                        className="px-1.5 py-0.5 rounded bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-green-400 text-[8px]"
                      >
                        + Set
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team1', -1); }}
                      className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      −
                    </button>
                    <div className="w-12 h-12 rounded-xl bg-[#080b10] border border-white/[0.06] flex items-center justify-center font-black text-xl text-white">
                      {matchState.team1Score}
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team1', 1); }}
                      className="w-8 h-8 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 hover:bg-[#22c55e]/20 text-[#22c55e] flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}

                {/* Score Divider / Overview */}
                {tournament?.sport === 'tennis' || tournament?.sport === 'volleyball' ? (
                  <div className="flex flex-col items-center gap-0.5 justify-center min-w-[60px]">
                    <div className="text-2xl font-black text-[#22c55e] font-mono leading-none">
                      {matchState.team1Score} : {matchState.team2Score}
                    </div>
                    <div className="text-[8px] font-black text-white/30 uppercase tracking-widest mt-1">Sets</div>
                  </div>
                ) : (
                  <div className="text-xl font-bold text-white/20">vs</div>
                )}

                {/* Team 2 scoring area */}
                {tournament?.sport === 'basketball' ? (
                  <div className="flex flex-col gap-1 items-center">
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team2', -1); }}
                        className="w-6 h-6 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white/50 text-xs flex items-center justify-center"
                      >
                        −1
                      </button>
                      <div className="w-12 h-12 rounded-xl bg-[#080b10] border border-white/[0.06] flex items-center justify-center font-black text-xl text-white">
                        {matchState.team2Score}
                      </div>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team2', 1); }}
                        className="w-6 h-6 rounded bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] text-xs flex items-center justify-center font-bold"
                      >
                        +1
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team2', 2); }}
                        className="px-2 py-0.5 rounded bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] text-[9px] font-black"
                      >
                        +2
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team2', 3); }}
                        className="px-2 py-0.5 rounded bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 text-[#3b82f6] text-[9px] font-black"
                      >
                        +3
                      </button>
                    </div>
                  </div>
                ) : tournament?.sport === 'tennis' || tournament?.sport === 'volleyball' ? (
                  <div className="flex flex-col gap-1.5 items-center">
                    <div className="text-[9px] font-black tracking-wider text-white/40 uppercase">Set {matchState.hiep} Pts</div>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team2', -1); }}
                        className="w-6 h-6 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white/50 text-xs flex items-center justify-center"
                      >
                        −
                      </button>
                      <div className="w-10 h-10 rounded-lg bg-[#080b10] border border-white/[0.06] flex items-center justify-center font-bold text-sm text-white">
                        {matchState.team2SetPoints ?? 0}
                      </div>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team2', 1); }}
                        className="w-6 h-6 rounded bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] text-xs flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-[8px] font-semibold text-white/30 uppercase mt-1">Set Wins: {matchState.team2Score}</div>
                    <div className="flex gap-1">
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMatchState(prev => ({ ...prev, team2Score: Math.max(0, prev.team2Score - 1) })); }}
                        className="px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[8px]"
                      >
                        − Set
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMatchState(prev => ({ ...prev, team2Score: prev.team2Score + 1 })); }}
                        className="px-1.5 py-0.5 rounded bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-green-400 text-[8px]"
                      >
                        + Set
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team2', -1); }}
                      className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      −
                    </button>
                    <div className="w-12 h-12 rounded-xl bg-[#080b10] border border-white/[0.06] flex items-center justify-center font-black text-xl text-white">
                      {matchState.team2Score}
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleScoreChange('team2', 1); }}
                      className="w-8 h-8 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 hover:bg-[#22c55e]/20 text-[#22c55e] flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {/* Set Win Condition Banner */}
              {winnableTeam && !matchState.isFinished && (
                <div className="mb-6 p-4 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl flex items-center justify-between animate-pulse max-w-md mx-auto">
                  <span className="text-xs font-bold text-[#22c55e]">
                    {(winnableTeam === 'team1' ? team1?.name : team2?.name)} đủ điều kiện thắng Set {matchState.hiep}!
                  </span>
                  <button
                    type="button"
                    onClick={() => handleWinSet(winnableTeam)}
                    className="px-3 py-1.5 rounded bg-[#22c55e] text-black font-black text-[10px] hover:bg-[#16a34a] transition-all duration-200"
                  >
                    Xác nhận thắng Set
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-white/50 mb-6">
                <span>Bù giờ H{matchState.hiep}:</span>
                <input 
                  type="number"
                  min="0"
                  max="15"
                  value={matchState.buGio || 0}
                  onChange={(e) => setMatchState(prev => ({ ...prev, buGio: parseInt(e.target.value) || 0 }))}
                  className="w-12 px-1.5 py-1 rounded bg-[#080b10] border border-white/[0.08] text-center text-white text-xs focus:outline-none focus:border-[#22c55e]"
                />
                <span>phút</span>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStartStop(); }}
                  className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                    matchState.isRunning
                      ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                      : 'bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/20'
                  }`}
                >
                  {matchState.isRunning ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSaveScore(); }}
                  className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white font-bold text-xs transition-all"
                >
                  Lưu tỉ số
                </button>
                {!matchState.isFinished && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEndHalf(); }}
                    className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-bold text-xs transition-all"
                  >
                    {matchState.hiep === 1 ? '→ Kết thúc H1' : '🏁 Kết thúc trận'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trận chờ bắt đầu (Pending matches) */}
        {getPendingMatches().length > 0 && (
          <div className="mt-8 bg-[#0f1419] border border-white/[0.06] rounded-2xl p-8 max-w-2xl mx-auto shadow-2xl">
            <h3 className="text-sm font-black tracking-widest text-white/50 uppercase mb-6 pb-2 border-b border-white/[0.04]">
              Trận chờ bắt đầu
            </h3>
            
            <div className="space-y-4">
              {getPendingMatches().map((item: any) => {
                const pendingTeamA = resolveTeamRef(tournament, item.match.teamA);
                const pendingTeamB = resolveTeamRef(tournament, item.match.teamB);
                
                return (
                  <div key={item.matchIdx} className="flex flex-col items-center justify-between p-4 rounded-xl bg-[#080b10] border border-white/[0.04]">
                    <div className="flex items-center justify-center gap-4 text-xs text-white/70 mb-3 font-semibold">
                      <span>{pendingTeamA?.name}</span>
                      <span className="text-white/20">vs</span>
                      <span>{pendingTeamB?.name}</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStartPendingMatch(item.matchIdx); }}
                      className="px-4 py-2 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/20 font-black text-[10px] uppercase tracking-wider transition-all duration-200 flex items-center gap-1"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      Bắt đầu H1
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* QR Code Modal Overlay */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-[#080b10]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1419] border border-white/[0.08] p-8 rounded-2xl w-full max-w-sm text-center shadow-2xl relative">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowQrModal(false); }}
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
                type="button"
                onClick={(e) => handleCopyLink(e)}
                className="px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] text-xs font-black hover:bg-[#16a34a] transition-all duration-200"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

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
