export type TeamRef = {
  id?: string;
  name?: string;
  isBye?: boolean;
};

export type BracketMatch = {
  id?: string;
  teamA?: TeamRef;
  teamB?: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
  isFinished: boolean;
  winner?: TeamRef | null;
  loser?: TeamRef | null;
};

export type BracketState = {
  format?: string;
  rounds?: BracketMatch[][];
  upperRounds?: BracketMatch[][];
  lowerRounds?: BracketMatch[][];
  grandFinal?: BracketMatch[];
  currentRound?: number;
  currentMatch?: number;
  isFinished?: boolean;
  winner?: TeamRef | null;
  activeMatches?: number[];
};

export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export function padTeamsToPowerOfTwo(teams: TeamRef[]): TeamRef[] {
  const copy = teams.map(t => ({ ...t }));
  if (copy.length < 2) return copy;

  let target = 2;
  while (target < copy.length) {
    target *= 2;
  }
  while (copy.length < target) {
    copy.push({ id: `bye-${copy.length + 1}`, name: 'BYE', isBye: true });
  }
  return copy;
}

export function pickWinner(
  teamA: TeamRef | undefined,
  teamB: TeamRef | undefined,
  scoreA: number | null | undefined,
  scoreB: number | null | undefined,
  isFinished: boolean
): TeamRef | null {
  if (!isFinished) return null;
  if (scoreA === null || scoreB === null || scoreA === undefined || scoreB === undefined) return null;
  if (scoreA === scoreB) return null; // Tie

  const aIsBye = teamA?.isBye || teamA?.name === 'BYE';
  const bIsBye = teamB?.isBye || teamB?.name === 'BYE';

  if (bIsBye && !aIsBye) return teamA || null;
  if (aIsBye && !bIsBye) return teamB || null;

  if (scoreA > scoreB) return teamA || null;
  if (scoreB > scoreA) return teamB || null;
  return null;
}

export function isSameTeam(t1?: TeamRef | null, t2?: TeamRef | null): boolean {
  if (!t1 || !t2) return false;
  if (t1.id && t2.id && String(t1.id) === String(t2.id)) return true;
  if (t1.name && t2.name && t1.name.trim().toLowerCase() === t2.name.trim().toLowerCase()) return true;
  return false;
}

// 1. Single Elimination Generator
export function buildSingleEliminationBracket(teams: TeamRef[]): BracketState {
  const padded = padTeamsToPowerOfTwo(teams);
  const numTeams = padded.length;
  const numRounds = Math.log2(numTeams);

  const rounds: BracketMatch[][] = [];

  // Round 0 (First Round)
  const round0: BracketMatch[] = [];
  for (let i = 0; i < numTeams; i += 2) {
    const tA = padded[i];
    const tB = padded[i + 1];
    const isByeA = tA.isBye || tA.name === 'BYE';
    const isByeB = tB.isBye || tB.name === 'BYE';

    if (isByeB && !isByeA) {
      round0.push({
        id: `r0-m${i / 2}`,
        teamA: tA,
        teamB: tB,
        scoreA: 1,
        scoreB: 0,
        isFinished: true,
        winner: tA,
        loser: tB
      });
    } else if (isByeA && !isByeB) {
      round0.push({
        id: `r0-m${i / 2}`,
        teamA: tA,
        teamB: tB,
        scoreA: 0,
        scoreB: 1,
        isFinished: true,
        winner: tB,
        loser: tA
      });
    } else {
      round0.push({
        id: `r0-m${i / 2}`,
        teamA: tA,
        teamB: tB,
        scoreA: null,
        scoreB: null,
        isFinished: false,
        winner: null,
        loser: null
      });
    }
  }
  rounds.push(round0);

  // Future Rounds
  for (let r = 1; r < numRounds; r++) {
    const matchCount = numTeams / Math.pow(2, r + 1);
    const roundR: BracketMatch[] = [];
    for (let m = 0; m < matchCount; m++) {
      roundR.push({
        id: `r${r}-m${m}`,
        teamA: { id: '', name: '?' },
        teamB: { id: '', name: '?' },
        scoreA: null,
        scoreB: null,
        isFinished: false,
        winner: null,
        loser: null
      });
    }
    rounds.push(roundR);
  }

  // Advance initial BYE winners into Round 1
  round0.forEach((m, idx) => {
    if (m.isFinished && m.winner && rounds[1]) {
      const nextMatchIdx = Math.floor(idx / 2);
      const isTeamA = idx % 2 === 0;
      if (isTeamA) {
        rounds[1][nextMatchIdx].teamA = m.winner;
      } else {
        rounds[1][nextMatchIdx].teamB = m.winner;
      }
    }
  });

  return {
    format: 'single_elimination',
    rounds,
    currentRound: 0,
    currentMatch: 0,
    isFinished: false,
    winner: null
  };
}

