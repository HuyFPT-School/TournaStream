'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState } from 'react';

interface Package {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  highlighted?: boolean;
}

const packages: Package[] = [
  {
    id: 'free',
    name: 'Dùng thử',
    price: 0,
    description: 'Miễn phí giải đấu đầu tiên',
    features: [
      'Tạo giải đấu đầu tiên miễn phí',
      'Đầy đủ tính năng',
      'Tối đa 8 đội',
    ],
  },
  {
    id: 'basic',
    name: 'Cơ bản',
    price: 49000,
    description: '/ giải đấu',
    features: [
      'Không giới hạn thời gian',
      'Tối đa 16 đội',
      'Quản lý thành viên đội',
      'Chia sẻ link trực tiếp',
    ],
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Cao cấp',
    price: 99000,
    description: '/ giải đấu',
    features: [
      'Không giới hạn thời gian',
      'Tối đa 32 đội',
      'Tất cả tính năng cơ bản',
      'Hỗ trợ ưu tiên',
      'Hỗ trợ ưu tiên',
    ],
  },
];

export default function PackageSelectionPage() {
  const router = useRouter();
  const { setPackage } = useTournament();
  const [selectedPackage, setSelectedPackage] = useState<string>('basic');

  const handleContinue = () => {
    const pkg = packages.find(p => p.id === selectedPackage);
    if (pkg) {
      setPackage(pkg.id, pkg.name, pkg.price);
      router.push('/tournaments/create/info');
    }
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
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-sm text-white/60">
          <button className="hover:text-white transition-colors">Gói dịch vụ</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Thông tin</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Danh sách đội</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Thành viên</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Sắp xếp & Tạo</span>
        </div>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-black mb-2">Chọn gói dịch vụ</h1>
          <p className="text-white/60">Chọn gói phù hợp cho giải đấu của bạn. Giải đấu đầu tiên miễn phí!</p>
        </div>

        {/* Package Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg.id)}
              className={`relative rounded-2xl border transition-all duration-300 cursor-pointer group overflow-hidden ${
                selectedPackage === pkg.id
                  ? 'border-[#22c55e] bg-[#1a1f2e] shadow-lg shadow-[#22c55e]/20'
                  : 'border-white/[0.06] bg-[#0f1419] hover:border-white/[0.12]'
              } ${pkg.highlighted ? 'md:scale-105 md:shadow-xl md:shadow-[#22c55e]/10' : ''}`}
            >
              {pkg.highlighted && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-[#22c55e] text-[#080b10] text-xs font-bold rounded-bl-xl">
                  Phổ biến
                </div>
              )}

              <div className="p-8">
                {/* Header */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-1">{pkg.name}</h3>
                  <div className="text-3xl font-black mb-1">
                    {pkg.price.toLocaleString('vi-VN')}
                    <span className="text-lg font-normal text-white/60">đ</span>
                  </div>
                  <p className="text-sm text-white/60">{pkg.description}</p>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6 border-t border-white/[0.06] pt-6">
                  {pkg.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 18 18"
                        fill="none"
                        className="mt-0.5 flex-shrink-0 text-[#22c55e]"
                      >
                        <path
                          d="M15 4.5L6.75 13.5L3 9.75"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-sm text-white/80">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Selection Indicator */}
                <div className={`w-full h-1 rounded-full transition-all duration-300 ${
                  selectedPackage === pkg.id ? 'bg-[#22c55e]' : 'bg-white/[0.06]'
                }`} />
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <div className="bg-[#0f1419] border border-white/[0.06] rounded-lg p-4 mb-8 text-sm text-white/60">
          📌 Miễn phí cho giải đấu đầu tiên! Tối đa 8 đội, đầy đủ tính năng.
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4">
          <Link
            href="/tournaments"
            className="flex-1 px-6 py-3 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200 text-center"
          >
            Quay lại
          </Link>
          <button
            onClick={handleContinue}
            className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
          >
            Tiếp tục
          </button>
        </div>
      </section>
    </main>
  );
}
