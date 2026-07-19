'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getSession, getAccessToken, logoutUser, SessionUser, getApiBaseUrl } from '@/app/lib/authStorage';

interface AdminStats {
  users: {
    total: number;
    active24h: number;
    active7d: number;
  };
  purchases: {
    totalCount: number;
    totalRevenue: number;
    basic: {
      count: number;
      revenue: number;
    };
    premium: {
      count: number;
      revenue: number;
    };
  };
  recentTransactions: Array<{
    _id: string;
    checkoutCode: string;
    planName: string;
    amount: number;
    status: string;
    createdAt: string;
    note?: string;
    userId?: { fullName: string; email: string };
  }>;
  recentTournaments: Array<{
    _id: string;
    id: string;
    name: string;
    sport: string;
    teams: Array<any>;
    matchDuration: number;
    createdAt: string;
  }>;
  usersList: Array<{
    _id: string;
    fullName: string;
    email: string;
    role: string;
    isVerified: boolean;
    lastActiveAt?: string;
    createdAt: string;
  }>;
  transactionsList: Array<{
    _id: string;
    checkoutCode: string;
    planName: string;
    amount: number;
    status: string;
    createdAt: string;
    paidAt?: string;
    note?: string;
    userId?: { fullName: string; email: string };
  }>;
  feedbacksList: Array<{
    _id: string;
    id: string;
    name: string;
    sport: string;
    feedbacks: Array<{
      rating: number;
      content: string;
      createdAt: string;
    }>;
    updatedAt: string;
  }>;
}