// 2. Double Elimination Generator
export function buildDoubleEliminationBracket(teams: TeamRef[]): BracketState {
  const padded = padTeamsToPowerOfTwo(teams);
  const n = padded.length;
  const numUpperRounds = Math.log2(n);

  const upperRounds: BracketMatch[][] = [];
  const u0Matches: BracketMatch[] = [];
  for (let i = 0; i < n; i += 2) {
    const tA = padded[i];
    const tB = padded[i + 1];
    const isByeA = tA?.isBye || tA?.name === 'BYE';
    const isByeB = tB?.isBye || tB?.name === 'BYE';

    if (isByeB && !isByeA) {
      u0Matches.push({
        id: `u0-m${i / 2}`,
        teamA: tA,
        teamB: tB,
        scoreA: 1,
        scoreB: 0,
        isFinished: true,
        winner: tA,
        loser: tB
      });
    } else if (isByeA && !isByeB) {
      u0Matches.push({
        id: `u0-m${i / 2}`,
        teamA: tA,
        teamB: tB,
        scoreA: 0,
        scoreB: 1,
        isFinished: true,
        winner: tB,
        loser: tA
      });
    } else {
      u0Matches.push({
        id: `u0-m${i / 2}`,
        teamA: tA,
        teamB: tB,
        scoreA: null,
        scoreB: null,
        isFinished: false,
        winner: null,
        loser: null
      });
    }
  }
  upperRounds.push(u0Matches);

  for (let r = 1; r < numUpperRounds; r++) {
    const matchesInRound = n / Math.pow(2, r + 1);
    const roundMatches: BracketMatch[] = [];
    for (let m = 0; m < matchesInRound; m++) {
      roundMatches.push({
        id: `u${r}-m${m}`,
        teamA: { id: '', name: '?' },
        teamB: { id: '', name: '?' },
        scoreA: null,
        scoreB: null,
        isFinished: false,
        winner: null,
        loser: null
      });
    }
    upperRounds.push(roundMatches);
  }

  const lowerRounds: BracketMatch[][] = [];
  const totalLowerRounds = Math.max(1, 2 * numUpperRounds - 2);
  for (let r = 0; r < totalLowerRounds; r++) {
    const k = Math.floor(r / 2);
    const matchesInRound = Math.max(1, n / Math.pow(2, k + 2));
    const roundMatches: BracketMatch[] = [];
    for (let m = 0; m < matchesInRound; m++) {
      roundMatches.push({
        id: `l${r}-m${m}`,
        teamA: { id: '', name: '?' },
        teamB: { id: '', name: '?' },
        scoreA: null,
        scoreB: null,
        isFinished: false,
        winner: null,
        loser: null
      });
    }
    lowerRounds.push(roundMatches);
  }

  const grandFinal: BracketMatch[] = [
    {
      id: 'gf-0',
      teamA: { id: '', name: '?' },
      teamB: { id: '', name: '?' },
      scoreA: null,
      scoreB: null,
      isFinished: false,
      winner: null,
      loser: null
    }
  ];

  // Advance initial BYE winners into Upper Round 1
  u0Matches.forEach((m, idx) => {
    if (m.isFinished && m.winner && upperRounds[1]) {
      const nextMatchIdx = Math.floor(idx / 2);
      const isTeamA = idx % 2 === 0;
      if (isTeamA) {
        upperRounds[1][nextMatchIdx].teamA = m.winner;
      } else {
        upperRounds[1][nextMatchIdx].teamB = m.winner;
      }
    }
  });

  return {
    format: 'double_elimination',
    upperRounds,
    lowerRounds,
    grandFinal,
    currentRound: 0,
    currentMatch: 0,
    isFinished: false,
    winner: null
  };
}

