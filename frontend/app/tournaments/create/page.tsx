'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState, useEffect, useMemo } from 'react';
import { createSePayCheckout, getSePayTransactionStatus } from '@/app/lib/sepay';
import { getSession } from '@/app/lib/authStorage';

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
  const { data, setPackage } = useTournament();
  const [selectedPackage, setSelectedPackage] = useState<string>('basic');
  const [activeCheckout, setActiveCheckout] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/login');
    }
  }, [router]);

  const session = getSession();
  const pendingCheckoutKey = session ? `pendingCheckout_${session.id}` : 'pendingCheckout';

  const bankDetails = useMemo(() => {
    if (!activeCheckout?.qrPayload) return null;
    const parts = activeCheckout.qrPayload.split('|');
    const details: Record<string, string> = {};
    parts.forEach((p: string) => {
      const [key, val] = p.split('=');
      if (key && val) {
        details[key.trim().toUpperCase()] = val.trim();
      }
    });
    return {
      bank: details['BANK'] || 'Ngân hàng',
      account: details['ACCOUNT'] || 'Số tài khoản',
      name: details['NAME'] || 'Tên tài khoản',
    };
  }, [activeCheckout]);

  useEffect(() => {
    // Check if there is a pending checkout in localStorage on mount
    const saved = localStorage.getItem(pendingCheckoutKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveCheckout(parsed);
        const planId = parsed.planKey === 'premium' ? 'pro' : parsed.planKey;
        setSelectedPackage(planId);
      } catch (e) {
        console.error('Error parsing pendingCheckout:', e);
      }
    }
  }, [pendingCheckoutKey]);

  useEffect(() => {
    if (!activeCheckout || paymentSuccess) return;

    const interval = setInterval(async () => {
      try {
        const res = await getSePayTransactionStatus(activeCheckout.checkoutCode);
        if (res.status === 'paid') {
          setPaymentSuccess(true);
          localStorage.removeItem(pendingCheckoutKey);
          clearInterval(interval);
          setTimeout(() => {
            const planId = activeCheckout.planKey === 'premium' ? 'pro' : activeCheckout.planKey;
            const pkg = packages.find(p => p.id === planId);
            if (pkg) {
              setPackage(pkg.id, pkg.name, pkg.price);
              router.push('/tournaments/create/info');
            }
          }, 2000);
        }
      } catch (err) {
        console.error('Error polling transaction status:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeCheckout, paymentSuccess, router, setPackage, pendingCheckoutKey]);

  const handleCancelCheckout = () => {
    if (!paymentSuccess) {
      setActiveCheckout(null);
      localStorage.removeItem(pendingCheckoutKey);
    }
  };

  const handleContinue = async () => {
    const pkg = packages.find(p => p.id === selectedPackage);
    if (!pkg) return;

    if (pkg.price === 0) {
      setPackage(pkg.id, pkg.name, pkg.price);
      router.push('/tournaments/create/info');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const planKey = pkg.id === 'pro' ? 'premium' : pkg.id;
      const checkout = await createSePayCheckout({ planKey });
      setActiveCheckout(checkout);
      localStorage.setItem(pendingCheckoutKey, JSON.stringify(checkout));
      setPaymentSuccess(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Không tạo được thông tin thanh toán'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Đã copy mã chuyển khoản!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
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

          <span>Quản lý đội</span>
          {(!data.sport || (data.sport !== 'battle_royale' && data.format !== 'league')) && (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Sắp xếp & Tạo đội</span>
            </>
          )}

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
              className={`relative rounded-2xl border transition-all duration-300 cursor-pointer group overflow-hidden ${selectedPackage === pkg.id
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
                <div className={`w-full h-1 rounded-full transition-all duration-300 ${selectedPackage === pkg.id ? 'bg-[#22c55e]' : 'bg-white/[0.06]'
                  }`} />
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <div className="bg-[#0f1419] border border-white/[0.06] rounded-lg p-4 mb-8 text-sm text-white/60">
          📌 Miễn phí cho giải đấu đầu tiên! Tối đa 8 đội, đầy đủ tính năng.
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

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
            disabled={isLoading}
            className={`flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200 ${isLoading ? 'opacity-70 cursor-wait' : ''
              }`}
          >
            {isLoading ? 'Đang tạo QR thanh toán...' : 'Tiếp tục'}
          </button>
        </div>
      </section>

      {/* SePay Checkout Modal */}
      {activeCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={handleCancelCheckout}
          />

          {/* Modal Container */}
          <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0c1118] shadow-[0_30px_120px_rgba(0,0,0,0.8)]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#22c55e]">
                  SePay Checkout
                </p>
                <h3 className="mt-1 text-lg font-black text-white">
                  Thanh toán gói {activeCheckout.planName}
                </h3>
              </div>
              {!paymentSuccess && (
                <button
                  onClick={handleCancelCheckout}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all"
                >
                  Đóng
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              {paymentSuccess ? (
                /* SUCCESS STATE */
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-[#22c55e]/15 flex items-center justify-center border border-[#22c55e]/30 animate-pulse">
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h4 className="text-2xl font-black text-white">Thanh toán thành công!</h4>
                  <p className="text-white/60 text-sm max-w-sm">
                    Giao dịch đã được ghi nhận. Đang chuẩn bị chuyển đến màn hình thiết lập thông tin giải đấu...
                  </p>
                  <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 bg-[#22c55e] w-1/2 rounded-full animate-pulse" />
                  </div>
                </div>
              ) : (
                /* PAYMENT QR & INFO STATE */
                <div className="space-y-6">
                  {/* QR Image & Bank details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-white/10">
                      <img
                        src={activeCheckout.qrImageUrl}
                        alt="SePay QR Code"
                        className="w-full max-w-[200px] h-auto rounded-lg"
                      />
                      <span className="mt-2 text-[10px] font-medium text-black/50 tracking-wider uppercase text-center">
                        Quét mã bằng ứng dụng ngân hàng
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">Ngân hàng</span>
                        <span className="text-sm font-bold text-white block mt-0.5">
                          {bankDetails?.bank || 'MB Bank (Ngân hàng Quân Đội)'}
                        </span>
                      </div>
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">Chủ tài khoản</span>
                        <span className="text-sm font-bold text-white block mt-0.5">
                          {bankDetails?.name || 'TOURNAMENT FLOW CO.'}
                        </span>
                      </div>
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">Số tài khoản</span>
                        <span className="text-sm font-bold text-[#22c55e] block mt-0.5">
                          {bankDetails?.account || '0987654321'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment instruction & Content Code */}
                  <div className="border border-white/10 bg-white/[0.03] rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">Nội dung chuyển khoản</span>
                        <span className="text-lg font-mono font-black text-[#22c55e] block mt-0.5 tracking-wide">
                          {activeCheckout.checkoutCode}
                        </span>
                      </div>
                      <button
                        onClick={() => copyText(activeCheckout.checkoutCode)}
                        className="px-4 py-2 text-xs font-bold bg-white/10 rounded-xl hover:bg-white/20 transition-all text-white border border-white/5"
                      >
                        Copy
                      </button>
                    </div>

                    <div className="h-px bg-white/10" />

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">Số tiền cần thanh toán</span>
                        <span className="text-xl font-black text-white block mt-0.5">
                          {activeCheckout.amount.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Loading / Status Polling message */}
                  <div className="flex items-center justify-center gap-3 py-2 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
                    <span className="text-xs font-bold text-[#d8ffe5] tracking-wide">
                      Đang chờ hệ thống ghi nhận thanh toán...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
