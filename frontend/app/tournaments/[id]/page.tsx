'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const [tournament, setTournament] = useState<any>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');

  useEffect(() => {
    // Load tournament from localStorage
    const saved = localStorage.getItem('currentTournament');
    if (saved) {
      const tourn = JSON.parse(saved);
      setTournament(tourn);

      // Generate share link and QR code
      const link = `${window.location.origin}/tournaments/${tournamentId}/live`;
      setShareLink(link);
      setQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`);
    }
  }, [tournamentId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('Đã copy link vào clipboard!');
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
        <div className="mb-12">
          <h1 className="text-4xl font-black mb-2">{tournament.name}</h1>
          <p className="text-white/60">{tournament.sport}</p>
        </div>

        {/* Share Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
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
            <p className="text-sm text-white/60 mb-1">Gói dịch vụ</p>
            <p className="font-semibold">{tournament.packageName}</p>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Số đội</p>
            <p className="font-semibold">{tournament.teams.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Hiệp</p>
            <p className="font-semibold">{tournament.matchDuration} phút</p>
          </div>
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06]">
            <p className="text-sm text-white/60 mb-1">Hiệp phụ</p>
            <p className="font-semibold">{tournament.allowExtraTime ? 'Có' : 'Không'}</p>
          </div>
        </div>

        {/* Teams */}
        <div className="mb-8">
          <h2 className="text-2xl font-black mb-4">Danh sách đội</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournament.teams.map((team: any, idx: number) => (
              <div key={team.id} className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200">
                <div className="font-semibold mb-3">#{idx + 1} {team.name}</div>
                {team.members.length > 0 ? (
                  <div className="space-y-2">
                    {team.members.slice(0, 3).map((member: any) => (
                      <div key={member.id} className="text-sm text-white/60 flex items-center gap-2">
                        {member.image && (
                          <img
                            src={member.image}
                            alt={member.name}
                            className="w-6 h-6 rounded object-cover"
                          />
                        )}
                        <span>{member.name} ({member.position})</span>
                      </div>
                    ))}
                    {team.members.length > 3 && (
                      <p className="text-sm text-white/50">+{team.members.length - 3} thành viên khác</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-white/50">Chưa có thành viên</p>
                )}
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
          <Link
            href={`/tournaments/${tournamentId}/match`}
            className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200 text-center"
          >
            Xem trực tiếp
          </Link>
        </div>
      </section>
    </main>
  );
}
