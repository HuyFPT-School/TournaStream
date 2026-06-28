'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { syncTournamentToBackend, fetchTournamentFromBackend } from '@/app/lib/tournaments';
import { getSession, getApiBaseUrl } from '@/app/lib/authStorage';
import { getPusherClient } from '@/app/lib/pusher';

interface MatchState {
  team1Score: number;
  team2Score: number;
  time: number;
  isRunning: boolean;
  hiep: number;
  isFinished?: boolean;
  team1SetPoints?: number;
  team2SetPoints?: number;
  buGio?: number;
  streamType?: 'youtube' | 'twitch' | 'webcam' | null;
  streamUrl?: string;
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

const getRoundLabel = (r: number, totalRounds: number) => {
  if (r === totalRounds - 1) return "Chung kết";
  if (r === totalRounds - 2) return "Bán kết";
  if (r === totalRounds - 3) return "Tứ kết";
  return `Vòng ${r + 1}`;
};

function getParsedIndices(key: string | null) {
  if (!key) return { roundIndex: 0, matchIndex: 0 };
  const parts = key.split('-');
  if (key.startsWith('league-')) {
    return {
      roundIndex: 0,
      matchIndex: parseInt(parts[2], 10) || 0
    };
  }
  if (key.startsWith('m-')) {
    return {
      roundIndex: 0,
      matchIndex: parseInt(parts[1], 10) || 0
    };
  }
  if (key.startsWith('g-') || key.startsWith('u-') || key.startsWith('l-')) {
    return {
      roundIndex: parseInt(parts[1], 10) || 0,
      matchIndex: parseInt(parts[2], 10) || 0
    };
  } else if (key.startsWith('gf-')) {
    return {
      roundIndex: 0,
      matchIndex: parseInt(parts[1], 10) || 0
    };
  } else {
    return {
      roundIndex: parseInt(parts[0], 10) || 0,
      matchIndex: parseInt(parts[1], 10) || 0
    };
  }
}

function getMatchLabel(key: string | null, tournament: any) {
  if (!key) return 'VÒNG 1 • TRẬN 1';
  const parts = key.split('-');
  if (key.startsWith('br-')) {
    const idx = parseInt(parts[1], 10) || 0;
    return `Game Sinh tồn • Trận ${idx + 1}`;
  }
  if (key.startsWith('league-') || key.startsWith('m-')) {
    const match = tournament?.leagueMatches?.find((m: any) => m.id === key);
    return match ? match.name : 'Trận đấu League';
  }
  if (key.startsWith('g-')) {
    const gIdx = parseInt(parts[1], 10) || 0;
    const mIdx = parseInt(parts[2], 10) || 0;
    const groupName = tournament?.groups?.[gIdx]?.name || String.fromCharCode(65 + gIdx);
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
  const numTeams = (tournament?.orderedTeams || tournament?.teams || []).length;
  const numRounds = Math.ceil(Math.log2(numTeams || 2));
  return `${getRoundLabel(rIdx, numRounds)} • Trận ${mIdx + 1}`;
}

function advanceDoubleElimination(bracket: any, roundIndex: number, matchIndex: number, winner: any, loser: any, isUpper: boolean) {
  const numUpperRounds = bracket.upperRounds.length;
  const totalLowerRounds = bracket.lowerRounds.length;

  if (isUpper) {
    if (roundIndex === numUpperRounds - 1) {
      bracket.grandFinal[0].teamA = winner;
      bracket.lowerRounds[totalLowerRounds - 1][0].teamB = loser;
    } else {
      const nextMatchIdx = Math.floor(matchIndex / 2);
      const isTeamA = matchIndex % 2 === 0;
      const targetMatch = bracket.upperRounds[roundIndex + 1][nextMatchIdx];
      if (isTeamA) {
        targetMatch.teamA = winner;
      } else {
        targetMatch.teamB = winner;
      }

      if (roundIndex === 0) {
        const lowerMatchIdx = Math.floor(matchIndex / 2);
        const isLowerTeamA = matchIndex % 2 === 0;
        const targetLowerMatch = bracket.lowerRounds[0][lowerMatchIdx];
        if (isLowerTeamA) {
          targetLowerMatch.teamA = loser;
        } else {
          targetLowerMatch.teamB = loser;
        }
      } else {
        const lowerRoundIdx = 2 * roundIndex - 1;
        const targetLowerMatch = bracket.lowerRounds[lowerRoundIdx][matchIndex];
        targetLowerMatch.teamB = loser;
      }
    }
  } else {
    if (roundIndex === totalLowerRounds - 1) {
      bracket.grandFinal[0].teamB = winner;
    } else {
      const isMinorRound = roundIndex % 2 === 0;
      if (isMinorRound) {
        const targetLowerMatch = bracket.lowerRounds[roundIndex + 1][matchIndex];
        targetLowerMatch.teamA = winner;
      } else {
        const nextLowerMatchIdx = Math.floor(matchIndex / 2);
        const isLowerTeamA = matchIndex % 2 === 0;
        const targetLowerMatch = bracket.lowerRounds[roundIndex + 1][nextLowerMatchIdx];
        if (isLowerTeamA) {
          targetLowerMatch.teamA = winner;
        } else {
          targetLowerMatch.teamB = winner;
        }
      }
    }
  }
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

  const [streamType, setStreamType] = useState<'youtube' | 'twitch' | 'webcam' | null>(null);
  const [streamUrlInput, setStreamUrlInput] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [brResults, setBrResults] = useState<any[]>([]);

  useEffect(() => {
    if (tournament && matchKey && matchKey.startsWith('br-')) {
      const match = tournament.matches?.find((m: any) => m.id === matchKey);
      if (match) {
        setBrResults(match.results || []);
      }
    }
  }, [tournament, matchKey]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const iceQueuesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const broadcasterVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (matchState) {
      setStreamType(matchState.streamType || null);
      setStreamUrlInput(matchState.streamUrl || '');
    }
  }, [matchState.streamType, matchState.streamUrl]);

  const sendSignalingMessage = async (payload: any) => {
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

  const handleStreamTypeChange = (type: 'youtube' | 'twitch' | 'webcam' | null) => {
    setStreamType(type);
    if (type === 'webcam') {
      setStreamUrlInput('webcam');
      setMatchState(prev => ({
        ...prev,
        streamType: 'webcam',
        streamUrl: 'webcam'
      }));
    } else {
      setStreamUrlInput(matchState.streamUrl === 'webcam' ? '' : (matchState.streamUrl || ''));
    }
  };

  const saveStreamUrl = () => {
    setMatchState(prev => ({
      ...prev,
      streamType,
      streamUrl: streamUrlInput.trim()
    }));
    alert('Đã lưu cấu hình livestream thành công!');
  };

  const startWebcamBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      
      if (broadcasterVideoRef.current) {
        broadcasterVideoRef.current.srcObject = stream;
      }
      
      setIsBroadcasting(true);
      
      setMatchState(prev => ({
        ...prev,
        streamType: 'webcam',
        streamUrl: 'webcam'
      }));
    } catch (err) {
      console.error('Lỗi truy cập camera/micro:', err);
      alert('Không thể truy cập camera và micro của bạn. Vui lòng cấp quyền và thử lại.');
    }
  };

