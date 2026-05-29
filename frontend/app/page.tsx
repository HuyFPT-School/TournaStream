'use client';

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchLiveTournamentsFromBackend } from "@/app/lib/tournaments";

/* ── Live ticker data ── */
const DEMO_TICKER_ITEMS = [
  "🔴 LIVE · Dragon FC 3 - 1 Phoenix United",
  "⚽ FT · Storm City 0 - 2 Iron Eagles",
  "🔴 LIVE · Blaze SC 1 - 1 Thunder Boys",
  "🏆 QF · Night Wolves 2 - 0 Solar Kings",
  "🔴 LIVE · Red Sharks 4 - 2 Blue Tide",
  "⚽ FT · Golden Lions 1 - 3 Dark Matter FC",
];

/* ── Bracket data ── */
const DEMO_BRACKET = {
  qf: [
    { a: "Dragon FC",    b: "Storm City",   sa: 3,    sb: 1,    done: true  },
    { a: "Iron Eagles",  b: "Blaze SC",     sa: 2,    sb: 0,    done: true  },
    { a: "Night Wolves", b: "Red Sharks",   sa: 1,    sb: 1,    done: false },
    { a: "Golden Lions", b: "Dark Matter",  sa: 0,    sb: 2,    done: false },
  ],
  sf: [
    { a: "Dragon FC",   b: "Iron Eagles",  sa: null, sb: null, done: false },
    { a: "?",           b: "Dark Matter",  sa: null, sb: null, done: false },
  ],
  f: [
    { a: "?",           b: "?",            sa: null, sb: null, done: false },
  ],
};

type LiveTournament = {
  id: string;
  name: string;
  teams?: { id?: string; name?: string }[];
  orderedTeams?: { id?: string; name?: string }[];
  bracket?: {
    rounds?: Array<
      Array<{
        teamA?: { id?: string; name?: string };
        teamB?: { id?: string; name?: string };
        scoreA?: number | null;
        scoreB?: number | null;
        isFinished?: boolean;
      }>
    >;
    currentRound?: number;
    currentMatch?: number;
    isFinished?: boolean;
  };
  matchState?: {
    team1Score?: number;
    team2Score?: number;
    isRunning?: boolean;
    isFinished?: boolean;
  };
};

type BracketPreviewMatch = {
  a: string;
  b: string;
  sa: number | null;
  sb: number | null;
  done: boolean;
};

const PLACEHOLDER_MATCH: BracketPreviewMatch = { a: "?", b: "?", sa: null, sb: null, done: true };

function resolveTournamentTeams(tournament: LiveTournament) {
  if (tournament.orderedTeams && tournament.orderedTeams.length > 0) {
    return tournament.orderedTeams;
  }
  return tournament.teams || [];
}

function resolveTeamName(
  tournament: LiveTournament,
  team?: { id?: string; name?: string } | string | null,
  fallback?: { id?: string; name?: string } | string | null
): string {
  if (!team && !fallback) return "?";
  const ref = team || fallback;
  if (!ref) return "?";

  if (typeof ref === "string") {
    return ref || "?";
  }

  // Try to look up by id first (full name stored in teams array)
  if (ref.id) {
    const found =
      tournament.teams?.find((t) => t.id === ref.id) ||
      tournament.orderedTeams?.find((t) => t.id === ref.id);
    if (found?.name) return found.name;
  }
  // Fall back to name stored on the ref itself
  if (ref.name) return ref.name;
  return "?";
}

