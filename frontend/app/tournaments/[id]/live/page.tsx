'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { fetchTournamentFromBackend } from '@/app/lib/tournaments';
import { getPusherClient } from '@/app/lib/pusher';
import { getApiBaseUrl } from '@/app/lib/authStorage';

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
        standings[idA].pts += 3;
      } else if (scoreA === scoreB) {
        standings[idA].d += 1;
        standings[idA].pts += 1;
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
        standings[idB].pts += 3;
      } else if (scoreA === scoreB) {
        standings[idB].d += 1;
        standings[idB].pts += 1;
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
      try {
        const data = await fetchTournamentFromBackend(tournamentId);
        const migrated = migrateTournamentData(data);
        setTournament(migrated);
        
        const link = `${window.location.origin}/tournaments/${tournamentId}/live`;
        setShareLink(link);
        setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`);
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

  const getTournamentWinnerName = () => {
    if (!tournament || !tournament.bracket || !tournament.bracket.isFinished) return null;
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
        </div>
      </nav>

      {/* Main Content */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        
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

        {/* Bracket Tree View */}
        <div className="w-full">
          {tournament.format === 'round_robin' && tournament.stage === 'group' ? (
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
                            <th className="py-2 px-3">Đội bóng</th>
                            <th className="py-2 px-3 text-center">MP</th>
                            <th className="py-2 px-3 text-center">W</th>
                            <th className="py-2 px-3 text-center">D</th>
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
                              <td className="py-2 px-3 text-center text-blue-500">{row.d}</td>
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
      {selectedMatchKey && selectedDetails && (
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
                  ? (tournament?.sport === 'moba' ? `Đang thi đấu Game ${selectedDetails.hiep}` : tournament?.sport === 'fps' ? `Đang thi đấu Map ${selectedDetails.hiep}` : `Hiệp ${selectedDetails.hiep}`)
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
                
                {tournament?.sport === 'moba' ? (
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="flex justify-center items-center gap-3 text-3xl font-black text-[#22c55e]">
                      <span>{selectedDetails.scoreA !== null ? selectedDetails.scoreA : '0'}</span>
                      <span className="text-white/20">:</span>
                      <span>{selectedDetails.scoreB !== null ? selectedDetails.scoreB : '0'}</span>
                    </div>
                    <div className="text-[9px] font-black text-white/30 uppercase tracking-wider">Ván thắng (BO)</div>
                    
                    {(selectedDetails.team1SetPoints !== null || selectedDetails.team2SetPoints !== null) && (
                      <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-xs font-bold font-mono mt-1 text-white/70">
                        <span>{selectedDetails.team1SetPoints ?? 0}</span>
                        <span className="text-white/20">:</span>
                        <span>{selectedDetails.team2SetPoints ?? 0}</span>
                      </div>
                    )}
                    <div className="text-[8px] text-white/40">Hạ gục (Kills)</div>
                  </div>
                ) : tournament?.sport === 'fps' ? (
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="flex justify-center items-center gap-3 text-3xl font-black text-[#22c55e]">
                      <span>{selectedDetails.scoreA !== null ? selectedDetails.scoreA : '0'}</span>
                      <span className="text-white/20">:</span>
                      <span>{selectedDetails.scoreB !== null ? selectedDetails.scoreB : '0'}</span>
                    </div>
                    <div className="text-[9px] font-black text-white/30 uppercase tracking-wider">Map thắng (BO)</div>
                    
                    {(selectedDetails.team1SetPoints !== null || selectedDetails.team2SetPoints !== null) && (
                      <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-xs font-bold font-mono mt-1 text-white/70">
                        <span>{selectedDetails.team1SetPoints ?? 0}</span>
                        <span className="text-white/20">:</span>
                        <span>{selectedDetails.team2SetPoints ?? 0}</span>
                      </div>
                    )}
                    <div className="text-[8px] text-white/40">Số vòng (Rounds)</div>
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