  const startScreenShareBroadcast = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      
      let combinedStream = screenStream;
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const tracks = [...screenStream.getVideoTracks(), ...audioStream.getAudioTracks()];
        combinedStream = new MediaStream(tracks);
      } catch (audioErr) {
        console.warn('Không thể truy cập microphone, phát màn hình không tiếng:', audioErr);
      }
      
      localStreamRef.current = combinedStream;
      
      if (broadcasterVideoRef.current) {
        broadcasterVideoRef.current.srcObject = combinedStream;
      }
      
      setIsBroadcasting(true);
      
      setMatchState(prev => ({
        ...prev,
        streamType: 'webcam',
        streamUrl: 'webcam'
      }));

      // Khi bấm nút "Stop sharing" trên trình duyệt
      screenStream.getVideoTracks()[0].onended = () => {
        stopWebcamBroadcast();
      };
    } catch (err: any) {
      console.error('Lỗi chia sẻ màn hình:', err);
      if (err.name !== 'NotAllowedError') {
        alert('Không thể chia sẻ màn hình. Vui lòng thử lại.');
      }
    }
  };

  const stopWebcamBroadcast = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (broadcasterVideoRef.current) {
      broadcasterVideoRef.current.srcObject = null;
    }
    
    Object.keys(peerConnectionsRef.current).forEach(peerId => {
      peerConnectionsRef.current[peerId].close();
    });
    peerConnectionsRef.current = {};
    
    setIsBroadcasting(false);
  };

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.keys(peerConnectionsRef.current).forEach(peerId => {
        peerConnectionsRef.current[peerId].close();
      });
    };
  }, []);

  useEffect(() => {
    if (isBroadcasting && localStreamRef.current && broadcasterVideoRef.current) {
      broadcasterVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isBroadcasting]);

  useEffect(() => {
    if (!isLoaded || !tournamentId || !matchKey) return;
    
    const pusher = getPusherClient();
    if (!pusher) return;
    
    const channel = pusher.subscribe(tournamentId);
    
    const handleSignaling = async (data: any) => {
      if (data.matchKey !== matchKey) return;
      
      const { type, peerId, sender, sdp, candidate } = data;
      if (sender === 'referee') return;
      
      if (type === 'join') {
        if (!isBroadcasting || !localStreamRef.current) return;
        
        delete iceQueuesRef.current[peerId];
        
        if (peerConnectionsRef.current[peerId]) {
          peerConnectionsRef.current[peerId].close();
        }
        
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        });
        
        peerConnectionsRef.current[peerId] = pc;
        
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendSignalingMessage({
              type: 'ice-candidate',
              peerId,
              candidate: event.candidate,
              matchKey,
              sender: 'referee'
            });
          }
        };
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        sendSignalingMessage({
          type: 'offer',
          peerId,
          sdp: offer,
          matchKey,
          sender: 'referee'
        });
      } else if (type === 'answer') {
        const pc = peerConnectionsRef.current[peerId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const queue = iceQueuesRef.current[peerId];
          if (queue) {
            for (const cand of queue) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.error("Lỗi addIceCandidate từ queue:", e);
              }
            }
            delete iceQueuesRef.current[peerId];
          }
        }
      } else if (type === 'ice-candidate') {
        const pc = peerConnectionsRef.current[peerId];
        if (pc && candidate) {
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              if (!iceQueuesRef.current[peerId]) {
                iceQueuesRef.current[peerId] = [];
              }
              iceQueuesRef.current[peerId].push(candidate);
            }
          } catch (e) {
            console.error("Lỗi addIceCandidate referee:", e);
          }
        }
      }
    };
    
    channel.bind('match_signaling', handleSignaling);
    
    return () => {
      channel.unbind('match_signaling', handleSignaling);
      pusher.unsubscribe(tournamentId);
    };
  }, [isLoaded, tournamentId, matchKey, isBroadcasting]);

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
            
            if (!mKey) {
              if (parsed.format === 'double_elimination') {
                mKey = 'u-0-0';
              } else if (parsed.format === 'round_robin' && parsed.groups?.[0]?.matches?.[0]) {
                mKey = 'g-0-0';
              } else if (parsed.bracket) {
                const r = parsed.bracket.currentRound ?? 0;
                const m = parsed.bracket.currentMatch ?? 0;
                mKey = `${r}-${m}`;
              }
              if (mKey) {
                setMatchKey(mKey);
              }
            }

            const mState = mKey ? parsed.matchStates?.[mKey] : parsed.matchState;
            if (mState) {
              setMatchState({
                ...mState,
                isRunning: !!mState.isRunning,
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
        
        if (!mKey) {
          if (data.format === 'double_elimination') {
            mKey = 'u-0-0';
          } else if (data.format === 'round_robin' && data.groups?.[0]?.matches?.[0]) {
            mKey = 'g-0-0';
          } else if (data.bracket) {
            const r = data.bracket.currentRound ?? 0;
            const m = data.bracket.currentMatch ?? 0;
            mKey = `${r}-${m}`;
          }
          if (mKey) {
            setMatchKey(mKey);
          }
        }

        const mState = mKey ? data.matchStates?.[mKey] : data.matchState;
        if (mState) {
          setMatchState({
            ...mState,
            isRunning: !!mState.isRunning,
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
    if (!tournament || tournament.format === 'round_robin' || tournament.format === 'double_elimination' || tournament.format === 'league' || tournament.format === 'battle_royale' || tournament.bracket?.rounds?.length) return;

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

      const currentStored = tournament.matchStates?.[matchKey];
      const isEquivalent = currentStored && 
        currentStored.team1Score === matchState.team1Score &&
        currentStored.team2Score === matchState.team2Score &&
        currentStored.time === matchState.time &&
        currentStored.isRunning === matchState.isRunning &&
        currentStored.hiep === matchState.hiep &&
        currentStored.isFinished === matchState.isFinished &&
        (currentStored.buGio ?? 0) === (matchState.buGio ?? 0) &&
        (currentStored.team1SetPoints ?? 0) === (matchState.team1SetPoints ?? 0) &&
        (currentStored.team2SetPoints ?? 0) === (matchState.team2SetPoints ?? 0) &&
        currentStored.streamType === matchState.streamType &&
        currentStored.streamUrl === matchState.streamUrl;

      if (isEquivalent) {
        return;
      }

      const updatedMatchStates = {
        ...(tournament.matchStates || {}),
        [matchKey]: matchState
      };

      let updatedLeagueMatches = tournament.leagueMatches;
      if (matchKey.startsWith('league-') || matchKey.startsWith('m-')) {
        updatedLeagueMatches = (tournament.leagueMatches || []).map((m: any) => {
          if (m.id === matchKey) {
            return {
              ...m,
              streamType: matchState.streamType,
              streamUrl: matchState.streamUrl
            };
          }
          return m;
        });
      }

      const updatedTournament = {
        ...tournament,
        matchStates: updatedMatchStates,
        matchState: matchState,
        leagueMatches: updatedLeagueMatches,
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

      setTournament(updatedTournament);
    }
  }, [matchState, tournament, isLoaded, currentTournamentKey, tournamentsKey, matchKey]);

  // Sync tournament state to backend on key changes and every 15 seconds of match time
  useEffect(() => {
    if (!isLoaded || !tournament || !matchKey) return;

    if (backendKeyRef.current !== matchKey) {
      backendKeyRef.current = matchKey;
      return;
    }

    const currentStored = tournament.matchStates?.[matchKey];
    const isEquivalent = currentStored && 
      currentStored.team1Score === matchState.team1Score &&
      currentStored.team2Score === matchState.team2Score &&
      currentStored.time === matchState.time &&
      currentStored.isRunning === matchState.isRunning &&
      currentStored.hiep === matchState.hiep &&
      currentStored.isFinished === matchState.isFinished &&
      (currentStored.buGio ?? 0) === (matchState.buGio ?? 0) &&
      (currentStored.team1SetPoints ?? 0) === (matchState.team1SetPoints ?? 0) &&
      (currentStored.team2SetPoints ?? 0) === (matchState.team2SetPoints ?? 0) &&
      currentStored.streamType === matchState.streamType &&
      currentStored.streamUrl === matchState.streamUrl;

    if (isEquivalent) {
      return;
    }

    const updatedMatchStates = {
      ...(tournament.matchStates || {}),
      [matchKey]: matchState
    };

    let updatedLeagueMatches = tournament.leagueMatches;
    if (matchKey.startsWith('league-') || matchKey.startsWith('m-')) {
      updatedLeagueMatches = (tournament.leagueMatches || []).map((m: any) => {
        if (m.id === matchKey) {
          return {
            ...m,
            streamType: matchState.streamType,
            streamUrl: matchState.streamUrl
          };
        }
        return m;
      });
    }

    const updatedTournament = {
      ...tournament,
      matchStates: updatedMatchStates,
      matchState: matchState,
      leagueMatches: updatedLeagueMatches,
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
    matchState.streamType,
    matchState.streamUrl,
    Math.floor(matchState.time / 15),
    tournament,
    isLoaded,
    matchKey
  ]);

  // Timer is disabled for Esports
  useEffect(() => {
    // No timer interval for Esports
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartStop = () => {
    if (!tournament || !matchKey) return;

    const { roundIndex, matchIndex } = getParsedIndices(matchKey);

    const activeMatches = [...(tournament.bracket?.activeMatches || [])];
    let bracketUpdated = false;
    let updatedBracket = tournament.bracket;
    if (tournament.bracket && !activeMatches.includes(matchIndex)) {
      activeMatches.push(matchIndex);
      updatedBracket = {
        ...tournament.bracket,
        activeMatches,
        currentRound: matchKey.startsWith('u-') || matchKey.startsWith('l-') ? roundIndex : tournament.bracket.currentRound,
        currentMatch: matchIndex,
      };
      bracketUpdated = true;
    }

    setMatchState(prev => ({ ...prev, isRunning: !prev.isRunning }));

    if (bracketUpdated) {
      const updatedTournament = {
        ...tournament,
        bracket: updatedBracket
      };
      setTournament(updatedTournament);
    }
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

  const handleWinGame = (winner: 'team1' | 'team2') => {
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

  const handleRevertWinGame = (winner: 'team1' | 'team2') => {
    setMatchState(prev => {
      const isTeam1 = winner === 'team1';
      return {
        ...prev,
        team1Score: Math.max(0, prev.team1Score - (isTeam1 ? 1 : 0)),
        team2Score: Math.max(0, prev.team2Score - (isTeam1 ? 0 : 1)),
        hiep: Math.max(1, prev.hiep - 1)
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

    const updatedTournament = JSON.parse(JSON.stringify(tournament));
    let dbMatch = null;
    let isGroup = false;
    let isUpper = false;
    let isLower = false;
    let isGF = false;
    let roundIndex = 0;
    let matchIndex = 0;

    if (matchKey.startsWith('g-')) {
      const parts = matchKey.split('-');
      roundIndex = parseInt(parts[1], 10); // groupIndex
      matchIndex = parseInt(parts[2], 10);
      dbMatch = updatedTournament.groups?.[roundIndex]?.matches?.[matchIndex];
      isGroup = true;
    } else if (matchKey.startsWith('u-')) {
      const parts = matchKey.split('-');
      roundIndex = parseInt(parts[1], 10);
      matchIndex = parseInt(parts[2], 10);
      dbMatch = updatedTournament.bracket?.upperRounds?.[roundIndex]?.[matchIndex];
      isUpper = true;
    } else if (matchKey.startsWith('l-')) {
      const parts = matchKey.split('-');
      roundIndex = parseInt(parts[1], 10);
      matchIndex = parseInt(parts[2], 10);
      dbMatch = updatedTournament.bracket?.lowerRounds?.[roundIndex]?.[matchIndex];
      isLower = true;
    } else if (matchKey.startsWith('gf-')) {
      const parts = matchKey.split('-');
      matchIndex = parseInt(parts[1], 10);
      dbMatch = updatedTournament.bracket?.grandFinal?.[matchIndex];
      isGF = true;
    } else {
      const parts = matchKey.split('-');
      roundIndex = parseInt(parts[0], 10);
      matchIndex = parseInt(parts[1], 10);
      dbMatch = updatedTournament.bracket?.rounds?.[roundIndex]?.[matchIndex];
    }

    if (!dbMatch) return;

    if (matchState.team1Score === matchState.team2Score) {
      alert("Trận đấu không thể kết thúc với tỉ số hòa! Vui lòng cập nhật tỉ số để xác định đội thắng cuộc.");
      return;
    }

    dbMatch.scoreA = matchState.team1Score;
    dbMatch.scoreB = matchState.team2Score;
    dbMatch.isFinished = true;

    if (dbMatch.teamA?.id && !dbMatch.teamA.name) {
      const resolved = updatedTournament.teams?.find((t: any) => t.id === dbMatch.teamA!.id);
      if (resolved) dbMatch.teamA = { id: resolved.id, name: resolved.name };
    }
    if (dbMatch.teamB?.id && !dbMatch.teamB.name) {
      const resolved = updatedTournament.teams?.find((t: any) => t.id === dbMatch.teamB!.id);
      if (resolved) dbMatch.teamB = { id: resolved.id, name: resolved.name };
    }

    const rawWinner = pickWinner(dbMatch.teamA, dbMatch.teamB, matchState.team1Score, matchState.team2Score);
    dbMatch.winner = rawWinner?.id
      ? (updatedTournament.teams?.find((t: any) => t.id === rawWinner.id) || rawWinner)
      : rawWinner;

    const rawLoser = dbMatch.winner?.id === dbMatch.teamA?.id ? dbMatch.teamB : dbMatch.teamA;
    const loser = rawLoser?.id
      ? (updatedTournament.teams?.find((t: any) => t.id === rawLoser.id) || rawLoser)
      : rawLoser;

    const nextMatchState: MatchState = {
      ...matchState,
      isRunning: false,
      isFinished: true,
    };

    const updatedMatchStates = {
      ...(updatedTournament.matchStates || {}),
      [matchKey]: nextMatchState,
    };
    updatedTournament.matchStates = updatedMatchStates;
    updatedTournament.matchState = nextMatchState;

    let bracketFinished = false;

    if (isGroup) {
      const allGroupMatchesFinished = updatedTournament.groups.every((g: any) =>
        g.matches.every((m: any) => m.isFinished || (g.name === updatedTournament.groups[roundIndex].name && m.id === dbMatch.id))
      );
    } else if (isUpper || isLower || isGF) {
      advanceDoubleElimination(updatedTournament.bracket, roundIndex, matchIndex, dbMatch.winner, loser, isUpper);
      
      const activeMatches = (updatedTournament.bracket.activeMatches || []).filter((idx: number) => idx !== matchIndex);
      updatedTournament.bracket.activeMatches = activeMatches;

      if (isGF) {
        if (matchIndex === 0) {
          if (dbMatch.winner?.id === dbMatch.teamA?.id) {
            updatedTournament.bracket.isFinished = true;
            bracketFinished = true;
          } else {
            updatedTournament.bracket.grandFinal.push({
              teamA: dbMatch.teamA,
              teamB: dbMatch.teamB,
              scoreA: null,
              scoreB: null,
              isFinished: false,
            });
            updatedTournament.bracket.currentMatch = 1;
          }
        } else if (matchIndex === 1) {
          updatedTournament.bracket.isFinished = true;
          bracketFinished = true;
        }
      } else {
        const bracket = updatedTournament.bracket;
        const upperFinalDone = bracket.upperRounds[bracket.upperRounds.length - 1][0].isFinished;
        const lowerFinalDone = bracket.lowerRounds[bracket.lowerRounds.length - 1][0].isFinished;
        if (upperFinalDone && lowerFinalDone) {
          const gf = bracket.grandFinal[0];
          if (gf.teamA?.name === '?' || gf.teamB?.name === '?') {
            gf.teamA = bracket.upperRounds[bracket.upperRounds.length - 1][0].winner;
            gf.teamB = bracket.lowerRounds[bracket.lowerRounds.length - 1][0].winner;
          }
        }
      }
    } else {
      const bracket = updatedTournament.bracket;
      const round = bracket.rounds[roundIndex] || [];
      const activeMatches = (bracket.activeMatches || []).filter((idx: number) => idx !== matchIndex);
      bracket.activeMatches = activeMatches;

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

        const resolvedWinners = winners.map(w =>
          w.id ? (updatedTournament.teams?.find((t: any) => t.id === w.id) || w) : w
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
          bracket.activeMatches = [];
        } else {
          bracket.isFinished = true;
          bracketFinished = true;
        }
      }
    }

    updatedTournament.anyMatchRunning = Object.values(updatedMatchStates).some((ms: any) => ms.isRunning && !ms.isFinished);

    if (bracketFinished || (updatedTournament.bracket && updatedTournament.bracket.isFinished)) {
      setFinishedMatchInfo({
        teamA: dbMatch.teamA?.name || 'Đội 1',
        teamB: dbMatch.teamB?.name || 'Đội 2',
        scoreA: matchState.team1Score,
        scoreB: matchState.team2Score,
        roundLabel: isGF ? 'Chung kết tổng' : getMatchLabel(matchKey, updatedTournament),
      });

      setPendingFinishData({ bracket: updatedTournament.bracket, nextMatchState, updatedTournament });
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
  const { roundIndex, matchIndex } = getParsedIndices(matchKey);
  
  const getSelectedBracketMatch = () => {
    if (!tournament || !matchKey) return null;
    if (matchKey.startsWith('league-') || matchKey.startsWith('m-')) {
      return tournament.leagueMatches?.find((m: any) => m.id === matchKey) || null;
    }
    if (matchKey.startsWith('g-')) {
      const parts = matchKey.split('-');
      const gIdx = parseInt(parts[1], 10);
      const mIdx = parseInt(parts[2], 10);
      return tournament.groups?.[gIdx]?.matches?.[mIdx] || null;
    }
    if (matchKey.startsWith('u-')) {
      const parts = matchKey.split('-');
      const rIdx = parseInt(parts[1], 10);
      const mIdx = parseInt(parts[2], 10);
      return tournament.bracket?.upperRounds?.[rIdx]?.[mIdx] || null;
    }
    if (matchKey.startsWith('l-')) {
      const parts = matchKey.split('-');
      const rIdx = parseInt(parts[1], 10);
      const mIdx = parseInt(parts[2], 10);
      return tournament.bracket?.lowerRounds?.[rIdx]?.[mIdx] || null;
    }
    if (matchKey.startsWith('gf-')) {
      const parts = matchKey.split('-');
      const mIdx = parseInt(parts[1], 10);
      return tournament.bracket?.grandFinal?.[mIdx] || null;
    }

    if (!tournament.bracket) return null;
    const parts = matchKey.split('-');
    const rIdx = parseInt(parts[0], 10) || 0;
    const mIdx = parseInt(parts[1], 10) || 0;
    const round = tournament.bracket.rounds?.[rIdx];
    if (!round) return null;
    return round[mIdx] || null;
  };

  const currentBracketMatch = getSelectedBracketMatch();
  const fallbackTeamA = fallbackTeams[matchIndex * 2];
  const fallbackTeamB = fallbackTeams[matchIndex * 2 + 1];
  const team1 = resolveTeamRef(tournament, currentBracketMatch?.teamA) || fallbackTeamA || tournament.teams?.[0];
  const team2 = resolveTeamRef(tournament, currentBracketMatch?.teamB) || fallbackTeamB || tournament.teams?.[1];
  const roundLabel = getMatchLabel(matchKey, tournament);

  const winnableTeam = null;

  const handleBrPlacementChange = (teamId: string, val: string) => {
    const numericRank = val === '' ? null : parseInt(val, 10);
    const pointRules = tournament.pointRules || {
      "1": 10, "2": 6, "3": 5, "4": 4, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1
    };

    setBrResults(prev => prev.map((r: any) => {
      if (r.teamId === teamId) {
        const placementPoints = numericRank !== null ? (pointRules[numericRank.toString()] || 0) : 0;
        const killPoints = Number(r.kills || 0) * 1;
        const totalPoints = placementPoints + killPoints;
        return {
          ...r,
          rank: numericRank,
          placement: numericRank,
          placementPoints,
          killPoints,
          totalPoints,
          pts: totalPoints
        };
      }
      return r;
    }));
  };

  const handleBrKillsChange = (teamId: string, val: string) => {
    const numericKills = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
    const pointRules = tournament.pointRules || {
      "1": 10, "2": 6, "3": 5, "4": 4, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1
    };

    setBrResults(prev => prev.map((r: any) => {
      if (r.teamId === teamId) {
        const placementPoints = r.placement !== null && r.placement !== undefined && r.placement !== '' ? (pointRules[r.placement.toString()] || 0) : 0;
        const killPoints = numericKills * 1;
        const totalPoints = placementPoints + killPoints;
        return {
          ...r,
          kills: numericKills,
          placementPoints,
          killPoints,
          totalPoints,
          pts: totalPoints
        };
      }
      return r;
    }));
  };

  const saveBattleRoyaleMatchResults = async (isFinal: boolean) => {
    if (!tournament || !matchKey) return;

    // Validate placements if final
    if (isFinal) {
      const placements = brResults.map(r => r.placement);
      const hasEmptyPlacement = placements.some(p => p === '' || p === null || p === undefined);
      if (hasEmptyPlacement) {
        alert('Vui lòng nhập thứ hạng (placement) cho tất cả các đội trước khi kết thúc.');
        return;
      }

      const placementSet = new Set(placements.filter(p => p !== null && p !== undefined));
      if (placementSet.size !== placements.length) {
        if (!window.confirm('Có một số thứ hạng bị trùng lặp. Bạn có muốn tiếp tục kết thúc không?')) {
          return;
        }
      }
    } else {
      // Just check duplicates when saving temporary but don't block
      const placements = brResults.map(r => r.placement).filter(p => p !== null && p !== undefined && p !== '');
      const placementSet = new Set(placements);
      if (placementSet.size !== placements.length) {
        if (!window.confirm('Có một số thứ hạng bị trùng lặp. Bạn có muốn tiếp tục lưu không?')) {
          return;
        }
      }
    }

    const pointRules = tournament.pointRules || {
      "1": 10, "2": 6, "3": 5, "4": 4, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1
    };

    const calculatedResults = brResults.map((r: any) => {
      const placementVal = r.placement === '' || r.placement === null || r.placement === undefined ? null : Number(r.placement);
      const placementPoints = placementVal !== null ? (pointRules[placementVal.toString()] || 0) : 0;
      const killPoints = Number(r.kills || 0) * 1;
      const totalPoints = placementPoints + killPoints;

      return {
        ...r,
        rank: placementVal,
        placement: placementVal,
        kills: Number(r.kills || 0),
        placementPoints,
        killPoints,
        totalPoints,
        pts: totalPoints
      };
    });

    const updatedMatches = (tournament.matches || []).map((m: any) => {
      if (m.id === matchKey) {
        return {
          ...m,
          isFinished: isFinal,
          results: calculatedResults
        };
      }
      return m;
    });

    const allMatchesFinished = updatedMatches.every((m: any) => m.isFinished);

    const updatedTournament = {
      ...tournament,
      matches: updatedMatches,
      isFinished: allMatchesFinished,
    };

    setTournament(updatedTournament);
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
      console.error('Error syncing Battle Royale results to backend:', err);
    }

    alert(isFinal ? 'Đã hoàn tất trận đấu!' : 'Đã lưu kết quả tạm thời!');
    if (isFinal) {
      router.push(`/tournaments/${tournament.id}`);
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
          <div className="text-sm text-white/50">
            {tournament.name} • {
              tournament.sport === 'battle_royale' ? 'Game Sinh tồn (PUBG)' : 
              tournament.sport === 'moba' ? 'Game MOBA' :
              tournament.sport === 'fps' ? 'Game FPS' : 
              tournament.sport === 'fighting_sports' ? 'Game Đối kháng / FIFA' : 
              tournament.sport
            }
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
        {matchKey?.startsWith('br-') ? (
          <div className="space-y-8 animate-fade-in">
            {/* Title / Header */}
            <div className="text-center">
              <h1 className="text-3xl font-black mb-2">Nhập Điểm Giải Đấu Sinh Tồn</h1>
              <p className="text-white/60">
                {tournament.matches?.find((m: any) => m.id === matchKey)?.name || 'Trận đấu'}
              </p>
            </div>

            {/* Main Scoring Table */}
            <div className="bg-[#0f1419] border border-white/[0.06] rounded-2xl p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-white/50">
                      <th className="py-3 px-4">Đội tuyển</th>
                      <th className="py-3 px-4 text-center w-28 font-bold text-white">Thứ hạng</th>
                      <th className="py-3 px-4 text-center w-28 font-bold text-white">Mạng hạ gục (Kills)</th>
                      <th className="py-3 px-4 text-center w-24 font-bold text-white">Điểm Hạng</th>
                      <th className="py-3 px-4 text-center w-24 font-bold text-white">Điểm Mạng</th>
                      <th className="py-3 px-4 text-center w-24 font-bold text-white">Tổng điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brResults.map((result: any) => {
                      const pointRules = tournament.pointRules || {
                        "1": 10, "2": 6, "3": 5, "4": 4, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1
                      };
                      const placementPoints = result.placement !== null && result.placement !== undefined && result.placement !== '' ? (pointRules[result.placement.toString()] || 0) : 0;
                      const killPoints = Number(result.kills || 0) * 1;
                      const totalPoints = placementPoints + killPoints;

                      return (
                        <tr key={result.teamId} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          <td className="py-3 px-4 font-bold text-white text-sm">{result.teamName}</td>
                          <td className="py-3 px-4 text-center">
                            <select
                              value={result.placement !== null && result.placement !== undefined ? result.placement : ''}
                              onChange={(e) => handleBrPlacementChange(result.teamId, e.target.value)}
                              className="w-full max-w-[100px] px-2 py-1.5 rounded bg-[#080b10] border border-white/[0.08] text-white text-center text-xs font-bold focus:outline-none focus:border-[#22c55e] transition-colors inline-block"
                            >
                              <option value="">Chọn...</option>
                              {Array.from({ length: tournament.teams?.length || 0 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                  Hạng {i + 1}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleBrKillsChange(result.teamId, String(Math.max(0, Number(result.kills || 0) - 1)))}
                                className="w-6 h-6 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 text-xs font-bold transition-all flex items-center justify-center"
                                title="Trừ 1 mạng"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={result.kills ?? 0}
                                onChange={(e) => handleBrKillsChange(result.teamId, e.target.value)}
                                className="w-14 px-1.5 py-1 rounded bg-[#080b10] border border-white/[0.08] text-white text-center text-xs font-black focus:outline-none focus:border-[#22c55e] transition-colors"
                              />
                              <button
                                type="button"
                                onClick={() => handleBrKillsChange(result.teamId, String(Number(result.kills || 0) + 1))}
                                className="w-6 h-6 rounded bg-[#22c55e]/20 hover:bg-[#22c55e]/30 border border-[#22c55e]/50 text-green-400 text-xs font-bold transition-all flex items-center justify-center"
                                title="Cộng 1 mạng"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-blue-400 font-bold text-sm">
                            {placementPoints}
                          </td>
                          <td className="py-3 px-4 text-center text-red-400 font-bold text-sm">
                            {killPoints}
                          </td>
                          <td className="py-3 px-4 text-center text-[#22c55e] font-black text-sm bg-[#22c55e]/5">
                            {totalPoints}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Link
                href={`/tournaments/${tournament.id}`}
                className="flex-1 px-6 py-3 rounded-xl border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200 text-center text-sm"
              >
                Hủy & Quay lại
              </Link>
              <button
                onClick={() => saveBattleRoyaleMatchResults(false)}
                className="flex-1 px-6 py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 font-semibold hover:bg-blue-500/20 transition-all duration-200 text-sm"
              >
                Lưu tạm thời
              </button>
              <button
                onClick={() => saveBattleRoyaleMatchResults(true)}
                className="flex-1 px-6 py-3 rounded-xl bg-[#22c55e] text-[#080b10] font-black hover:bg-[#16a34a] shadow-[0_0_20px_rgba(34,197,94,0.25)] transition-all duration-200 text-sm"
              >
                Hoàn tất trận đấu
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Match Header */}
        <div className="text-center mb-8">
          <div className="text-sm font-semibold text-[#22c55e] mb-2">{roundLabel}</div>
        </div>

        {/* Score Board */}
        {tournament.format === 'league' ? (
          <div className="space-y-8 mb-12">
            {/* Simplified League match control */}
            <div className="flex flex-col items-center justify-center p-8 bg-[#0f1419] border border-white/[0.06] rounded-2xl max-w-md mx-auto gap-5 shadow-xl">
              <h3 className="text-base font-black text-[#22c55e] uppercase tracking-wider">{roundLabel}</h3>
              
              {/* Start/Stop Button */}
              {matchState.isFinished ? (
                <div className="px-6 py-3 rounded-lg font-bold text-xs bg-white/[0.02] border border-white/[0.08] text-white/40 uppercase tracking-widest cursor-not-allowed">
                  🏁 Trận đấu đã kết thúc
                </div>
              ) : !matchState.isRunning ? (
                <button
                  onClick={handleStartStop}
                  className="px-8 py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-200 border bg-[#22c55e]/20 hover:bg-[#22c55e]/30 border-[#22c55e]/50 text-green-400"
                >
                  ▶ Bắt đầu trận đấu
                </button>
              ) : null}

              {/* Status */}
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                matchState.isFinished
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : matchState.isRunning
                  ? 'bg-[#22c55e]/20 text-green-400 border border-[#22c55e]/40 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  matchState.isFinished ? 'bg-red-400' : matchState.isRunning ? 'bg-[#22c55e] animate-pulse' : 'bg-blue-400'
                }`} />
                {matchState.isFinished ? 'Đã kết thúc' : matchState.isRunning ? 'Đang phát sóng (LIVE)' : 'Sẵn sàng'}
              </div>
            </div>

            {/* League Team List Reference */}
            <div className="p-6 bg-[#0f1419] border border-white/[0.06] rounded-2xl">
              <h5 className="text-xs font-black tracking-widest text-white/40 uppercase mb-4 text-center">
                Đội tuyển thi đấu ({tournament.teams?.length || 0})
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(tournament.teams || []).map((team: any) => (
                  <div key={team.id} className="p-3.5 rounded-xl bg-[#080b10] border border-white/[0.04] flex flex-col items-center justify-center text-center">
                    <span className="font-extrabold text-xs text-white truncate max-w-full">{team.name}</span>
                    <span className="text-[10px] text-white/30 mt-1 font-semibold">
                      {team.members && team.members.length > 0 ? `${team.members.length} thành viên` : 'Chưa xếp đội hình'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6 mb-12">
            {/* Team 1 */}
            <div className="text-center">
              <div className="mb-4">
                <h2 className="text-2xl font-black mb-2">{team1?.name || 'Team 1'}</h2>
                {team1?.members && team1.members.length > 0 && (
                  <p className="text-sm text-white/60">{team1.members.length} thành viên</p>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 max-w-[180px] mx-auto">
                <button
                  onClick={() => handleScoreChange('team1', -1)}
                  className="px-3.5 py-2.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 text-sm font-bold transition-all"
                  title="Trừ 1 điểm"
                >
                  −
                </button>
                <button
                  onClick={() => handleScoreChange('team1', 1)}
                  className="flex-1 py-2.5 px-3 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 border border-[#22c55e]/50 text-xs font-bold transition-all text-green-400"
                >
                  + Điểm số
                </button>
              </div>
            </div>

            {/* Score & Time */}
            <div className="flex flex-col items-center justify-center">
              {/* Score */}
              <div className="flex flex-col items-center gap-1 mb-6">
                <div className="text-[10px] font-black tracking-widest text-white/40 uppercase">Tỉ số</div>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-black">{matchState.team1Score}</div>
                  <div className="text-3xl font-black text-white/50">−</div>
                  <div className="text-5xl font-black">{matchState.team2Score}</div>
                </div>
              </div>

              {/* Start Button */}
              {matchState.isFinished ? (
                <div className="px-6 py-3 rounded-lg font-semibold bg-gray-500/20 border border-gray-500/30 text-gray-400 mb-4 cursor-not-allowed">
                  🏁 Trận đấu đã kết thúc
                </div>
              ) : !matchState.isRunning ? (
                <div className="flex flex-col gap-2 w-full max-w-[200px] mb-4">
                  {!matchState.isRunning && (
                    <button
                      onClick={handleStartStop}
                      className="w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 border bg-[#22c55e]/20 hover:bg-[#22c55e]/30 border-[#22c55e]/50 text-green-400"
                    >
                      ▶ Bắt đầu trận đấu
                    </button>
                  )}
                  {tournament?.sport === 'fighting_sports' && (
                    <button
                      onClick={() => setMatchState(prev => ({ ...prev, hiep: prev.hiep + 1 }))}
                      className="w-full px-4 py-2 rounded-lg font-bold text-xs bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-400 transition-all duration-200"
                    >
                      ➔ Qua Hiệp {matchState.hiep + 1}
                    </button>
                  )}
                </div>
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
                {matchState.isFinished ? 'Đã kết thúc' : matchState.isRunning ? 'Đang phát sóng' : 'Sẵn sàng'}
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
              <div className="flex items-center justify-center gap-2 max-w-[180px] mx-auto">
                <button
                  onClick={() => handleScoreChange('team2', -1)}
                  className="px-3.5 py-2.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 text-sm font-bold transition-all"
                  title="Trừ 1 điểm"
                >
                  −
                </button>
                <button
                  onClick={() => handleScoreChange('team2', 1)}
                  className="flex-1 py-2.5 px-3 rounded-lg bg-[#22c55e]/20 hover:bg-[#22c55e]/30 border border-[#22c55e]/50 text-xs font-bold transition-all text-green-400"
                >
                  + Điểm số
                </button>
              </div>
            </div>
          </div>
        )}




        {/* Livestream Configuration */}
        <div className="p-5 rounded-lg bg-[#0f1419] border border-white/[0.06] mb-12 animate-fade-in-up">
          <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            Cấu hình phát trực tiếp (Livestream)
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-2">
                Nguồn phát (Nền tảng hoặc thiết bị)
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleStreamTypeChange('youtube')}
                  className={`py-2.5 px-3 rounded-lg border font-bold text-xs transition-all ${
                    streamType === 'youtube'
                      ? 'border-red-500 bg-red-500/10 text-red-400'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white'
                  }`}
                >
                  YouTube URL
                </button>
                <button
                  onClick={() => handleStreamTypeChange('twitch')}
                  className={`py-2.5 px-3 rounded-lg border font-bold text-xs transition-all ${
                    streamType === 'twitch'
                      ? 'border-[#a855f7] bg-[#a855f7]/10 text-[#a855f7]'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white'
                  }`}
                >
                  Twitch URL
                </button>
                <button
                  onClick={() => handleStreamTypeChange('webcam')}
                  className={`py-2.5 px-3 rounded-lg border font-bold text-xs transition-all ${
                    streamType === 'webcam'
                      ? 'border-[#22c55e] bg-[#22c55e]/10 text-green-400 font-extrabold'
                      : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white'
                  }`}
                >
                  🎥 Webcam trực tiếp
                </button>
              </div>
            </div>

            {streamType === 'webcam' ? (
              <div className="p-4 rounded-lg bg-[#080b10] border border-white/[0.04]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-white/60 font-semibold">Tình trạng máy quay (Webcam stream)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    isBroadcasting ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white/10 text-white/50'
                  }`}>
                    {isBroadcasting ? 'ĐANG PHÁT (BROADCASTING)' : 'SẴN SÀNG'}
                  </span>
                </div>

                {isBroadcasting && (
                  <video
                    ref={broadcasterVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full aspect-video object-cover rounded-lg border border-white/10 mb-3 bg-black"
                  />
                )}

                <div className="flex gap-2">
                  {!isBroadcasting ? (
                    <>
                      <button
                        onClick={startWebcamBroadcast}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-[#22c55e] text-[#080b10] font-black text-xs hover:bg-[#16a34a] transition-all flex items-center justify-center gap-1.5"
                      >
                        🎥 Phát Webcam
                      </button>
                      <button
                        onClick={startScreenShareBroadcast}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-[#3b82f6] text-white font-black text-xs hover:bg-[#2563eb] transition-all flex items-center justify-center gap-1.5"
                      >
                        🖥️ Chia sẻ màn hình
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={stopWebcamBroadcast}
                      className="w-full py-2.5 px-4 rounded-lg bg-red-500 text-white font-black text-xs hover:bg-red-600 transition-all"
                    >
                      Tạm dừng truyền hình
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-2">
                  Đường dẫn (Stream URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={streamUrlInput}
                    onChange={(e) => setStreamUrlInput(e.target.value)}
                    placeholder={
                      streamType === 'youtube'
                        ? 'VD: https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                        : streamType === 'twitch'
                        ? 'VD: https://www.twitch.tv/ninja'
                        : 'Vui lòng chọn loại nguồn phát phía trên...'
                    }
                    disabled={!streamType}
                    className="flex-1 px-4 py-2 rounded-lg bg-[#080b10] border border-white/[0.06] text-white placeholder-white/30 text-xs focus:outline-none focus:border-[#22c55e] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={saveStreamUrl}
                    disabled={!streamType}
                    className="px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] font-black text-xs hover:bg-[#16a34a] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Lưu cấu hình
                  </button>
                </div>
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
        </>
        )}
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