function buildQuarterMatches(tournament: LiveTournament) {
  const bracketRound = tournament.bracket?.rounds?.[0];
  if (bracketRound && bracketRound.length > 0) {
    const teams = resolveTournamentTeams(tournament);
    const mapped = bracketRound.map((match, idx) => {
      const fallbackA = teams[idx * 2];
      const fallbackB = teams[idx * 2 + 1];
      const isCurrent = tournament.bracket?.currentRound === 0
        && tournament.bracket?.currentMatch === idx
        && tournament.matchState?.isRunning;
      const sa = isCurrent
        ? tournament.matchState?.team1Score ?? null
        : (Number.isFinite(match.scoreA) ? match.scoreA : null);
      const sb = isCurrent
        ? tournament.matchState?.team2Score ?? null
        : (Number.isFinite(match.scoreB) ? match.scoreB : null);
      const done = !!match.isFinished || !isCurrent;

      return {
        a: resolveTeamName(tournament, match.teamA, fallbackA),
        b: resolveTeamName(tournament, match.teamB, fallbackB),
        sa,
        sb,
        done,
      };
    });

    while (mapped.length < 4) mapped.push({ ...PLACEHOLDER_MATCH });
    return mapped.slice(0, 4);
  }

  const teams = resolveTournamentTeams(tournament);
  const isLive = !!tournament.matchState?.isRunning && !tournament.matchState?.isFinished;
  const liveSa = Number.isFinite(tournament.matchState?.team1Score)
    ? (tournament.matchState?.team1Score ?? null)
    : null;
  const liveSb = Number.isFinite(tournament.matchState?.team2Score)
    ? (tournament.matchState?.team2Score ?? null)
    : null;

  const matches = [] as Array<typeof PLACEHOLDER_MATCH>;
  for (let i = 0; i < 8; i += 2) {
    const teamA = teams[i]?.name || "?";
    const teamB = teams[i + 1]?.name || "?";
    const isLiveMatch = isLive && i === 0;
    matches.push({
      a: teamA,
      b: teamB,
      sa: isLiveMatch ? liveSa : null,
      sb: isLiveMatch ? liveSb : null,
      done: !isLiveMatch,
    });
  }

  if (matches.every((m) => m.a === "?" && m.b === "?")) {
    return [PLACEHOLDER_MATCH, PLACEHOLDER_MATCH, PLACEHOLDER_MATCH, PLACEHOLDER_MATCH];
  }

  return matches;
}

function buildRoundMatches(
  tournament: LiveTournament,
  roundIndex: number,
  size: number
) {
  const round = tournament.bracket?.rounds?.[roundIndex] || [];
  const prevRound = tournament.bracket?.rounds?.[roundIndex - 1] || [];
  const prevWinners = prevRound.map((match) => {
    let winner: { id?: string; name?: string } | string | null | undefined;
    if (match.teamA && !match.teamB) winner = match.teamA;
    else if (match.teamB && !match.teamA) winner = match.teamB;
    else if (!Number.isFinite(match.scoreA) || !Number.isFinite(match.scoreB)) {
      winner = match.teamA || match.teamB;
    } else {
      const scoreA = match.scoreA as number;
      const scoreB = match.scoreB as number;
      if (scoreA > scoreB) winner = match.teamA;
      else if (scoreB > scoreA) winner = match.teamB;
      else winner = match.teamA || match.teamB;
    }
    // Return a resolved ref so fallback names are always available
    if (!winner) return undefined;
    if (typeof winner === "string") return winner;
    const teams = resolveTournamentTeams(tournament);
    const found =
      (winner.id && (tournament.teams?.find((t) => t.id === winner.id) || tournament.orderedTeams?.find((t) => t.id === winner.id))) ||
      (winner.name && teams.find((t) => t.name === winner.name));
    return found || winner;
  });
  const mapped = round.map((match, idx) => {
    const isCurrent = tournament.bracket?.currentRound === roundIndex
      && tournament.bracket?.currentMatch === idx
      && tournament.matchState?.isRunning;
    const sa = isCurrent
      ? tournament.matchState?.team1Score ?? null
      : (Number.isFinite(match.scoreA) ? match.scoreA : null);
    const sb = isCurrent
      ? tournament.matchState?.team2Score ?? null
      : (Number.isFinite(match.scoreB) ? match.scoreB : null);
    const done = !!match.isFinished || !isCurrent;

    const fallbackA = prevWinners[idx * 2];
    const fallbackB = prevWinners[idx * 2 + 1];

    return {
      a: resolveTeamName(tournament, match.teamA, fallbackA),
      b: resolveTeamName(tournament, match.teamB, fallbackB),
      sa,
      sb,
      done,
    };
  });

  while (mapped.length < size) mapped.push({ ...PLACEHOLDER_MATCH });
  return mapped.slice(0, size);
}

