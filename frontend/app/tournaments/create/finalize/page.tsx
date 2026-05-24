'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState, useEffect } from 'react';
import { syncTournamentToBackend } from '@/app/lib/tournaments';

export default function FinalizeCreatePage() {
  const router = useRouter();
  const { data, resetTournament } = useTournament();
  const [tournament, setTournament] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [shareLink, setShareLink] = useState<string>('');

  useEffect(() => {
    if (tournament) return; // Prevent regenerating ID and details if already set

    // Generate a mock tournament ID
    const tournamentId = 'tourn_' + Date.now();
    const mockTournament = {
      id: tournamentId,
      ...data,
      orderedTeams: data.teams, // In real app, would use the ordered teams from bracket page
      createdAt: new Date().toISOString(),
    };

    setTournament(mockTournament);

    // Generate mock QR code and share link
    const link = `${window.location.origin}/tournaments/${tournamentId}/live`;
    setShareLink(link);

    // In a real app, you would generate an actual QR code here
    // For now, we'll use a placeholder
    setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`);
  }, [data, tournament]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Đã copy link vào clipboard!');
  };

  const handleStartTournament = async () => {
    if (tournament) {
      try {
        // Sync to backend first so spectator page can load it instantly
        await syncTournamentToBackend(tournament);
      } catch (err) {
        console.error('Error syncing tournament to backend:', err);
      }

      // Save tournament to localStorage list
      const savedList = localStorage.getItem('tournaments');
      const list = savedList ? JSON.parse(savedList) : [];
      const index = list.findIndex((t: any) => t.id === tournament.id);
      if (index > -1) {
        list[index] = tournament;
      } else {
        list.push(tournament);
      }
      localStorage.setItem('tournaments', JSON.stringify(list));

      // Also keep currentTournament for ongoing match compatibility
      localStorage.setItem('currentTournament', JSON.stringify(tournament));
      
      // Remove draft as it is now finalized
      localStorage.removeItem('tournamentDraft');
      resetTournament();
      router.push(`/tournaments/${tournament.id}/match`);
    }
  };

  if (!tournament) {
    return (
      <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center">
        <p>Đang tải...</p>
      </main>
    );
  }

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
          <Link
            href="/tournaments"
            className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5"
          >
            Quay lại
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black mb-2">Giải đấu đã sẵn sàng! 🎉</h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Giải đấu "{tournament.name}" của bạn đã được tạo thành công. Chia sẻ mã QR hoặc link dưới đây để người khác có thể xem trực tiếp.
          </p>
        </div>

        {/* Tournament Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* QR Code */}
          <div className="p-6 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <h3 className="font-semibold mb-4 text-center">Mã QR</h3>
            <div className="flex items-center justify-center p-4 bg-white rounded-lg mb-4">
              <img src={qrCode} alt="QR Code" className="w-full max-w-xs" />
            </div>
            <p className="text-sm text-white/60 text-center">Quét mã để xem trực tiếp</p>
          </div>

          {/* Share Link */}
          <div className="p-6 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <h3 className="font-semibold mb-4">Đường link trực tiếp</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-3 py-2 rounded-lg bg-[#080b10] border border-white/[0.06] text-white text-sm text-white/70 focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
              >
                Copy
              </button>
            </div>
            <p className="text-sm text-white/60">Dán vào trình duyệt để xem trực tiếp</p>
          </div>
        </div>

        {/* Tournament Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Giải đấu</p>
            <p className="font-semibold">{tournament.name}</p>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Môn thể thao</p>
            <p className="font-semibold">{tournament.sport}</p>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Số đội</p>
            <p className="font-semibold">{tournament.teams.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Gói dịch vụ</p>
            <p className="font-semibold">{tournament.packageName}</p>
          </div>
        </div>

        {/* Team List */}
        <div className="mb-8">
          <h3 className="font-semibold mb-4">Danh sách đội ({tournament.teams.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {tournament.teams.map((team: any, idx: number) => (
              <div key={team.id} className="p-3 rounded-lg bg-[#0f1419] border border-white/[0.06]">
                <div className="font-semibold text-sm">{idx + 1}. {team.name}</div>
                <div className="text-xs text-white/50 mt-1">{team.members.length} thành viên</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4">
          <Link
            href="/tournaments"
            className="flex-1 px-6 py-3 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200 text-center"
          >
            Quay lại Giải đấu
          </Link>
          <button
            onClick={handleStartTournament}
            className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
          >
            Bắt đầu Hiệp 1
          </button>
        </div>
      </section>
    </main>
  );
}