export default function AdminDashboardPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab control: 'overview' | 'users' | 'transactions' | 'feedbacks' | 'coupons'
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'transactions' | 'feedbacks' | 'coupons'>('overview');
  
  // Search filters
  const [userSearch, setUserSearch] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [feedbackSearch, setFeedbackSearch] = useState('');

  // Coupon states
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    maxUses: '',
    expiryDate: '',
  });

  const loadCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const token = getAccessToken();
      const response = await fetch(`${getApiBaseUrl()}/admin/coupons`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch coupons');
      }
      const data = await response.json();
      setCoupons(data);
    } catch (err: any) {
      console.error(err);
      alert('Không thể tải danh sách mã giảm giá');
    } finally {
      setLoadingCoupons(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.discountValue) {
      alert('Vui lòng nhập mã và giá trị giảm giá');
      return;
    }
    try {
      const token = getAccessToken();
      const response = await fetch(`${getApiBaseUrl()}/admin/coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: newCoupon.code,
          discountType: newCoupon.discountType,
          discountValue: Number(newCoupon.discountValue),
          maxUses: newCoupon.maxUses ? Number(newCoupon.maxUses) : null,
          expiryDate: newCoupon.expiryDate || null,
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to create coupon');
      }
      alert('Tạo mã giảm giá thành công!');
      setNewCoupon({
        code: '',
        discountType: 'percentage',
        discountValue: 0,
        maxUses: '',
        expiryDate: '',
      });
      loadCoupons();
    } catch (err: any) {
      alert(err.message || 'Có lỗi xảy ra khi tạo mã giảm giá');
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mã giảm giá này không?')) {
      return;
    }
    try {
      const token = getAccessToken();
      const response = await fetch(`${getApiBaseUrl()}/admin/coupons/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to delete coupon');
      }
      alert('Xóa thành công!');
      loadCoupons();
    } catch (err: any) {
      alert(err.message || 'Không thể xóa mã giảm giá');
    }
  };

  useEffect(() => {
    if (activeTab === 'coupons') {
      loadCoupons();
    }
  }, [activeTab]);

  // User details modal states
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const handleUserClick = async (userId: string) => {
    setSelectedUserId(userId);
    setLoadingDetails(true);
    setShowDetailsModal(true);
    setUserDetails(null);
    try {
      const token = getAccessToken();
      const response = await fetch(`${getApiBaseUrl()}/admin/users/${userId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }
      const data = await response.json();
      setUserDetails(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Có lỗi xảy ra khi tải chi tiết người dùng.');
      setShowDetailsModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session.role !== 'admin') {
      router.replace('/');
      return;
    }
    setSessionUser(session);

    const loadStats = async () => {
      try {
        const token = getAccessToken();
        const response = await fetch(`${getApiBaseUrl()}/admin/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch admin stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error loading dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [router]);

  const handleLogout = async () => {
    await logoutUser();
    router.push('/login');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter users based on search query
  const filteredUsers = stats?.usersList.filter(user => {
    const query = userSearch.toLowerCase().trim();
    return (
      user.fullName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  }) || [];

  // Filter transactions based on search query
  const filteredTransactions = stats?.transactionsList.filter(tx => {
    const query = transactionSearch.toLowerCase().trim();
    return (
      tx.checkoutCode.toLowerCase().includes(query) ||
      tx.planName.toLowerCase().includes(query) ||
      tx.status.toLowerCase().includes(query) ||
      (tx.note && tx.note.toLowerCase().includes(query))
    );
  }) || [];

  // Filter feedbacks based on search query
  const filteredFeedbacks = stats?.feedbacksList.filter(f => {
    const query = feedbackSearch.toLowerCase().trim();
    return (
      f.name.toLowerCase().includes(query) ||
      f.sport.toLowerCase().includes(query) ||
      f.feedbacks.some(fb => (fb.content || '').toLowerCase().includes(query))
    );
  }) || [];

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Đang tải số liệu thống kê...</p>
        </div>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-red-500/10 border border-red-500/20 rounded-2xl p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Đã xảy ra lỗi</h2>
          <p className="text-white/60 mb-6">{error || 'Không tải được số liệu admin.'}</p>
          <Link href="/tournaments" className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all font-semibold">
            Quay lại Giải đấu
          </Link>
        </div>
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
          <span className="text-[15px] font-bold tracking-tight">TournaStream Admin</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/40">
            Chào Admin, {sessionUser?.fullName}
          </span>
          <Link
            href="/tournaments"
            className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5"
          >
            Giải đấu của tôi
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
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Bảng Điều Khiển Hệ Thống</h1>
            <p className="text-white/60 mt-1">Quản lý thống kê đăng ký, hoạt động và doanh thu giải đấu.</p>
          </div>
          
          {/* Tab buttons */}
          <div className="flex bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'overview'
                  ? 'bg-[#22c55e] text-[#080b10]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Tổng quan
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'users'
                  ? 'bg-[#22c55e] text-[#080b10]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Người dùng ({stats.usersList.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'transactions'
                  ? 'bg-[#22c55e] text-[#080b10]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Giao dịch ({stats.transactionsList.length})
            </button>
            <button
              onClick={() => setActiveTab('feedbacks')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'feedbacks'
                  ? 'bg-[#22c55e] text-[#080b10]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Đánh giá ({stats.feedbacksList?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('coupons')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'coupons'
                  ? 'bg-[#22c55e] text-[#080b10]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Mã giảm giá
            </button>
          </div>
        </div>

        {/* Stats Cards - Clickable to switch tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Card 1: Users registered */}
          <div
            onClick={() => setActiveTab('users')}
            className={`p-6 rounded-2xl border transition-all cursor-pointer hover:scale-[1.02] ${
              activeTab === 'users'
                ? 'border-[#22c55e] bg-[#22c55e]/[0.05]'
                : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
            }`}
          >
            <span className="text-xs font-bold text-white/40 uppercase tracking-wider block">Đăng ký hệ thống</span>
            <span className="text-4xl font-black mt-2 block">{stats.users.total}</span>
            <span className="text-xs text-[#22c55e] font-semibold mt-2 block hover:underline">
              Bấm để xem danh sách chi tiết &rarr;
            </span>
          </div>

          {/* Card 2: Active Users */}
          <div
            onClick={() => setActiveTab('users')}
            className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] transition-all cursor-pointer hover:scale-[1.02]"
          >
            <span className="text-xs font-bold text-white/40 uppercase tracking-wider block">Người đang sử dụng</span>
            <span className="text-4xl font-black mt-2 block">{stats.users.active24h}</span>
            <span className="text-xs text-white/50 font-semibold mt-2 block">
              Hoạt động: {stats.users.active7d} người / 7 ngày qua
            </span>
          </div>

          {/* Card 3: Plan Sales */}
          <div
            onClick={() => setActiveTab('transactions')}
            className={`p-6 rounded-2xl border transition-all cursor-pointer hover:scale-[1.02] ${
              activeTab === 'transactions'
                ? 'border-[#22c55e] bg-[#22c55e]/[0.05]'
                : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
            }`}
          >
            <span className="text-xs font-bold text-white/40 uppercase tracking-wider block">Giao dịch mua gói</span>
            <span className="text-4xl font-black mt-2 block">{stats.purchases.totalCount}</span>
            <div className="flex gap-4 mt-2 text-[11px] text-white/60">
              <span>Cơ bản: <strong>{stats.purchases.basic.count}</strong></span>
              <span>Cao cấp: <strong>{stats.purchases.premium.count}</strong></span>
            </div>
          </div>

          {/* Card 4: Total Revenue */}
          <div
            onClick={() => setActiveTab('transactions')}
            className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] transition-all cursor-pointer hover:scale-[1.02]"
          >
            <span className="text-xs font-bold text-white/40 uppercase tracking-wider block">Doanh thu hệ thống</span>
            <span className="text-4xl font-black mt-2 text-[#22c55e] block">
              {stats.purchases.totalRevenue.toLocaleString('vi-VN')}đ
            </span>
            <div className="flex gap-4 mt-2 text-[10px] text-white/50">
              <span>CB: {stats.purchases.basic.revenue.toLocaleString('vi-VN')}đ</span>
              <span>CC: {stats.purchases.premium.revenue.toLocaleString('vi-VN')}đ</span>
            </div>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left / Middle: Recent Transactions Table */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-bold tracking-tight">Giao dịch SePay gần đây</h2>
              <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-white/40 font-semibold text-xs uppercase tracking-wider">
                      <th className="px-6 py-4">Mã GD</th>
                      <th className="px-6 py-4">Gói dịch vụ</th>
                      <th className="px-6 py-4">Số tiền</th>
                      <th className="px-6 py-4">Trạng thái</th>
                      <th className="px-6 py-4">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats.recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-white/40">
                          Chưa có lịch sử giao dịch nào.
                        </td>
                      </tr>
                    ) : (
                      stats.recentTransactions.map((tx) => (
                        <tr key={tx._id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-[#22c55e]">{tx.checkoutCode}</td>
                          <td className="px-6 py-4">{tx.planName}</td>
                          <td className="px-6 py-4 font-semibold">{tx.amount.toLocaleString('vi-VN')}đ</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
                              tx.status === 'paid'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                               : tx.status === 'pending'
                                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {tx.status === 'paid' ? 'Đã thu' : tx.status === 'pending' ? 'Chờ thanh toán' : tx.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-white/50">{formatDate(tx.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Recent Tournaments */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-xl font-bold tracking-tight">Giải đấu mới tạo</h2>
              <div className="space-y-3">
                {stats.recentTournaments.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] text-center text-white/40">
                    Chưa có giải đấu nào được tạo.
                  </div>
                ) : (
                  stats.recentTournaments.map((t) => (
                    <div key={t._id} className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                      <h3 className="font-bold text-white tracking-tight truncate">{t.name}</h3>
                      <div className="flex justify-between items-center mt-2 text-xs text-white/50">
                        <span>{t.sport} • {t.teams?.length || 0} đội</span>
                        <span>{formatDate(t.createdAt).split(',')[0]}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DETAILED USERS LIST */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight">Danh sách người dùng đăng ký</h2>
              
              {/* Search user */}
              <div className="w-full md:max-w-xs">
                <input
                  type="text"
                  placeholder="Tìm theo tên, email, vai trò..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-white/40 font-semibold text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 w-12 text-center">STT</th>
                    <th className="px-6 py-4">Họ và Tên</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Vai trò</th>
                    <th className="px-6 py-4">Xác thực</th>
                    <th className="px-6 py-4">Hoạt động gần nhất</th>
                    <th className="px-6 py-4">Ngày đăng ký</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-white/40">
                        {userSearch ? 'Không tìm thấy người dùng nào phù hợp.' : 'Chưa có người dùng đăng ký.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, idx) => {
                      const isActiveNow = user.lastActiveAt && (new Date().getTime() - new Date(user.lastActiveAt).getTime() < 5 * 60 * 1000);
                      return (
                        <tr 
                          key={user._id} 
                          onClick={() => handleUserClick(user._id)}
                          className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                          title="Nhấp để xem chi tiết người dùng"
                        >
                          <td className="px-6 py-4 text-center text-white/40">{idx + 1}</td>
                          <td className="px-6 py-4 font-bold flex items-center gap-2">
                            {user.fullName}
                            {isActiveNow && (
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Đang online" />
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-white/80">{user.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              user.role === 'admin' 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
                              user.isVerified
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-white/[0.05] text-white/40'
                            }`}>
                              {user.isVerified ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {user.lastActiveAt ? (
                              <span className={isActiveNow ? 'text-[#22c55e] font-semibold' : 'text-white/60'}>
                                {isActiveNow ? 'Vừa mới đây' : formatDate(user.lastActiveAt)}
                              </span>
                            ) : (
                              <span className="text-white/30">Chưa ghi nhận</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-white/50">{formatDate(user.createdAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DETAILED TRANSACTIONS LIST */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight">Nhật ký giao dịch hệ thống</h2>
              
              {/* Search transaction */}
              <div className="w-full md:max-w-xs">
                <input
                  type="text"
                  placeholder="Tìm mã GD, gói, trạng thái..."
                  value={transactionSearch}
                  onChange={(e) => setTransactionSearch(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-white/40 font-semibold text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 w-12 text-center">STT</th>
                    <th className="px-6 py-4">Mã GD</th>
                    <th className="px-6 py-4">Người mua</th>
                    <th className="px-6 py-4">Gói dịch vụ</th>
                    <th className="px-6 py-4">Số tiền</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4">Nội dung / Note</th>
                    <th className="px-6 py-4">Thời gian tạo</th>
                    <th className="px-6 py-4">Thanh toán lúc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-white/40">
                        {transactionSearch ? 'Không tìm thấy giao dịch nào phù hợp.' : 'Chưa có giao dịch nào phát sinh.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx, idx) => (
                      <tr key={tx._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 text-center text-white/40">{idx + 1}</td>
                        <td className="px-6 py-4 font-mono font-bold text-[#22c55e]">{tx.checkoutCode}</td>
                        <td className="px-6 py-4">
                          {tx.userId ? (
                            <div>
                              <div className="font-semibold text-white/90">{tx.userId.fullName}</div>
                              <div className="text-xs text-white/40 font-mono mt-0.5">{tx.userId.email}</div>
                            </div>
                          ) : (
                            <span className="text-white/30">Ẩn danh / Cũ</span>
                          )}
                        </td>
                        <td className="px-6 py-4">{tx.planName}</td>
                        <td className="px-6 py-4 font-semibold">{tx.amount.toLocaleString('vi-VN')}đ</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
                            tx.status === 'paid'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : tx.status === 'pending'
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {tx.status === 'paid' ? 'Đã thu' : tx.status === 'pending' ? 'Chờ thanh toán' : tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-white/60 truncate max-w-[200px]" title={tx.note}>
                          {tx.note || 'Không có'}
                        </td>
                        <td className="px-6 py-4 text-xs text-white/50">{formatDate(tx.createdAt)}</td>
                        <td className="px-6 py-4 text-xs text-white/50">
                          {tx.paidAt ? (
                            <span className="text-green-400 font-semibold">{formatDate(tx.paidAt)}</span>
                          ) : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DETAILED FEEDBACKS LIST */}
        {activeTab === 'feedbacks' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight">Đánh giá & Phản hồi giải đấu</h2>
              
              {/* Search feedback */}
              <div className="w-full md:max-w-xs">
                <input
                  type="text"
                  placeholder="Tìm giải đấu, môn thể thao, nội dung..."
                  value={feedbackSearch}
                  onChange={(e) => setFeedbackSearch(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-white/40 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-white/40 font-semibold text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 w-12 text-center">STT</th>
                    <th className="px-6 py-4">Giải đấu</th>
                    <th className="px-6 py-4">Môn thể thao</th>
                    <th className="px-6 py-4">Đánh giá (Sao)</th>
                    <th className="px-6 py-4">Ý kiến đóng góp</th>
                    <th className="px-6 py-4">Thời gian gửi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredFeedbacks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-white/40">
                        {feedbackSearch ? 'Không tìm thấy đánh giá nào phù hợp.' : 'Chưa có đánh giá nào được gửi.'}
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      let globalIdx = 0;
                      return filteredFeedbacks.flatMap((f) => 
                        (f.feedbacks || []).map((fb, idx) => {
                          globalIdx++;
                          return (
                            <tr key={`${f._id}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4 text-center text-white/40">{globalIdx}</td>
                              <td className="px-6 py-4 font-bold">{f.name}</td>
                              <td className="px-6 py-4 text-white/80">{f.sport}</td>
                              <td className="px-6 py-4 font-semibold text-yellow-400">
                                <span className="flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <svg
                                      key={i}
                                      className={`w-4 h-4 ${i < fb.rating ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}`}
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  ))}
                                  <span className="ml-1 text-xs text-white/60">({fb.rating}/5)</span>
                                </span>
                              </td>
                              <td className="px-6 py-4 text-white/80 whitespace-pre-wrap max-w-md">
                                {fb.content || <span className="text-white/30 italic">Không có nhận xét</span>}
                              </td>
                              <td className="px-6 py-4 text-xs text-white/50">{formatDate(fb.createdAt)}</td>
                            </tr>
                          );
                        })
                      );
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* TAB 5: COUPONS MANAGEMENT */}
        {activeTab === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Coupon Form */}
            <div className="lg:col-span-1 bg-[#0f1419] border border-white/[0.06] rounded-2xl p-6 shadow-xl space-y-6">
              <h2 className="text-lg font-black text-white">Tạo mã giảm giá mới</h2>
              <form onSubmit={handleCreateCoupon} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-white/55 uppercase tracking-wider mb-2">Mã code</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: GIOITHIEU50"
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/55 uppercase tracking-wider mb-2">Loại giảm giá</label>
                  <select
                    value={newCoupon.discountType}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0f1419] border border-white/10 text-white text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                  >
                    <option value="percentage">Phần trăm (%)</option>
                    <option value="fixed">Số tiền cố định (đ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/55 uppercase tracking-wider mb-2">Giá trị giảm</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder={newCoupon.discountType === 'percentage' ? 'Ví dụ: 50' : 'Ví dụ: 20000'}
                    value={newCoupon.discountValue || ''}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/55 uppercase tracking-wider mb-2">Giới hạn số lần dùng (để trống nếu không giới hạn)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ví dụ: 100"
                    value={newCoupon.maxUses}
                    onChange={(e) => setNewCoupon({ ...newCoupon, maxUses: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/55 uppercase tracking-wider mb-2">Ngày hết hạn (để trống nếu không hết hạn)</label>
                  <input
                    type="date"
                    value={newCoupon.expiryDate}
                    onChange={(e) => setNewCoupon({ ...newCoupon, expiryDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-[#080b10] font-black text-xs uppercase tracking-wider transition-all duration-200"
                >
                  Tạo mã giảm giá
                </button>
              </form>
            </div>

            {/* List Coupons */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-bold tracking-tight text-white">Danh sách mã giảm giá</h2>
              <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-white/40 font-semibold text-xs uppercase tracking-wider">
                      <th className="px-6 py-4">Mã Code</th>
                      <th className="px-6 py-4">Loại</th>
                      <th className="px-6 py-4">Giá trị</th>
                      <th className="px-6 py-4 text-center">Đã dùng</th>
                      <th className="px-6 py-4 text-center">Giới hạn</th>
                      <th className="px-6 py-4">Ngày hết hạn</th>
                      <th className="px-6 py-4 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingCoupons ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-white/40">Đang tải...</td>
                      </tr>
                    ) : coupons.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-white/40">Chưa có mã giảm giá nào được tạo.</td>
                      </tr>
                    ) : (
                      coupons.map((coupon) => (
                        <tr key={coupon._id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-bold text-white tracking-wider">{coupon.code}</td>
                          <td className="px-6 py-4 text-white/60">
                            {coupon.discountType === 'percentage' ? 'Phần trăm (%)' : 'Cố định (đ)'}
                          </td>
                          <td className="px-6 py-4 font-semibold text-[#22c55e]">
                            {coupon.discountType === 'percentage' 
                              ? `${coupon.discountValue}%` 
                              : `${coupon.discountValue.toLocaleString('vi-VN')} đ`}
                          </td>
                          <td className="px-6 py-4 text-center font-semibold text-white/80">{coupon.uses}</td>
                          <td className="px-6 py-4 text-center text-white/60">
                            {coupon.maxUses === null ? 'Không giới hạn' : coupon.maxUses}
                          </td>
                          <td className="px-6 py-4 text-xs text-white/50">
                            {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString('vi-VN') : 'Không hết hạn'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleDeleteCoupon(coupon._id)}
                              className="px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 font-bold text-[10px] uppercase transition-all"
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
      {/* User Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080b10]/80 backdrop-blur-md">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setShowDetailsModal(false)} />
          
          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-[#0f1419] border border-white/[0.08] rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col gap-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                  {loadingDetails ? 'Đang tải thông tin...' : userDetails?.user.fullName}
                  {userDetails?.user.role === 'admin' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30">
                      ADMIN
                    </span>
                  )}
                </h3>
                {!loadingDetails && userDetails?.user && (
                  <p className="text-white/60 text-sm font-mono mt-1">{userDetails.user.email}</p>
                )}
              </div>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-3 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
                <p className="text-white/40 text-xs">Đang truy vấn cơ sở dữ liệu...</p>
              </div>
            ) : (
              userDetails && (
                <div className="flex flex-col gap-6">
                  {/* Summary Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.01]">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Giải đấu đã tạo</span>
                      <span className="text-3xl font-black text-white mt-1 block">{userDetails.tournaments.length}</span>
                    </div>
                    <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.01]">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Tổng số giao dịch</span>
                      <span className="text-3xl font-black text-white mt-1 block">{userDetails.transactions.length}</span>
                    </div>
                    <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.01]">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Đánh giá nhận được</span>
                      <span className="text-3xl font-black text-white mt-1 block">
                        {userDetails.feedbacks.reduce((sum: number, t: any) => sum + (t.feedbacks?.length || 0), 0)}
                      </span>
                    </div>
                  </div>

                  {/* Tab Detail Contents */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Column 1: Tournaments List */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[#22c55e] border-b border-[#22c55e]/20 pb-2 flex items-center justify-between">
                        <span>Giải đấu ({userDetails.tournaments.length})</span>
                      </h4>
                      <div className="overflow-y-auto max-h-[350px] pr-1 space-y-3">
                        {userDetails.tournaments.length === 0 ? (
                          <p className="text-white/30 text-xs italic py-4">Chưa tạo giải đấu nào.</p>
                        ) : (
                          userDetails.tournaments.map((t: any) => (
                            <div key={t._id} className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-left">
                              <h5 className="font-bold text-xs truncate text-white" title={t.name}>{t.name}</h5>
                              <div className="flex justify-between items-center text-[10px] text-white/40 mt-2">
                                <span>{t.sport.toUpperCase()} • {t.teams?.length || 0} Đội</span>
                                <span>{new Date(t.createdAt).toLocaleDateString('vi-VN')}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Column 2: Transactions List */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[#22c55e] border-b border-[#22c55e]/20 pb-2">
                        Giao dịch ({userDetails.transactions.length})
                      </h4>
                      <div className="overflow-y-auto max-h-[350px] pr-1 space-y-3">
                        {userDetails.transactions.length === 0 ? (
                          <p className="text-white/30 text-xs italic py-4">Chưa có giao dịch nào.</p>
                        ) : (
                          userDetails.transactions.map((tx: any) => (
                            <div key={tx._id} className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.01] flex flex-col gap-1.5 text-left">
                              <div className="flex justify-between items-center">
                                <span className="font-mono font-bold text-xs text-[#22c55e]">{tx.checkoutCode}</span>
                                <span className={`px-1.5 py-0.5 text-[8px] font-black rounded-full ${
                                  tx.status === 'paid'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-white/10 text-white/60 border border-white/20'
                                }`}>
                                  {tx.status === 'paid' ? 'Thành công' : tx.status}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-white/50">
                                <span>{tx.planName}</span>
                                <span className="font-bold text-white">{tx.amount.toLocaleString('vi-VN')}đ</span>
                              </div>
                              <span className="text-[9px] text-white/30 self-end">
                                {new Date(tx.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Column 3: Feedbacks List */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[#22c55e] border-b border-[#22c55e]/20 pb-2">
                        Đánh giá ({userDetails.feedbacks.reduce((sum: number, t: any) => sum + (t.feedbacks?.length || 0), 0)})
                      </h4>
                      <div className="overflow-y-auto max-h-[350px] pr-1 space-y-3">
                        {userDetails.feedbacks.length === 0 ? (
                          <p className="text-white/30 text-xs italic py-4">Chưa nhận được đánh giá nào.</p>
                        ) : (
                          userDetails.feedbacks.flatMap((t: any) => 
                            (t.feedbacks || []).map((fb: any, index: number) => (
                              <div key={`${t._id}-${index}`} className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.01] flex flex-col gap-1.5 text-left">
                                <div className="flex justify-between items-start gap-1">
                                  <span className="font-bold text-[10px] text-white/80 truncate max-w-[120px]" title={t.name}>
                                    {t.name}
                                  </span>
                                  <span className="flex items-center gap-0.5 text-yellow-400 shrink-0">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <svg
                                        key={i}
                                        className={`w-3.5 h-3.5 ${i < fb.rating ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}`}
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    ))}
                                  </span>
                                </div>
                                <p className="text-[10px] text-white/60 italic leading-relaxed whitespace-pre-wrap">
                                  {fb.content || 'Không có nhận xét'}
                                </p>
                                <span className="text-[8px] text-white/30 self-end">
                                  {new Date(fb.createdAt).toLocaleDateString('vi-VN')}
                                </span>
                              </div>
                            ))
                          )
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )
            )}
            
            {/* Modal Footer */}
            <div className="border-t border-white/[0.06] pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-semibold text-sm transition-all"
              >
                Đóng
              </button>
            </div>
            
          </div>
        </div>
      )}
    </main>
  );
}
