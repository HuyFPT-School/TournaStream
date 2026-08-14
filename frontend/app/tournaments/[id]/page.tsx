'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchTournamentFromBackend, syncTournamentToBackend } from '@/app/lib/tournaments';
import { useTournament } from '@/app/contexts/TournamentContext';
import { getSession, getApiBaseUrl, getAccessToken } from '@/app/lib/authStorage';
import { getPusherClient } from '@/app/lib/pusher';
import {
  pickWinner as pickWinnerEngine,
  advanceSingleElimination as advanceSingleEliminationEngine,
  advanceDoubleElimination as advanceDoubleEliminationEngine,
  buildSingleEliminationBracket,
  buildDoubleEliminationBracket,
  getTournamentChampion,
  isSameTeam,
  padTeamsToPowerOfTwo,
  isPowerOfTwo
} from '@/app/lib/bracketEngine';
import FormatGuideModal from '@/app/components/FormatGuideModal';

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
  streamType?: 'youtube' | 'twitch' | 'webcam' | null;
  streamUrl?: string;
}

type TeamRef = { id?: string; name?: string; isBye?: boolean };

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

function pickWinner(teamA: TeamRef | undefined, teamB: TeamRef | undefined, scoreA: number | null | undefined, scoreB: number | null | undefined) {
  if (scoreA === null || scoreB === null || scoreA === undefined || scoreB === undefined) return null;
  if (scoreA === scoreB) return null;
  const aIsBye = teamA?.name === 'BYE';
  const bIsBye = teamB?.name === 'BYE';
  if (bIsBye && !aIsBye) return teamA || null;
  if (aIsBye && !bIsBye) return teamB || null;
  if (scoreA > scoreB) return teamA || null;
  if (scoreB > scoreA) return teamB || null;
  return null;
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

function getCurrentBracketMatch(bracket?: BracketState) {
  if (!bracket) return null;
  const round = bracket.rounds[bracket.currentRound];
  if (!round) return null;
  return round[bracket.currentMatch] || null;
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

function buildInitialBracket(teams: TeamRef[]): any {
  return buildSingleEliminationBracket(teams);
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

function calculateGroupStandings(groupTeams: TeamRef[], groupMatches: any[], matchStates: any): StandingRow[] {
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

function getPlacementPoints(rank: number | null, pointRules?: Record<string, number>): number {
  if (rank === null || rank === undefined) return 0;
  if (pointRules && pointRules[String(rank)] !== undefined) {
    return Number(pointRules[String(rank)]) || 0;
  }
  if (rank === 1) return 10;
  if (rank === 2) return 6;
  if (rank === 3) return 5;
  if (rank === 4) return 4;
  if (rank === 5) return 3;
  if (rank === 6) return 2;
  if (rank === 7 || rank === 8) return 1;
  return 0;
}

function calculateBattleRoyaleStandings(teams: any[], matches: any[], pointRules?: Record<string, number>) {
  const standings = teams.map((team: any) => {
    const teamId = team.id || team.name;
    let mp = 0;
    let placementPts = 0;
    let killPts = 0;

    matches?.forEach((match: any) => {
      if (match.isFinished) {
        const teamResult = match.results?.find((r: any) => (r.teamId === teamId || r.teamName === team.name));
        if (teamResult && teamResult.rank !== null && teamResult.rank !== undefined) {
          mp += 1;
          placementPts += getPlacementPoints(teamResult.rank, pointRules);
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
      const team = standingsMap[res.teamId] || standingsMap[res.teamName];
      if (team) {
        if (match.isFinished || (res.placement !== null && res.placement !== undefined && res.placement !== '') || res.pts !== undefined || res.rank !== undefined) {
          team.matchesPlayed += 1;
        }
        const kills = Number(res.kills || 0);
        const rankVal = res.placement ?? res.rank;
        const calcPlacementPts = (res.placementPoints !== undefined && res.placementPoints !== null)
          ? Number(res.placementPoints)
          : (rankVal !== null && rankVal !== undefined && rankVal !== '' ? getPlacementPoints(Number(rankVal), pointRules) : 0);
        const calcKillPts = (res.killPoints !== undefined && res.killPoints !== null)
          ? Number(res.killPoints)
          : kills;

        team.totalKills += kills;
        team.placementPoints += calcPlacementPts;
        team.killPoints += calcKillPts;
        team.totalPoints += (res.totalPoints !== undefined && res.totalPoints !== null)
          ? Number(res.totalPoints)
          : (res.pts !== undefined && res.pts !== null) ? Number(res.pts) : (calcPlacementPts + calcKillPts);

        if (Number(rankVal) === 1) {
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

function seedKnockoutFromGroups(groups: any[], advancingCount: number, matchStates: any): TeamRef[] {
  const groupStandings = groups.map((g, gIdx) => {
    return {
      groupIdx: gIdx,
      name: g.name,
      standings: calculateGroupStandings(g.teams, g.matches, matchStates)
    };
  });

  const candidates: Array<{ team: TeamRef; rank: number; groupIdx: number }> = [];
  groupStandings.forEach((gs) => {
    for (let r = 0; r < advancingCount; r++) {
      const row = gs.standings[r];
      if (row) {
        candidates.push({
          team: { id: row.teamId, name: row.teamName },
          rank: r + 1,
          groupIdx: gs.groupIdx
        });
      }
    }
  });

  const seeded: TeamRef[] = [];
  const numGroups = groups.length;

  if (numGroups === 1) {
    if (candidates.length === 4) {
      seeded.push(candidates[0].team, candidates[3].team, candidates[1].team, candidates[2].team);
    } else {
      candidates.forEach(c => seeded.push(c.team));
    }
  } else if (numGroups === 2) {
    if (advancingCount === 2) {
      const a1 = candidates.find(c => c.groupIdx === 0 && c.rank === 1)?.team;
      const a2 = candidates.find(c => c.groupIdx === 0 && c.rank === 2)?.team;
      const b1 = candidates.find(c => c.groupIdx === 1 && c.rank === 1)?.team;
      const b2 = candidates.find(c => c.groupIdx === 1 && c.rank === 2)?.team;
      if (a1 && b2) seeded.push(a1, b2);
      if (b1 && a2) seeded.push(b1, a2);
    } else {
      const a1 = candidates.find(c => c.groupIdx === 0 && c.rank === 1)?.team;
      const b1 = candidates.find(c => c.groupIdx === 1 && c.rank === 1)?.team;
      if (a1 && b1) seeded.push(a1, b1);
    }
  } else if (numGroups === 4) {
    if (advancingCount === 2) {
      const getCandidate = (g: number, r: number) => candidates.find(c => c.groupIdx === g && c.rank === r)?.team;
      const a1 = getCandidate(0, 1), a2 = getCandidate(0, 2);
      const b1 = getCandidate(1, 1), b2 = getCandidate(1, 2);
      const c1 = getCandidate(2, 1), c2 = getCandidate(2, 2);
      const d1 = getCandidate(3, 1), d2 = getCandidate(3, 2);

      if (a1 && b2) seeded.push(a1, b2);
      if (c1 && d2) seeded.push(c1, d2);
      if (b1 && a2) seeded.push(b1, a2);
      if (d1 && c2) seeded.push(d1, c2);
    } else {
      const getCandidate = (g: number, r: number) => candidates.find(c => c.groupIdx === g && c.rank === r)?.team;
      const a1 = getCandidate(0, 1);
      const b1 = getCandidate(1, 1);
      const c1 = getCandidate(2, 1);
      const d1 = getCandidate(3, 1);
      if (a1 && b1) seeded.push(a1, b1);
      if (c1 && d1) seeded.push(c1, d1);
    }
  } else {
    candidates.forEach(c => seeded.push(c.team));
  }

  return seeded;
}




interface BracketMatchCardProps {
  a: string;
  b: string;
  sa: number | null;
  sb: number | null;
  done: boolean;
  isLive: boolean;
  winner?: string | null;
  onClick: () => void;
}

function BracketMatchCard({ a, b, sa, sb, done, isLive, winner, onClick }: BracketMatchCardProps) {
  const winA = done && winner ? a === winner : (sa !== null && sb !== null && sa > sb);
  const winB = done && winner ? b === winner : (sa !== null && sb !== null && sb > sa);

  return (
    <div
      onClick={onClick}
      className={`w-[160px] rounded-xl border overflow-hidden text-[12px] shadow-lg transition-all duration-300 cursor-pointer ${isLive
        ? 'border-[#22c55e] bg-[#22c55e]/[0.05] shadow-[0_0_15px_rgba(34,197,94,0.15)] scale-[1.03] hover:scale-[1.05]'
        : 'border-white/[0.08] bg-[#0f1419] hover:border-white/[0.15] hover:scale-[1.02]'
        }`}
    >
      {/* Team A */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.04] transition-colors ${winA ? 'bg-[#22c55e]/10' : ''
        }`}>
        <span className={`font-semibold truncate max-w-[100px] ${winA ? 'text-[#22c55e]' : 'text-white/80'
          }`}>
          {a}
        </span>
        {sa !== null && (
          <span className={`font-bold ml-2 ${winA ? 'text-[#22c55e]' : 'text-white/40'
            }`}>
            {sa}
          </span>
        )}
      </div>

      {/* Team B */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 transition-colors ${winB ? 'bg-[#22c55e]/10' : ''
        }`}>
        <span className={`font-semibold truncate max-w-[100px] ${winB ? 'text-[#22c55e]' : 'text-white/80'
          }`}>
          {b}
        </span>
        {sb !== null && (
          <span className={`font-bold ml-2 ${winB ? 'text-[#22c55e]' : 'text-white/40'
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
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-500/10 border-t border-blue-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-blue-500 text-[10px] font-black tracking-wider uppercase">SẴN SÀNG</span>
        </div>
      )}
    </div>
  );
}

function buildBracketData(tournament: any, matchState: any, selectedMatchKey: string | null) {
  if (!tournament) return [];

  const teams = tournament.orderedTeams || tournament.teams || [];
  const numTeams = teams.length;
  if (numTeams < 2) return [];

  const numRounds = tournament.bracket?.rounds?.length || Math.ceil(Math.log2(numTeams));
  const roundsData: any[][] = [];

  const getMatchWinner = (roundIdx: number, matchIdx: number): any => {
    if (roundIdx < 0) return null;
    const roundMatches = tournament.bracket?.rounds?.[roundIdx] || [];
    const match = roundMatches[matchIdx];

    const mKey = `${roundIdx}-${matchIdx}`;
    const isLive = tournament.bracket?.currentRound === roundIdx && (tournament.bracket?.activeMatches || []).includes(matchIdx);

    let currentMS = tournament.matchStates?.[mKey];
    if (selectedMatchKey === mKey) {
      currentMS = matchState;
    }

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
      const round0 = tournament.bracket?.rounds?.[0];
      if (round0 && round0[matchIdx]) {
        const teamRef = slot === 'A' ? round0[matchIdx].teamA : round0[matchIdx].teamB;
        if (teamRef && teamRef.name && teamRef.name !== '?') {
          return tournament.teams?.find((t: any) => t.id === teamRef.id || t.name === teamRef.name) || teamRef;
        }
      }
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

      let currentMS = tournament.matchStates?.[mKey];
      if (selectedMatchKey === mKey) {
        currentMS = matchState;
      }

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

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { loadTournamentData } = useTournament();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<any>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [matchState, setMatchState] = useState<MatchState>({
    team1Score: 0,
    team2Score: 0,
    time: 0,
    isRunning: false,
    hiep: 1,
    isFinished: false,
    buGio: 0,
  });
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);
  const [activeDeTab, setActiveDeTab] = useState<'upper' | 'lower' | 'grand'>('upper');
  const [selectedLeagueMatchId, setSelectedLeagueMatchId] = useState<string | null>(null);
  const [editingResults, setEditingResults] = useState<Record<string, { placement: number | ''; kills: number | '' }>>({});
  const [leagueAutoSaveStatus, setLeagueAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [leagueLastAutoSaveTime, setLeagueLastAutoSaveTime] = useState<string>('');
  const isLeagueEditingInitialMount = useRef(true);

  // WebRTC Livestream states & refs for League Match Editor
  const [leagueStreamType, setLeagueStreamType] = useState<'youtube' | 'twitch' | 'webcam' | null>(null);
  const [leagueStreamUrlInput, setLeagueStreamUrlInput] = useState('');
  const [isLeagueBroadcasting, setIsLeagueBroadcasting] = useState(false);
  const leagueLocalStreamRef = useRef<MediaStream | null>(null);
  const leaguePeerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const leagueIceQueuesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const leagueBroadcasterVideoRef = useRef<HTMLVideoElement | null>(null);

  const handleSelectLeagueMatch = (matchId: string) => {
    setSelectedLeagueMatchId(matchId);
    const matchesList = tournament.leagueMatches || tournament.matches || [];
    const match = matchesList.find((m: any) => m.id === matchId);
    if (match) {
      const resultsMap: Record<string, { placement: number | ''; kills: number | '' }> = {};
      tournament.teams.forEach((team: any) => {
        const res = match.results?.find((r: any) => r.teamId === team.id);
        resultsMap[team.id] = {
          placement: res?.placement !== null && res?.placement !== undefined ? res.placement : '',
          kills: res?.kills !== null && res?.kills !== undefined ? res.kills : 0,
        };
      });
      setEditingResults(resultsMap);
      isLeagueEditingInitialMount.current = true;

      // Sync stream config states
      setLeagueStreamType(match.streamType || null);
      setLeagueStreamUrlInput(match.streamUrl || '');
    }
  };

  const silentAutoSaveLeagueMatchResults = async (resultsMap: Record<string, { placement: number | ''; kills: number | '' }>) => {
    if (!selectedLeagueMatchId || !tournament) return;
    setLeagueAutoSaveStatus('saving');

    const matchesList = tournament.leagueMatches || tournament.matches || [];
    const matchIdx = matchesList.findIndex((m: any) => m.id === selectedLeagueMatchId);
    if (matchIdx === -1) return;

    const teamPlacements = Object.entries(resultsMap).map(([teamId, r]) => ({
      teamId,
      placement: r.placement === '' || r.placement === null || r.placement === undefined ? null : Number(r.placement),
      kills: Number(r.kills || 0),
    }));

    const pointRules = tournament.pointRules || {
      "1": 10, "2": 6, "3": 5, "4": 4, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1
    };

    const updatedResults = teamPlacements.map(tp => {
      const placementPoints = tp.placement !== null ? (pointRules[tp.placement.toString()] || 0) : 0;
      const killPoints = tp.kills * 1;
      const totalPoints = placementPoints + killPoints;

      const teamObj = tournament.teams.find((t: any) => t.id === tp.teamId);

      return {
        teamId: tp.teamId,
        teamName: teamObj?.name || '',
        placement: tp.placement,
        kills: tp.kills,
        placementPoints,
        killPoints,
        totalPoints,
        win: tp.placement === 1
      };
    });

    const updatedMatches = [...matchesList];
    updatedMatches[matchIdx] = {
      ...updatedMatches[matchIdx],
      results: updatedResults
    };

    const updatedTournament = {
      ...tournament,
      ...(tournament.leagueMatches ? { leagueMatches: updatedMatches } : { matches: updatedMatches })
    };

    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));

    const savedList = localStorage.getItem(tournamentsKey);
    if (savedList) {
      try {
        const list = JSON.parse(savedList);
        const idx = list.findIndex((t: any) => t.id === tournament.id);
        if (idx > -1) {
          list[idx] = updatedTournament;
          localStorage.setItem(tournamentsKey, JSON.stringify(list));
        }
      } catch (e) {
        console.error(e);
      }
    }

    try {
      await syncTournamentToBackend(updatedTournament);
      setLeagueAutoSaveStatus('saved');
      setLeagueLastAutoSaveTime(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Error auto-syncing league results:', err);
      setLeagueAutoSaveStatus('error');
    }
  };

  useEffect(() => {
    if (!selectedLeagueMatchId) return;
    if (isLeagueEditingInitialMount.current) {
      isLeagueEditingInitialMount.current = false;
      return;
    }

    setLeagueAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      silentAutoSaveLeagueMatchResults(editingResults);
    }, 700);

    return () => clearTimeout(timer);
  }, [editingResults, selectedLeagueMatchId]);

  const handleSaveLeagueMatchResults = async () => {
    if (!selectedLeagueMatchId || !tournament) return;

    const matchesList = tournament.leagueMatches || tournament.matches || [];
    const matchIdx = matchesList.findIndex((m: any) => m.id === selectedLeagueMatchId);
    if (matchIdx === -1) return;

    const teamPlacements = Object.entries(editingResults).map(([teamId, r]) => ({
      teamId,
      placement: r.placement === '' || r.placement === null || r.placement === undefined ? null : Number(r.placement),
      kills: Number(r.kills || 0),
    }));

    const placementSet = new Set(teamPlacements.map(t => t.placement).filter(p => p !== null));
    if (placementSet.size !== teamPlacements.filter(t => t.placement !== null).length) {
      if (!window.confirm('Có một số thứ hạng bị trùng lặp. Bạn có muốn tiếp tục lưu không?')) {
        return;
      }
    }

    const pointRules = tournament.pointRules || {
      "1": 10, "2": 6, "3": 5, "4": 4, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1
    };

    const updatedResults = teamPlacements.map(tp => {
      const placementPoints = tp.placement !== null ? (pointRules[tp.placement.toString()] || 0) : 0;
      const killPoints = tp.kills * 1;
      const totalPoints = placementPoints + killPoints;

      const teamObj = tournament.teams.find((t: any) => t.id === tp.teamId);

      return {
        teamId: tp.teamId,
        teamName: teamObj?.name || '',
        placement: tp.placement,
        kills: tp.kills,
        placementPoints,
        killPoints,
        totalPoints,
        win: tp.placement === 1
      };
    });

    const updatedMatches = [...matchesList];
    updatedMatches[matchIdx] = {
      ...updatedMatches[matchIdx],
      isFinished: updatedMatches[matchIdx].isFinished || false,
      results: updatedResults
    };

    const updatedTournament = {
      ...tournament,
      ...(tournament.leagueMatches ? { leagueMatches: updatedMatches } : { matches: updatedMatches })
    };

    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));

    const savedList = localStorage.getItem(tournamentsKey);
    if (savedList) {
      try {
        const list = JSON.parse(savedList);
        const idx = list.findIndex((t: any) => t.id === tournament.id);
        if (idx > -1) {
          list[idx] = updatedTournament;
          localStorage.setItem(tournamentsKey, JSON.stringify(list));
        }
      } catch (e) {
        console.error(e);
      }
    }

    try {
      await syncTournamentToBackend(updatedTournament);
      alert('Đã lưu kết quả trận đấu thành công!');
    } catch (err) {
      console.error('Error syncing league match results:', err);
      alert('Có lỗi khi đồng bộ lên hệ thống. Đã lưu tạm ở trình duyệt.');
    }
  };

  const handleFinishLeagueMatch = async () => {
    if (!selectedLeagueMatchId || !tournament) return;

    const matchesList = tournament.leagueMatches || tournament.matches || [];
    const matchIdx = matchesList.findIndex((m: any) => m.id === selectedLeagueMatchId);
    if (matchIdx === -1) return;

    const placements = Object.values(editingResults).map(r => r.placement);
    const hasEmptyPlacement = placements.some(p => p === '');
    if (hasEmptyPlacement) {
      alert('Vui lòng nhập thứ hạng (placement) cho tất cả các đội trước khi kết thúc.');
      return;
    }

    const teamPlacements = Object.entries(editingResults).map(([teamId, r]) => ({
      teamId,
      placement: Number(r.placement),
      kills: Number(r.kills || 0),
    }));

    const placementSet = new Set(teamPlacements.map(t => t.placement));
    if (placementSet.size !== teamPlacements.length) {
      if (!window.confirm('Có một số thứ hạng bị trùng lặp. Bạn có muốn tiếp tục kết thúc không?')) {
        return;
      }
    }

    const pointRules = tournament.pointRules || {
      "1": 10, "2": 6, "3": 5, "4": 4, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1
    };

    const updatedResults = teamPlacements.map(tp => {
      const placementPoints = pointRules[tp.placement.toString()] || 0;
      const killPoints = tp.kills * 1;
      const totalPoints = placementPoints + killPoints;

      const teamObj = tournament.teams.find((t: any) => t.id === tp.teamId);

      return {
        teamId: tp.teamId,
        teamName: teamObj?.name || '',
        placement: tp.placement,
        kills: tp.kills,
        placementPoints,
        killPoints,
        totalPoints,
        win: tp.placement === 1
      };
    });

    const updatedMatches = [...matchesList];
    updatedMatches[matchIdx] = {
      ...updatedMatches[matchIdx],
      isFinished: true,
      results: updatedResults
    };

    const updatedMatchStates = {
      ...(tournament.matchStates || {}),
      [selectedLeagueMatchId]: {
        ...(tournament.matchStates?.[selectedLeagueMatchId] || {}),
        isRunning: false,
        isFinished: true
      }
    };

    const allMatchesFinished = updatedMatches.every((m: any) => m.isFinished);

    const updatedTournament = {
      ...tournament,
      ...(tournament.leagueMatches ? { leagueMatches: updatedMatches } : { matches: updatedMatches }),
      matchStates: updatedMatchStates,
      isFinished: allMatchesFinished
    };

    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));

    const savedList = localStorage.getItem(tournamentsKey);
    if (savedList) {
      try {
        const list = JSON.parse(savedList);
        const idx = list.findIndex((t: any) => t.id === tournament.id);
        if (idx > -1) {
          list[idx] = updatedTournament;
          localStorage.setItem(tournamentsKey, JSON.stringify(list));
        }
      } catch (e) {
        console.error(e);
      }
    }

    try {
      await syncTournamentToBackend(updatedTournament);
      alert('Đã kết thúc trận đấu và lưu kết quả chung cuộc!');
      setSelectedLeagueMatchId(null);
    } catch (err) {
      console.error('Error finishing league match:', err);
      alert('Có lỗi khi kết thúc trận đấu. Đã lưu tạm ở trình duyệt.');
    }
  };

  const handleToggleLeagueMatchRunning = async (matchId: string) => {
    if (!tournament) return;

    const currentMS = tournament.matchStates?.[matchId] || {
      isRunning: false,
      isFinished: false,
      streamType: null,
      streamUrl: '',
      team1Score: 0,
      team2Score: 0,
      time: 0,
      hiep: 1
    };

    const nextRunning = !currentMS.isRunning;

    const updatedMatchStates = {
      ...(tournament.matchStates || {}),
      [matchId]: {
        ...currentMS,
        isRunning: nextRunning,
        isFinished: false
      }
    };

    const updatedTournament = {
      ...tournament,
      matchStates: updatedMatchStates
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
      console.error('Lỗi toggle league match running:', err);
    }
  };

  const handleLeagueStreamTypeChange = (type: 'youtube' | 'twitch' | 'webcam' | null) => {
    setLeagueStreamType(type);
    if (type === 'webcam') {
      setLeagueStreamUrlInput('webcam');

      const matchesList = tournament.leagueMatches || tournament.matches || [];
      const updatedMatches = matchesList.map((m: any) => {
        if (m.id === selectedLeagueMatchId) {
          return { ...m, streamType: 'webcam', streamUrl: 'webcam' };
        }
        return m;
      });
      const updatedTournament = {
        ...tournament,
        ...(tournament.leagueMatches ? { leagueMatches: updatedMatches } : { matches: updatedMatches })
      };
      setTournament(updatedTournament);
      localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));
      syncTournamentToBackend(updatedTournament).catch(err => console.error(err));
    } else {
      const matchesList = tournament.leagueMatches || tournament.matches || [];
      const prevMatch = matchesList.find((m: any) => m.id === selectedLeagueMatchId);
      setLeagueStreamUrlInput(prevMatch?.streamUrl === 'webcam' ? '' : (prevMatch?.streamUrl || ''));
    }
  };

  const handleSaveLeagueStreamUrl = async () => {
    if (!selectedLeagueMatchId || !tournament) return;

    const matchesList = tournament.leagueMatches || tournament.matches || [];
    const updatedMatches = matchesList.map((m: any) => {
      if (m.id === selectedLeagueMatchId) {
        return { ...m, streamType: leagueStreamType, streamUrl: leagueStreamUrlInput.trim() };
      }
      return m;
    });

    const updatedTournament = {
      ...tournament,
      ...(tournament.leagueMatches ? { leagueMatches: updatedMatches } : { matches: updatedMatches })
    };

    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));

    const savedList = localStorage.getItem(tournamentsKey);
    if (savedList) {
      try {
        const list = JSON.parse(savedList);
        const idx = list.findIndex((t: any) => t.id === tournament.id);
        if (idx > -1) {
          list[idx] = updatedTournament;
          localStorage.setItem(tournamentsKey, JSON.stringify(list));
        }
      } catch (e) {
        console.error(e);
      }
    }

    try {
      await syncTournamentToBackend(updatedTournament);
      alert('Đã cập nhật livestream trận đấu thành công!');
    } catch (err) {
      console.error('Error syncing stream config:', err);
      alert('Có lỗi khi lưu cấu hình.');
    }
  };

  const sendLeagueSignalingMessage = async (payload: any) => {
    try {
      const baseUrl = getApiBaseUrl();
      const token = getAccessToken();
      await fetch(`${baseUrl}/tournaments/${tournamentId}/signaling`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Lỗi gửi WebRTC signaling:', err);
    }
  };

  const startLeagueWebcamBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      leagueLocalStreamRef.current = stream;

      if (leagueBroadcasterVideoRef.current) {
        leagueBroadcasterVideoRef.current.srcObject = stream;
      }

      setIsLeagueBroadcasting(true);

      const updatedMatchStates = {
        ...(tournament.matchStates || {}),
        [selectedLeagueMatchId!]: {
          isRunning: true,
          isFinished: false,
          streamType: 'webcam',
          streamUrl: 'webcam',
          team1Score: 0,
          team2Score: 0,
          time: 0,
          hiep: 1
        }
      };

      const matchesList = tournament.leagueMatches || tournament.matches || [];
      const updatedMatches = matchesList.map((m: any) => {
        if (m.id === selectedLeagueMatchId) {
          return { ...m, streamType: 'webcam', streamUrl: 'webcam' };
        }
        return m;
      });

      const updatedTournament = {
        ...tournament,
        matchStates: updatedMatchStates,
        ...(tournament.leagueMatches ? { leagueMatches: updatedMatches } : { matches: updatedMatches })
      };

      setTournament(updatedTournament);
      localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));
      syncTournamentToBackend(updatedTournament).catch(err => console.error(err));
    } catch (err) {
      console.error('Lỗi truy cập camera/micro:', err);
      alert('Không thể truy cập camera và micro của bạn. Vui lòng cấp quyền và thử lại.');
    }
  };

  const startLeagueScreenShareBroadcast = async () => {
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

      leagueLocalStreamRef.current = combinedStream;

      if (leagueBroadcasterVideoRef.current) {
        leagueBroadcasterVideoRef.current.srcObject = combinedStream;
      }

      setIsLeagueBroadcasting(true);

      const updatedMatchStates = {
        ...(tournament.matchStates || {}),
        [selectedLeagueMatchId!]: {
          isRunning: true,
          isFinished: false,
          streamType: 'webcam',
          streamUrl: 'webcam',
          team1Score: 0,
          team2Score: 0,
          time: 0,
          hiep: 1
        }
      };

      const matchesList = tournament.leagueMatches || tournament.matches || [];
      const updatedMatches = matchesList.map((m: any) => {
        if (m.id === selectedLeagueMatchId) {
          return { ...m, streamType: 'webcam', streamUrl: 'webcam' };
        }
        return m;
      });

      const updatedTournament = {
        ...tournament,
        matchStates: updatedMatchStates,
        ...(tournament.leagueMatches ? { leagueMatches: updatedMatches } : { matches: updatedMatches })
      };

      setTournament(updatedTournament);
      localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));
      syncTournamentToBackend(updatedTournament).catch(err => console.error(err));

      screenStream.getVideoTracks()[0].onended = () => {
        stopLeagueWebcamBroadcast();
      };
    } catch (err: any) {
      console.error('Lỗi chia sẻ màn hình:', err);
      if (err.name !== 'NotAllowedError') {
        alert('Không thể chia sẻ màn hình. Vui lòng thử lại.');
      }
    }
  };

  const stopLeagueWebcamBroadcast = () => {
    if (leagueLocalStreamRef.current) {
      leagueLocalStreamRef.current.getTracks().forEach(track => track.stop());
      leagueLocalStreamRef.current = null;
    }

    if (leagueBroadcasterVideoRef.current) {
      leagueBroadcasterVideoRef.current.srcObject = null;
    }

    Object.keys(leaguePeerConnectionsRef.current).forEach(peerId => {
      leaguePeerConnectionsRef.current[peerId].close();
    });
    leaguePeerConnectionsRef.current = {};

    setIsLeagueBroadcasting(false);
  };

  useEffect(() => {
    return () => {
      if (leagueLocalStreamRef.current) {
        leagueLocalStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.keys(leaguePeerConnectionsRef.current).forEach(peerId => {
        leaguePeerConnectionsRef.current[peerId].close();
      });
    };
  }, []);

  useEffect(() => {
    if (leagueLocalStreamRef.current) {
      leagueLocalStreamRef.current.getTracks().forEach(track => track.stop());
      leagueLocalStreamRef.current = null;
    }
    if (leagueBroadcasterVideoRef.current) {
      leagueBroadcasterVideoRef.current.srcObject = null;
    }
    Object.keys(leaguePeerConnectionsRef.current).forEach(peerId => {
      leaguePeerConnectionsRef.current[peerId].close();
    });
    leaguePeerConnectionsRef.current = {};
    setIsLeagueBroadcasting(false);
  }, [selectedLeagueMatchId]);

  useEffect(() => {
    if (isLeagueBroadcasting && leagueLocalStreamRef.current && leagueBroadcasterVideoRef.current) {
      leagueBroadcasterVideoRef.current.srcObject = leagueLocalStreamRef.current;
    }
  }, [isLeagueBroadcasting]);

  useEffect(() => {
    if (!isLoaded || !tournamentId || !selectedLeagueMatchId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(tournamentId);

    const handleSignaling = async (data: any) => {
      if (data.matchKey !== selectedLeagueMatchId) return;

      const { type, peerId, sender, sdp, candidate } = data;
      if (sender === 'referee') return;

      if (type === 'join') {
        if (!isLeagueBroadcasting || !leagueLocalStreamRef.current) return;

        delete leagueIceQueuesRef.current[peerId];

        if (leaguePeerConnectionsRef.current[peerId]) {
          leaguePeerConnectionsRef.current[peerId].close();
        }

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        });

        leaguePeerConnectionsRef.current[peerId] = pc;

        leagueLocalStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, leagueLocalStreamRef.current!);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendLeagueSignalingMessage({
              type: 'ice-candidate',
              peerId,
              candidate: event.candidate,
              matchKey: selectedLeagueMatchId,
              sender: 'referee'
            });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendLeagueSignalingMessage({
          type: 'offer',
          peerId,
          sdp: offer,
          matchKey: selectedLeagueMatchId,
          sender: 'referee'
        });
      } else if (type === 'answer') {
        const pc = leaguePeerConnectionsRef.current[peerId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const queue = leagueIceQueuesRef.current[peerId];
          if (queue) {
            for (const cand of queue) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.error("Lỗi addIceCandidate từ queue:", e);
              }
            }
            delete leagueIceQueuesRef.current[peerId];
          }
        }
      } else if (type === 'ice-candidate') {
        const pc = leaguePeerConnectionsRef.current[peerId];
        if (pc && candidate) {
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              if (!leagueIceQueuesRef.current[peerId]) {
                leagueIceQueuesRef.current[peerId] = [];
              }
              leagueIceQueuesRef.current[peerId].push(candidate);
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
  }, [isLoaded, tournamentId, selectedLeagueMatchId, isLeagueBroadcasting]);

  const localKeyRef = useRef<string | null>(null);
  const backendKeyRef = useRef<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [pendingFinishData, setPendingFinishData] = useState<{ bracket: BracketState; nextMatchState: MatchState; updatedTournament: any } | null>(null);
  const [finishedMatchInfo, setFinishedMatchInfo] = useState<{ teamA: string; teamB: string; scoreA: number; scoreB: number; roundLabel: string } | null>(null);

  // Announcement states
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementType, setAnnouncementType] = useState<'info' | 'warning' | 'update'>('info');
  const [announcementPosting, setAnnouncementPosting] = useState(false);

  // Chat moderation states
  const [adminChatMessages, setAdminChatMessages] = useState<any[]>([]);
  const [adminChatLoading, setAdminChatLoading] = useState(false);
  const [chatModerationSubmitting, setChatModerationSubmitting] = useState<string | null>(null);

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

  // --- Announcements ---
  const fetchAnnouncements = async () => {
    if (!tournamentId) return;
    setAnnouncementsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/tournaments/${tournamentId}/announcements`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const fetchAdminChatMessages = useCallback(async () => {
    if (!tournamentId) return;
    setAdminChatLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/tournaments/${tournamentId}/chat`);
      if (res.ok) {
        const data = await res.json();
        setAdminChatMessages(data);
      }
    } catch (err) {
      console.error('Error fetching admin chat:', err);
    } finally {
      setAdminChatLoading(false);
    }
  }, [tournamentId]);

  const handleBlockUser = async (userId: string, userName: string) => {
    if (!userId || !tournamentId) return;
    if (!window.confirm(`Bạn có chắc chắn muốn chặn người dùng "${userName}" không? Tất cả tin nhắn của họ trong giải đấu này sẽ bị xóa.`)) return;

    setChatModerationSubmitting(userId);
    try {
      const res = await fetch(`${getApiBaseUrl()}/tournaments/${tournamentId}/chat/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ userId, userName }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.tournament) {
          setTournament(migrateTournamentData(result.tournament));
        }
        setAdminChatMessages(prev => prev.filter(m => m.userId !== userId));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Không thể chặn người dùng.');
      }
    } catch (err) {
      console.error('Error blocking user:', err);
    } finally {
      setChatModerationSubmitting(null);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    if (!userId || !tournamentId) return;
    setChatModerationSubmitting(userId);
    try {
      const res = await fetch(`${getApiBaseUrl()}/tournaments/${tournamentId}/chat/unblock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.tournament) {
          setTournament(migrateTournamentData(result.tournament));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Không thể bỏ chặn.');
      }
    } catch (err) {
      console.error('Error unblocking user:', err);
    } finally {
      setChatModerationSubmitting(null);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementContent.trim()) return;
    setAnnouncementPosting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/tournaments/${tournamentId}/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
          type: announcementType,
        }),
      });
      if (res.ok) {
        setAnnouncementTitle('');
        setAnnouncementContent('');
        setAnnouncementType('info');
        await fetchAnnouncements();
      }
    } catch (err) {
      console.error('Error posting announcement:', err);
    } finally {
      setAnnouncementPosting(false);
    }
  };

  useEffect(() => {
    let isOwnerUser = false;
    const savedList = localStorage.getItem(tournamentsKey);
    if (savedList) {
      try {
        const list = JSON.parse(savedList);
        const tourn = list.find((t: any) => t.id === tournamentId);
        if (tourn && session && tourn.userId && String(tourn.userId) === String(session.id)) {
          isOwnerUser = true;
          setIsOwner(true);
        }
      } catch (e) {
        console.error('Error parsing tournaments list:', e);
      }
    }

    const loadTournament = async () => {
      let loadedTournament = null;

      // Always fetch from backend first to get the most up-to-date data (registrations, scores, etc.)
      try {
        const data = await fetchTournamentFromBackend(tournamentId);
        if (data) {
          loadedTournament = data;
          // Synchronize back to local storage list
          if (savedList) {
            try {
              const list = JSON.parse(savedList);
              const idx = list.findIndex((t: any) => t.id === tournamentId);
              if (idx > -1) {
                list[idx] = data;
                localStorage.setItem(tournamentsKey, JSON.stringify(list));
              }
            } catch (e) {
              console.error('Error syncing backend data to local list:', e);
            }
          }
          localStorage.setItem(currentTournamentKey, JSON.stringify(data));
        }
      } catch (err) {
        console.error('Error fetching tournament from backend, fallback to local storage:', err);
      }

      // Fallback to local storage if backend fails
      if (!loadedTournament) {
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

      if (loadedTournament) {
        loadedTournament = migrateTournamentData(loadedTournament);
        setTournament(loadedTournament);

        // Verify owner status from loaded tournament
        if (session && loadedTournament.userId && String(loadedTournament.userId) === String(session.id)) {
          setIsOwner(true);
        } else {
          setIsOwner(false);
        }

        const rIdx = loadedTournament.bracket?.currentRound ?? 0;
        let mIdx = loadedTournament.bracket?.activeMatches?.[0] ?? loadedTournament.bracket?.currentMatch ?? 0;
        const defaultKey = `${rIdx}-${mIdx}`;
        setSelectedMatchKey(defaultKey);

        if (loadedTournament.matchStates?.[defaultKey]) {
          setMatchState(loadedTournament.matchStates[defaultKey]);
        } else if (loadedTournament.matchState) {
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

    fetchAnnouncements();
    fetchAdminChatMessages();
  }, [tournamentId, currentTournamentKey, tournamentsKey, fetchAdminChatMessages]);

  useEffect(() => {
    if (!tournamentId) return;
    const pusher = getPusherClient();
    if (!pusher) return;
    const channel = pusher.subscribe(String(tournamentId));

    const handleChatMsg = (data: any) => {
      setAdminChatMessages(prev => [...prev.slice(-99), data]);
    };

    const handleChatModeration = (data: any) => {
      if (data.action === 'block') {
        setAdminChatMessages(prev => prev.filter((m: any) => m.userId !== data.userId));
      }
    };

    channel.bind('chat_message', handleChatMsg);
    channel.bind('chat_moderation', handleChatModeration);

    return () => {
      channel.unbind('chat_message', handleChatMsg);
      channel.unbind('chat_moderation', handleChatModeration);
    };
  }, [tournamentId]);

  useEffect(() => {
    // If the user is the owner AND the tournament has already started (bracket seeded),
    // do not subscribe to Pusher updates on this page to prevent feedback loops.
    // However, if the tournament has NOT started yet, the admin must receive real-time updates when teams register!
    if (isOwner && tournament && tournament.bracketSeeded) return;

    const pusher = getPusherClient();
    let channel: any = null;

    if (pusher) {
      channel = pusher.subscribe(tournamentId);
      channel.bind("tournament_updated", (data: any) => {
        console.log("Pusher received tournament update in dashboard:", data);
        const migrated = migrateTournamentData(data);
        setTournament(migrated);

        let mKey = selectedMatchKey;
        if (!mKey && migrated.bracket) {
          const rIdx = migrated.bracket.currentRound ?? 0;
          const mIdx = migrated.bracket.activeMatches?.[0] ?? migrated.bracket.currentMatch ?? 0;
          mKey = `${rIdx}-${mIdx}`;
          setSelectedMatchKey(mKey);
        }

        if (mKey && migrated.matchStates?.[mKey]) {
          setMatchState(migrated.matchStates[mKey]);
        } else if (migrated.matchState) {
          setMatchState(migrated.matchState);
        }
      });
    }

    return () => {
      if (pusher && channel) {
        channel.unbind("tournament_updated");
        pusher.unsubscribe(tournamentId);
      }
    };
  }, [tournamentId, isOwner, tournament?.bracketSeeded, selectedMatchKey]);

  // Timer is disabled for Esports
  useEffect(() => {
    // No timer interval for Esports
  }, []);

  // Sync to local storage
  useEffect(() => {
    if (isLoaded && tournament && selectedMatchKey) {
      if (localKeyRef.current !== selectedMatchKey) {
        localKeyRef.current = selectedMatchKey;
        return;
      }

      const currentStored = tournament.matchStates?.[selectedMatchKey];
      const isEquivalent = currentStored &&
        currentStored.team1Score === matchState.team1Score &&
        currentStored.team2Score === matchState.team2Score &&
        currentStored.time === matchState.time &&
        currentStored.isRunning === matchState.isRunning &&
        currentStored.hiep === matchState.hiep &&
        currentStored.isFinished === matchState.isFinished &&
        (currentStored.buGio ?? 0) === (matchState.buGio ?? 0) &&
        (currentStored.team1SetPoints ?? 0) === (matchState.team1SetPoints ?? 0) &&
        (currentStored.team2SetPoints ?? 0) === (matchState.team2SetPoints ?? 0);

      if (isEquivalent) {
        return;
      }

      const updatedMatchStates = {
        ...(tournament.matchStates || {}),
        [selectedMatchKey]: matchState
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

      setTournament(updatedTournament);
    }
  }, [matchState, tournament, isLoaded, currentTournamentKey, tournamentsKey, selectedMatchKey]);

  // Sync to backend on score/running/hiep/buGio changes and periodic time
  useEffect(() => {
    if (!isLoaded || !tournament || !selectedMatchKey) return;

    if (backendKeyRef.current !== selectedMatchKey) {
      backendKeyRef.current = selectedMatchKey;
      return;
    }

    const currentStored = tournament.matchStates?.[selectedMatchKey];
    const isEquivalent = currentStored &&
      currentStored.team1Score === matchState.team1Score &&
      currentStored.team2Score === matchState.team2Score &&
      currentStored.time === matchState.time &&
      currentStored.isRunning === matchState.isRunning &&
      currentStored.hiep === matchState.hiep &&
      currentStored.isFinished === matchState.isFinished &&
      (currentStored.buGio ?? 0) === (matchState.buGio ?? 0) &&
      (currentStored.team1SetPoints ?? 0) === (matchState.team1SetPoints ?? 0) &&
      (currentStored.team2SetPoints ?? 0) === (matchState.team2SetPoints ?? 0);

    if (isEquivalent) {
      return;
    }

    const updatedMatchStates = {
      ...(tournament.matchStates || {}),
      [selectedMatchKey]: matchState
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
    matchState.buGio,
    matchState.team1SetPoints,
    matchState.team2SetPoints,
    Math.floor(matchState.time / 15),
    tournament,
    isLoaded,
    selectedMatchKey
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
    if (!tournament || !selectedMatchKey) return;

    let matchIdx = 0;
    if (selectedMatchKey.startsWith('g-')) {
      const parts = selectedMatchKey.split('-');
      matchIdx = parseInt(parts[2], 10);
    } else if (selectedMatchKey.startsWith('u-') || selectedMatchKey.startsWith('l-')) {
      const parts = selectedMatchKey.split('-');
      matchIdx = parseInt(parts[2], 10);
    } else if (selectedMatchKey.startsWith('gf-')) {
      const parts = selectedMatchKey.split('-');
      matchIdx = parseInt(parts[1], 10);
    } else {
      const parts = selectedMatchKey.split('-');
      matchIdx = parseInt(parts[1], 10);
    }

    const isGroup = selectedMatchKey.startsWith('g-');
    const activeMatches = [...(tournament.bracket?.activeMatches || [])];
    let bracketUpdated = false;
    let updatedBracket = tournament.bracket;
    if (tournament.bracket && !isGroup && !activeMatches.includes(matchIdx)) {
      activeMatches.push(matchIdx);
      updatedBracket = {
        ...tournament.bracket,
        activeMatches
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
    handleFinishMatch();
  };

  const handleFinishMatch = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc trận đấu này không? Kết quả sẽ được lưu lại vĩnh viễn.')) {
      return;
    }

    if (!tournament || !selectedMatchKey) return;

    const updatedTournament = JSON.parse(JSON.stringify(tournament));
    let dbMatch = null;
    let isGroup = false;
    let isUpper = false;
    let isLower = false;
    let isGF = false;
    let roundIndex = 0;
    let matchIndex = 0;

    if (selectedMatchKey.startsWith('g-')) {
      const parts = selectedMatchKey.split('-');
      roundIndex = parseInt(parts[1], 10); // groupIndex
      matchIndex = parseInt(parts[2], 10);
      dbMatch = updatedTournament.groups?.[roundIndex]?.matches?.[matchIndex];
      isGroup = true;
    } else if (selectedMatchKey.startsWith('u-')) {
      const parts = selectedMatchKey.split('-');
      roundIndex = parseInt(parts[1], 10);
      matchIndex = parseInt(parts[2], 10);
      dbMatch = updatedTournament.bracket?.upperRounds?.[roundIndex]?.[matchIndex];
      isUpper = true;
    } else if (selectedMatchKey.startsWith('l-')) {
      const parts = selectedMatchKey.split('-');
      roundIndex = parseInt(parts[1], 10);
      matchIndex = parseInt(parts[2], 10);
      dbMatch = updatedTournament.bracket?.lowerRounds?.[roundIndex]?.[matchIndex];
      isLower = true;
    } else if (selectedMatchKey.startsWith('gf-')) {
      const parts = selectedMatchKey.split('-');
      matchIndex = parseInt(parts[1], 10);
      dbMatch = updatedTournament.bracket?.grandFinal?.[matchIndex];
      isGF = true;
    } else {
      const parts = selectedMatchKey.split('-');
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
      [selectedMatchKey]: nextMatchState,
    };
    updatedTournament.matchStates = updatedMatchStates;
    updatedTournament.matchState = nextMatchState;

    let bracketFinished = false;

    if (isGroup) {
      // Group stage matches do nothing extra to bracket tree
    } else if (isUpper || isLower || isGF) {
      const loc = isGF ? 'gf' : isUpper ? 'upper' : 'lower';
      const advRes = advanceDoubleEliminationEngine(
        updatedTournament.bracket,
        roundIndex,
        matchIndex,
        matchState.team1Score,
        matchState.team2Score,
        loc
      );
      if (advRes.bracketFinished) {
        bracketFinished = true;
      }
    } else {
      // Single Elimination
      const advRes = advanceSingleEliminationEngine(
        updatedTournament.bracket,
        roundIndex,
        matchIndex,
        matchState.team1Score,
        matchState.team2Score
      );
      if (advRes.bracketFinished) {
        bracketFinished = true;
      }
    }

    updatedTournament.anyMatchRunning = Object.values(updatedMatchStates).some((ms: any) => ms.isRunning && !ms.isFinished);

    if (bracketFinished) {
      const numRounds = isGF ? 1 : Math.ceil(Math.log2((updatedTournament.orderedTeams || updatedTournament.teams || []).length));
      setFinishedMatchInfo({
        teamA: dbMatch.teamA?.name || 'Đội 1',
        teamB: dbMatch.teamB?.name || 'Đội 2',
        scoreA: matchState.team1Score,
        scoreB: matchState.team2Score,
        roundLabel: isGF ? 'Chung kết tổng' : getRoundLabel(roundIndex, numRounds),
      });

      setPendingFinishData({ bracket: updatedTournament.bracket, nextMatchState, updatedTournament });
      setFeedbackRating(0);
      setFeedbackHover(0);
      setFeedbackContent('');
      setShowFeedbackModal(true);
    } else {
      setSelectedMatchKey(null);
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

  const handleToggleRegistration = async () => {
    if (!tournament) return;
    const updatedTournament = {
      ...tournament,
      registrationOpen: !tournament.registrationOpen,
    };
    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));
    try {
      await syncTournamentToBackend(updatedTournament);
    } catch (err) {
      console.error('Error toggling registrationOpen:', err);
    }
  };

  const handleLockTeams = async () => {
    if (!tournament) return;
    if (!window.confirm("Bạn có chắc chắn muốn chốt danh sách đội tham gia? Cổng đăng ký trực tuyến sẽ được đóng lại và danh sách đội sẽ được xác nhận chính thức.")) return;

    const updatedTournament = {
      ...tournament,
      registrationOpen: false,
      teamsLocked: true,
    };
    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));
    try {
      await syncTournamentToBackend(updatedTournament);
    } catch (err) {
      console.error('Error locking teams:', err);
    }
  };

  const handleUnlockTeams = async () => {
    if (!tournament) return;
    const updatedTournament = {
      ...tournament,
      registrationOpen: true,
      teamsLocked: false,
    };
    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));
    try {
      await syncTournamentToBackend(updatedTournament);
    } catch (err) {
      console.error('Error unlocking teams:', err);
    }
  };

  const handleRemoveTeam = async (teamId: string) => {
    if (!tournament) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa đội này khỏi giải đấu?')) return;
    const updatedTeams = (tournament.teams || []).filter((t: any) => t.id !== teamId);
    const updatedTournament = {
      ...tournament,
      teams: updatedTeams,
    };
    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));
    try {
      await syncTournamentToBackend(updatedTournament);
    } catch (err) {
      console.error('Error removing team from tournament:', err);
    }
  };

  const handleShuffleTeams = () => {
    if (!tournament) return;
    const shuffled = [...(tournament.teams || [])];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setTournament({
      ...tournament,
      teams: shuffled,
    });
  };

  const handleStartTournament = async () => {
    if (!tournament) return;
    const shuffledTeams = tournament.teams || [];

    // Check validation constraints based on format
    const len = shuffledTeams.length;
    const format = tournament.format;
    const groupsCount = tournament.groupsCount || 1;
    const isPowerOfTwo = (n: number) => n > 1 && (n & (n - 1)) === 0;

    let isValid = false;
    if (format === 'single_elimination') {
      isValid = len >= 2 && isPowerOfTwo(len);
    } else if (format === 'double_elimination') {
      isValid = len >= 4 && isPowerOfTwo(len);
    } else if (format === 'round_robin') {
      isValid = len >= groupsCount * 2;
    } else if (format === 'league' || format === 'battle_royale') {
      isValid = len >= 2;
    }

    if (!isValid) {
      alert('Số lượng đội tham gia chưa hợp lệ để tạo bảng đấu. Vui lòng kiểm tra lại thể thức giải đấu!');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn xác nhận danh sách và Khởi tranh giải đấu? Thao tác này sẽ khóa đăng ký và tạo sơ đồ thi đấu.')) {
      return;
    }

    let bracket = null;
    let groups: any[] | null = null;
    let leagueMatches: any[] | null = null;
    let stage = null;
    let matches: any[] | null = null;

    if (tournament.sport === 'battle_royale') {
      stage = 'battle_royale';
      const matchesCount = tournament.matchesCount || 5;
      matches = Array.from({ length: matchesCount }, (_, idx) => ({
        id: `br-${idx}`,
        name: `Trận ${idx + 1}`,
        isFinished: false,
        results: shuffledTeams.map((t: any) => ({
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
    } else if (tournament.format === 'round_robin') {
      groups = Array.from({ length: groupsCount }, (_, gIdx) => ({
        name: `Bảng ${String.fromCharCode(65 + gIdx)}`,
        teams: [] as TeamRef[],
        matches: [] as any[]
      }));
      shuffledTeams.forEach((team: any, idx: number) => {
        const gIdx = idx % groupsCount;
        groups![gIdx].teams.push(team);
      });

      groups!.forEach((group: any, gIdx: number) => {
        group.matches = buildRoundRobinMatches(group.teams, gIdx);
      });
      stage = 'group';
    } else if (tournament.format === 'double_elimination') {
      bracket = buildDoubleEliminationBracket(shuffledTeams);
    } else if (tournament.format === 'league') {
      const matchesCount = tournament.leagueMatchesCount || 5;
      leagueMatches = Array.from({ length: matchesCount }, (_, mIdx) => ({
        id: `league-match-${mIdx}`,
        name: `Trận ${mIdx + 1}`,
        isFinished: false,
        results: shuffledTeams.map((team: any) => ({
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
      bracket = buildInitialBracket(shuffledTeams);
    }

    const updatedTournament = {
      ...tournament,
      orderedTeams: shuffledTeams,
      bracket,
      groups,
      leagueMatches,
      stage,
      matches,
      bracketSeeded: true,
      registrationOpen: false,
    };

    setTournament(updatedTournament);
    localStorage.setItem(currentTournamentKey, JSON.stringify(updatedTournament));

    try {
      await syncTournamentToBackend(updatedTournament);
      alert('Giải đấu đã khởi tranh và tạo sơ đồ thi đấu thành công!');
    } catch (err: any) {
      console.error('Error starting tournament:', err);
      alert(err.message || 'Lỗi kết nối mạng khi tạo sơ đồ thi đấu.');
    }
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

    const roundIdx = tournament.bracket.currentRound;
    const matchKey = `${roundIdx}-${matchIdx}`;

    const activeMatches = [...(tournament.bracket.activeMatches || [])];
    if (!activeMatches.includes(matchIdx)) {
      activeMatches.push(matchIdx);
    }

    const updatedBracket = {
      ...tournament.bracket,
      currentMatch: matchIdx,
      activeMatches,
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

    const updatedMatchStates = {
      ...(tournament.matchStates || {}),
      [matchKey]: initialMatchState,
    };

    const updatedTournament = {
      ...tournament,
      bracket: updatedBracket,
      matchStates: updatedMatchStates,
      matchState: initialMatchState,
      anyMatchRunning: Object.values(updatedMatchStates).some((ms: any) => ms.isRunning && !ms.isFinished),
    };

    setIsSwitching(true);
    setSelectedMatchKey(matchKey);
    setTournament(updatedTournament);
    setMatchState(initialMatchState);
    setTimeout(() => {
      setIsSwitching(false);
    }, 350);

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

  const handleMatchCardClick = (mKey: string) => {
    if (!isOwner) {
      setIsRedirecting(true);
      setTimeout(() => {
        router.push(`/tournaments/${tournamentId}/live`);
      }, 650);
      return;
    }

    if (!tournament) return;

    let dbMatch = null;
    let roundIdx = 0;
    let matchIdx = 0;

    if (mKey.startsWith('g-')) {
      const parts = mKey.split('-');
      roundIdx = parseInt(parts[1], 10);
      matchIdx = parseInt(parts[2], 10);
      dbMatch = tournament.groups?.[roundIdx]?.matches?.[matchIdx];
    } else if (mKey.startsWith('u-')) {
      const parts = mKey.split('-');
      roundIdx = parseInt(parts[1], 10);
      matchIdx = parseInt(parts[2], 10);
      dbMatch = tournament.bracket?.upperRounds?.[roundIdx]?.[matchIdx];
    } else if (mKey.startsWith('l-')) {
      const parts = mKey.split('-');
      roundIdx = parseInt(parts[1], 10);
      matchIdx = parseInt(parts[2], 10);
      dbMatch = tournament.bracket?.lowerRounds?.[roundIdx]?.[matchIdx];
    } else if (mKey.startsWith('gf-')) {
      const parts = mKey.split('-');
      matchIdx = parseInt(parts[1], 10);
      dbMatch = tournament.bracket?.grandFinal?.[matchIdx];
    } else {
      const parts = mKey.split('-');
      roundIdx = parseInt(parts[0], 10) || 0;
      matchIdx = parseInt(parts[1], 10) || 0;
      dbMatch = tournament.bracket?.rounds?.[roundIdx]?.[matchIdx];
    }

    if (!dbMatch) return;

    if (selectedMatchKey === mKey) {
      setTimeout(() => {
        const controllerEl = document.getElementById('match-controller');
        if (controllerEl) {
          controllerEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return;
    }

    if (!dbMatch.teamA || !dbMatch.teamB || dbMatch.teamA.name === '?' || dbMatch.teamB.name === '?') {
      alert('Không thể chọn trận đấu chưa xác định đủ đội hình.');
      return;
    }

    let newMatchState: MatchState;
    if (tournament.matchStates?.[mKey]) {
      newMatchState = tournament.matchStates[mKey];
    } else {
      newMatchState = {
        team1Score: dbMatch.scoreA !== null ? dbMatch.scoreA : 0,
        team2Score: dbMatch.scoreB !== null ? dbMatch.scoreB : 0,
        time: dbMatch.time || 0,
        isRunning: false,
        hiep: dbMatch.hiep || 1,
        isFinished: !!dbMatch.isFinished,
        buGio: dbMatch.buGio || 0,
      };
    }

    const updatedBracket = tournament.bracket ? {
      ...tournament.bracket,
      currentRound: roundIdx,
      currentMatch: matchIdx,
    } : null;

    const updatedTournament = {
      ...tournament,
      ...(updatedBracket ? { bracket: updatedBracket } : {}),
    };

    setIsSwitching(true);
    setSelectedMatchKey(mKey);
    setTournament(updatedTournament);
    setMatchState(newMatchState);
    setTimeout(() => {
      setIsSwitching(false);
    }, 350);

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

    setTimeout(() => {
      const controllerEl = document.getElementById('match-controller');
      if (controllerEl) {
        controllerEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const getPendingMatches = () => {
    if (!tournament || tournament.format === 'round_robin' || tournament.format === 'double_elimination' || tournament.format === 'league') return [];
    if (!tournament.bracket || tournament.bracket.isFinished) return [];

    const round = tournament.bracket.rounds?.[tournament.bracket.currentRound] || [];
    return round.map((m: any, idx: number) => {
      const isLive = (tournament.bracket.activeMatches || []).includes(idx);
      const done = m.isFinished;
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

  const selectedMatchIndex = selectedMatchKey
    ? (selectedMatchKey.startsWith('g-') || selectedMatchKey.startsWith('u-') || selectedMatchKey.startsWith('l-')
      ? parseInt(selectedMatchKey.split('-')[2], 10)
      : parseInt(selectedMatchKey.split('-')[1], 10))
    : 0;
  const isLiveMatchActive = matchState && !matchState.isFinished;

  const getSelectedBracketMatch = () => {
    if (!tournament) return null;
    if (selectedMatchKey?.startsWith('g-')) {
      const parts = selectedMatchKey.split('-');
      const gIdx = parseInt(parts[1], 10);
      const mIdx = parseInt(parts[2], 10);
      return tournament.groups?.[gIdx]?.matches?.[mIdx] || null;
    }
    if (selectedMatchKey?.startsWith('u-')) {
      const parts = selectedMatchKey.split('-');
      const rIdx = parseInt(parts[1], 10);
      const mIdx = parseInt(parts[2], 10);
      return tournament.bracket?.upperRounds?.[rIdx]?.[mIdx] || null;
    }
    if (selectedMatchKey?.startsWith('l-')) {
      const parts = selectedMatchKey.split('-');
      const rIdx = parseInt(parts[1], 10);
      const mIdx = parseInt(parts[2], 10);
      return tournament.bracket?.lowerRounds?.[rIdx]?.[mIdx] || null;
    }
    if (selectedMatchKey?.startsWith('gf-')) {
      const parts = selectedMatchKey.split('-');
      const mIdx = parseInt(parts[1], 10);
      return tournament.bracket?.grandFinal?.[mIdx] || null;
    }

    if (!tournament.bracket) return null;
    const parts = (selectedMatchKey || '').split('-');
    const rIdx = parseInt(parts[0], 10) || 0;
    const mIdx = parseInt(parts[1], 10) || 0;
    const round = tournament.bracket.rounds?.[rIdx];
    if (!round) return null;
    return round[mIdx] || null;
  };

  const currentBracketMatch = getSelectedBracketMatch();
  const matchIndex = selectedMatchIndex;
  const team1 = tournament && currentBracketMatch ? (resolveTeamRef(tournament, currentBracketMatch?.teamA) || tournament.teams?.[0]) : null;
  const team2 = tournament && currentBracketMatch ? (resolveTeamRef(tournament, currentBracketMatch?.teamB) || tournament.teams?.[1]) : null;

  const showActiveMatch = !!(tournament && currentBracketMatch &&
    team1 && team2 && team1.name !== '?' && team2.name !== '?');

  const winnableTeam = (tournament?.sport === 'tennis' || tournament?.sport === 'volleyball')
    ? checkSetWinCondition(matchState.team1SetPoints ?? 0, matchState.team2SetPoints ?? 0)
    : null;

  const getTournamentWinnerName = () => {
    return getTournamentChampion(tournament)?.name || null;
  };
  const tournamentWinnerName = getTournamentWinnerName();
  const activeMatchesCount = tournament?.bracket?.activeMatches?.length || 0;

  const areAllGroupMatchesFinished = () => {
    if (!tournament || !tournament.groups) return false;
    return tournament.groups.every((g: any) =>
      g.matches.every((m: any) => m.isFinished)
    );
  };

  const handleProceedToKnockout = async () => {
    if (!areAllGroupMatchesFinished()) {
      alert('Tất cả các trận đấu vòng bảng phải kết thúc trước khi tiến vào vòng Knockout.');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn kết thúc Vòng bảng và tiến hành sinh Vòng Knockout? Hành động này sẽ cố định bảng xếp hạng.')) {
      return;
    }

    const advancingTeams = seedKnockoutFromGroups(tournament.groups, tournament.advancingCount || 2, tournament.matchStates);
    const newBracket = buildInitialBracket(advancingTeams);

    const updatedTournament = {
      ...tournament,
      bracket: newBracket,
      stage: 'knockout'
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
      alert('Đã tạo vòng Knock-out thành công!');
    } catch (err) {
      console.error('Error proceeding to knockout:', err);
    }
  };

  const handleNavigateToDraftStep = (stepPath: string) => {
    if (!tournament) return;
    const draftData = {
      packageId: tournament.packageId || 'free',
      packageName: tournament.packageName || 'Dùng thử',
      packagePrice: tournament.packagePrice || 0,
      name: tournament.name || '',
      sport: tournament.sport || '',
      matchDuration: tournament.matchDuration || 45,
      allowExtraTime: tournament.allowExtraTime || false,
      format: tournament.format,
      groupsCount: tournament.groupsCount || 1,
      advancingCount: tournament.advancingCount || 2,
      matchesCount: tournament.matchesCount || 5,
      leagueMatchesCount: tournament.leagueMatchesCount || 5,
      pointRules: tournament.pointRules || {},
      teams: tournament.teams || [],
      isPublicRegistration: tournament.isPublicRegistration ?? true,
      registrationOpen: tournament.registrationOpen ?? true,
      maxTeams: tournament.maxTeams || 8,
      bracketSeeded: tournament.bracketSeeded || false,
      shuffled: tournament.shuffled || false,
      id: tournament.id,
    };
    loadTournamentData(draftData);
    router.push(stepPath);
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
          {activeMatchesCount > 0 && isOwner && (
            <button
              type="button"
              onClick={scrollToController}
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all duration-200 flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.35)] animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              Trận đang đấu ({activeMatchesCount})
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
            onClick={() => setShowGuideModal(true)}
            className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white text-xs font-bold transition-all duration-200 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Thể thức
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

        {tournamentWinnerName && (
          <div className="mb-12 p-8 rounded-2xl bg-gradient-to-r from-yellow-500/10 via-amber-500/15 to-yellow-500/10 border border-yellow-500/30 text-center shadow-[0_0_30px_rgba(234,179,8,0.2)] relative overflow-hidden animate-pulse">
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="flex items-center justify-center gap-2 text-yellow-400 animate-bounce">
                <svg className="w-8 h-8 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                </svg>
                <svg className="w-10 h-10 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0011 15.9V18H8v2h8v-2h-3v-2.1a5.01 5.01 0 003.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
                </svg>
                <svg className="w-8 h-8 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                </svg>
              </div>
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

        {/* Bracket Diagram Container / Registration Management View */}
        <div className="w-full">
          {!tournament.bracketSeeded ? (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              {/* Breadcrumb for Edit Return */}
              {isOwner && (
                <div className="flex items-center gap-2 mb-8 text-sm text-white/60 overflow-x-auto pb-2 justify-center">
                  <button
                    onClick={() => handleNavigateToDraftStep('/tournaments/create')}
                    className="text-white/40 hover:text-white transition-colors whitespace-nowrap"
                  >
                    Gói dịch vụ
                  </button>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-white/20">
                    <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <button
                    onClick={() => handleNavigateToDraftStep('/tournaments/create/info')}
                    className="text-white/40 hover:text-white transition-colors whitespace-nowrap"
                  >
                    Thông tin
                  </button>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-white/20">
                    <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <button
                    onClick={() => handleNavigateToDraftStep('/tournaments/create/teams')}
                    className="text-white/40 hover:text-white transition-colors whitespace-nowrap"
                  >
                    Danh sách đội
                  </button>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-white/20">
                    <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <button
                    onClick={() => handleNavigateToDraftStep('/tournaments/create/members')}
                    className="text-white/40 hover:text-white transition-colors whitespace-nowrap"
                  >
                    Thành viên
                  </button>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-white/20">
                    <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <button
                    onClick={() => handleNavigateToDraftStep('/tournaments/create/finalize')}
                    className="text-[#22c55e] whitespace-nowrap font-semibold"
                  >
                    Quản lý đội
                  </button>
                  {tournament.sport !== 'battle_royale' && tournament.format !== 'league' && (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-white/20">
                        <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <button
                        onClick={() => handleNavigateToDraftStep('/tournaments/create/bracket')}
                        className="text-white/40 hover:text-white transition-colors whitespace-nowrap"
                      >
                        Sắp xếp & Tạo đội
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Registration Toggle Panel */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl bg-[#0f1419] border border-white/[0.06] shadow-xl gap-4">
                <div className="space-y-1.5">
                  {tournament.teamsLocked ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider">
                      <svg className="w-3 h-3 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4" />
                      </svg>
                      Đã chốt đội tham gia
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] text-[10px] font-black uppercase tracking-wider">
                      <span className={`w-1.5 h-1.5 rounded-full ${tournament.registrationOpen ? 'bg-[#22c55e] animate-pulse' : 'bg-red-500'}`} />
                      {tournament.registrationOpen ? 'Đang mở đăng ký trực tuyến' : 'Đã đóng đăng ký trực tuyến'}
                    </span>
                  )}
                  <h2 className="text-xl font-black text-white">Quản lý Cổng Đăng ký</h2>
                  <p className="text-xs text-white/50">
                    {tournament.teamsLocked
                      ? 'Danh sách đội tham gia đã được chốt chính thức. Không nhận thêm đăng ký mới.'
                      : 'Cho phép các đội tự đăng ký tên đội và thành viên ngoài trang Live'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleRegistration}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${tournament.registrationOpen ? 'bg-[#22c55e]' : 'bg-white/[0.1]'
                    }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${tournament.registrationOpen ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {/* Seeding & Kickoff Controls */}
              {(() => {
                const len = (tournament.teams || []).length;
                const format = tournament.format;
                const groupsCount = tournament.groupsCount || 1;
                const isPowerOfTwo = (n: number) => n > 1 && (n & (n - 1)) === 0;

                let isValid = false;
                let reason = '';
                if (format === 'single_elimination') {
                  isValid = len >= 2 && isPowerOfTwo(len);
                  if (!isValid) reason = 'Thể thức Loại trực tiếp yêu cầu số lượng đội phải là lũy thừa của 2 (2, 4, 8, 16, 32...) và tối thiểu 2 đội.';
                } else if (format === 'double_elimination') {
                  isValid = len >= 4 && isPowerOfTwo(len);
                  if (!isValid) reason = 'Thể thức Nhánh thắng-thua yêu cầu số lượng đội phải là lũy thừa của 2 và tối thiểu 4 đội.';
                } else if (format === 'round_robin') {
                  isValid = len >= groupsCount * 2;
                  if (!isValid) reason = `Thể thức Vòng bảng với ${groupsCount} bảng yêu cầu tối thiểu ${groupsCount * 2} đội (2 đội mỗi bảng).`;
                } else if (format === 'league' || format === 'battle_royale') {
                  isValid = len >= 2;
                  if (!isValid) reason = 'Thể thức League/Giải đấu yêu cầu tối thiểu 2 đội.';
                }

                return (
                  <div className="p-6 rounded-2xl bg-[#0f1419] border border-white/[0.06] shadow-xl space-y-4">
                    <h3 className="font-extrabold text-white text-base">Khởi tranh giải đấu</h3>
                    {isValid ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-[#22c55e]/5 border border-[#22c55e]/20 text-xs text-[#22c55e] leading-relaxed">
                          ✓ Số lượng đội hiện tại (<span className="font-bold">{len} đội</span>) đã hợp lệ với thể thức thi đấu. Bạn đã có thể bắt đầu giải đấu và tạo sơ đồ thi đấu ngay bây giờ.
                        </div>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={handleShuffleTeams}
                            className="flex-1 px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white font-black uppercase text-xs tracking-wider transition-all duration-200 flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            Xáo trộn hạt giống
                          </button>
                          <button
                            type="button"
                            onClick={handleStartTournament}
                            className="flex-1 px-4 py-3.5 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-[#080b10] font-black uppercase text-xs tracking-wider transition-all duration-200 shadow-lg shadow-[#22c55e]/10 hover:shadow-[#22c55e]/20 flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4 text-[#080b10]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Bắt đầu & Tạo sơ đồ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-xs text-red-400 leading-relaxed flex items-start gap-2">
                          <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>Chưa thể tạo sơ đồ thi đấu. Lý do: {reason} (Hiện có: <span className="font-bold">{len} đội</span>)</span>
                        </div>
                        <button
                          type="button"
                          disabled
                          className="w-full px-4 py-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/20 font-black uppercase text-xs tracking-wider cursor-not-allowed"
                        >
                          Chờ các đội đăng ký...
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Registered Teams Grid */}
              <div className="space-y-4">
                <h3 className="text-sm font-black tracking-widest text-white/50 uppercase border-b border-white/[0.04] pb-3 flex items-center justify-between">
                  <span>Danh sách đội đã đăng ký ({(tournament.teams || []).length} / {tournament.maxTeams || 8})</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const data = await fetchTournamentFromBackend(tournamentId);
                        if (data) {
                          const migrated = migrateTournamentData(data);
                          setTournament(migrated);
                          localStorage.setItem(currentTournamentKey, JSON.stringify(migrated));
                          // Update list too
                          const savedList = localStorage.getItem(tournamentsKey);
                          if (savedList) {
                            const list = JSON.parse(savedList);
                            const idx = list.findIndex((t: any) => t.id === tournamentId);
                            if (idx > -1) {
                              list[idx] = migrated;
                              localStorage.setItem(tournamentsKey, JSON.stringify(list));
                            }
                          }
                        }
                      } catch (err) {
                        console.error('Error refreshing teams:', err);
                      }
                    }}
                    className="px-3 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white/60 hover:text-white text-xs font-bold transition-all duration-200 flex items-center gap-1.5 normal-case tracking-normal"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Làm mới danh sách
                  </button>
                </h3>

                {(tournament.teams || []).length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-white/[0.04]">
                    <p className="text-sm text-white/30">Chưa có đội nào đăng ký trực tuyến.</p>
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
                        <div key={team.id} className="p-5 rounded-2xl bg-[#0f1419] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 flex flex-col justify-between gap-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 min-w-0">
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
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-white text-base truncate">{team.name}</h4>
                                <span className="text-[10px] text-white/40">Hạt giống #{idx + 1}</span>
                              </div>
                            </div>
                            {!tournament.teamsLocked && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTeam(team.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[10px] font-black uppercase tracking-wider transition-all"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {team.members && team.members.length > 0 ? (
                              team.members.map((m: any) => (
                                <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/60 text-[10px] font-semibold">
                                  {m.image ? (
                                    <img src={m.image} className="w-4.5 h-4.5 rounded-md object-cover flex-shrink-0 border border-white/[0.08]" alt={m.name} />
                                  ) : (
                                    <svg className="w-3 h-3 text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  )}
                                  <span>{m.name}</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-white/30 italic">Chưa đăng ký thành viên</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : tournament.format === 'battle_royale' || tournament.format === 'league' ? (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* STANDINGS TABLE (LEFT/MIDDLE) */}
                <div className="lg:col-span-2 bg-[#0f1419] border border-white/[0.06] rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <h3 className="text-lg font-black tracking-tight text-[#22c55e]">
                      Bảng Xếp Hạng Giải Đấu
                    </h3>
                    <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
                      {tournament.format === 'battle_royale' ? 'PUBG Points' : 'Standard Points'}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-white/50">
                          <th className="py-3 px-2 text-center w-12">Hạng</th>
                          {tournament.format === 'battle_royale' && (
                            <th className="py-3 px-1 text-center w-8">+/-</th>
                          )}
                          <th className="py-3 px-3">Đội tuyển</th>
                          {tournament.format === 'battle_royale' && (
                            <>
                              <th className="py-3 px-2 text-center">Điểm Hạng</th>
                              <th className="py-3 px-2 text-center">Điểm Kill</th>
                            </>
                          )}
                          <th className="py-3 px-3 text-center font-bold text-white">Tổng Điểm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculateLeagueStandings(
                          tournament.teams,
                          tournament.leagueMatches || tournament.matches || [],
                          tournament.pointRules || {}
                        ).map((row, idx) => {
                          const isTop3 = idx < 3;
                          const rankColor = idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-white/40';
                          const medal = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}`;
                          return (
                            <tr key={row.teamId} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                              <td className="py-3.5 px-2 text-center font-black">
                                <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-black ${isTop3 ? rankColor + ' bg-white/5' : 'text-white/40'}`}>
                                  {medal}
                                </span>
                              </td>
                              {tournament.format === 'battle_royale' && (
                                <td className="py-3.5 px-1 text-center">
                                  {row.rankChange > 0 && (
                                    <span className="text-green-500 text-[9px] font-bold">▲{row.rankChange}</span>
                                  )}
                                  {row.rankChange < 0 && (
                                    <span className="text-red-500 text-[9px] font-bold">▼{Math.abs(row.rankChange)}</span>
                                  )}
                                  {row.rankChange === 0 && (
                                    <span className="text-white/20 text-[9px]">-</span>
                                  )}
                                </td>
                              )}
                              <td className="py-3.5 px-3 font-bold text-white">
                                <div className="flex items-center gap-2">
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
                                  <span className="truncate">{row.teamName}</span>
                                </div>
                              </td>
                              {tournament.format === 'battle_royale' && (
                                <>
                                  <td className="py-3.5 px-2 text-center font-medium text-blue-400">{row.placementPoints}</td>
                                  <td className="py-3.5 px-2 text-center font-medium text-red-400">{row.killPoints}</td>
                                </>
                              )}
                              <td className="py-3.5 px-3 text-center font-black text-[#22c55e]">{row.totalPoints}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MATCH HISTORY / SIDEBAR (RIGHT) */}
                <div className="bg-[#0f1419] border border-white/[0.06] rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-black tracking-widest text-white/40 uppercase border-b border-white/[0.06] pb-3">
                    Danh Sách Trận Đấu
                  </h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {(tournament.leagueMatches || tournament.matches || []).map((m: any) => {
                      const isSelected = selectedLeagueMatchId === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleSelectLeagueMatch(m.id)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all ${isSelected ? 'border-[#22c55e] bg-[#22c55e]/10' : 'border-white/[0.06] bg-[#080b10]'
                            }`}
                        >
                          <div className="font-bold text-xs">{m.name}</div>
                          <div className="text-[10px] text-white/40">{m.isFinished ? '✓ Đã xong' : 'Chờ'}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* MATCH RESULT EDITOR FOR ADMINS */}
              {selectedLeagueMatchId && isOwner && (
                <div id="league-match-editor" className="mt-8 bg-[#0f1419] border border-white/[0.06] rounded-2xl p-6 space-y-6 max-w-3xl mx-auto shadow-2xl animate-fade-in-up">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div>
                      <h4 className="font-black text-white text-base">
                        Nhập Kết Quả - {((tournament.leagueMatches || tournament.matches || []).find((m: any) => m.id === selectedLeagueMatchId))?.name}
                      </h4>
                      <p className="text-[11px] text-white/50 mt-0.5">Điền thứ hạng và mạng hạ gục của từng đội tuyển thi đấu.</p>
                    </div>
                    <button
                      onClick={() => setSelectedLeagueMatchId(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[11px] font-bold transition-all border border-white/5"
                    >
                      Hủy
                    </button>
                  </div>

                  {(() => {
                    const selectedMatchObj = (tournament.leagueMatches || tournament.matches || []).find((m: any) => m.id === selectedLeagueMatchId);
                    const leagueMatchState = tournament.matchStates?.[selectedLeagueMatchId] || {
                      isRunning: false,
                      isFinished: selectedMatchObj?.isFinished || false
                    };
                    const isFinished = selectedMatchObj?.isFinished || !!leagueMatchState.isFinished;
                    const isRunning = !isFinished && !!leagueMatchState.isRunning;

                    return (
                      <>
                        {/* TRẠNG THÁI VÀ ĐIỀU KHIỂN TRẬN ĐẤU */}
                        <div className="p-5 rounded-xl bg-[#080b10]/60 border border-white/[0.04] space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white uppercase tracking-wider">Trạng thái trận đấu</span>
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isFinished
                              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                              : isRunning
                                ? 'bg-[#22c55e]/20 text-green-400 border border-[#22c55e]/40 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                              }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${isFinished ? 'bg-red-400' : isRunning ? 'bg-[#22c55e] animate-pulse' : 'bg-blue-400'
                                }`} />
                              {isFinished ? 'Đã kết thúc' : isRunning ? 'Đang phát sóng (LIVE)' : 'Sẵn sàng'}
                            </div>
                          </div>

                          <div className="flex gap-3">
                            {isFinished ? (
                              <div className="w-full text-center py-2 px-4 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-bold flex items-center justify-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                                <span>Trận đấu đã kết thúc & Đã cập nhật Standing</span>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleLeagueMatchRunning(selectedLeagueMatchId)}
                                  className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-200 border shadow-md ${isRunning
                                    ? 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/50 text-yellow-400'
                                    : 'bg-[#22c55e]/20 hover:bg-[#22c55e]/30 border-[#22c55e]/50 text-green-400'
                                    }`}
                                >
                                  {isRunning ? '⏸ Tạm dừng trận đấu' : '▶ Bắt đầu trận đấu'}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleFinishLeagueMatch}
                                  className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/50 font-bold text-xs hover:bg-red-500/30 transition-all"
                                >
                                  Kết thúc trận đấu
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* ĐỘI TUYỂN THI ĐẤU REFERENCE PANEL */}
                        <div className="p-5 rounded-xl bg-[#080b10]/60 border border-white/[0.04] space-y-3">
                          <h5 className="text-xs font-black tracking-widest text-white/40 uppercase mb-2">
                            Đội tuyển thi đấu ({tournament.teams?.length || 0})
                          </h5>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {(tournament.teams || []).map((team: any) => {
                              const initials = team.name.slice(0, 2).toUpperCase();
                              return (
                                <div key={team.id} className="p-2.5 rounded-lg bg-[#080b10] border border-white/[0.04] flex flex-col items-center justify-center text-center gap-1.5">
                                  {team.logo ? (
                                    <img
                                      src={team.logo}
                                      className="w-8 h-8 rounded-full object-cover border border-white/10"
                                      alt={team.name}
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/30 text-[#22c55e] border border-white/[0.06] flex items-center justify-center font-bold text-[9px] uppercase">
                                      {initials}
                                    </div>
                                  )}
                                  <div className="min-w-0 max-w-full text-center">
                                    <div className="font-extrabold text-[11px] text-white truncate max-w-full">{team.name}</div>
                                    <div className="text-[9px] text-white/30 mt-0.5 font-semibold">
                                      {team.members && team.members.length > 0 ? `${team.members.length} TV` : 'Chưa xếp đ/h'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Cấu hình Livestream trận đấu */}
                  <div className="p-5 rounded-xl bg-[#080b10]/60 border border-white/[0.04] space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        Cấu hình phát trực tiếp (Livestream)
                      </h5>
                      {leagueStreamType && (
                        <span className="text-[10px] text-[#22c55e] font-black uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {leagueStreamType} Live
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-white/50 mb-2 uppercase tracking-wider">
                          Nguồn phát (Nền tảng hoặc thiết bị)
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          <button
                            type="button"
                            onClick={() => handleLeagueStreamTypeChange('youtube')}
                            className={`py-2 px-3 rounded-lg border font-bold text-xs transition-all ${leagueStreamType === 'youtube'
                              ? 'border-red-500 bg-red-500/10 text-red-400'
                              : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white'
                              }`}
                          >
                            YouTube URL
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLeagueStreamTypeChange('twitch')}
                            className={`py-2 px-3 rounded-lg border font-bold text-xs transition-all ${leagueStreamType === 'twitch'
                              ? 'border-[#a855f7] bg-[#a855f7]/10 text-[#a855f7]'
                              : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white'
                              }`}
                          >
                            Twitch URL
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLeagueStreamTypeChange('webcam')}
                            className={`py-2 px-3 rounded-lg border font-bold text-xs transition-all flex items-center gap-1.5 ${leagueStreamType === 'webcam'
                              ? 'border-[#22c55e] bg-[#22c55e]/10 text-green-400 font-extrabold'
                              : 'border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white'
                              }`}
                          >
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Webcam trực tiếp</span>
                          </button>
                        </div>
                      </div>

                      {leagueStreamType === 'webcam' ? (
                        <div className="p-4 rounded-lg bg-[#080b10] border border-white/[0.04]">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-white/60 font-semibold">Tình trạng máy quay (Webcam stream)</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isLeagueBroadcasting ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white/10 text-white/50'
                              }`}>
                              {isLeagueBroadcasting ? 'ĐANG PHÁT (BROADCASTING)' : 'SẴN SÀNG'}
                            </span>
                          </div>

                          {isLeagueBroadcasting && (
                            <video
                              ref={leagueBroadcasterVideoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full aspect-video object-cover rounded-lg border border-white/10 mb-3 bg-black"
                            />
                          )}

                          <div className="flex gap-2">
                            {!isLeagueBroadcasting ? (
                              <>
                                <button
                                  type="button"
                                  onClick={startLeagueWebcamBroadcast}
                                  className="flex-1 py-2 px-4 rounded-lg bg-[#22c55e] text-[#080b10] font-black text-xs hover:bg-[#16a34a] transition-all flex items-center justify-center gap-1.5"
                                >
                                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span>Phát Webcam</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={startLeagueScreenShareBroadcast}
                                  className="flex-1 py-2 px-4 rounded-lg bg-[#3b82f6] text-white font-black text-xs hover:bg-[#2563eb] transition-all flex items-center justify-center gap-1.5"
                                >
                                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <span>Chia sẻ màn hình</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={stopLeagueWebcamBroadcast}
                                className="w-full py-2 px-4 rounded-lg bg-red-500 text-white font-black text-xs hover:bg-red-600 transition-all"
                              >
                                Tạm dừng truyền hình
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-semibold text-white/50 mb-2 uppercase tracking-wider">
                            Đường dẫn (Stream URL)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={leagueStreamUrlInput}
                              onChange={(e) => setLeagueStreamUrlInput(e.target.value)}
                              placeholder={
                                leagueStreamType === 'youtube'
                                  ? 'VD: https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                                  : leagueStreamType === 'twitch'
                                    ? 'VD: https://www.twitch.tv/ninja'
                                    : 'Vui lòng chọn loại nguồn phát phía trên...'
                              }
                              disabled={!leagueStreamType}
                              className="flex-1 px-3 py-2 rounded-lg bg-[#080b10] border border-white/[0.08] text-white placeholder-white/30 text-xs focus:outline-none focus:border-[#22c55e] disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <button
                              type="button"
                              onClick={handleSaveLeagueStreamUrl}
                              disabled={!leagueStreamType}
                              className="px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] font-black text-xs hover:bg-[#16a34a] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Lưu Live
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* NHẬP ĐIỂM/PLACEMENT CHI TIẾT */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tournament.teams.map((team: any) => {
                      const teamRes = editingResults[team.id] || { placement: '', kills: 0 };
                      const pointRules = tournament.pointRules || {
                        "1": 10, "2": 6, "3": 5, "4": 4, "5": 3, "6": 2, "7": 2, "8": 1, "9": 1, "10": 1, "11": 1, "12": 1
                      };
                      const calculatedPlacementPoints = teamRes.placement !== '' ? (pointRules[teamRes.placement.toString()] || 0) : 0;
                      const calculatedTotalPoints = calculatedPlacementPoints + (Number(teamRes.kills || 0) * 1);

                      return (
                        <div key={team.id} className="bg-[#080b10] border border-white/[0.04] p-4 rounded-xl flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-sm text-white truncate block">{team.name}</span>
                            <span className="text-[10px] text-[#22c55e] font-bold mt-1 block">
                              Dự tính: {calculatedPlacementPoints} (Hạng) + {teamRes.kills || 0} (Kills) = {calculatedTotalPoints} điểm
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Placement */}
                            <div className="w-20">
                              <label className="block text-[9px] text-white/40 uppercase font-black mb-1">Hạng</label>
                              <input
                                type="number"
                                min="1"
                                max={tournament.teams.length}
                                placeholder="Hạng"
                                value={teamRes.placement}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1);
                                  setEditingResults(prev => ({
                                    ...prev,
                                    [team.id]: { ...prev[team.id], placement: val }
                                  }));
                                }}
                                className="w-full px-2 py-1.5 rounded bg-[#0f1419] border border-white/[0.06] text-white text-xs font-bold text-center focus:outline-none focus:border-[#22c55e]"
                              />
                            </div>

                            {/* Kills */}
                            <div className="w-20">
                              <label className="block text-[9px] text-white/40 uppercase font-black mb-1">Mạng Kills</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="Kills"
                                value={teamRes.kills}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                                  setEditingResults(prev => ({
                                    ...prev,
                                    [team.id]: { ...prev[team.id], kills: val }
                                  }));
                                }}
                                className="w-full px-2 py-1.5 rounded bg-[#0f1419] border border-white/[0.06] text-white text-xs font-bold text-center focus:outline-none focus:border-[#22c55e]"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                    <div className="px-3.5 py-1.5 rounded-lg border border-white/[0.08] bg-[#080b10] flex items-center gap-2 text-xs select-none">
                      {leagueAutoSaveStatus === 'saving' ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-amber-400 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                          </svg>
                          <span className="text-amber-400 font-bold">Đang tự động lưu...</span>
                        </>
                      ) : leagueAutoSaveStatus === 'saved' ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-[#22c55e] font-bold">Đã tự động lưu ({leagueLastAutoSaveTime})</span>
                        </>
                      ) : leagueAutoSaveStatus === 'error' ? (
                        <div className="flex items-center gap-1.5 text-yellow-400 font-bold">
                          <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>Đã lưu tạm ở máy</span>
                        </div>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          <span className="text-white/50">Tự động lưu kích hoạt</span>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedLeagueMatchId(null)}
                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white font-semibold text-xs transition-colors"
                      >
                        Đóng bảng
                      </button>
                      <button
                        onClick={handleSaveLeagueMatchResults}
                        className="px-5 py-2 rounded-lg bg-[#22c55e] text-[#080b10] font-bold text-xs hover:bg-[#16a34a] transition-all shadow-[0_0_15px_rgba(34,197,94,0.15)]"
                      >
                        Cập nhật Bảng xếp hạng
                      </button>
                    </div>
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
                                onClick={() => handleMatchCardClick(mKey)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Transition to Knockout Button */}
              {isOwner && (
                <div className="flex justify-center pt-6">
                  <button
                    onClick={handleProceedToKnockout}
                    className={`px-8 py-3 rounded-xl font-black text-sm transition-all duration-200 active:scale-95 flex items-center gap-2 ${areAllGroupMatchesFinished()
                      ? 'bg-[#22c55e] text-black hover:bg-[#16a34a] shadow-[0_0_20px_rgba(34,197,94,0.25)]'
                      : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                      }`}
                    disabled={!areAllGroupMatchesFinished()}
                  >
                    <svg className="w-4 h-4 text-black shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                    <span>Tiến vào Vòng Knockout</span>
                  </button>
                </div>
              )}
            </div>
          ) : tournament.format === 'double_elimination' ? (
            <div className="space-y-8">
              {/* Tab Selector */}
              <div className="flex justify-center border-b border-white/[0.06] pb-3 mb-6 gap-2 md:gap-4 overflow-x-auto">
                {(['upper', 'lower', 'grand'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveDeTab(tab)}
                    className={`px-4 py-2 rounded-lg text-xs font-black tracking-wider uppercase transition-all duration-200 whitespace-nowrap ${activeDeTab === tab
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
                                  onClick={() => handleMatchCardClick(mKey)}
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
          ) : buildBracketData(tournament, matchState, selectedMatchKey).length === 0 ? (
            <div className="text-center py-20 bg-[#0f1419] rounded-2xl border border-white/[0.06]">
              <p className="text-white/60 text-lg">Không có dữ liệu sơ đồ cho giải đấu này</p>
            </div>
          ) : (
            <div className="flex items-stretch justify-center gap-8 overflow-x-auto pb-8 pt-4 min-h-[500px]">
              {buildBracketData(tournament, matchState, selectedMatchKey).map((roundMatches, roundIdx, arr) => (
                <div key={roundIdx} className="flex flex-col shrink-0 items-center w-[160px]">
                  <h3 className="text-xs font-black tracking-widest text-[#22c55e]/70 uppercase text-center mb-8">
                    {getRoundLabel(roundIdx, arr.length)}
                  </h3>
                  <div className="flex flex-col justify-around flex-1 h-full gap-4">
                    {roundMatches.map((m: any, matchIdx: number) => {
                      const mKey = `${roundIdx}-${matchIdx}`;
                      return (
                        <div key={matchIdx} className="relative flex items-center justify-center py-2">
                          <BracketMatchCard
                            {...m}
                            onClick={() => handleMatchCardClick(mKey)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bảng điều khiển trận đấu (Active Match Controls) */}
        {showActiveMatch && isOwner && tournament.format !== 'league' && (
          <div
            key={selectedMatchKey || 'no-match'}
            id="match-controller"
            className="mt-12 bg-[#0f1419] border border-white/[0.06] rounded-2xl p-8 max-w-2xl mx-auto shadow-2xl relative animate-fade-in-up"
          >
            {(() => {
              if (tournament.format === 'round_robin' && tournament.stage === 'group') {
                return null;
              }
              if (tournament.format === 'double_elimination') {
                return null;
              }
              if (!tournament.bracket || !tournament.bracket.rounds) return null;

              const currentRound = tournament.bracket.currentRound;
              const roundMatches = tournament.bracket.rounds[currentRound] || [];
              const playableMatches = roundMatches.map((m: any, idx: number) => {
                const hasTeams = m.teamA && m.teamB && m.teamA.name !== '?' && m.teamB.name !== '?';
                return { match: m, idx, hasTeams };
              }).filter((item: any) => item.hasTeams);

              if (playableMatches.length <= 1) return null;

              return (
                <div className="mb-6 flex flex-wrap gap-2 pb-4 border-b border-white/[0.04]">
                  {playableMatches.map((item: any) => {
                    const mKey = `${currentRound}-${item.idx}`;
                    const isSelected = selectedMatchKey === mKey;

                    const isActive = (tournament.bracket.activeMatches || []).includes(item.idx);
                    const mState = tournament.matchStates?.[mKey] || {};
                    const isRunning = isActive && mState.isRunning && !mState.isFinished;
                    const isFinished = item.match.isFinished || mState.isFinished;

                    let statusColor = "bg-white/20";
                    if (isRunning) statusColor = "bg-[#22c55e] animate-pulse";
                    else if (isFinished) statusColor = "bg-white/40";
                    else if (isActive) statusColor = "bg-blue-500 animate-pulse";

                    return (
                      <button
                        key={item.idx}
                        type="button"
                        onClick={() => handleMatchCardClick(mKey)}
                        className={`px-4 py-2.5 rounded-xl border text-xs font-black tracking-tight transition-all duration-200 flex items-center gap-2 ${isSelected
                          ? "bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] text-white/60 hover:text-white"
                          }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                        <span>
                          {item.match.teamA?.name} vs {item.match.teamB?.name}
                        </span>
                        {isFinished && (
                          <svg className="w-3 h-3 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                        )}
                        {isRunning && <span className="text-[9px] px-1 bg-[#22c55e] text-[#080b10] rounded">LIVE</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${matchState.isFinished
                  ? 'bg-white/30'
                  : matchState.isRunning
                    ? 'bg-[#22c55e] animate-pulse'
                    : 'bg-blue-500 animate-pulse'
                  }`} />
                <h3 className={`text-sm font-black tracking-widest uppercase ${matchState.isFinished
                  ? 'text-white/40'
                  : matchState.isRunning
                    ? 'text-[#22c55e]'
                    : 'text-blue-400'
                  }`}>
                  {matchState.isFinished ? 'Đã kết thúc' : matchState.isRunning ? 'Đang thi đấu' : 'Sẵn sàng'}
                </h3>
              </div>
              <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 ${matchState.isFinished
                ? 'bg-white/[0.02] border-white/10 text-white/40'
                : 'bg-red-500/10 border border-red-500/20 text-red-500'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${matchState.isFinished ? 'bg-white/20' : 'bg-red-500 animate-pulse'}`} />
                Trận đấu
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 text-lg font-bold mb-6 text-white/90">
                <span>{team1?.name}</span>
                <span className="text-white/20">vs</span>
                <span>{team2?.name}</span>
              </div>

              <div className="text-[11px] font-black tracking-wider text-white/40 uppercase mb-4">
                Tỉ số
              </div>

              {/* Dynamic Score Controls based on Sport */}
              <div className={`flex items-center justify-center gap-8 mb-6 ${matchState.isFinished ? 'pointer-events-none opacity-50' : ''}`}>
                {/* Team 1 scoring area */}
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

                <div className="text-xl font-bold text-white/20">vs</div>

                {/* Team 2 scoring area */}
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
              </div>





              {/* Quick Livestream URL */}
              {!matchState.isFinished && (
                <div className="mb-6 p-4 rounded-xl bg-[#080b10]/60 border border-white/[0.04] max-w-md mx-auto space-y-3 animate-fade-in-up">
                  <div className="flex items-center justify-between text-xs font-semibold text-white/60">
                    <span>Cấu hình Livestream trận đấu</span>
                    {matchState.streamType === 'webcam' && (
                      <span className="text-[10px] text-red-400 font-black animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Webcam Live
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Dán link stream (YouTube/Twitch) tại đây..."
                      value={matchState.streamUrl || ''}
                      onChange={(e) => {
                        const url = e.target.value.trim();
                        let type: 'youtube' | 'twitch' | null = null;
                        if (url.includes('youtube.com') || url.includes('youtu.be')) {
                          type = 'youtube';
                        } else if (url.includes('twitch.tv')) {
                          type = 'twitch';
                        }
                        setMatchState(prev => ({
                          ...prev,
                          streamType: type,
                          streamUrl: url
                        }));
                      }}
                      disabled={matchState.streamType === 'webcam'}
                      className="w-full px-3 py-1.5 rounded bg-[#080b10] border border-white/[0.08] text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#22c55e] disabled:opacity-50"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/tournaments/${tournamentId}/match?match=${selectedMatchKey}`}
                      className="w-full py-1.5 rounded bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/25 text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-pulse">
                        <path d="M23 7l-7 5 7 5V7z" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                      Mở bảng Trọng tài & Webcam Live
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-3">
                {matchState.isFinished ? (
                  <div className="w-full max-w-md text-center py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.08] text-white/40 text-xs font-bold select-none flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                    <span>Trận đấu đã kết thúc. Kết quả đã lưu vĩnh viễn.</span>
                  </div>
                ) : (
                  <>
                    {!matchState.isRunning && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStartStop(); }}
                        className="px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all duration-200 active:scale-95 bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]"
                      >
                        <svg className="w-3.5 h-3.5 text-[#22c55e] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span>Bắt đầu</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEndHalf(); }}
                      className="px-5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-black text-xs transition-all duration-200 active:scale-95 flex items-center gap-1 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                    >
                      <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                      <span>Kết thúc trận</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trận chờ bắt đầu (Pending matches) */}
        {getPendingMatches().length > 0 && isOwner && (
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
                      Bắt đầu trận đấu
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* ====== Announcement Section (Owner only for posting, visible to all) ====== */}
        {isOwner && (
          <div className="mt-8 bg-[#0f1419] border border-white/[0.06] rounded-2xl p-8 max-w-2xl mx-auto shadow-2xl">
            <h3 className="text-sm font-black tracking-widest text-white/50 uppercase mb-6 pb-2 border-b border-white/[0.04]">
              Thông báo giải đấu
            </h3>

            {/* Post new announcement form */}
            <div className="mb-8 p-5 rounded-xl bg-[#080b10] border border-white/[0.06]">
              <h4 className="text-xs font-black tracking-wider text-white/40 uppercase mb-4">Đăng thông báo mới</h4>

              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="Tiêu đề thông báo..."
                    className="w-full px-4 py-3 rounded-xl bg-[#0f1419] border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#22c55e]/40 focus:ring-1 focus:ring-[#22c55e]/20 transition-all"
                  />
                </div>

                <div>
                  <textarea
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    placeholder="Nội dung thông báo..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-[#0f1419] border border-white/[0.08] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#22c55e]/40 focus:ring-1 focus:ring-[#22c55e]/20 transition-all resize-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-white/40 font-bold">Loại:</label>
                  <div className="flex gap-2">
                    {(['info', 'warning', 'update'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAnnouncementType(type)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 border ${announcementType === type
                          ? type === 'info'
                            ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                            : type === 'warning'
                              ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                              : 'bg-[#22c55e]/20 border-[#22c55e]/30 text-[#22c55e]'
                          : 'bg-white/[0.03] border-white/[0.06] text-white/30 hover:bg-white/[0.06]'
                          }`}
                      >
                        {type === 'info' ? 'Thông tin' : type === 'warning' ? 'Cảnh báo' : 'Cập nhật'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handlePostAnnouncement}
                    disabled={announcementPosting || !announcementTitle.trim() || !announcementContent.trim()}
                    className="px-5 py-2.5 rounded-xl bg-[#22c55e] text-[#080b10] font-black text-xs hover:bg-[#16a34a] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {announcementPosting ? (
                      <>
                        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
                        </svg>
                        Đang đăng...
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        Đăng thông báo
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Existing announcements list */}
            {announcementsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/30 text-sm">Chưa có thông báo nào</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann: any, idx: number) => (
                  <div key={ann._id || idx} className="p-4 rounded-xl bg-[#080b10] border border-white/[0.04]">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="text-sm font-bold text-white">{ann.title}</h4>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${ann.type === 'warning'
                        ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
                        : ann.type === 'update'
                          ? 'bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/20'
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                        }`}>
                        {ann.type === 'warning' ? 'Cảnh báo' : ann.type === 'update' ? 'Cập nhật' : 'Thông tin'}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">{ann.content}</p>
                    {ann.createdAt && (
                      <p className="text-[10px] text-white/20 mt-2">
                        {new Date(ann.createdAt).toLocaleString('vi-VN')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Refresh button */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={fetchAnnouncements}
                className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white/60 text-xs font-bold transition-all duration-200 flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Làm mới
              </button>
            </div>
          </div>
        )}

        {/* ====== Chat Moderation Section (Owner only) ====== */}
        {isOwner && (
          <div className="mt-8 bg-[#0f1419] border border-white/[0.06] rounded-2xl p-8 max-w-2xl mx-auto shadow-2xl space-y-8">
            <div>
              <h3 className="text-sm font-black tracking-widest text-white/50 uppercase mb-6 pb-2 border-b border-white/[0.04] flex items-center justify-between">
                <span>Quản lý Chat Trực tiếp</span>
                <button
                  type="button"
                  onClick={fetchAdminChatMessages}
                  className="px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white/60 text-[10px] font-bold transition-all flex items-center gap-1 normal-case tracking-normal"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Làm mới
                </button>
              </h3>

              {adminChatLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : adminChatMessages.length === 0 ? (
                <div className="text-center py-8 bg-[#080b10]/40 rounded-xl border border-white/[0.04]">
                  <p className="text-white/30 text-xs">Chưa có tin nhắn nào trong kênh chat.</p>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-96 overflow-y-auto pr-2">
                  {adminChatMessages.map((msg: any, idx: number) => {
                    const isUserBlocked = (tournament?.blockedChatUserIds || []).includes(msg.userId);

                    return (
                      <div key={msg._id || idx} className="p-3.5 rounded-xl bg-[#080b10] border border-white/[0.04] flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-[#22c55e]">{msg.userName}</span>
                            {msg.userId && (
                              <span className="text-[9px] text-white/20 font-mono font-normal">({msg.userId.substring(0, 10)}...)</span>
                            )}
                          </div>
                          <p className="text-xs text-white/70 leading-relaxed break-words">{msg.message}</p>
                        </div>
                        {msg.userId && !isUserBlocked && (
                          <button
                            type="button"
                            disabled={chatModerationSubmitting === msg.userId}
                            onClick={() => handleBlockUser(msg.userId, msg.userName)}
                            className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1"
                          >
                            <svg className="w-3 h-3 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            <span>Chặn</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-black tracking-widest text-white/50 uppercase mb-4 pb-2 border-b border-white/[0.04]">
                Danh sách người bị chặn
              </h3>
              {(!tournament?.blockedChatUserIds || tournament.blockedChatUserIds.length === 0) ? (
                <div className="text-center py-4 bg-[#080b10]/40 rounded-xl border border-white/[0.04]">
                  <p className="text-white/30 text-xs">Chưa chặn người dùng nào.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {tournament.blockedChatUserIds.map((userId: string, idx: number) => {
                    const name = tournament.blockedChatUserNames?.[idx] || 'Người dùng ẩn danh';
                    return (
                      <div key={userId} className="px-4 py-2.5 rounded-xl bg-[#080b10] border border-white/[0.04] flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">{name}</span>
                          <span className="text-[9px] text-white/30 font-mono font-normal block truncate">{userId}</span>
                        </div>
                        <button
                          type="button"
                          disabled={chatModerationSubmitting === userId}
                          onClick={() => handleUnblockUser(userId)}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white/70 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1"
                        >
                          <svg className="w-3 h-3 text-white/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                          <span>Bỏ chặn</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
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
              <div className="text-center mb-6 flex flex-col items-center">
                <svg className="w-10 h-10 text-[#22c55e] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
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
      {/* Redirecting Loader Screen */}
      {isRedirecting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080b10]/95 backdrop-blur-md transition-all duration-500 ease-out opacity-100">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 border-4 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
            <h3 className="text-xl font-black tracking-wide text-white animate-pulse">Kết nối Live Match...</h3>
            <p className="text-xs text-white/40">Chuyển hướng bạn đến trang xem trực tiếp</p>
          </div>
        </div>
      )}
      <FormatGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        initialFormat={tournament?.format}
      />
    </main>
  );
}