// 3. Single Elimination Match Advancement
export function advanceSingleElimination(
  bracket: BracketState,
  roundIndex: number,
  matchIndex: number,
  scoreA: number,
  scoreB: number
): { bracketFinished: boolean; champion?: TeamRef } {
  if (!bracket || !bracket.rounds) return { bracketFinished: false };

  const round = bracket.rounds[roundIndex];
  if (!round || !round[matchIndex]) return { bracketFinished: false };

  const match = round[matchIndex];
  if (!match.teamA || !match.teamB || !match.teamA.name || !match.teamB.name || match.teamA.name === '?' || match.teamB.name === '?') {
    return { bracketFinished: false };
  }

  if (scoreA === scoreB) {
    throw new Error("Trận đấu loại trực tiếp không thể hòa!");
  }

  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.isFinished = true;
  match.winner = scoreA > scoreB ? match.teamA : match.teamB;
  match.loser = scoreA > scoreB ? match.teamB : match.teamA;

  const isFinalRound = roundIndex === bracket.rounds.length - 1;

  if (isFinalRound) {
    bracket.isFinished = true;
    bracket.winner = match.winner;
    return { bracketFinished: true, champion: match.winner };
  } else {
    const nextRound = bracket.rounds[roundIndex + 1];
    if (nextRound) {
      const nextMatchIdx = Math.floor(matchIndex / 2);
      const isTeamA = matchIndex % 2 === 0;
      if (isTeamA) {
        nextRound[nextMatchIdx].teamA = match.winner;
      } else {
        nextRound[nextMatchIdx].teamB = match.winner;
      }
    }
    return { bracketFinished: false };
  }
}

// 4. Double Elimination Match Advancement
export function advanceDoubleElimination(
  bracket: BracketState,
  roundIndex: number,
  matchIndex: number,
  scoreA: number,
  scoreB: number,
  location: 'upper' | 'lower' | 'gf'
): { bracketFinished: boolean; champion?: TeamRef } {
  if (!bracket || !bracket.upperRounds || !bracket.lowerRounds || !bracket.grandFinal) {
    return { bracketFinished: false };
  }

  if (scoreA === scoreB) {
    throw new Error("Trận đấu nhánh thắng thua không thể hòa!");
  }

  const numUpperRounds = bracket.upperRounds.length;
  const totalLowerRounds = bracket.lowerRounds.length;

  if (location === 'upper') {
    const match = bracket.upperRounds[roundIndex]?.[matchIndex];
    if (!match) return { bracketFinished: false };

    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.isFinished = true;
    match.winner = scoreA > scoreB ? match.teamA : match.teamB;
    match.loser = scoreA > scoreB ? match.teamB : match.teamA;

    const winner = match.winner;
    const loser = match.loser;

    if (roundIndex === numUpperRounds - 1) {
      // Upper Final Winner -> Grand Final teamA
      if (bracket.grandFinal[0]) bracket.grandFinal[0].teamA = winner;
      // Upper Final Loser -> Lower Final teamB
      if (bracket.lowerRounds[totalLowerRounds - 1]?.[0]) {
        bracket.lowerRounds[totalLowerRounds - 1][0].teamB = loser;
      }
    } else {
      const nextMatchIdx = Math.floor(matchIndex / 2);
      const isTeamA = matchIndex % 2 === 0;
      const targetMatch = bracket.upperRounds[roundIndex + 1]?.[nextMatchIdx];
      if (targetMatch) {
        if (isTeamA) targetMatch.teamA = winner;
        else targetMatch.teamB = winner;
      }

      // Send Loser to Lower Bracket
      if (roundIndex === 0) {
        const lowerMatchIdx = Math.floor(matchIndex / 2);
        const isLowerTeamA = matchIndex % 2 === 0;
        const targetLowerMatch = bracket.lowerRounds[0]?.[lowerMatchIdx];
        if (targetLowerMatch) {
          if (isLowerTeamA) targetLowerMatch.teamA = loser;
          else targetLowerMatch.teamB = loser;
        }
      } else {
        const lowerRoundIdx = Math.min(2 * roundIndex - 1, totalLowerRounds - 1);
        const roundMatches = bracket.lowerRounds[lowerRoundIdx] || [];
        const safeMatchIdx = Math.min(matchIndex, Math.max(0, roundMatches.length - 1));
        const targetLowerMatch = roundMatches[safeMatchIdx];
        if (targetLowerMatch) {
          targetLowerMatch.teamB = loser;
        }
      }
    }
  } else if (location === 'lower') {
    const match = bracket.lowerRounds[roundIndex]?.[matchIndex];
    if (!match) return { bracketFinished: false };

    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.isFinished = true;
    match.winner = scoreA > scoreB ? match.teamA : match.teamB;
    match.loser = scoreA > scoreB ? match.teamB : match.teamA;

    const winner = match.winner;

    if (roundIndex === totalLowerRounds - 1) {
      // Lower Final Winner -> Grand Final teamB
      if (bracket.grandFinal[0]) bracket.grandFinal[0].teamB = winner;
    } else {
      const isMinorRound = roundIndex % 2 === 0;
      const nextLowerRound = bracket.lowerRounds[roundIndex + 1];
      if (nextLowerRound) {
        if (isMinorRound) {
          const safeMatchIdx = Math.min(matchIndex, Math.max(0, nextLowerRound.length - 1));
          const targetLowerMatch = nextLowerRound[safeMatchIdx];
          if (targetLowerMatch) targetLowerMatch.teamA = winner;
        } else {
          const nextLowerMatchIdx = Math.floor(matchIndex / 2);
          const isLowerTeamA = matchIndex % 2 === 0;
          const safeMatchIdx = Math.min(nextLowerMatchIdx, Math.max(0, nextLowerRound.length - 1));
          const targetLowerMatch = nextLowerRound[safeMatchIdx];
          if (targetLowerMatch) {
            if (isLowerTeamA) targetLowerMatch.teamA = winner;
            else targetLowerMatch.teamB = winner;
          }
        }
      }
    }
  } else if (location === 'gf') {
    const gfMatch = bracket.grandFinal[matchIndex];
    if (!gfMatch) return { bracketFinished: false };

    gfMatch.scoreA = scoreA;
    gfMatch.scoreB = scoreB;
    gfMatch.isFinished = true;
    gfMatch.winner = scoreA > scoreB ? gfMatch.teamA : gfMatch.teamB;
    gfMatch.loser = scoreA > scoreB ? gfMatch.teamB : gfMatch.teamA;

    if (matchIndex === 0) {
      // Robust comparison using isSameTeam
      if (isSameTeam(gfMatch.winner, gfMatch.teamA)) {
        // Upper winner won Grand Final Match 1: Tournament is OVER! No reset match!
        bracket.isFinished = true;
        bracket.winner = gfMatch.winner;
        return { bracketFinished: true, champion: gfMatch.winner };
      } else {
        // Lower winner won Grand Final Match 1: Bracket Reset! Must play Match 2!
        if (bracket.grandFinal.length === 1) {
          bracket.grandFinal.push({
            id: 'gf-1',
            teamA: gfMatch.teamA,
            teamB: gfMatch.teamB,
            scoreA: null,
            scoreB: null,
            isFinished: false,
            winner: null,
            loser: null
          });
        }
        return { bracketFinished: false };
      }
    } else if (matchIndex === 1) {
      // Grand Final Reset Match finished: Winner is Champion!
      bracket.isFinished = true;
      bracket.winner = gfMatch.winner;
      return { bracketFinished: true, champion: gfMatch.winner };
    }
  }

  return { bracketFinished: false };
}

