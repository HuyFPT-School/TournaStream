'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSession } from '@/app/lib/authStorage';

export interface Team {
  id: string;
  name: string;
  members: Member[];
  logo?: string;
}

export interface Member {
  id: string;
  name: string;
  position: string;
  image?: string;
}

export interface TournamentData {
  // Package info
  packageId: string;
  packageName: string;
  packagePrice: number;

  // Tournament info
  name: string;
  sport: string;
  matchDuration: number; // in minutes
  allowExtraTime: boolean;

  // Format selection
  format?: 'single_elimination' | 'round_robin' | 'double_elimination' | 'battle_royale' | 'league';
  groupsCount?: number;
  advancingCount?: number;
  matchesCount?: number;
  leagueMatchesCount?: number;
  pointRules?: Record<string, number>;

  // Teams and members
  teams: Team[];

  // Registration config
  isPublicRegistration?: boolean;
  registrationOpen?: boolean;
  maxTeams?: number;

  // Bracket
  bracketSeeded: boolean;
  shuffled: boolean;
  id?: string;
}

interface TournamentContextType {
  data: TournamentData;
  setPackage: (packageId: string, name: string, price: number) => void;
  setTournamentInfo: (
    name: string,
    sport: string,
    matchDuration: number,
    allowExtraTime: boolean,
    format?: 'single_elimination' | 'round_robin' | 'double_elimination' | 'battle_royale' | 'league',
    groupsCount?: number,
    advancingCount?: number,
    matchesCount?: number,
    leagueMatchesCount?: number,
    pointRules?: Record<string, number>
  ) => void;
  addTeam: (team: Team) => void;
  removeTeam: (teamId: string) => void;
  updateTeam: (teamId: string, team: Team) => void;
  addMember: (teamId: string, member: Member) => void;
  removeMember: (teamId: string, memberId: string) => void;
  updateMember: (teamId: string, memberId: string, member: Member) => void;
  resetTournament: () => void;
  loadTournamentData: (data: TournamentData) => void;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

const initialData: TournamentData = {
  packageId: '',
  packageName: '',
  packagePrice: 0,
  name: '',
  sport: '',
  matchDuration: 45,
  allowExtraTime: false,
  format: 'single_elimination',
  groupsCount: 1,
  advancingCount: 2,
  leagueMatchesCount: 5,
  pointRules: {
    "1": 10,
    "2": 6,
    "3": 5,
    "4": 4,
    "5": 3,
    "6": 2,
    "7": 2,
    "8": 1,
    "9": 1,
    "10": 1,
    "11": 1,
    "12": 1
  },
  teams: [],
  bracketSeeded: false,
  shuffled: false,
};

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TournamentData>(initialData);

  const getDraftStorageKey = () => {
    const session = getSession();
    return session ? `tournamentDraft_${session.id}` : 'tournamentDraft';
  };

  // Load draft on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = getDraftStorageKey();
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setData(JSON.parse(saved));
        } catch (e) {
          console.error('Error parsing tournamentDraft:', e);
        }
      }
    }
  }, []);

  // Save draft on data change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (data.packageId) {
        const key = getDraftStorageKey();
        localStorage.setItem(key, JSON.stringify(data));
      }
    }
  }, [data]);

  const setPackage = (packageId: string, name: string, price: number) => {
    setData(prev => ({
      ...prev,
      packageId,
      packageName: name,
      packagePrice: price,
    }));
  };

  const setTournamentInfo = (
    name: string,
    sport: string,
    matchDuration: number,
    allowExtraTime: boolean,
    format?: 'single_elimination' | 'round_robin' | 'double_elimination' | 'battle_royale' | 'league',
    groupsCount?: number,
    advancingCount?: number,
    matchesCount?: number,
    leagueMatchesCount?: number,
    pointRules?: Record<string, number>
  ) => {
    setData(prev => ({
      ...prev,
      name,
      sport,
      matchDuration,
      allowExtraTime,
      format: format || 'single_elimination',
      groupsCount: groupsCount || 1,
      advancingCount: advancingCount || 2,
      matchesCount: matchesCount || 5,
      leagueMatchesCount: leagueMatchesCount || 5,
      pointRules: pointRules || {
        "1": 10,
        "2": 6,
        "3": 5,
        "4": 4,
        "5": 3,
        "6": 2,
        "7": 2,
        "8": 1,
        "9": 1,
        "10": 1,
        "11": 1,
        "12": 1
      },
    }));
  };

  const addTeam = (team: Team) => {
    setData(prev => ({
      ...prev,
      teams: [...prev.teams, team],
    }));
  };

  const removeTeam = (teamId: string) => {
    setData(prev => ({
      ...prev,
      teams: prev.teams.filter(t => t.id !== teamId),
    }));
  };

  const updateTeam = (teamId: string, team: Team) => {
    setData(prev => ({
      ...prev,
      teams: prev.teams.map(t => (t.id === teamId ? team : t)),
    }));
  };

  const addMember = (teamId: string, member: Member) => {
    setData(prev => ({
      ...prev,
      teams: prev.teams.map(t =>
        t.id === teamId ? { ...t, members: [...t.members, member] } : t
      ),
    }));
  };

  const removeMember = (teamId: string, memberId: string) => {
    setData(prev => ({
      ...prev,
      teams: prev.teams.map(t =>
        t.id === teamId
          ? { ...t, members: t.members.filter(m => m.id !== memberId) }
          : t
      ),
    }));
  };

  const updateMember = (teamId: string, memberId: string, member: Member) => {
    setData(prev => ({
      ...prev,
      teams: prev.teams.map(t =>
        t.id === teamId
          ? {
              ...t,
              members: t.members.map(m => (m.id === memberId ? member : m)),
            }
          : t
      ),
    }));
  };

  const resetTournament = () => {
    if (typeof window !== 'undefined') {
      const key = getDraftStorageKey();
      localStorage.removeItem(key);
    }
    setData(initialData);
  };

  const loadTournamentData = (newData: TournamentData) => {
    setData(newData);
    if (typeof window !== 'undefined') {
      const key = getDraftStorageKey();
      localStorage.setItem(key, JSON.stringify(newData));
    }
  };

  const value: TournamentContextType = {
    data,
    setPackage,
    setTournamentInfo,
    addTeam,
    removeTeam,
    updateTeam,
    addMember,
    removeMember,
    updateMember,
    resetTournament,
    loadTournamentData,
  };

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
}
