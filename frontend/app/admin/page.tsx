'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getSession, getAccessToken, logoutUser, SessionUser } from '@/app/lib/authStorage';

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
  }>;
}

function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocalHost) {
      return "http://localhost:4000/api";
    }
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab control: 'overview' | 'users' | 'transactions'
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'transactions'>('overview');
  
  // Search filters
  const [userSearch, setUserSearch] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');

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
                        <tr key={user._id} className="hover:bg-white/[0.02] transition-colors">
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
                      <td colSpan={8} className="px-6 py-8 text-center text-white/40">
                        {transactionSearch ? 'Không tìm thấy giao dịch nào phù hợp.' : 'Chưa có giao dịch nào phát sinh.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx, idx) => (
                      <tr key={tx._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 text-center text-white/40">{idx + 1}</td>
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
      </section>
    </main>
  );
}