// 5. Champion Resolver
export function getTournamentChampion(tournament: any): TeamRef | null {
  if (!tournament) return null;
  const bracket = tournament.bracket || (tournament.rounds || tournament.upperRounds ? tournament : null);

  if (tournament.format === 'league' || tournament.format === 'battle_royale') {
    const matchesList = tournament.leagueMatches || tournament.matches || [];
    const allFinished = matchesList.length > 0 && matchesList.every((m: any) => m.isFinished);
    if (!allFinished) return null;
    return tournament.winner || null;
  }

  if (!bracket || !bracket.isFinished) return null;
  if (bracket.winner) return bracket.winner;

  if (bracket.upperRounds && bracket.grandFinal) {
    if (bracket.grandFinal[1]?.isFinished) return bracket.grandFinal[1].winner || null;
    if (bracket.grandFinal[0]?.isFinished) return bracket.grandFinal[0].winner || null;
    return null;
  }

  const rounds = bracket.rounds;
  if (!rounds || rounds.length === 0) return null;
  const finalRound = rounds[rounds.length - 1];
  if (!finalRound || finalRound.length === 0) return null;
  const finalMatch = finalRound[0];
  if (!finalMatch || !finalMatch.isFinished) return null;
  return finalMatch.winner || null;
}

// 6. Round Label Helper
export function getRoundLabel(r: number, totalRounds: number): string {
  if (totalRounds <= 1) return 'Chung kết';
  if (r === totalRounds - 1) return 'Chung kết';
  if (r === totalRounds - 2) return 'Bán kết';
  if (r === totalRounds - 3) return 'Tứ kết';
  return `Vòng ${r + 1}`;
}