function getTickerItem(tournament: LiveTournament) {
  const teamA = tournament.teams?.[0]?.name;
  const teamB = tournament.teams?.[1]?.name;
  const sa = Number.isFinite(tournament.matchState?.team1Score) ? tournament.matchState?.team1Score : 0;
  const sb = Number.isFinite(tournament.matchState?.team2Score) ? tournament.matchState?.team2Score : 0;

  if (teamA && teamB) {
    return `🔴 LIVE · ${teamA} ${sa} - ${sb} ${teamB}`;
  }

  return `🔴 LIVE · ${tournament.name}`;
}

/* ── Stats ── */
const STATS = [
  { label: "Giải đấu đã tạo",  value: 12400,   suffix: "+",  decimals: 0 },
  { label: "Trận đấu diễn ra", value: 2300000, suffix: "+",  decimals: 0, short: "2.3M+" },
  { label: "Quốc gia sử dụng", value: 48,      suffix: "",   decimals: 0 },
  { label: "Uptime đảm bảo",   value: 99.9,    suffix: "%",  decimals: 1 },
];

/* ── useCountUp hook ── */
function useCountUp(target: number, duration = 1800, decimals = 0) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setVal(parseFloat((ease * target).toFixed(decimals)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration, decimals]);

  return { val, ref };
}

/* ── StatCard ── */
function StatCard({
  label, value, suffix, short, decimals = 0,
}: {
  label: string; value: number; suffix: string; short?: string; decimals?: number;
}) {
  const { val, ref } = useCountUp(value, 1800, decimals);
  const display = short
    ? short
    : decimals
    ? val.toFixed(decimals) + suffix
    : Math.round(val).toLocaleString("vi-VN") + suffix;

  return (
    <div ref={ref} className="flex flex-col items-center gap-1 px-6 py-5 rounded-2xl border border-white/[0.07] bg-white/[0.03] min-w-[140px]">
      <span className="text-3xl font-black tracking-tight text-[#22c55e] tabular-nums">{display}</span>
      <span className="text-xs text-white/40 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

/* ── BracketMatch ── */
function BracketMatch({
  a, b, sa, sb, done, delay = 0,
}: {
  a: string; b: string; sa: number | null; sb: number | null; done: boolean; delay?: number;
}) {
  const winA = sa !== null && sb !== null && sa > sb;
  const winB = sa !== null && sb !== null && sb > sa;
  return (
    <div
      className="bracket-match rounded-xl border border-white/[0.1] bg-white/[0.04] overflow-hidden text-[11px] w-[148px] shadow-lg"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`flex items-center justify-between px-3 py-2 border-b border-white/[0.06] ${winA ? "bg-[#22c55e]/10" : ""}`}>
        <span className={`font-semibold truncate max-w-[90px] ${winA ? "text-[#22c55e]" : "text-white/80"}`}>{a}</span>
        {sa !== null && <span className={`font-black ml-2 ${winA ? "text-[#22c55e]" : "text-white/50"}`}>{sa}</span>}
      </div>
      <div className={`flex items-center justify-between px-3 py-2 ${winB ? "bg-[#22c55e]/10" : ""}`}>
        <span className={`font-semibold truncate max-w-[90px] ${winB ? "text-[#22c55e]" : "text-white/80"}`}>{b}</span>
        {sb !== null && <span className={`font-black ml-2 ${winB ? "text-[#22c55e]" : "text-white/50"}`}>{sb}</span>}
      </div>
      {!done && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border-t border-white/[0.06]">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-red-400 text-[10px] font-bold tracking-wide">LIVE</span>
        </div>
      )}
    </div>
  );
}

/* ── useBracketVisible: trigger once when bracket scrolls into view ── */
function useBracketVisible() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { visible, ref };
}

/* ── Features ── */
const FEATURES = [
  { emoji: "🏆", title: "Sinh bracket tự động",  desc: "Nhập đội, hệ thống tự tạo bảng đấu loại trực tiếp theo chuẩn quốc tế." },
  { emoji: "📺", title: "Trình chiếu trên TV",    desc: "Link public read-only với font lớn, tối ưu cho màn hình chiếu hội trường." },
  { emoji: "⚡", title: "Đồng bộ realtime",       desc: "Admin cập nhật → tất cả màn hình thay đổi ngay tức thì, không cần reload." },
];

