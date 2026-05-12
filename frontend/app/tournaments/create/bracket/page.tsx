'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState, useEffect } from 'react';

export default function BracketPage() {
  const router = useRouter();
  const { data } = useTournament();
  const [orderedTeams, setOrderedTeams] = useState(data.teams);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    setOrderedTeams(data.teams);
  }, [data.teams]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;

    const newTeams = [...orderedTeams];
    const draggedTeam = newTeams[draggedIndex];
    newTeams.splice(draggedIndex, 1);
    newTeams.splice(index, 0, draggedTeam);

    setOrderedTeams(newTeams);
    setDraggedIndex(null);
  };

  const handleShuffle = () => {
    const shuffled = [...orderedTeams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrderedTeams(shuffled);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newTeams = [...orderedTeams];
    [newTeams[index], newTeams[index - 1]] = [newTeams[index - 1], newTeams[index]];
    setOrderedTeams(newTeams);
  };

  const handleMoveDown = (index: number) => {
    if (index === orderedTeams.length - 1) return;
    const newTeams = [...orderedTeams];
    [newTeams[index], newTeams[index + 1]] = [newTeams[index + 1], newTeams[index]];
    setOrderedTeams(newTeams);
  };

  const handleCreate = () => {
    // TODO: Create tournament with orderedTeams
    router.push('/tournaments/create/finalize');
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
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-sm text-white/60 overflow-x-auto pb-2">
          <button className="text-white/40 hover:text-white transition-colors whitespace-nowrap">Gói dịch vụ</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <button className="text-white/40 hover:text-white transition-colors whitespace-nowrap">Thông tin</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <button className="text-white/40 hover:text-white transition-colors whitespace-nowrap">Danh sách đội</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <button className="text-white/40 hover:text-white transition-colors whitespace-nowrap">Thành viên</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <button className="text-[#22c55e] whitespace-nowrap">Sắp xếp & Tạo</button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black mb-1">Sắp xếp đội hình thi đấu</h1>
            <p className="text-white/60">Kéo thả hoặc dùng nút mũi tên để sắp xếp. Bấm xáo trộn để trộn ngẫu nhiên.</p>
          </div>
          <button
            onClick={handleShuffle}
            className="px-4 py-2.5 rounded-lg bg-[#0f1419] border border-white/[0.06] text-white font-semibold hover:border-white/[0.12] transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 6L4 4M4 4L2 2M4 4H10C12.2091 4 14 5.79086 14 8C14 10.2091 12.2091 12 10 12H4M14 10L12 12M12 12L14 14M12 12H6C3.79086 12 2 10.2091 2 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Xáo trộn
          </button>
        </div>

        {/* Teams List */}
        <div className="space-y-2 mb-8">
          {orderedTeams.map((team, index) => (
            <div
              key={team.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all duration-200 cursor-move ${
                draggedIndex === index
                  ? 'opacity-50 border-[#22c55e] bg-[#1a1f2e]'
                  : 'border-white/[0.06] bg-[#0f1419] hover:border-white/[0.12]'
              }`}
            >
              {/* Drag Handle */}
              <div className="flex-shrink-0 text-white/40">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="5" cy="5" r="2" />
                  <circle cx="5" cy="10" r="2" />
                  <circle cx="5" cy="15" r="2" />
                  <circle cx="15" cy="5" r="2" />
                  <circle cx="15" cy="10" r="2" />
                  <circle cx="15" cy="15" r="2" />
                </svg>
              </div>

              {/* Team Info */}
              <div className="flex-1">
                <div className="text-sm font-semibold text-white/40">#{index + 1}</div>
                <div className="font-semibold">{team.name}</div>
                <div className="text-sm text-white/50">{team.members.length} thành viên</div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 2V14M3 7L8 2L13 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === orderedTeams.length - 1}
                  className="p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 14V2M3 9L8 14L13 9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bracket Info */}
        <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06] mb-8">
          <div className="flex gap-3 items-start">
            <div className="text-lg flex-shrink-0">🎯</div>
            <div className="flex-1">
              <div className="font-semibold mb-1">MỞ PHÒNG BẢNG ĐẤU — ⚽ BÓNG ĐÁ</div>
              <div className="text-sm text-white/60">
                Trận 1: {orderedTeams[0]?.name} vs {orderedTeams[1]?.name}
              </div>
              <div className="text-xs text-white/50 mt-1">2 đội, 1 vòng — 45 phút/hiệp - Có hiệp phụ</div>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4">
          <Link
            href="/tournaments/create/members"
            className="flex-1 px-6 py-3 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200 text-center"
          >
            Quay lại
          </Link>
          <button
            onClick={handleCreate}
            className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
          >
            Tạo giải đấu & Sinh bracket
          </button>
        </div>
      </section>
    </main>
  );
}
