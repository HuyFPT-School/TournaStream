'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Team {
  id: string;
  name: string;
  members: Member[];
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

  // Teams and members
  teams: Team[];

  // Bracket
  bracketSeeded: boolean;
  shuffled: boolean;
}

interface TournamentContextType {
  data: TournamentData;
  setPackage: (packageId: string, name: string, price: number) => void;
  setTournamentInfo: (name: string, sport: string, matchDuration: number, allowExtraTime: boolean) => void;
  addTeam: (team: Team) => void;
  removeTeam: (teamId: string) => void;
  updateTeam: (teamId: string, team: Team) => void;
  addMember: (teamId: string, member: Member) => void;
  removeMember: (teamId: string, memberId: string) => void;
  updateMember: (teamId: string, memberId: string, member: Member) => void;
  resetTournament: () => void;
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
  teams: [],
  bracketSeeded: false,
  shuffled: false,
};

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TournamentData>(initialData);

  const setPackage = (packageId: string, name: string, price: number) => {
    setData(prev => ({
      ...prev,
      packageId,
      packageName: name,
      packagePrice: price,
    }));
  };

  const setTournamentInfo = (name: string, sport: string, matchDuration: number, allowExtraTime: boolean) => {
    setData(prev => ({
      ...prev,
      name,
      sport,
      matchDuration,
      allowExtraTime,
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
    setData(initialData);
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