/* ── Pricing tiers ── */
const PRICING_TIERS = [
  {
    name: "Dùng thử", price: "Miễn phí", subtitle: "giải đấu đầu tiên", badge: null,
    features: ["Tạo giải đấu đầu tiên miễn phí", "Đầy đủ tính năng", "Tối đa 8 đội"],
  },
  {
    name: "Cơ bản", price: "49.000đ", subtitle: "/ giải đấu", badge: "Phổ biến",
    features: ["Không giới hạn thời gian", "Tối đa 16 đội", "Quản lý thành viên đội", "Chia sẻ link trực tiếp"],
  },
  {
    name: "Cao cấp", price: "99.000đ", subtitle: "/ giải đấu", badge: null,
    features: ["Không giới hạn thời gian", "Tối đa 32 đội", "Tất cả tính năng cơ bản", "Hiệp phụ & bù giải nâng cao", "Hỗ trợ ưu tiên"],
  },
];

/* ── Main Page ── */
export default function HomePage() {
  const year = new Date().getFullYear();
  const [tickerPaused, setTickerPaused] = useState(false);
  const { visible: bracketVisible, ref: bracketRef } = useBracketVisible();
  const [liveTournaments, setLiveTournaments] = useState<LiveTournament[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [selectedLiveId, setSelectedLiveId] = useState<string>("");

  useEffect(() => {
    let active = true;

    const loadLive = async () => {
      try {
        const data = await fetchLiveTournamentsFromBackend(8);
        if (!active) return;
        setLiveTournaments(Array.isArray(data) ? data : []);
        setLiveError(null);
      } catch (err) {
        console.error("Error fetching live tournaments:", err);
        if (!active) return;
        setLiveError("Không thể tải giải đấu trực tiếp");
      }
    };

    loadLive();
    return () => {
      active = false;
    };
  }, []);

  const liveMatches = useMemo(
    () => liveTournaments.filter((t) => t.matchState?.isRunning && !t.matchState?.isFinished),
    [liveTournaments]
  );

  useEffect(() => {
    if (liveMatches.length === 0) {
      setSelectedLiveId("");
      return;
    }

    const current = liveMatches.find((t) => t.id === selectedLiveId);
    if (!current) {
      setSelectedLiveId(liveMatches[0].id);
    }
  }, [liveMatches, selectedLiveId]);

  const tickerItems = useMemo(
    () => (liveMatches.length > 0 ? liveMatches.map(getTickerItem) : DEMO_TICKER_ITEMS),
    [liveMatches]
  );

  const bracketData = useMemo(() => {
    if (liveMatches.length === 0) return DEMO_BRACKET;

    const selected = liveMatches.find((t) => t.id === selectedLiveId) || liveMatches[0];
    const qf = buildQuarterMatches(selected);
    const sf = selected.bracket?.rounds?.[1]
      ? buildRoundMatches(selected, 1, 2)
      : [PLACEHOLDER_MATCH, PLACEHOLDER_MATCH];
    const f = selected.bracket?.rounds?.[2]
      ? buildRoundMatches(selected, 2, 1)
      : [PLACEHOLDER_MATCH];

    return { qf, sf, f };
  }, [liveMatches, selectedLiveId]);

  return (
    <main className="min-h-screen bg-[#080b10] text-white font-sans overflow-x-hidden">

      {/* Noise overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Stadium spotlight beams */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="spotlight spotlight-left" />
        <div className="spotlight spotlight-right" />
        <div className="spotlight spotlight-center" />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-4 border-b border-white/[0.06] backdrop-blur-md bg-[#080b10]/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#22c55e] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L10 6.5H15.5L11 9.5L13 15L8 11.5L3 15L5 9.5L0.5 6.5H6L8 1Z" fill="#080b10" />
            </svg>
          </div>
          <span className="text-[15px] font-bold tracking-tight">Tournament Flow</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/features" className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5">Tính năng</Link>
          <Link href="/pricing" className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5">Bảng giá</Link>
          <Link href="/login" className="px-5 py-2 rounded-lg bg-white text-[#080b10] text-sm font-bold hover:bg-[#22c55e] transition-all duration-200">
            Đăng nhập
          </Link>
        </div>
      </nav>

      {/* ── Live Ticker ── */}
      <div
        className="relative z-20 border-b border-white/[0.06] bg-[#0d1117]/80 backdrop-blur-sm overflow-hidden"
        onMouseEnter={() => setTickerPaused(true)}
        onMouseLeave={() => setTickerPaused(false)}
      >
        <div className="flex items-center">
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-red-500 z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[11px] font-black tracking-widest text-white uppercase">Live</span>
          </div>
          <div className="overflow-hidden flex-1">
            <div
              className="ticker-track flex gap-16 whitespace-nowrap py-2.5"
              style={{ animationPlayState: tickerPaused ? "paused" : "running" }}
            >
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <span key={i} className="text-[12px] text-white/60 font-medium shrink-0">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="relative z-10 px-0">
        <div
          className="w-screen rounded-none overflow-hidden mb-16 border-0 shadow-2xl relative flex flex-col items-center justify-center"
          style={{
            height: "700px",
            backgroundImage: `url('/background.png')`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            marginLeft: "calc(-50vw + 50%)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#080b10]/80 to-[#080b10]/100" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#22c55e] blur-3xl opacity-15 pointer-events-none" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-red-500 blur-3xl opacity-15 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center w-full">
            <div className="mb-6 hero-fade-in" style={{ animationDelay: "0ms" }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e] text-[11px] font-bold tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                Realtime Sync · Season 2026
              </div>
            </div>
            <h1 className="hero-fade-in text-[clamp(2.8rem,6.5vw,5rem)] font-black leading-[1.05] tracking-[-3px] mb-4 max-w-4xl" style={{ animationDelay: "80ms" }}>
              Quản lý bảng đấu
              <br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #22c55e 0%, #4ade80 60%, #86efac 100%)" }}>
                Realtime
              </span>
            </h1>
            <p className="hero-fade-in text-white/60 text-[1rem] leading-relaxed max-w-md mb-8 px-4" style={{ animationDelay: "160ms" }}>
              Tạo giải đấu, cập nhật kết quả một lần — mọi màn hình đồng bộ ngay lập tức. Không cần Excel, không cần reload.
            </p>
            <div className="hero-fade-in flex items-center gap-3" style={{ animationDelay: "240ms" }}>
              <Link
                href="/tournaments/new"
                className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#22c55e] text-[#080b10] text-[15px] font-black hover:bg-[#16a34a] transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_50px_rgba(34,197,94,0.3)]"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="group-hover:scale-110 transition-transform">
                  <path d="M7.5 0.5L9.5 6H14.5L10.5 9L12 14.5L7.5 11.5L3 14.5L4.5 9L0.5 6H5.5L7.5 0.5Z" fill="currentColor" />
                </svg>
                Tạo giải đấu ngay
              </Link>
              <Link
                href="#bracket"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/[0.12] text-white/70 text-[15px] font-semibold hover:border-white/25 hover:text-white transition-all duration-200"
              >
                Xem demo bracket
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Bracket Preview ── */}
      <section className="relative z-10 px-6 pb-16">
        <div id="bracket" ref={bracketRef} className="w-full max-w-5xl mx-auto">
          <div
            className="flex flex-wrap items-center justify-between gap-3 mb-2 transition-all duration-500"
            style={{
              opacity: bracketVisible ? 1 : 0,
              transform: bracketVisible ? "translateY(0)" : "translateY(8px)",
            }}
          >
            <p className="text-[11px] font-bold tracking-widest text-white/25 uppercase">
              🏆 {liveMatches.length > 0 ? `Đang diễn ra · ${liveMatches.length} giải` : "Demo bracket"}
            </p>
            {liveMatches.length > 0 && (
              <label className="flex items-center gap-2 text-[11px] text-white/50">
                Chọn giải
                <select
                  value={selectedLiveId}
                  onChange={(event) => setSelectedLiveId(event.target.value)}
                  className="rounded-lg bg-[#0f1419] border border-white/[0.08] px-2 py-1 text-white/80 text-[11px]"
                >
                  {liveMatches.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {liveError && liveMatches.length === 0 && (
            <p className="text-[11px] text-red-300/70 mb-4">{liveError}</p>
          )}

          <div className="bracket-container flex items-center justify-center gap-8 overflow-x-auto pb-4">

            {/* ── Quarter-finals — fly in from LEFT ── */}
            <div
              className="flex flex-col gap-3 shrink-0"
              style={{
                transition: "transform 0.7s cubic-bezier(0.22,1,0.36,1), opacity 0.7s ease",
                transform: bracketVisible ? "translateX(0)" : "translateX(-140px)",
                opacity: bracketVisible ? 1 : 0,
                transitionDelay: "0ms",
              }}
            >
              <p className="text-[10px] font-black tracking-widest text-white/20 uppercase text-center mb-1">Tứ kết</p>
              {bracketData.qf.map((m, i) => (
                <div key={i} className="flex items-center">
                  <BracketMatch {...m} delay={bracketVisible ? 300 + i * 80 : 99999} />
                  <div
                    className="connector-h"
                    style={{
                      transition: "opacity 0.4s ease",
                      opacity: bracketVisible ? 1 : 0,
                      transitionDelay: bracketVisible ? "700ms" : "0ms",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* QF → SF vertical connectors */}
            <div
              className="flex flex-col justify-center shrink-0"
              style={{
                transition: "opacity 0.4s ease",
                opacity: bracketVisible ? 1 : 0,
                transitionDelay: bracketVisible ? "750ms" : "0ms",
                height: "100%",
              }}
            >
              <div className="connector-v-top" />
              <div className="connector-v-bot" />
            </div>

            {/* ── Semi-finals — fly in from RIGHT ── */}
            <div
              className="flex flex-col gap-[52px] shrink-0 items-center justify-center h-full"
              style={{
                transition: "transform 0.7s cubic-bezier(0.22,1,0.36,1), opacity 0.7s ease",
                transform: bracketVisible ? "translateX(0)" : "translateX(140px)",
                opacity: bracketVisible ? 1 : 0,
                transitionDelay: "80ms",
              }}
            >
              <p className="text-[10px] font-black tracking-widest text-white/20 uppercase text-center mb-1">Bán kết</p>
              {bracketData.sf.map((m, i) => (
                <div key={i} className="flex items-center">
                  <BracketMatch {...m} delay={bracketVisible ? 380 + i * 100 : 99999} />
                  <div
                    className="connector-h"
                    style={{
                      transition: "opacity 0.4s ease",
                      opacity: bracketVisible ? 1 : 0,
                      transitionDelay: bracketVisible ? "800ms" : "0ms",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* SF → Final connector */}
            <div
              className="flex flex-col justify-center shrink-0"
              style={{
                transition: "opacity 0.4s ease",
                opacity: bracketVisible ? 1 : 0,
                transitionDelay: bracketVisible ? "850ms" : "0ms",
                height: "100%",
              }}
            >
              <div className="connector-v-final" />
            </div>

            {/* ── Final — zoom in from center ── */}
            <div
              className="flex flex-col items-center shrink-0"
              style={{
                transition: "transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.55s ease",
                transform: bracketVisible ? "scale(1) translateY(0)" : "scale(0.7) translateY(16px)",
                opacity: bracketVisible ? 1 : 0,
                transitionDelay: bracketVisible ? "900ms" : "0ms",
              }}
            >
              <p className="text-[10px] font-black tracking-widest text-[#22c55e]/60 uppercase text-center mb-2">⚡ Chung kết</p>
              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl bg-[#22c55e]/10 blur-md" />
                <BracketMatch {...bracketData.f[0]} delay={bracketVisible ? 950 : 99999} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats counter ── */}
      <section className="relative z-10 py-14 border-y border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-3xl mx-auto px-6 flex flex-wrap items-center justify-center gap-4">
          {STATS.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 hover:border-[#22c55e]/30 hover:bg-[#22c55e]/[0.04] transition-all duration-300 hover:-translate-y-1"
          >
            <div className="mb-4 w-10 h-10 flex items-center justify-center rounded-xl bg-[#22c55e]/15 text-xl">{f.emoji}</div>
            <h3 className="text-[15px] font-bold mb-2 text-white/90">{f.title}</h3>
            <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* ── Pricing ── */}
      <section className="relative z-10 py-20 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-3 tracking-tight">Chọn gói dịch vụ</h2>
            <p className="text-white/50 text-base leading-relaxed">Chọn gói phù hợp cho giải đấu của bạn. Giải đấu đầu tiên miễn phí!</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-3xl border p-8 transition-all duration-300 group ${
                  tier.badge
                    ? "border-[#22c55e]/50 bg-[#22c55e]/[0.08] ring-2 ring-[#22c55e]/20 md:scale-[1.05]"
                    : "border-white/[0.1] bg-white/[0.04] hover:border-white/20"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 right-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22c55e] text-[#080b10] text-xs font-black tracking-wide">
                    {tier.badge}
                  </div>
                )}
                <h3 className="text-2xl font-black mb-1 text-white/90">{tier.name}</h3>
                <div className="mb-6">
                  <div className="text-4xl font-black text-white mb-1 tracking-tight">{tier.price}</div>
                  <div className="text-xs text-white/40">{tier.subtitle}</div>
                </div>
                <button
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm mb-6 transition-all duration-200 ${
                    tier.badge
                      ? "bg-[#22c55e] text-[#080b10] hover:bg-[#16a34a]"
                      : "bg-white/10 text-white hover:bg-white/20 border border-white/[0.1]"
                  }`}
                >
                  Lựa chọn
                </button>
                <div className="space-y-3">
                  {tier.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
                        <path d="M13 4L6 11L3 8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-sm text-white/60">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] p-6 text-center">
            <p className="text-sm text-white/60">
              <span className="text-lg mr-2">🎉</span>
              <span className="font-bold text-white">Miễn phí cho giải đấu đầu tiên!</span>
              <span className="text-white/40 ml-1">Tối đa 8 đội, đầy đủ tính năng.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 text-center text-white/20 text-xs">
        © {year} Tournament Flow · Built for champions
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&display=swap');
        body { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }

        .spotlight {
          position: absolute; top: 0; height: 65vh; opacity: 0.1;
          filter: blur(60px);
          background: linear-gradient(180deg, #22c55e 0%, transparent 100%);
        }
        .spotlight-left   { left: 15%;  width: 140px; transform: rotate(-18deg); transform-origin: top center; animation: beam 9s ease-in-out infinite; }
        .spotlight-right  { right: 15%; width: 140px; transform: rotate(18deg);  transform-origin: top center; animation: beam 9s ease-in-out infinite 1.5s; }
        .spotlight-center { left: 50%;  width: 220px; transform: translateX(-50%); opacity: 0.06; animation: beam 12s ease-in-out infinite 0.7s; }
        @keyframes beam { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.2; } }

        .ticker-track { animation: ticker 32s linear infinite; }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        .hero-fade-in {
          opacity: 0; transform: translateY(18px);
          animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }

        /* bracket-match pop-in — delay 99999ms = effectively disabled until triggered */
        .bracket-match {
          opacity: 0; transform: scale(0.9) translateY(6px);
          animation: popIn 0.45s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes popIn { to { opacity: 1; transform: scale(1) translateY(0); } }

        .connector-h {
          width: 20px; height: 2px;
          background: linear-gradient(90deg, rgba(34,197,94,0.35), rgba(34,197,94,0.08));
        }
        .connector-v-top {
          width: 20px; height: 86px;
          border-right: 2px solid rgba(34,197,94,0.2);
          border-top: 2px solid rgba(34,197,94,0.2);
          border-top-right-radius: 6px; margin-top: 50px;
        }
        .connector-v-bot {
          width: 20px; height: 86px;
          border-right: 2px solid rgba(34,197,94,0.2);
          border-bottom: 2px solid rgba(34,197,94,0.2);
          border-bottom-right-radius: 6px;
        }
        .connector-v-final {
          width: 20px; height: 60px;
          border-right: 2px solid rgba(34,197,94,0.3);
          margin-top: 28px;
        }
      `}</style>
    </main>
  );
}