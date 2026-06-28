'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchTournamentFromBackend } from '@/app/lib/tournaments';
import { getPusherClient } from '@/app/lib/pusher';
import { getApiBaseUrl, getSession } from '@/app/lib/authStorage';

interface ChatMsg {
  _id: string;
  tournamentId: string;
  userName: string;
  message: string;
  createdAt: string;
}

interface AnnouncementItem {
  _id: string;
  tournamentId: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'update';
  createdAt: string;
}

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
  activeMatches?: number[];
};

interface BracketMatchCardProps {
  a: string;
  b: string;
  sa: number | null;
  sb: number | null;
  done: boolean;
  isLive: boolean;
  winner?: string | null;
  matchKey: string;
  onSelect: (matchKey: string) => void;
}

function BracketMatchCard({ a, b, sa, sb, done, isLive, winner, matchKey, onSelect }: BracketMatchCardProps) {
  const winA = done && winner ? a === winner : (sa !== null && sb !== null && sa > sb);
  const winB = done && winner ? b === winner : (sa !== null && sb !== null && sb > sa);
  
  return (
    <div 
      onClick={() => onSelect(matchKey)}
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

      {/* Watch Live Button */}
      <button 
        onClick={() => onSelect(matchKey)}
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

function buildBracketData(tournament: any, onSelect: (matchKey: string) => void) {
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
    
    const mKey = `${roundIdx}-${matchIdx}`;
    const isLive = tournament.bracket?.currentRound === roundIdx && (tournament.bracket?.activeMatches || []).includes(matchIdx);
    
    const currentMS = tournament.matchStates?.[mKey];
    if (isLive && (!currentMS || !currentMS.isFinished)) return null;

    if (match) {
      if (match.isFinished && match.winner) return match.winner;
      if (match.isFinished && match.scoreA !== null && match.scoreB !== null) {
        return match.scoreA > match.scoreB ? match.teamA : match.teamB;
      }
      if (isLive && currentMS?.isFinished) {
        return currentMS.team1Score > currentMS.team2Score ? match.teamA : match.teamB;
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

      const mKey = `${r}-${m}`;
      const isLive = tournament.bracket?.currentRound === r && (tournament.bracket?.activeMatches || []).includes(m);
      
      const currentMS = tournament.matchStates?.[mKey];
      const isFinished = dbMatch ? !!dbMatch.isFinished : false;

      let scoreA: number | null = null;
      let scoreB: number | null = null;

      if (isLive && currentMS) {
        scoreA = currentMS.team1Score;
        scoreB = currentMS.team2Score;
      } else if (dbMatch) {
        scoreA = dbMatch.scoreA !== undefined ? dbMatch.scoreA : null;
        scoreB = dbMatch.scoreB !== undefined ? dbMatch.scoreB : null;
      }

      let winnerName: string | null = null;
      if (dbMatch?.winner?.name) {
        winnerName = dbMatch.winner.name;
      } else if (dbMatch?.winner?.id) {
        const found = tournament.teams?.find((t: any) => t.id === dbMatch.winner.id);
        if (found) winnerName = found.name;
      }

      const doneFlag = isFinished || (isLive && currentMS?.isFinished) || (!isLive && dbMatch?.isFinished);
      if (!winnerName && doneFlag && scoreA !== null && scoreB !== null) {
        if (scoreA > scoreB) winnerName = teamAObj?.name || null;
        else if (scoreB > scoreA) winnerName = teamBObj?.name || null;
        else winnerName = teamAObj?.name || null;
      }

      roundMatches.push({
        a: teamAObj?.name || '?',
        b: teamBObj?.name || '?',
        sa: scoreA,
        sb: scoreB,
        done: doneFlag,
        isLive: isLive && (!currentMS || !currentMS.isFinished),
        winner: winnerName,
        matchKey: mKey,
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

interface StandingRow {
  teamId: string;
  teamName: string;
  mp: number; // matches played
  w: number;  // wins
  d: number;  // draws
  l: number;  // losses
  gf: number; // goals for
  ga: number; // goals against
  gd: number; // goal difference
  pts: number; // points
}

function calculateGroupStandings(groupTeams: any[], groupMatches: any[], matchStates: any): StandingRow[] {
  const standings: Record<string, StandingRow> = {};

  groupTeams.forEach((team) => {
    if (team.id) {
      standings[team.id] = {
        teamId: team.id,
        teamName: team.name || '',
        mp: 0,
        w: 0,
        d: 0,
        l: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
      };
    }
  });

  const matchesArray = groupMatches || [];
  matchesArray.forEach((m) => {
    const mState = matchStates?.[m.id];
    const isFinished = m.isFinished || mState?.isFinished;
    if (!isFinished) return;

    const scoreA = mState ? mState.team1Score : (m.scoreA ?? 0);
    const scoreB = mState ? mState.team2Score : (m.scoreB ?? 0);
    const idA = m.teamA?.id;
    const idB = m.teamB?.id;

    if (idA && standings[idA]) {
      standings[idA].mp += 1;
      standings[idA].gf += scoreA;
      standings[idA].ga += scoreB;
      standings[idA].gd = standings[idA].gf - standings[idA].ga;
      if (scoreA > scoreB) {
        standings[idA].w += 1;
        standings[idA].pts += 1;
      } else if (scoreA === scoreB) {
        standings[idA].d += 1;
      } else {
        standings[idA].l += 1;
      }
    }

    if (idB && standings[idB]) {
      standings[idB].mp += 1;
      standings[idB].gf += scoreB;
      standings[idB].ga += scoreA;
      standings[idB].gd = standings[idB].gf - standings[idB].ga;
      if (scoreB > scoreA) {
        standings[idB].w += 1;
        standings[idB].pts += 1;
      } else if (scoreA === scoreB) {
        standings[idB].d += 1;
      } else {
        standings[idB].l += 1;
      }
    }
  });

  return Object.values(standings).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.teamName.localeCompare(b.teamName);
  });
}

function getPlacementPoints(rank: number | null): number {
  if (rank === null) return 0;
  if (rank === 1) return 10;
  if (rank === 2) return 6;
  if (rank === 3) return 5;
  if (rank === 4) return 4;
  if (rank === 5) return 3;
  if (rank === 6) return 2;
  if (rank === 7 || rank === 8) return 1;
  return 0;
}

function calculateBattleRoyaleStandings(teams: any[], matches: any[]) {
  const standings = teams.map((team: any) => {
    const teamId = team.id || team.name;
    let mp = 0;
    let placementPts = 0;
    let killPts = 0;

    matches?.forEach((match: any) => {
      if (match.isFinished) {
        const teamResult = match.results?.find((r: any) => (r.teamId === teamId || r.teamName === team.name));
        if (teamResult && teamResult.rank !== null) {
          mp += 1;
          placementPts += getPlacementPoints(teamResult.rank);
          killPts += teamResult.kills || 0;
        }
      }
    });

    return {
      teamId,
      teamName: team.name,
      mp,
      placementPts,
      killPts,
      totalPts: placementPts + killPts,
    };
  });

  return standings.sort((a: any, b: any) => {
    if (b.totalPts !== a.totalPts) {
      return b.totalPts - a.totalPts;
    }
    if (b.placementPts !== a.placementPts) {
      return b.placementPts - a.placementPts;
    }
    return a.teamName.localeCompare(b.teamName);
  });
}

interface LeagueStandingRow {
  teamId: string;
  teamName: string;
  teamLogo?: string;
  matchesPlayed: number;
  wins: number;
  totalKills: number;
  placementPoints: number;
  killPoints: number;
  totalPoints: number;
  currentRank: number;
  rankChange: number;
}

function calculateLeagueStandings(
  teams: any[],
  leagueMatches: any[],
  pointRules: Record<string, number>
): LeagueStandingRow[] {
  const standingsMap: Record<string, Omit<LeagueStandingRow, 'currentRank' | 'rankChange'>> = {};
  
  (teams || []).forEach(team => {
    if (team.id) {
      standingsMap[team.id] = {
        teamId: team.id,
        teamName: team.name || '',
        teamLogo: team.logo || '',
        matchesPlayed: 0,
        wins: 0,
        totalKills: 0,
        placementPoints: 0,
        killPoints: 0,
        totalPoints: 0
      };
    }
  });

  const finishedMatches = (leagueMatches || []).filter(m => 
    m.isFinished || (m.results && m.results.some((r: any) => (r.placement !== null && r.placement !== undefined && r.placement !== '') || (r.kills || 0) > 0 || r.pts !== undefined))
  );
  
  finishedMatches.forEach(match => {
    (match.results || []).forEach((res: any) => {
      const team = standingsMap[res.teamId];
      if (team) {
        if (match.isFinished || (res.placement !== null && res.placement !== undefined && res.placement !== '') || res.pts !== undefined) {
          team.matchesPlayed += 1;
        }
        team.totalKills += res.kills || 0;
        team.placementPoints += res.placementPoints || 0;
        team.killPoints += res.killPoints || 0;
        team.totalPoints += res.totalPoints || res.pts || 0;
        if (res.placement === 1) {
          team.wins += 1;
        }
      }
    });
  });

  const sortStandings = (arr: Omit<LeagueStandingRow, 'currentRank' | 'rankChange'>[]) => {
    return [...arr].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints;
      if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.teamName.localeCompare(b.teamName);
    });
  };

  const currentSorted = sortStandings(Object.values(standingsMap));
  const currentLeaderboard = currentSorted.map((item, idx) => ({
    ...item,
    currentRank: idx + 1,
    rankChange: 0
  }));

  if (finishedMatches.length > 1) {
    const prevStandingsMap: Record<string, Omit<LeagueStandingRow, 'currentRank' | 'rankChange'>> = {};
    (teams || []).forEach(t => {
      if (t.id) {
        prevStandingsMap[t.id] = {
          teamId: t.id,
          teamName: t.name || '',
          matchesPlayed: 0,
          wins: 0,
          totalKills: 0,
          placementPoints: 0,
          killPoints: 0,
          totalPoints: 0
        };
      }
    });

    finishedMatches.slice(0, -1).forEach(match => {
      (match.results || []).forEach((res: any) => {
        const team = prevStandingsMap[res.teamId];
        if (team) {
          if (match.isFinished || (res.placement !== null && res.placement !== undefined && res.placement !== '') || res.pts !== undefined) {
            team.matchesPlayed += 1;
          }
          team.totalKills += res.kills || 0;
          team.placementPoints += res.placementPoints || 0;
          team.killPoints += res.killPoints || 0;
          team.totalPoints += res.totalPoints || res.pts || 0;
          if (res.placement === 1) {
            team.wins += 1;
          }
        }
      });
    });

    const prevSorted = sortStandings(Object.values(prevStandingsMap));
    const prevRanks: Record<string, number> = {};
    prevSorted.forEach((item, idx) => {
      prevRanks[item.teamId] = idx + 1;
    });

    currentLeaderboard.forEach(row => {
      const prevRank = prevRanks[row.teamId];
      if (prevRank) {
        row.rankChange = prevRank - row.currentRank;
      }
    });
  }

  return currentLeaderboard;
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

function reconcileMatchStates(prevMatchStates: any, nextMatchStates: any) {
  if (!nextMatchStates) return nextMatchStates;
  if (!prevMatchStates) return nextMatchStates;
  
  const reconciled = { ...nextMatchStates };
  Object.keys(reconciled).forEach(key => {
    const nextMs = reconciled[key];
    const prevMs = prevMatchStates[key];
    
    if (nextMs.isRunning && !nextMs.isFinished && prevMs) {
      const fetchedTime = nextMs.time || 0;
      const diff = prevMs.time - fetchedTime;
      if (diff >= 0 && diff <= 5) {
        reconciled[key] = {
          ...nextMs,
          time: prevMs.time
        };
      }
    }
  });
  
  return reconciled;
}

const getYoutubeEmbedUrl = (url: string) => {
  if (!url) return '';
  let videoId = '';
  const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s\?]+)/);
  if (watchMatch && watchMatch[1]) {
    videoId = watchMatch[1];
  } else {
    videoId = url;
  }
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
};

const getTwitchEmbedUrl = (url: string) => {
  if (!url) return '';
  let channel = '';
  const match = url.match(/(?:twitch\.tv\/)([^&\s\?\/]+)/);
  if (match && match[1]) {
    channel = match[1];
  } else {
    channel = url;
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `https://player.twitch.tv/?channel=${channel}&parent=${host}&autoplay=true`;
};

export default function TournamentLiveViewPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<any>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);
  const [activeDeTab, setActiveDeTab] = useState<'upper' | 'lower' | 'grand'>('upper');
  const [activeLeagueTab, setActiveLeagueTab] = useState<'leaderboard' | 'matches' | 'stats'>('leaderboard');
  const [selectedLeagueMatchId, setSelectedLeagueMatchId] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatUserName, setChatUserName] = useState('');
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [unreadChat, setUnreadChat] = useState(0);

  // Announcements state
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  // Registration state
  const [showRegModal, setShowRegModal] = useState(false);
  const [regTeamName, setRegTeamName] = useState('');
  const [regTeamLogo, setRegTeamLogo] = useState('');
  const [regLogoPreview, setRegLogoPreview] = useState<string | null>(null);
  const [isRegLogoUploading, setIsRegLogoUploading] = useState(false);
  const [regLogoUploadError, setRegLogoUploadError] = useState<string | null>(null);
  const [regMembers, setRegMembers] = useState<{ name: string; image?: string | null; imagePreview?: string | null; isUploading?: boolean; uploadError?: string | null }[]>([{ name: '', image: null, imagePreview: null, isUploading: false, uploadError: null }]);
  const [regError, setRegError] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  const handleRegLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setRegLogoUploadError('Kích thước ảnh tối đa là 5MB');
      return;
    }

    setIsRegLogoUploading(true);
    setRegLogoUploadError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setRegLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dt6uoyt1t';
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ml_default';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Không thể tải ảnh lên server Cloudinary');
      }

      const responseData = await response.json();
      if (responseData.secure_url) {
        setRegTeamLogo(responseData.secure_url);
      } else {
        throw new Error('Không nhận được URL ảnh từ Cloudinary');
      }
    } catch (err: any) {
      console.error('Lỗi upload Cloudinary:', err);
      setRegLogoUploadError(err.message || 'Lỗi khi tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setIsRegLogoUploading(false);
    }
  };

  const handleRemoveRegLogo = () => {
    setRegTeamLogo('');
    setRegLogoPreview(null);
    setRegLogoUploadError(null);
  };

  const handleRegisterTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regTeamName.trim()) {
      setRegError('Tên đội không được để trống');
      return;
    }
    const filledMembers = regMembers.filter(m => m.name.trim());
    if (filledMembers.length === 0) {
      setRegError('Vui lòng thêm ít nhất 1 thành viên');
      return;
    }
    
    // Check if any member image or team logo is still uploading
    if (regMembers.some(m => m.isUploading) || isRegLogoUploading) {
      setRegError('Vui lòng đợi quá trình tải ảnh đại diện hoặc logo hoàn tất');
      return;
    }

    setRegSubmitting(true);
    setRegError('');
    try {
      const formattedMembers = filledMembers.map(m => ({
        name: m.name.trim(),
        image: m.image || null,
        position: 'Thành viên'
      }));

      const res = await fetch(`${getApiBaseUrl()}/tournaments/${tournamentId}/register-team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamName: regTeamName,
          logo: regTeamLogo || null,
          members: formattedMembers,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRegSuccess(true);
        setTimeout(() => {
          setShowRegModal(false);
          setRegSuccess(false);
          setRegTeamName('');
          setRegTeamLogo('');
          setRegLogoPreview(null);
          setRegLogoUploadError(null);
          setRegMembers([{ name: '', image: null, imagePreview: null, isUploading: false, uploadError: null }]);
        }, 2000);
      } else {
        setRegError(data.message || 'Có lỗi xảy ra khi gửi đăng ký');
      }
    } catch (err) {
      console.error('Error registering team:', err);
      setRegError('Lỗi kết nối mạng, vui lòng thử lại');
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleAddRegMember = () => {
    setRegMembers(prev => [...prev, { name: '', image: null, imagePreview: null, isUploading: false, uploadError: null }]);
  };

  const handleRemoveRegMember = (index: number) => {
    if (regMembers.length <= 1) return;
    setRegMembers(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleRegMemberNameChange = (index: number, value: string) => {
    setRegMembers(prev => prev.map((m, idx) => idx === index ? { ...m, name: value } : m));
  };

  const handleRegMemberImageChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh tối đa là 5MB');
      return;
    }

    setRegMembers(prev => prev.map((m, idx) => {
      if (idx === index) {
        return {
          ...m,
          isUploading: true,
          uploadError: null,
          imagePreview: URL.createObjectURL(file)
        };
      }
      return m;
    }));

    try {
      const cloudName = 'dt6uoyt1t';
      const uploadPreset = 'ml_default';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Không thể tải ảnh lên');
      }

      const responseData = await response.json();
      if (responseData.secure_url) {
        setRegMembers(prev => prev.map((m, idx) => {
          if (idx === index) {
            return {
              ...m,
              image: responseData.secure_url,
              imagePreview: responseData.secure_url,
              isUploading: false
            };
          }
          return m;
        }));
      } else {
        throw new Error('Không nhận được URL ảnh');
      }
    } catch (err: any) {
      console.error('Error uploading member avatar:', err);
      setRegMembers(prev => prev.map((m, idx) => {
        if (idx === index) {
          return {
            ...m,
            isUploading: false,
            image: null,
            imagePreview: null,
            uploadError: 'Không thể tải ảnh'
          };
        }
        return m;
      }));
    }
  };

  const handleRemoveRegMemberImage = (index: number) => {
    setRegMembers(prev => prev.map((m, idx) => {
      if (idx === index) {
        return {
          ...m,
          image: null,
          imagePreview: null,
          uploadError: null
        };
      }
      return m;
    }));
  };

  useEffect(() => {
    if (tournament && (tournament.format === 'league' || tournament.format === 'battle_royale') && !selectedLeagueMatchId) {
      const matchesList = tournament.leagueMatches || tournament.matches || [];
      const activeMatch = matchesList.find((m: any) => !m.isFinished);
      if (activeMatch) {
        setSelectedLeagueMatchId(activeMatch.id);
      } else if (matchesList.length > 0) {
        setSelectedLeagueMatchId(matchesList[0].id);
      }
    }
  }, [tournament, selectedLeagueMatchId]);

  useEffect(() => {
    if (tournament && (tournament.format === 'league' || tournament.format === 'battle_royale') && selectedLeagueMatchId) {
      setSelectedMatchKey(selectedLeagueMatchId);
    }
  }, [selectedLeagueMatchId, tournament]);

  const [viewerStream, setViewerStream] = useState<MediaStream | null>(null);
  const [isViewerConnecting, setIsViewerConnecting] = useState(false);
  const [viewerConnectionError, setViewerConnectionError] = useState<string | null>(null);
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);
  const viewerVideoRef = useRef<HTMLVideoElement | null>(null);
  const spectatorPeerIdRef = useRef<string>('');
  const viewerIceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const selectedMatchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    selectedMatchKeyRef.current = selectedMatchKey;
  }, [selectedMatchKey]);

  // ======== CHAT: Fetch + Pusher subscribe ========
  const fetchChatMessages = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/tournaments/${tournamentId}/chat`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (err) { console.error('Error fetching chat:', err); }
  }, [tournamentId]);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/tournaments/${tournamentId}/announcements`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch (err) { console.error('Error fetching announcements:', err); }
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;
    fetchChatMessages();
    fetchAnnouncements();
  }, [tournamentId, fetchChatMessages, fetchAnnouncements]);

  // Subscribe to Pusher chat + announcement events
  useEffect(() => {
    if (!tournamentId) return;
    const pusher = getPusherClient();
    if (!pusher) return;
    const channel = pusher.subscribe(String(tournamentId));

    const handleChatMsg = (data: ChatMsg) => {
      setChatMessages(prev => [...prev.slice(-99), data]);
      setUnreadChat(prev => prev + 1);
    };
    const handleAnnouncement = (data: AnnouncementItem) => {
      setAnnouncements(prev => [data, ...prev].slice(0, 20));
    };

    channel.bind('chat_message', handleChatMsg);
    channel.bind('new_announcement', handleAnnouncement);

    return () => {
      channel.unbind('chat_message', handleChatMsg);
      channel.unbind('new_announcement', handleAnnouncement);
    };
  }, [tournamentId]);

  useEffect(() => {
    if (showChatPanel) {
      setUnreadChat(0);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showChatPanel, chatMessages]);

  // Restore saved chat username
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ts_chat_username');
      if (saved) setChatUserName(saved);
    }
  }, []);

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    if (!chatUserName.trim()) {
      setShowNamePrompt(true);
      return;
    }
    setChatSending(true);
    try {
      await fetch(`${getApiBaseUrl()}/tournaments/${tournamentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: chatUserName.trim(), message: chatInput.trim() }),
      });
      setChatInput('');
    } catch (err) { console.error('Error sending chat:', err); }
    setChatSending(false);
  };

  const handleSaveChatName = () => {
    if (chatUserName.trim()) {
      localStorage.setItem('ts_chat_username', chatUserName.trim());
      setShowNamePrompt(false);
    }
  };


  const sendSignalingMessage = async (mKey: string, payload: any) => {
    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/tournaments/${tournamentId}/signaling`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Lỗi gửi WebRTC signaling:', err);
    }
  };

  const startWebcamViewer = async (mKey: string) => {
    setViewerConnectionError(null);
    setIsViewerConnecting(true);
    setViewerStream(null);
    viewerIceQueueRef.current = [];
    
    const peerId = Math.random().toString(36).substring(7);
    spectatorPeerIdRef.current = peerId;
    
    if (viewerPcRef.current) {
      viewerPcRef.current.close();
    }
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });
    viewerPcRef.current = pc;
    
    pc.ontrack = (event) => {
      console.log('Nhận track video/audio từ trọng tài:', event.streams[0]);
      if (event.streams && event.streams[0]) {
        setViewerStream(event.streams[0]);
        setIsViewerConnecting(false);
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setViewerConnectionError('Kết nối với trọng tài bị gián đoạn.');
        setIsViewerConnecting(false);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && spectatorPeerIdRef.current) {
        sendSignalingMessage(mKey, {
          type: 'ice-candidate',
          peerId: spectatorPeerIdRef.current,
          candidate: event.candidate,
          matchKey: mKey,
          sender: 'spectator'
        });
      }
    };
    
    await sendSignalingMessage(mKey, {
      type: 'join',
      peerId,
      matchKey: mKey,
      sender: 'spectator'
    });
  };

  const activeStreamDetails = getSelectedMatchDetails();
  const activeStreamType = activeStreamDetails?.streamType || null;
  const activeStreamUrl = activeStreamDetails?.streamUrl || '';
  const activeIsLive = activeStreamDetails?.isLive || false;

  useEffect(() => {
    if (selectedMatchKey && activeStreamType === 'webcam' && activeIsLive) {
      startWebcamViewer(selectedMatchKey);
    } else {
      if (viewerPcRef.current) {
        viewerPcRef.current.close();
        viewerPcRef.current = null;
      }
      setViewerStream(null);
      setIsViewerConnecting(false);
    }
    
    return () => {
      if (viewerPcRef.current) {
        viewerPcRef.current.close();
        viewerPcRef.current = null;
      }
    };
  }, [selectedMatchKey, activeStreamType, activeStreamUrl, activeIsLive]);

  useEffect(() => {
    if (viewerStream && viewerVideoRef.current) {
      viewerVideoRef.current.srcObject = viewerStream;
    }
  }, [viewerStream]);

  useEffect(() => {
    const loadTournament = async () => {
      let loadedTournament = null;
      try {
        const data = await fetchTournamentFromBackend(tournamentId);
        if (data) {
          loadedTournament = data;
        }
      } catch (err) {
        console.error('Error fetching tournament from backend, fallback to local storage:', err);
      }

      if (!loadedTournament) {
        const session = getSession();
        const tournamentsKey = session ? `tournaments_${session.id}` : 'tournaments';
        const currentTournamentKey = session ? `currentTournament_${session.id}` : 'currentTournament';
        
        const savedList = localStorage.getItem(tournamentsKey);
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
      }

      if (loadedTournament) {
        const migrated = migrateTournamentData(loadedTournament);
        setTournament(migrated);
        
        const link = `${window.location.origin}/tournaments/${tournamentId}/live`;
        setShareLink(link);
        setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`);
      }
    };

    loadTournament();

    const pusher = getPusherClient();
    let channel: any = null;

    if (pusher) {
      channel = pusher.subscribe(tournamentId);

      channel.bind("tournament_updated", (data: any) => {
        console.log("Pusher received tournament update:", data);
        const migrated = migrateTournamentData(data);
        
        // Reconcile timers to prevent jumping UI
        setTournament((prev: any) => {
          if (prev && prev.matchStates && migrated.matchStates) {
            migrated.matchStates = reconcileMatchStates(prev.matchStates, migrated.matchStates);
          }
          return migrated;
        });
      });

      channel.bind("match_signaling", async (data: any) => {
        if (data.matchKey !== selectedMatchKeyRef.current) return;
        if (data.peerId !== spectatorPeerIdRef.current) return;
        if (data.sender === 'spectator') return;
        
        const { type, sdp, candidate } = data;
        const pc = viewerPcRef.current;
        if (!pc) return;
        
        if (type === 'offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            await sendSignalingMessage(selectedMatchKeyRef.current!, {
              type: 'answer',
              peerId: spectatorPeerIdRef.current,
              sdp: answer,
              matchKey: selectedMatchKeyRef.current!,
              sender: 'spectator'
            });
            
            // Process queued candidates
            const queue = viewerIceQueueRef.current;
            for (const cand of queue) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.error("Lỗi addIceCandidate spectator queue:", e);
              }
            }
            viewerIceQueueRef.current = [];
          } catch (err) {
            console.error("Lỗi setRemoteDescription/createAnswer spectator:", err);
          }
        } else if (type === 'ice-candidate') {
          if (candidate) {
            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } else {
                viewerIceQueueRef.current.push(candidate);
              }
            } catch (e) {
              console.error("Lỗi addIceCandidate spectator:", e);
            }
          }
        }
      });
    }

    return () => {
      if (pusher && channel) {
        channel.unbind("tournament_updated");
        channel.unbind("match_signaling");
        pusher.unsubscribe(tournamentId);
      }
    };
  }, [tournamentId]);

  useEffect(() => {
    // Timer is disabled for Esports
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Đã copy link vào clipboard!');
  };

  const handleSelectMatch = (matchKey: string) => {
    setSelectedMatchKey(matchKey);
  };

  const getMatchLabel = (key: string | null) => {
    if (!key) return '';
    const parts = key.split('-');
    if (key.startsWith('league-') || key.startsWith('m-') || key.startsWith('br-')) {
      const matchesList = tournament.leagueMatches || tournament.matches || [];
      const m = matchesList.find((x: any) => x.id === key);
      return m?.name || 'Trận đấu';
    }
    if (key.startsWith('g-')) {
      const gIdx = parseInt(parts[1], 10) || 0;
      const mIdx = parseInt(parts[2], 10) || 0;
      const groupName = tournament.groups?.[gIdx]?.name || String.fromCharCode(65 + gIdx);
      return `Bảng ${groupName} • Trận ${mIdx + 1}`;
    }
    if (key.startsWith('u-')) {
      const rIdx = parseInt(parts[1], 10) || 0;
      const mIdx = parseInt(parts[2], 10) || 0;
      return `Nhánh Thắng - Vòng ${rIdx + 1} • Trận ${mIdx + 1}`;
    }
    if (key.startsWith('l-')) {
      const rIdx = parseInt(parts[1], 10) || 0;
      const mIdx = parseInt(parts[2], 10) || 0;
      return `Nhánh Thua - Vòng ${rIdx + 1} • Trận ${mIdx + 1}`;
    }
    if (key.startsWith('gf-')) {
      const mIdx = parseInt(parts[1], 10) || 0;
      return mIdx === 0 ? 'Chung Kết Tổng - Trận 1' : 'Chung Kết Tổng - Trận Reset';
    }

    const rIdx = parseInt(parts[0], 10) || 0;
    const mIdx = parseInt(parts[1], 10) || 0;
    const numTeams = getFallbackTeams(tournament).length;
    const numRounds = Math.ceil(Math.log2(numTeams || 2));
    return `${getRoundLabel(rIdx, numRounds)} • Trận ${mIdx + 1}`;
  };

  function getSelectedMatchDetails() {
    if (!selectedMatchKey || !tournament) return null;
    
    let dbMatch = null;
    let isGroup = false;
    let isUpper = false;
    let isLower = false;
    let isGF = false;
    let roundIndex = 0;
    let matchIndex = 0;

    if (selectedMatchKey.startsWith('league-') || selectedMatchKey.startsWith('m-') || selectedMatchKey.startsWith('br-')) {
      const matchesList = tournament.leagueMatches || tournament.matches || [];
      dbMatch = matchesList.find((m: any) => m.id === selectedMatchKey);
      if (!dbMatch) return null;

      const liveState = tournament.matchStates?.[selectedMatchKey];
      const isLive = !dbMatch.isFinished && !!liveState?.isRunning;
      const isFinished = dbMatch.isFinished || !!liveState?.isFinished;

      return {
        team1: null,
        team2: null,
        scoreA: null,
        scoreB: null,
        time: 0,
        hiep: 1,
        team1SetPoints: null,
        team2SetPoints: null,
        isLive,
        isFinished,
        dbMatch,
        streamType: liveState ? (liveState.streamType || null) : (dbMatch.streamType || null),
        streamUrl: liveState ? (liveState.streamUrl || '') : (dbMatch.streamUrl || ''),
      };
    }

    if (selectedMatchKey.startsWith('g-')) {
      const parts = selectedMatchKey.split('-');
      roundIndex = parseInt(parts[1], 10);
      matchIndex = parseInt(parts[2], 10);
      dbMatch = tournament.groups?.[roundIndex]?.matches?.[matchIndex];
      isGroup = true;
    } else if (selectedMatchKey.startsWith('u-')) {
      const parts = selectedMatchKey.split('-');
      roundIndex = parseInt(parts[1], 10);
      matchIndex = parseInt(parts[2], 10);
      dbMatch = tournament.bracket?.upperRounds?.[roundIndex]?.[matchIndex];
      isUpper = true;
    } else if (selectedMatchKey.startsWith('l-')) {
      const parts = selectedMatchKey.split('-');
      roundIndex = parseInt(parts[1], 10);
      matchIndex = parseInt(parts[2], 10);
      dbMatch = tournament.bracket?.lowerRounds?.[roundIndex]?.[matchIndex];
      isLower = true;
    } else if (selectedMatchKey.startsWith('gf-')) {
      const parts = selectedMatchKey.split('-');
      matchIndex = parseInt(parts[1], 10);
      dbMatch = tournament.bracket?.grandFinal?.[matchIndex];
      isGF = true;
    } else {
      const parts = selectedMatchKey.split('-');
      roundIndex = parseInt(parts[0], 10);
      matchIndex = parseInt(parts[1], 10);
      dbMatch = tournament.bracket?.rounds?.[roundIndex]?.[matchIndex];
    }

    if (!dbMatch) return null;

    const mKey = selectedMatchKey;
    const liveState = tournament.matchStates?.[mKey];
    
    let isLive = false;
    if (isGroup) {
      isLive = !!liveState?.isRunning && !liveState?.isFinished;
    } else if (isUpper || isLower || isGF) {
      isLive = (tournament.bracket?.activeMatches || []).includes(matchIndex) && 
               ((isUpper && mKey.startsWith('u-')) || (isLower && mKey.startsWith('l-')) || (isGF && mKey.startsWith('gf-')));
    } else {
      isLive = tournament.bracket?.currentRound === roundIndex && (tournament.bracket?.activeMatches || []).includes(matchIndex);
    }

    const isFinished = dbMatch.isFinished || !!liveState?.isFinished;

    const teamA = resolveTeamRef(tournament, dbMatch.teamA) || dbMatch.teamA;
    const teamB = resolveTeamRef(tournament, dbMatch.teamB) || dbMatch.teamB;

    let scoreA = null;
    let scoreB = null;
    let time = 0;
    let hiep = 1;
    let team1SetPoints = null;
    let team2SetPoints = null;

    if (isLive && liveState) {
      scoreA = liveState.team1Score;
      scoreB = liveState.team2Score;
      time = liveState.time;
      hiep = liveState.hiep;
      team1SetPoints = liveState.team1SetPoints ?? 0;
      team2SetPoints = liveState.team2SetPoints ?? 0;
    } else {
      scoreA = liveState ? liveState.team1Score : dbMatch.scoreA;
      scoreB = liveState ? liveState.team2Score : dbMatch.scoreB;
      time = liveState ? liveState.time : (dbMatch.time || 0);
      hiep = liveState ? liveState.hiep : (dbMatch.hiep || 1);
      team1SetPoints = liveState ? (liveState.team1SetPoints ?? null) : (dbMatch.team1SetPoints ?? null);
      team2SetPoints = liveState ? (liveState.team2SetPoints ?? null) : (dbMatch.team2SetPoints ?? null);
    }
    const streamType = liveState ? liveState.streamType : (dbMatch.streamType || null);
    const streamUrl = liveState ? liveState.streamUrl : (dbMatch.streamUrl || '');

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
      streamType,
      streamUrl,
    };
  };

  if (!tournament || (!tournament.bracketSeeded && !tournament.isPublicRegistration)) {
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

  const getTournamentWinnerName = () => {
    if (!tournament) return null;
    if (tournament.format === 'league' || tournament.format === 'battle_royale') {
      const matchesList = tournament.leagueMatches || tournament.matches || [];
      const allFinished = matchesList.length > 0 && matchesList.every((m: any) => m.isFinished);
      if (!allFinished) return null;
      const standings = calculateLeagueStandings(tournament.teams, matchesList, tournament.pointRules || {});
      if (standings.length > 0) {
        return standings[0].teamName;
      }
      return null;
    }
    if (!tournament.bracket || !tournament.bracket.isFinished) return null;
    const rounds = tournament.bracket.rounds;
    if (!rounds || rounds.length === 0) return null;
    const finalRound = rounds[rounds.length - 1];
    if (!finalRound || finalRound.length === 0) return null;
    const finalMatch = finalRound[0];
    if (!finalMatch || !finalMatch.isFinished) return null;
    return finalMatch.winner?.name || null;
  };
  const tournamentWinnerName = getTournamentWinnerName();

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
          {/* Chat toggle */}
          <button
            onClick={() => setShowChatPanel(!showChatPanel)}
            className="relative px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white text-xs font-bold transition-all duration-200 flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Chat
            {unreadChat > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unreadChat > 9 ? '9+' : unreadChat}</span>
            )}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-16">

        {/* Announcements Section */}
        {announcements.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-black tracking-widest text-white/50 uppercase mb-4 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#22c55e]"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              Thông báo
            </h3>
            <div className="space-y-3">
              {announcements.slice(0, 5).map((ann) => (
                <div key={ann._id} className={`p-4 rounded-xl border transition-all ${
                  ann.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
                  ann.type === 'update' ? 'bg-blue-500/5 border-blue-500/20' :
                  'bg-[#22c55e]/5 border-[#22c55e]/20'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-black uppercase tracking-wider ${
                      ann.type === 'warning' ? 'text-amber-400' :
                      ann.type === 'update' ? 'text-blue-400' :
                      'text-[#22c55e]'
                    }`}>
                      {ann.type === 'warning' ? '⚠️' : ann.type === 'update' ? '🔄' : 'ℹ️'} {ann.title}
                    </span>
                    <span className="text-[10px] text-white/30 ml-auto">
                      {new Date(ann.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">{ann.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {tournamentWinnerName && (
          <div className="mb-12 p-8 rounded-2xl bg-gradient-to-r from-yellow-500/10 via-amber-500/15 to-yellow-500/10 border border-yellow-500/30 text-center shadow-[0_0_30px_rgba(234,179,8,0.2)] relative overflow-hidden animate-pulse">
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="text-4xl animate-bounce">👑🏆👑</div>
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 tracking-wider uppercase drop-shadow-[0_0_8px_rgba(250,204,21,0.25)]">
                Nhà vô địch giải đấu
              </h2>
              <p className="text-4xl font-extrabold text-white mt-1 drop-shadow-md">
                {tournamentWinnerName}
              </p>
              <div className="h-[2px] w-32 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent my-2" />
              <p className="text-xs text-yellow-500/70 font-bold uppercase tracking-widest">
                Chúc mừng nhà vô địch đã chiến thắng giải đấu!
              </p>
            </div>
          </div>
        )}

        {/* Bracket Tree View / Registration View */}
        <div className="w-full">
          {!tournament.bracketSeeded && tournament.isPublicRegistration ? (
            <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
              {/* Registration Header Banner */}
              <div className="p-8 rounded-2xl bg-[#0f1419] border border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#22c55e]/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="space-y-2 text-center md:text-left relative z-10">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] text-[10px] font-black uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                    Đăng ký trực tuyến đang mở
                  </span>
                  <h2 className="text-2xl font-black text-white">Hãy đăng ký đội tham gia ngay!</h2>
                  <p className="text-xs text-white/50">
                    Số lượng đội hiện tại: <span className="text-white font-bold">{(tournament.teams || []).length} / {tournament.maxTeams || 8}</span>
                  </p>
                </div>

                {tournament.registrationOpen && (tournament.teams || []).length < (tournament.maxTeams || 8) ? (
                  <button
                    onClick={() => setShowRegModal(true)}
                    className="relative z-10 px-6 py-3.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-[#080b10] font-black uppercase text-xs tracking-wider transition-all duration-200 shadow-lg shadow-[#22c55e]/10 hover:shadow-[#22c55e]/20 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Đăng ký đội của bạn
                  </button>
                ) : (
                  <span className="px-5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/40 text-xs font-bold uppercase tracking-wider">
                    Đã đóng đăng ký
                  </span>
                )}
              </div>

              {/* Registered Teams List */}
              <div className="space-y-4">
                <h3 className="text-sm font-black tracking-widest text-white/50 uppercase border-b border-white/[0.04] pb-3 flex items-center justify-between">
                  <span>Danh sách đội tham gia ({ (tournament.teams || []).length })</span>
                  <span className="text-xs text-white/30 lowercase font-normal">cập nhật tự động (real-time)</span>
                </h3>

                {(tournament.teams || []).length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-white/[0.04]">
                    <p className="text-sm text-white/30">Chưa có đội nào đăng ký. Hãy là đội đầu tiên đăng ký!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(tournament.teams || []).map((team: any, idx: number) => {
                      const initials = team.name.slice(0, 2).toUpperCase();
                      const isEven = idx % 2 === 0;
                      const avatarBg = isEven
                        ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/30 text-[#22c55e]'
                        : 'bg-gradient-to-br from-blue-500/20 to-indigo-500/30 text-blue-400';

                      return (
                        <div key={team.id} className="p-5 rounded-2xl bg-[#0f1419] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 flex items-start gap-4">
                          {team.logo ? (
                            <img
                              src={team.logo}
                              className="w-12 h-12 rounded-xl object-cover border border-white/[0.06] flex-shrink-0"
                              alt={team.name}
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm tracking-tight ${avatarBg} border border-white/[0.06] flex-shrink-0`}>
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0 space-y-2">
                            <h4 className="font-extrabold text-white text-base truncate">{team.name}</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {team.members && team.members.length > 0 ? (
                                team.members.map((m: any) => (
                                  <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/60 text-[10px] font-semibold">
                                    {m.image ? (
                                      <img src={m.image} className="w-4.5 h-4.5 rounded-md object-cover flex-shrink-0 border border-white/[0.08]" alt={m.name} />
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
                )}
              </div>
            </div>
          ) : tournament.format === 'battle_royale' || tournament.format === 'league' ? (
            <div className="space-y-12 animate-fade-in">
              {/* Split layout: Leaderboard on Left, Matches on Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* LEFT COLUMN: Leaderboard (5/12 columns) */}
                <div className="lg:col-span-5 bg-[#0f1419] border border-white/[0.06] rounded-2xl p-5 space-y-5 shadow-lg">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <h3 className="text-sm font-black tracking-widest text-[#22c55e] uppercase">
                      Bảng Xếp Hạng Real-time
                    </h3>
                    <span className="text-[9px] text-white/30 uppercase font-black tracking-wider">
                      {tournament.format === 'battle_royale' ? 'PUBG Scoring' : 'League Stats'}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-white/40">
                          <th className="py-2.5 px-2 text-center w-10">Hạng</th>
                          <th className="py-2.5 px-2">Đội tuyển</th>
                          {tournament.format === 'battle_royale' && (
                            <>
                              <th className="py-2.5 px-1 text-center font-bold text-white">Điểm Hạng</th>
                              <th className="py-2.5 px-1 text-center font-bold text-white">Điểm Kill</th>
                            </>
                          )}
                          <th className="py-2.5 px-2 text-center font-bold text-white">Tổng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculateLeagueStandings(
                          tournament.teams,
                          tournament.leagueMatches || tournament.matches || [],
                          tournament.pointRules || {}
                        ).map((row, idx) => {
                          const isTop3 = idx < 3;
                          const rankColor = idx === 0 ? 'text-yellow-400 bg-yellow-400/10' : idx === 1 ? 'text-gray-300 bg-gray-300/10' : idx === 2 ? 'text-amber-600 bg-amber-600/10' : 'text-white/40';
                          const medal = idx === 0 ? '👑 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `${idx + 1}`;

                          return (
                            <tr
                              key={row.teamId}
                              className={`border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors ${
                                isTop3 ? 'bg-white/[0.005]' : ''
                              }`}
                            >
                              <td className="py-2.5 px-2 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-black ${rankColor}`}>
                                  {medal}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 font-bold text-white flex items-center gap-2 min-w-[100px] max-w-[160px]">
                                {row.teamLogo ? (
                                  <img
                                    src={row.teamLogo}
                                    className="w-6 h-6 rounded-full object-cover border border-white/10 flex-shrink-0"
                                    alt={row.teamName}
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/30 text-[#22c55e] border border-white/[0.06] flex items-center justify-center font-bold text-[9px] flex-shrink-0">
                                    {row.teamName.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <span className="truncate flex-1">{row.teamName}</span>
                                {row.rankChange > 0 && (
                                  <span className="text-green-500 text-[8px] flex items-center font-black">
                                    ▲{row.rankChange}
                                  </span>
                                )}
                                {row.rankChange < 0 && (
                                  <span className="text-red-500 text-[8px] flex items-center font-black">
                                    ▼{Math.abs(row.rankChange)}
                                  </span>
                                )}
                              </td>
                              {tournament.format === 'battle_royale' && (
                                <>
                                  <td className="py-2.5 px-1 text-center font-medium text-blue-400">{row.placementPoints}</td>
                                  <td className="py-2.5 px-1 text-center font-medium text-red-400">{row.killPoints}</td>
                                </>
                              )}
                              <td className="py-2.5 px-2 text-center font-black text-[#22c55e] text-xs bg-[#22c55e]/5">
                                {row.totalPoints}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT COLUMN: Stream Player & Match Results (7/12 columns) */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Match Selection Row (compact inline selector) */}
                  <div className="bg-[#0f1419] border border-white/[0.06] rounded-2xl p-4 space-y-3 shadow-lg">
                    <span className="text-[10px] font-black tracking-widest text-white/40 uppercase block text-center">
                      Chọn Trận Đấu Đang Chiếu
                    </span>
                    <div className="flex gap-2 overflow-x-auto pb-1 justify-center">
                      {(tournament.leagueMatches || tournament.matches || []).map((m: any) => {
                        const isSelected = selectedLeagueMatchId === m.id;
                        const liveState = tournament.matchStates?.[m.id];
                        const hasStream = m.streamUrl || liveState?.streamUrl;
                        const isFinished = m.isFinished || liveState?.isFinished;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedLeagueMatchId(m.id)}
                            className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all duration-200 flex items-center gap-2 shrink-0 ${
                              isSelected
                                ? 'border-[#22c55e] bg-[#22c55e]/10 text-white shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                                : 'border-white/[0.06] bg-[#080b10] hover:border-white/[0.12] text-white/60 hover:text-white'
                            }`}
                          >
                            <span>{m.name}</span>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isFinished ? 'bg-white/30' : hasStream ? 'bg-[#22c55e] animate-pulse' : 'bg-yellow-500'
                            }`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {(() => {
                    const selectedMatch = (tournament.leagueMatches || tournament.matches || []).find((m: any) => m.id === selectedLeagueMatchId);
                    if (!selectedMatch) {
                      return (
                        <div className="bg-[#0f1419] border border-white/[0.06] rounded-2xl p-8 text-center text-white/40 text-sm">
                          Vui lòng chọn trận đấu phía trên để xem.
                        </div>
                      );
                    }

                    const liveState = tournament.matchStates?.[selectedMatch.id];
                    const streamType = liveState ? liveState.streamType : (selectedMatch.streamType || null);
                    const streamUrl = liveState ? liveState.streamUrl : (selectedMatch.streamUrl || '');
                    const isFinished = selectedMatch.isFinished || !!liveState?.isFinished;

                    return (
                      <div className="space-y-6">
                        {/* Livestream Player */}
                        {streamUrl ? (
                          <div className="p-1 rounded-2xl bg-[#0f1419] border border-white/[0.06] overflow-hidden shadow-2xl relative">
                            <div className="relative pb-[56.25%] h-0 rounded-xl overflow-hidden bg-black">
                              {streamType === 'youtube' && (
                                <iframe
                                  src={getYoutubeEmbedUrl(streamUrl)}
                                  className="absolute top-0 left-0 w-full h-full border-0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              )}
                              {streamType === 'twitch' && (
                                <iframe
                                  src={getTwitchEmbedUrl(streamUrl)}
                                  className="absolute top-0 left-0 w-full h-full border-0"
                                  allowFullScreen
                                />
                              )}
                              {streamType === 'webcam' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                                  {isViewerConnecting ? (
                                    <div className="flex flex-col items-center gap-3 text-center p-6">
                                      <svg className="animate-spin h-8 w-8 text-[#22c55e]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      <p className="text-xs text-white/60 font-semibold">Đang kết nối tới máy quay trọng tài...</p>
                                    </div>
                                  ) : viewerConnectionError ? (
                                    <div className="text-center p-6 space-y-2">
                                      <span className="text-3xl">📡❌</span>
                                      <p className="text-xs text-red-400 font-semibold">{viewerConnectionError}</p>
                                      <p className="text-[10px] text-white/40">Trọng tài chưa bật phát trực tiếp hoặc kết nối thất bại.</p>
                                    </div>
                                  ) : viewerStream ? (
                                    <video
                                      ref={viewerVideoRef}
                                      autoPlay
                                      playsInline
                                      controls
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="text-center p-6 space-y-2">
                                      <span className="text-3xl animate-pulse">📡</span>
                                      <p className="text-xs text-white/50 font-semibold">Đang chờ luồng phát webcam...</p>
                                      <p className="text-[10px] text-white/30">Kết nối thành công. Chờ trọng tài gửi dữ liệu stream.</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="px-4 py-2.5 bg-black/40 backdrop-blur-md flex items-center justify-between text-[10px] font-bold text-white/60 uppercase tracking-widest border-t border-white/[0.03]">
                              <span className={`flex items-center gap-1.5 ${!isFinished ? 'text-red-500 font-extrabold animate-pulse' : 'text-white/40'}`}>
                                {!isFinished && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
                                {!isFinished ? 'TRỰC TIẾP TRẬN ĐẤU' : 'PHÁT LẠI TRẬN ĐẤU'}
                              </span>
                              <span>Nguồn: {streamType === 'webcam' ? 'Trọng tài trực tiếp' : streamType}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-[#0f1419] border border-white/[0.06] rounded-2xl p-8 text-center text-white/40 text-sm flex flex-col items-center gap-2">
                            <span>📺 Trận đấu này chưa được cấu hình link livestream.</span>
                            <span className="text-xs text-white/20">Trọng tài sẽ cập nhật link stream khi trận đấu chuẩn bị khởi tranh.</span>
                          </div>
                        )}

                        {/* Match Results */}
                        <div className="bg-[#0f1419] border border-white/[0.06] rounded-2xl p-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                            <span className="font-extrabold text-sm text-[#22c55e]">{selectedMatch.name} - Kết quả chi tiết</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                              selectedMatch.isFinished ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-yellow-500/10 text-yellow-500'
                            }`}>
                              {selectedMatch.isFinished ? 'ĐÃ KẾT THÚC' : 'ĐANG DIỄN RA / CHỜ BẮT ĐẦU'}
                            </span>
                          </div>

                          {(selectedMatch.isFinished || (selectedMatch.results && selectedMatch.results.length > 0)) ? (
                            <div className="space-y-1.5">
                              {[...(selectedMatch.results || [])]
                                .sort((a: any, b: any) => {
                                  if (tournament.format === 'battle_royale') {
                                    return (b.pts || 0) - (a.pts || 0);
                                  }
                                  return (a.placement || 99) - (b.placement || 99);
                                })
                                .map((res: any, rIdx: number) => (
                                  <div key={res.teamId} className="flex items-center justify-between text-xs py-2 border-b border-white/[0.02] last:border-0 text-white/80">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-5 text-center font-black ${
                                        (tournament.format === 'battle_royale' ? rIdx === 0 : res.placement === 1)
                                          ? 'text-yellow-400 font-extrabold text-sm'
                                          : 'text-white/40'
                                      }`}>
                                        #{tournament.format === 'battle_royale' ? rIdx + 1 : res.placement}
                                      </span>
                                      <span className="font-bold text-white">{res.teamName}</span>
                                    </div>
                                    <div className="flex gap-4 font-mono text-[10px]">
                                      {tournament.format !== 'battle_royale' && <span>{res.kills} Kills</span>}
                                      <span className="text-[#22c55e] font-bold">
                                        +{tournament.format === 'battle_royale' ? (res.pts || 0) : (res.totalPoints || 0)} Pts
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-xs text-white/30">
                              Trận đấu đang diễn ra. Kết quả sẽ được trọng tài cập nhật ngay khi trận đấu kết thúc.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bottom: Team Stats Grid */}
              {tournament.format !== 'battle_royale' && (
                <div className="border-t border-white/[0.06] pt-8 space-y-6">
                  <h3 className="text-sm font-black tracking-widest text-[#22c55e] uppercase text-center">
                    Thống Kê Đội Tuyển Chi Tiết
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tournament.teams.map((team: any) => {
                      const matches = (tournament.leagueMatches || tournament.matches || []).filter((m: any) => m.isFinished);
                      const teamResults = matches.flatMap((m: any) => m.results?.filter((r: any) => r.teamId === team.id) || []);
                      
                      const totalMatches = teamResults.length;
                      const totalKills = teamResults.reduce((acc: number, curr: any) => acc + (curr.kills || 0), 0);
                      const avgKills = totalMatches > 0 ? (totalKills / totalMatches).toFixed(1) : '0.0';
                      const avgPlacement = totalMatches > 0 ? (teamResults.reduce((acc: number, curr: any) => acc + (curr.placement || 0), 0) / totalMatches).toFixed(1) : '0.0';
                      
                      const firstPlaces = teamResults.filter((r: any) => r.placement === 1).length;
                      const top3Places = teamResults.filter((r: any) => r.placement >= 1 && r.placement <= 3).length;

                      return (
                        <div key={team.id} className="bg-[#0f1419] border border-white/[0.06] rounded-2xl p-5 space-y-4 shadow-lg">
                          <h4 className="font-black text-sm text-[#22c55e] border-b border-white/[0.06] pb-2 text-center">
                            {team.name}
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-[#080b10] p-2.5 rounded-lg border border-white/[0.02]">
                              <span className="text-[10px] text-white/40 block">Trận đấu</span>
                              <span className="text-sm font-black text-white">{totalMatches}</span>
                            </div>
                            <div className="bg-[#080b10] p-2.5 rounded-lg border border-white/[0.02]">
                              <span className="text-[10px] text-white/40 block">Hạng TB</span>
                              <span className="text-sm font-black text-[#22c55e]">#{avgPlacement}</span>
                            </div>
                            <div className="bg-[#080b10] p-2.5 rounded-lg border border-white/[0.02]">
                              <span className="text-[10px] text-white/40 block">Tổng Kills</span>
                              <span className="text-sm font-black text-white">{totalKills}</span>
                            </div>
                            <div className="bg-[#080b10] p-2.5 rounded-lg border border-white/[0.02]">
                              <span className="text-[10px] text-white/40 block">Kills TB / Trận</span>
                              <span className="text-sm font-black text-white">{avgKills}</span>
                            </div>
                          </div>

                          <div className="border-t border-white/[0.04] pt-3 flex justify-between text-xs text-white/60">
                            <span>Số trận TOP 1 (Win):</span>
                            <span className="font-bold text-green-400">{firstPlaces}</span>
                          </div>
                          <div className="flex justify-between text-xs text-white/60">
                            <span>Số trận lọt TOP 3:</span>
                            <span className="font-bold text-amber-500">{top3Places}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : tournament.format === 'round_robin' && tournament.stage === 'group' ? (
            <div className="space-y-12">
              {tournament.groups?.map((group: any, gIdx: number) => {
                const standings = calculateGroupStandings(group.teams, group.matches, tournament.matchStates);
                return (
                  <div key={gIdx} className="bg-[#0f1419] border border-white/[0.06] rounded-2xl p-6 space-y-6">
                    <h3 className="text-lg font-black tracking-tight text-[#22c55e] border-b border-white/[0.06] pb-3">
                      {group.name}
                    </h3>
                    
                    {/* Standings Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-white/50">
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Đội tuyển</th>
                            <th className="py-2 px-3 text-center">MP</th>
                            <th className="py-2 px-3 text-center">W</th>
                            <th className="py-2 px-3 text-center">L</th>
                            <th className="py-2 px-3 text-center">GD</th>
                            <th className="py-2 px-3 text-center font-bold text-white">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((row, idx) => (
                            <tr key={row.teamId} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                              <td className="py-2 px-3 font-semibold text-white/40">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-white">{row.teamName}</td>
                              <td className="py-2 px-3 text-center">{row.mp}</td>
                              <td className="py-2 px-3 text-center text-green-500">{row.w}</td>
                              <td className="py-2 px-3 text-center text-red-500">{row.l}</td>
                              <td className={`py-2 px-3 text-center ${row.gd > 0 ? 'text-green-500' : row.gd < 0 ? 'text-red-500' : ''}`}>
                                {row.gd > 0 ? `+${row.gd}` : row.gd}
                              </td>
                              <td className="py-2 px-3 text-center font-black text-[#22c55e]">{row.pts}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Group Matches */}
                    <div>
                      <h4 className="text-xs font-black tracking-widest text-white/40 uppercase mb-3">Lịch thi đấu & Kết quả</h4>
                      <div className="flex flex-wrap gap-4 justify-start">
                        {group.matches.map((m: any, mIdx: number) => {
                          const mKey = `g-${gIdx}-${mIdx}`;
                          const ms = tournament.matchStates?.[mKey];
                          const isRunning = ms?.isRunning && !ms?.isFinished;
                          const isFinished = m.isFinished || ms?.isFinished;
                          const sa = isRunning && ms ? ms.team1Score : (isFinished && ms ? ms.team1Score : m.scoreA);
                          const sb = isRunning && ms ? ms.team2Score : (isFinished && ms ? ms.team2Score : m.scoreB);
                          const done = isFinished;
                          
                          return (
                            <div key={mIdx} className="relative flex items-center justify-center py-2">
                              <BracketMatchCard
                                a={m.teamA?.name}
                                b={m.teamB?.name}
                                sa={sa}
                                sb={sb}
                                done={done}
                                isLive={isRunning}
                                winner={m.winner?.name}
                                matchKey={mKey}
                                onSelect={handleSelectMatch}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : tournament.format === 'double_elimination' ? (
            <div className="space-y-8">
              {/* Tab Selector */}
              <div className="flex justify-center border-b border-white/[0.06] pb-3 mb-6 gap-2 md:gap-4 overflow-x-auto">
                {(['upper', 'lower', 'grand'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveDeTab(tab)}
                    className={`px-4 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition-all duration-200 whitespace-nowrap ${
                      activeDeTab === tab
                        ? 'bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                        : 'text-white/50 border border-transparent hover:text-white/80'
                    }`}
                  >
                    {tab === 'upper' ? 'Nhánh Thắng (Upper)' : tab === 'lower' ? 'Nhánh Thua (Lower)' : 'Chung Kết Tổng (Grand)'}
                  </button>
                ))}
              </div>

              {/* Render selected rounds */}
              {(() => {
                let rounds: any[][] = [];
                let labelPrefix = '';
                let keyPrefix = '';

                if (activeDeTab === 'upper') {
                  rounds = tournament.bracket?.upperRounds || [];
                  labelPrefix = 'Nhánh Thắng R';
                  keyPrefix = 'u-';
                } else if (activeDeTab === 'lower') {
                  rounds = tournament.bracket?.lowerRounds || [];
                  labelPrefix = 'Nhánh Thua R';
                  keyPrefix = 'l-';
                } else {
                  rounds = [tournament.bracket?.grandFinal || []];
                  labelPrefix = 'Chung kết';
                  keyPrefix = 'gf-';
                }

                if (rounds.length === 0 || rounds[0].length === 0) {
                  return (
                    <div className="text-center py-20 bg-[#0f1419] rounded-2xl border border-white/[0.06]">
                      <p className="text-white/60 text-lg">Không có dữ liệu nhánh thi đấu</p>
                    </div>
                  );
                }

                return (
                  <div className="flex items-stretch justify-center gap-8 overflow-x-auto pb-8 pt-4 min-h-[400px]">
                    {rounds.map((roundMatches, roundIdx) => (
                      <div key={roundIdx} className="flex flex-col shrink-0 items-center w-[160px]">
                        <h3 className="text-xs font-black tracking-widest text-[#22c55e]/70 uppercase text-center mb-8">
                          {activeDeTab === 'grand' ? 'Chung Kết Tổng' : `${labelPrefix}${roundIdx + 1}`}
                        </h3>
                        <div className="flex flex-col justify-around flex-1 h-full gap-4">
                          {roundMatches.map((m: any, matchIdx: number) => {
                            const mKey = activeDeTab === 'grand' ? `gf-${matchIdx}` : `${keyPrefix}${roundIdx}-${matchIdx}`;
                            const ms = tournament.matchStates?.[mKey];
                            const isRunning = ms?.isRunning && !ms?.isFinished;
                            const isFinished = m.isFinished || ms?.isFinished;
                            const sa = isRunning && ms ? ms.team1Score : (isFinished && ms ? ms.team1Score : m.scoreA);
                            const sb = isRunning && ms ? ms.team2Score : (isFinished && ms ? ms.team2Score : m.scoreB);
                            const done = isFinished;

                            return (
                              <div key={matchIdx} className="relative flex items-center justify-center py-2">
                                <BracketMatchCard
                                  a={m.teamA?.name}
                                  b={m.teamB?.name}
                                  sa={sa}
                                  sb={sb}
                                  done={done}
                                  isLive={isRunning}
                                  winner={m.winner?.name}
                                  matchKey={mKey}
                                  onSelect={handleSelectMatch}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : buildBracketData(tournament, handleSelectMatch).length === 0 ? (
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

      {/* Registration Modal Overlay */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 bg-[#080b10]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1419] border border-white/[0.08] p-8 rounded-2xl w-full max-w-md shadow-2xl relative max-h-[85vh] overflow-y-auto">
            
            <button
              onClick={() => setShowRegModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {regSuccess ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#22c55e]/20 text-[#22c55e] flex items-center justify-center mx-auto text-xl animate-bounce">
                  ✓
                </div>
                <h3 className="text-lg font-bold text-white">Đăng ký thành công!</h3>
                <p className="text-xs text-white/50">Đội của bạn đã được thêm vào giải đấu.</p>
              </div>
            ) : (
              <form onSubmit={handleRegisterTeamSubmit} className="space-y-6">
                <div>
                  <h3 className="font-extrabold text-white text-lg">Đăng ký giải đấu</h3>
                  <p className="text-xs text-white/50 mt-1">Vui lòng điền tên đội và thành viên tham gia</p>
                </div>

                {regError && (
                  <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                    ⚠️ {regError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-black tracking-wider text-white/40 uppercase">Tên đội tuyển</label>
                  <input
                    type="text"
                    value={regTeamName}
                    onChange={(e) => setRegTeamName(e.target.value)}
                    placeholder="Nhập tên đội..."
                    className="w-full px-4 py-3 rounded-lg bg-[#080b10] border border-white/[0.06] text-white focus:outline-none focus:border-[#22c55e] text-sm transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black tracking-wider text-white/40 uppercase">Logo đội tuyển</label>
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {regLogoPreview ? (
                        <div className="relative w-14 h-14 rounded-full border border-white/[0.12] overflow-hidden group/logo">
                          <img src={regLogoPreview} className="w-full h-full object-cover" alt="Preview logo" />
                          <button
                            type="button"
                            onClick={handleRemoveRegLogo}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-opacity"
                          >
                            Xóa
                          </button>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-white/[0.02] border border-dashed border-white/[0.12] flex items-center justify-center text-white/20 text-[9px] text-center p-1.5 font-medium">
                          Không logo
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        id="reg-team-logo-upload"
                        onChange={handleRegLogoChange}
                        className="hidden"
                        disabled={isRegLogoUploading}
                      />
                      <label
                        htmlFor="reg-team-logo-upload"
                        className={`inline-flex items-center justify-center px-3.5 py-2 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-xs font-bold cursor-pointer transition-all ${
                          isRegLogoUploading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isRegLogoUploading ? 'Đang tải...' : 'Chọn logo'}
                      </label>
                      {regLogoUploadError && (
                        <p className="text-[10px] text-red-500 mt-1 font-medium">{regLogoUploadError}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black tracking-wider text-white/40 uppercase">Danh sách thành viên</label>
                    <button
                      type="button"
                      onClick={handleAddRegMember}
                      className="text-[#22c55e] hover:text-[#16a34a] text-xs font-bold transition-all"
                    >
                      + Thêm thành viên
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {regMembers.map((member, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        {/* Member avatar upload */}
                        <div className="flex-shrink-0">
                          {member.imagePreview ? (
                            <div className="relative w-9 h-9 flex-shrink-0">
                              <img src={member.imagePreview} className="w-9 h-9 rounded-full object-cover border border-white/[0.12]" alt={`Avatar ${idx + 1}`} />
                              <button
                                type="button"
                                onClick={() => handleRemoveRegMemberImage(idx)}
                                className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[8px] flex items-center justify-center transition-all shadow-md shadow-black/30"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <label
                                htmlFor={`reg-member-file-${idx}`}
                                className="w-9 h-9 rounded-full bg-[#080b10] border border-dashed border-white/[0.08] hover:border-white/[0.16] text-white/40 hover:text-white flex items-center justify-center cursor-pointer transition-all"
                              >
                                {member.isUploading ? (
                                  <svg className="animate-spin h-4 w-4 text-[#22c55e]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                    <circle cx="12" cy="13" r="4"></circle>
                                  </svg>
                                )}
                              </label>
                              <input
                                id={`reg-member-file-${idx}`}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleRegMemberImageChange(idx, e)}
                                className="hidden"
                                disabled={member.isUploading}
                              />
                            </>
                          )}
                        </div>

                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => handleRegMemberNameChange(idx, e.target.value)}
                          placeholder={`Tên thành viên ${idx + 1}...`}
                          className="flex-1 px-3 py-2 h-9 rounded-lg bg-[#080b10] border border-white/[0.06] text-white text-xs focus:outline-none focus:border-[#22c55e]"
                          required
                        />
                        {regMembers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRegMember(idx)}
                            className="p-2 h-9 text-red-400 hover:bg-red-500/10 rounded-lg transition-all flex items-center justify-center"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRegModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-white/[0.06] text-white hover:bg-white/[0.05] text-xs font-black uppercase tracking-wider transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={regSubmitting}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[#22c55e] text-[#080b10] hover:bg-[#16a34a] text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regSubmitting ? 'Đang gửi...' : 'Xác nhận'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
      {selectedMatchKey && selectedDetails && !selectedMatchKey.startsWith('league-') && !selectedMatchKey.startsWith('m-') && !selectedMatchKey.startsWith('br-') && (
        <div className="fixed inset-0 z-50 bg-[#080b10]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1419] border border-white/[0.08] p-6 rounded-2xl w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scale-in">
            
            {/* Close Button */}
            <button
              onClick={() => setSelectedMatchKey(null)}
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
                {getMatchLabel(selectedMatchKey)}
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
              <div className="text-sm font-semibold text-white/60 mb-4">
                {selectedDetails.isLive 
                  ? 'Đang thi đấu'
                  : selectedDetails.isFinished 
                  ? 'Chung cuộc' 
                  : 'Chờ bắt đầu'
                }
              </div>

              {/* Big Score Board */}
              <div className="grid grid-cols-3 items-center gap-4 max-w-lg mx-auto bg-[#080b10] border border-white/[0.05] p-6 rounded-xl">
                <div>
                  <h4 className="text-lg font-bold text-white truncate">{selectedDetails.team1?.name || 'Chờ xác định'}</h4>
                </div>
                
                  <div className="flex justify-center items-center gap-3 text-3xl font-black text-[#22c55e]">
                    <span>{selectedDetails.scoreA !== null ? selectedDetails.scoreA : '0'}</span>
                    <span className="text-white/20">:</span>
                    <span>{selectedDetails.scoreB !== null ? selectedDetails.scoreB : '0'}</span>
                  </div>

                <div>
                  <h4 className="text-lg font-bold text-white truncate">{selectedDetails.team2?.name || 'Chờ xác định'}</h4>
                </div>
              </div>
            </div>
            {/* Livestream Player */}
            {selectedDetails.streamType && (
              <div className="mb-8 p-1 rounded-2xl bg-[#080b10] border border-white/[0.05] overflow-hidden shadow-2xl relative">
                <div className="relative pb-[56.25%] h-0 rounded-xl overflow-hidden bg-black animate-scale-in">
                  {selectedDetails.streamType === 'youtube' && (
                    <iframe
                      src={getYoutubeEmbedUrl(selectedDetails.streamUrl)}
                      className="absolute top-0 left-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                  {selectedDetails.streamType === 'twitch' && (
                    <iframe
                      src={getTwitchEmbedUrl(selectedDetails.streamUrl)}
                      className="absolute top-0 left-0 w-full h-full border-0"
                      allowFullScreen
                    />
                  )}
                  {selectedDetails.streamType === 'webcam' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                      {isViewerConnecting ? (
                        <div className="flex flex-col items-center gap-3 text-center p-6">
                          <svg className="animate-spin h-8 w-8 text-[#22c55e]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p className="text-xs text-white/60 font-semibold">Đang kết nối tới máy quay trọng tài...</p>
                        </div>
                      ) : viewerConnectionError ? (
                        <div className="text-center p-6 space-y-2">
                          <span className="text-3xl">📡❌</span>
                          <p className="text-xs text-red-400 font-semibold">{viewerConnectionError}</p>
                          <p className="text-[10px] text-white/40">Trọng tài chưa bật phát trực tiếp hoặc kết nối thất bại.</p>
                        </div>
                      ) : viewerStream ? (
                        <video
                          ref={viewerVideoRef}
                          autoPlay
                          playsInline
                          controls
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-6 space-y-2">
                          <span className="text-3xl animate-pulse">📡</span>
                          <p className="text-xs text-white/50 font-semibold">Đang chờ luồng phát webcam...</p>
                          <p className="text-[10px] text-white/30">Kết nối thành công. Chờ trọng tài gửi dữ liệu stream.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="px-4 py-2 bg-black/40 backdrop-blur-md flex items-center justify-between text-[10px] font-bold text-white/60 uppercase tracking-widest border-t border-white/[0.03]">
                  <span className="flex items-center gap-1.5 text-red-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Live stream
                  </span>
                  <span>
                    Nguồn: {selectedDetails.streamType === 'webcam' ? 'Trọng tài trực tiếp' : selectedDetails.streamType}
                  </span>
                </div>
              </div>
            )}

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
                        {member.image ? (
                          <img src={member.image} alt={member.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
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
                        {member.image ? (
                          <img src={member.image} alt={member.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
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
      {/* ======== FLOATING CHAT PANEL ======== */}
      {showChatPanel && (
        <div className="fixed bottom-4 right-4 z-50 w-[360px] h-[480px] bg-[#0f1419] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#080b10]/80 backdrop-blur-md">
            <h4 className="text-xs font-black tracking-widest text-[#22c55e] uppercase flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Chat trực tiếp
            </h4>
            <button onClick={() => setShowChatPanel(false)} className="text-white/40 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {chatMessages.length === 0 && (
              <p className="text-xs text-white/30 text-center py-8">Chưa có tin nhắn. Hãy là người đầu tiên bình luận!</p>
            )}
            {chatMessages.map((msg) => (
              <div key={msg._id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#22c55e]/30 to-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#22c55e] text-[9px] font-black">{msg.userName[0]?.toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-bold text-[#22c55e]">{msg.userName}</span>
                    <span className="text-[9px] text-white/20">{new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-white/70 break-words leading-relaxed">{msg.message}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Name prompt */}
          {showNamePrompt && (
            <div className="px-4 py-3 border-t border-white/[0.06] bg-[#080b10]/80">
              <p className="text-[10px] text-white/50 mb-2">Nhập tên hiển thị của bạn:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatUserName}
                  onChange={(e) => setChatUserName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveChatName()}
                  placeholder="Tên của bạn..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[#080b10] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#22c55e]/50"
                  autoFocus
                  maxLength={50}
                />
                <button onClick={handleSaveChatName} className="px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] text-xs font-black hover:bg-[#16a34a] transition-all">OK</button>
              </div>
            </div>
          )}

          {/* Chat Input */}
          {!showNamePrompt && (
            <div className="px-4 py-3 border-t border-white/[0.06] bg-[#080b10]/80">
              {chatUserName && (
                <p className="text-[10px] text-white/30 mb-1.5 flex items-center justify-between">
                  <span>Gửi với tên: <strong className="text-[#22c55e]">{chatUserName}</strong></span>
                  <button onClick={() => setShowNamePrompt(true)} className="text-white/30 hover:text-white/60 underline">Đổi</button>
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !chatSending && handleSendChat()}
                  placeholder="Nhập tin nhắn..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[#080b10] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#22c55e]/50"
                  maxLength={500}
                  disabled={chatSending}
                />
                <button
                  onClick={handleSendChat}
                  disabled={chatSending || !chatInput.trim()}
                  className="px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] text-xs font-black hover:bg-[#16a34a] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </main>
  );
}
