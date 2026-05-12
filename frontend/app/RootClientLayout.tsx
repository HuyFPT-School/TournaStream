'use client';

import { TournamentProvider } from './contexts/TournamentContext';
import { ReactNode } from 'react';

export function RootClientLayout({ children }: { children: ReactNode }) {
  return (
    <TournamentProvider>
      {children}
    </TournamentProvider>
  );
}
