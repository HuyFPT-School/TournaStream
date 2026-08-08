'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/app/contexts/TournamentContext';
import { useState, useEffect, useMemo } from 'react';
import { createSePayCheckout, getSePayTransactionStatus, cancelSePayCheckout } from '@/app/lib/sepay';
import { getSession, getAccessToken, getApiBaseUrl } from '@/app/lib/authStorage';
import { fetchUserTournamentsFromBackend } from '@/app/lib/tournaments';

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
  const [hasCreatedBefore, setHasCreatedBefore] = useState<boolean>(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);

  // Coupon states
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCouponInfo, setAppliedCouponInfo] = useState<any>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) return;
    setIsValidatingCoupon(true);
    setErrorMessage('');
    try {
      const token = getAccessToken();
      const planKey = selectedPackage === 'pro' ? 'premium' : selectedPackage;
      const response = await fetch(`${getApiBaseUrl()}/payments/coupon/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          code: couponCodeInput,
          planKey
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Mã giảm giá không hợp lệ');
      }

      const data = await response.json();
      setAppliedCouponInfo(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể kiểm tra mã giảm giá');
      setAppliedCouponInfo(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Reset coupon if package is changed
  useEffect(() => {
    setAppliedCouponInfo(null);
    setCouponCodeInput('');
  }, [selectedPackage]);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    const checkExistingTournaments = async () => {
      try {
        const list = await fetchUserTournamentsFromBackend();
        if (list && list.length > 0) {
          setHasCreatedBefore(true);
        }
      } catch (err) {
        console.error('Error checking user tournaments:', err);
      }
    };
    checkExistingTournaments();
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
        const age = parsed.createdAt ? Date.now() - new Date(parsed.createdAt).getTime() : 0;
        if (age > 15 * 60 * 1000) {
          localStorage.removeItem(pendingCheckoutKey);
        } else {
          setActiveCheckout(parsed);
          const planId = parsed.planKey === 'premium' ? 'pro' : parsed.planKey;
          setSelectedPackage(planId);
        }
      } catch (e) {
        console.error('Error parsing pendingCheckout:', e);
      }
    }
  }, [pendingCheckoutKey]);

  useEffect(() => {
    if (paymentSuccess && activeCheckout) {
      localStorage.removeItem(pendingCheckoutKey);
      const timer = setTimeout(() => {
        const planId = activeCheckout.planKey === 'premium' ? 'pro' : activeCheckout.planKey;
        const pkg = packages.find(p => p.id === planId);
        if (pkg) {
          setPackage(pkg.id, pkg.name, pkg.price);
          router.push('/tournaments/create/info');
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [paymentSuccess, activeCheckout, pendingCheckoutKey, router, setPackage]);

  useEffect(() => {
    if (!activeCheckout || paymentSuccess) return;

    const createdAtTime = activeCheckout.createdAt ? new Date(activeCheckout.createdAt).getTime() : Date.now();
    const expiresAt = createdAtTime + 15 * 60 * 1000;

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);
      if (remaining <= 0) {
        setActiveCheckout(null);
        localStorage.removeItem(pendingCheckoutKey);
        setErrorMessage('Mã thanh toán đã hết hạn (quá 15 phút). Vui lòng thử lại.');
      }
    };
    updateCountdown();
    const timerInterval = setInterval(updateCountdown, 1000);

    const statusInterval = setInterval(async () => {
      try {
        const res = await getSePayTransactionStatus(activeCheckout.checkoutCode);
        if (res.status === 'paid') {
          setPaymentSuccess(true);
          clearInterval(statusInterval);
          clearInterval(timerInterval);
        } else if (res.status === 'expired' || res.status === 'cancelled') {
          setActiveCheckout(null);
          localStorage.removeItem(pendingCheckoutKey);
          clearInterval(statusInterval);
          clearInterval(timerInterval);
          setErrorMessage(
            res.status === 'expired'
              ? 'Mã thanh toán đã hết hạn (quá 15 phút). Vui lòng thử lại.'
              : 'Giao dịch đã được hủy thành công.'
          );
        }
      } catch (err) {
        console.error('Error polling transaction status:', err);
      }
    }, 3000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(timerInterval);
    };
  }, [activeCheckout, paymentSuccess, pendingCheckoutKey]);

  const session = getSession();
  const isVipUser = Boolean(session?.isVip);
  const pendingCheckoutKey = session ? `pendingCheckout_${session.id}` : 'pendingCheckout';

  const bankDetails = useMemo(() => { ... });

  const handleCancelCheckout = async () => { ... };

  const handleContinue = async () => {
    const pkg = packages.find(p => p.id === selectedPackage);
    if (!pkg) return;

    if (pkg.id === 'free') {
      if (hasCreatedBefore && !isVipUser) {
        alert('Cảnh báo: Bạn đã sử dụng gói dùng thử trước đó. Gói dùng thử chỉ áp dụng cho giải đấu đầu tiên của bạn. Vui lòng chọn gói Cơ bản hoặc Cao cấp.');
        return;
      }
      setPackage(pkg.id, pkg.name, pkg.price);
      router.push('/tournaments/create/info');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const planKey = pkg.id === 'pro' ? 'premium' : pkg.id;
      const checkout = await createSePayCheckout({
        planKey,
        couponCode: appliedCouponInfo ? appliedCouponInfo.code : undefined,
      });
      setActiveCheckout(checkout);
      if (checkout.status !== 'paid') {
        localStorage.setItem(pendingCheckoutKey, JSON.stringify(checkout));
      }
      setPaymentSuccess(checkout.status === 'paid');
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
                } ${pkg.highlighted ? 'md:scale-105 md:shadow-xl md:shadow-[#22c55e]/10' : ''} ${
                  pkg.id === 'free' && hasCreatedBefore ? 'opacity-85' : ''
                }`}
            >
              {pkg.highlighted && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-[#22c55e] text-[#080b10] text-xs font-bold rounded-bl-xl">
                  Phổ biến
                </div>
              )}
              {pkg.id === 'free' && hasCreatedBefore && !isVipUser && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-red-600 text-white text-[10px] font-bold rounded-bl-xl shadow-md">
                  Đã dùng thử
                </div>
              )}
              {pkg.id === 'free' && isVipUser && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-[#22c55e] text-[#080b10] text-[10px] font-bold rounded-bl-xl shadow-md">
                  Miễn phí (VIP)
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
                  {pkg.id === 'free' && hasCreatedBefore && !isVipUser && (
                    <p className="text-xs text-red-400 font-bold mt-2 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Bạn đã dùng gói này rồi
                    </p>
                  )}
                  {pkg.id === 'free' && isVipUser && (
                    <p className="text-xs text-[#22c55e] font-bold mt-2 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Đặc quyền Tài khoản VIP (Miễn phí)
                    </p>
                  )}
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
        <div className="bg-[#0f1419] border border-white/[0.06] rounded-lg p-4 mb-8 text-sm text-white/60 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#22c55e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Miễn phí cho giải đấu đầu tiên! Tối đa 8 đội, đầy đủ tính năng.</span>
        </div>

        {/* Coupon Input Block */}
        {selectedPackage !== 'free' && (
          <div className="bg-[#0f1419] border border-white/[0.06] rounded-2xl p-6 mb-8 space-y-4 shadow-inner">
            <h4 className="text-sm font-black text-white">Bạn có mã giảm giá (Coupon)?</h4>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Nhập mã giảm giá..."
                value={couponCodeInput}
                onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                disabled={appliedCouponInfo !== null || isValidatingCoupon}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#22c55e] disabled:opacity-50 transition-colors"
              />
              {appliedCouponInfo ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCouponInfo(null);
                    setCouponCodeInput('');
                  }}
                  className="px-5 py-2.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 text-red-400 font-bold text-xs uppercase transition-all"
                >
                  Hủy áp dụng
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={!couponCodeInput.trim() || isValidatingCoupon}
                  className="px-6 py-2.5 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-white/5 disabled:text-white/20 text-[#080b10] font-bold text-xs uppercase transition-all"
                >
                  {isValidatingCoupon ? 'Đang kiểm tra...' : 'Áp dụng'}
                </button>
              )}
            </div>
            {appliedCouponInfo && (
              <div className="p-3.5 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20 text-xs text-[#22c55e] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[#22c55e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Đã áp dụng mã <strong>{appliedCouponInfo.code}</strong> (Giảm{' '}
                  {appliedCouponInfo.discountType === 'percentage'
                    ? `${appliedCouponInfo.discountValue}%`
                    : `${appliedCouponInfo.discountValue.toLocaleString('vi-VN')} đ`}
                  )
                </span>
                <span className="font-bold">
                  Còn lại: {appliedCouponInfo.finalAmount.toLocaleString('vi-VN')} đ
                </span>
              </div>
            )}
          </div>
        )}

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
                  {activeCheckout.amount === 0 ? 'Kích hoạt gói dịch vụ' : 'SePay Checkout'}
                </p>
                <h3 className="mt-1 text-lg font-black text-white">
                  {activeCheckout.amount === 0 ? `Kích hoạt gói ${activeCheckout.planName}` : `Thanh toán gói ${activeCheckout.planName}`}
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
                  <h4 className="text-2xl font-black text-white">
                    {activeCheckout.amount === 0 ? 'Kích hoạt gói thành công!' : 'Thanh toán thành công!'}
                  </h4>
                  <p className="text-white/60 text-sm max-w-sm">
                    {activeCheckout.amount === 0
                      ? 'Gói dịch vụ đã được kích hoạt miễn phí. Đang chuẩn bị chuyển đến màn hình thiết lập thông tin giải đấu...'
                      : 'Giao dịch đã được ghi nhận. Đang chuẩn bị chuyển đến màn hình thiết lập thông tin giải đấu...'}
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
                      {timeLeftSeconds !== null && (
                        <div className="text-right">
                          <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-bold">Hết hạn sau</span>
                          <span className="text-lg font-mono font-black text-amber-400 block mt-0.5">
                            {Math.floor(timeLeftSeconds / 60)}:{(timeLeftSeconds % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Loading / Status Polling message */}
                  <div className="flex items-center justify-center gap-3 py-2 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
                    <span className="text-xs font-bold text-[#d8ffe5] tracking-wide">
                      Đang chờ hệ thống ghi nhận thanh toán...
                    </span>
                  </div>

                  {/* Cancel Button */}
                  <button
                    onClick={handleCancelCheckout}
                    className="w-full py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Hủy giao dịch này & chọn lại gói
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
