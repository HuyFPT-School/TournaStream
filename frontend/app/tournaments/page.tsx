"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, logoutUser, SessionUser } from "@/app/lib/authStorage";
import { useTournament } from "@/app/contexts/TournamentContext";
import { fetchUserTournamentsFromBackend } from "@/app/lib/tournaments";

interface Tournament {
  id: string;
  name: string;
  teams?: { id: string; name: string }[];
}

export default function MyTournamentsPage() {
  const router = useRouter();
  const { loadTournamentData } = useTournament();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [draftTournament, setDraftTournament] = useState<any | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setSessionUser(session);

    const tournamentsKey = `tournaments_${session.id}`;
    const draftKey = `tournamentDraft_${session.id}`;

    // 1. Fetch user's finalized tournaments from backend
    fetchUserTournamentsFromBackend()
      .then((data) => {
        setTournaments(data);
        localStorage.setItem(tournamentsKey, JSON.stringify(data));
      })
      .catch((err) => {
        console.error("Error fetching tournaments from backend, falling back to local storage:", err);
        // Fallback to local storage if offline
        const saved = localStorage.getItem(tournamentsKey);
        if (saved) {
          try {
            setTournaments(JSON.parse(saved));
          } catch (e) {
            console.error("Error parsing tournaments:", e);
          }
        }
      });

    // 2. Load draft tournament using user-specific key
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        setDraftTournament(JSON.parse(savedDraft));
      } catch (e) {
        console.error("Error parsing tournamentDraft:", e);
      }
    }
  }, [router]);

  const handleLogout = async () => {
    await logoutUser();
    router.push("/login");
  };

  const handleDraftClick = (draft: any) => {
    loadTournamentData(draft);
    // Check if all teams have at least 1 member
    const allTeamsHaveMembers = draft.teams && draft.teams.length > 0 && draft.teams.every((t: any) => t.members && t.members.length > 0);

    // Determine the next creation step based on completeness
    if (!draft.name) {
      router.push('/tournaments/create/info');
    } else if (!draft.teams || draft.teams.length === 0) {
      router.push('/tournaments/create/teams');
    } else if (!allTeamsHaveMembers) {
      router.push('/tournaments/create/members');
    } else if (!draft.bracketSeeded && draft.format !== 'league' && draft.format !== 'battle_royale') {
      router.push('/tournaments/create/bracket');
    } else {
      router.push('/tournaments/create/finalize');
    }
  };

  if (!sessionUser) {
    return (
      <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center">
        <p>Đang chuyển hướng...</p>
      </main>
    );
  }

  const isEmpty = tournaments.length === 0 && !draftTournament;

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
        <Link
          href="/"
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-[#22c55e] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1L10 6.5H15.5L11 9.5L13 15L8 11.5L3 15L5 9.5L0.5 6.5H6L8 1Z"
                fill="#080b10"
              />
            </svg>
          </div>
          <span className="text-[15px] font-bold tracking-tight">
            Tournament Flow
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {sessionUser.role === "admin" && (
            <Link
              href="/admin"
              className="text-sm text-[#22c55e] font-semibold border border-[#22c55e]/30 bg-[#22c55e]/10 rounded-lg px-3 py-1.5 hover:bg-[#22c55e]/20 transition-all mr-2"
            >
              Admin Panel
            </Link>
          )}
          <span className="text-sm text-white/40">
            Xin chào, {sessionUser.fullName}
          </span>
          <Link
            href="/change-password"
            className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5"
          >
            Doi mat khau
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5"
          >
            Đăng xuất
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black mb-1">Giải đấu của bạn</h1>
          </div>
          <Link
            href="/tournaments/create"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#22c55e] text-[#080b10] text-sm font-bold hover:bg-[#16a34a] transition-all duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1V15M1 8H15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Tạo giải đấu
          </Link>
        </div>

        {/* Empty State */}
        {isEmpty ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-20 text-center">
            {/* Trophy Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path
                    d="M24 4L28 14H38L30 18L34 28L24 24L14 28L18 18L10 14H20L24 4Z"
                    stroke="#22c55e"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
              </div>
            </div>

            {/* Empty State Text */}
            <h2 className="text-2xl font-bold mb-3 text-white/90">
              Chưa có giải đấu nào
            </h2>
            <p className="text-white/50 mb-8 max-w-sm mx-auto">
              Bắt đầu tạo giải đấu đầu tiên của bạn ngay để quản lý và theo dõi
              các bảng đấu realtime.
            </p>

            {/* CTA Button */}
            <Link
              href="/tournaments/create"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#22c55e] text-[#080b10] text-[15px] font-black hover:bg-[#16a34a] transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_50px_rgba(34,197,94,0.3)]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1V15M1 8H15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Tạo giải đấu đầu tiên
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Draft Card */}
            {draftTournament && (
              <div
                onClick={() => handleDraftClick(draftTournament)}
                className="cursor-pointer group rounded-2xl border border-[#eab308]/20 bg-[#eab308]/[0.02] p-6 hover:border-[#eab308]/50 hover:bg-[#eab308]/[0.05] transition-all duration-300 hover:-translate-y-1"
              >
                <h3 className="text-lg font-bold mb-2 text-white/90 truncate">
                  {draftTournament.name || "Bản nháp giải đấu chưa đặt tên"}
                </h3>
                <p className="text-sm text-white/50 mb-4">
                  Gói: {draftTournament.packageName || "Dùng thử"} • {draftTournament.teams?.length || 0} đội
                </p>
                <div className="flex items-center gap-2 text-xs text-[#eab308] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#eab308] animate-pulse" />
                  Chưa hoàn tất (Bấm để tiếp tục)
                </div>
              </div>
            )}

            {/* Finalized Cards */}
            {tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/tournaments/${tournament.id}`}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 hover:border-[#22c55e]/30 hover:bg-[#22c55e]/[0.04] transition-all duration-300 hover:-translate-y-1"
              >
                <h3 className="text-lg font-bold mb-2 text-white/90 truncate">
                  {tournament.name}
                </h3>
                <p className="text-sm text-white/50 mb-4">
                  Gói: {tournament.packageName || "Cơ bản"} • {tournament.teams?.length || 0} đội
                </p>
                <div className={`flex items-center gap-2 text-xs font-semibold ${
                  tournament.bracket?.isFinished 
                    ? "text-white/40" 
                    : tournament.matchState 
                    ? "text-[#22c55e]" 
                    : "text-blue-400"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    tournament.bracket?.isFinished 
                      ? "bg-white/30" 
                      : tournament.matchState 
                      ? "bg-[#22c55e]" 
                      : "bg-blue-400"
                  }`} />
                  {tournament.bracket?.isFinished 
                    ? "Đã kết thúc" 
                    : tournament.matchState 
                    ? "Đang thi đấu" 
                    : "Sẵn sàng"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