// 7. Group Standings Calculation
export interface GroupStandingRow {
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

export function calculateGroupStandings(
  groupTeams: TeamRef[],
  groupMatches: any[],
  matchStates?: any,
  groupIdx: number = 0
): GroupStandingRow[] {
  const standings: Record<string, GroupStandingRow> = {};

  (groupTeams || []).forEach((team) => {
    if (team?.id || team?.name) {
      const key = team.id || team.name || '';
      standings[key] = {
        teamId: team.id || '',
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
  matchesArray.forEach((m, mIdx) => {
    const mKey = `g-${groupIdx}-${mIdx}`;
    const mState = (m.id && matchStates?.[m.id]) || (matchStates && matchStates[mKey]);
    const isFinished = m.isFinished || mState?.isFinished || (m.scoreA !== null && m.scoreB !== null && m.scoreA !== undefined && m.scoreB !== undefined);
    if (!isFinished) return;

    const scoreA = mState ? mState.team1Score : (m.scoreA ?? 0);
    const scoreB = mState ? mState.team2Score : (m.scoreB ?? 0);
    const idA = m.teamA?.id || m.teamA?.name;
    const idB = m.teamB?.id || m.teamB?.name;

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

// 8. Check All Group Matches Finished
export function areAllGroupMatchesFinished(groups: any[], matchStates?: any): boolean {
  if (!groups || groups.length === 0) return false;
  return groups.every((g: any, gIdx: number) => {
    if (!g.matches || g.matches.length === 0) return false;
    return g.matches.every((m: any, mIdx: number) => {
      const mKey = `g-${gIdx}-${mIdx}`;
      const ms = (m.id && matchStates?.[m.id]) || (matchStates && matchStates[mKey]);
      return !!(m.isFinished || ms?.isFinished || (m.scoreA !== null && m.scoreB !== null && m.scoreA !== undefined && m.scoreB !== undefined));
    });
  });
}

// 9. Seed Knockout From Groups
export function seedKnockoutFromGroups(
  groups: any[],
  advancingCount: number = 2,
  matchStates?: any
): TeamRef[] {
  if (!groups || groups.length === 0) return [];

  const groupStandings = groups.map((g, gIdx) => {
    return {
      groupIdx: gIdx,
      name: g.name,
      standings: calculateGroupStandings(g.teams, g.matches, matchStates, gIdx)
    };
  });

  const candidates: Array<{ team: TeamRef; rank: number; groupIdx: number }> = [];
  groupStandings.forEach((gs) => {
    for (let r = 0; r < advancingCount; r++) {
      const row = gs.standings[r];
      if (row && (row.teamId || row.teamName)) {
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
    if (candidates.length === 2) {
      // 1 table, Top 2 -> Final directly (2 teams)
      seeded.push(candidates[0].team, candidates[1].team);
    } else if (candidates.length === 4) {
      // 1 table, Top 4 -> Semi 1 (1 vs 4), Semi 2 (2 vs 3)
      seeded.push(candidates[0].team, candidates[3].team, candidates[1].team, candidates[2].team);
    } else {
      candidates.forEach(c => seeded.push(c.team));
    }
  } else if (numGroups === 2) {
    if (advancingCount === 2) {
      // 2 tables, Top 2 each -> Semi 1 (A1 vs B2), Semi 2 (B1 vs A2)
      const a1 = candidates.find(c => c.groupIdx === 0 && c.rank === 1)?.team;
      const a2 = candidates.find(c => c.groupIdx === 0 && c.rank === 2)?.team;
      const b1 = candidates.find(c => c.groupIdx === 1 && c.rank === 1)?.team;
      const b2 = candidates.find(c => c.groupIdx === 1 && c.rank === 2)?.team;
      if (a1 && b2) seeded.push(a1, b2);
      if (b1 && a2) seeded.push(b1, a2);
    } else {
      // 2 tables, Top 1 each -> Final (A1 vs B1)
      const a1 = candidates.find(c => c.groupIdx === 0 && c.rank === 1)?.team;
      const b1 = candidates.find(c => c.groupIdx === 1 && c.rank === 1)?.team;
      if (a1 && b1) seeded.push(a1, b1);
    }
  } else if (numGroups === 4) {
    if (advancingCount === 2) {
      // 4 tables, Top 2 each (8 teams -> QF)
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
      // 4 tables, Top 1 each (4 teams -> SF)
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
