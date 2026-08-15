'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTournament, Team } from '@/app/contexts/TournamentContext';
import { useState } from 'react';

export default function TeamsPage() {
  const router = useRouter();
  const { data, addTeam, removeTeam, loadTournamentData } = useTournament();
  const [teamName, setTeamName] = useState('');
  const [teamLogo, setTeamLogo] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPublicReg, setIsPublicReg] = useState(data.isPublicRegistration || false);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Kích thước ảnh tối đa là 5MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dt6uoyt1t';
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ml_default';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Không thể tải ảnh lên server Cloudinary');
      }

      const responseData = await response.json();
      if (responseData.secure_url) {
        setTeamLogo(responseData.secure_url);
      } else {
        throw new Error('Không nhận được URL ảnh từ Cloudinary');
      }
    } catch (err: any) {
      console.error('Lỗi upload Cloudinary:', err);
      setUploadError(err.message || 'Lỗi khi tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setTeamLogo('');
    setLogoPreview(null);
    setUploadError(null);
  };

  const maxTeams = data.packageId === 'free' ? 8 : data.packageId === 'basic' ? 16 : 32;

  const handleAddTeam = () => {
    const newErrors: Record<string, string> = {};

    if (!teamName.trim()) {
      newErrors.teamName = 'Vui lòng nhập tên đội';
    }

    if (data.teams.some(t => t.name.toLowerCase() === teamName.toLowerCase())) {
      newErrors.teamName = 'Tên đội này đã tồn tại';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const newTeam: Team = {
        id: Date.now().toString(),
        name: teamName,
        members: [],
        logo: teamLogo || undefined,
      };
      addTeam(newTeam);
      setTeamName('');
      setTeamLogo('');
      setLogoPreview(null);
      setUploadError(null);
      setShowForm(false);
    }
  };

  const isPowerOfTwo = (n: number) => {
    return n > 1 && (n & (n - 1)) === 0;
  };

  const isValidTeamCount = () => {
    const len = data.teams.length;
    const format = data.format || 'single_elimination';

    if (format === 'single_elimination') {
      return len >= 2 && isPowerOfTwo(len);
    }
    if (format === 'double_elimination') {
      return len >= 4 && isPowerOfTwo(len);
    }
    if (format === 'league' || format === 'battle_royale') {
      return len >= 2;
    }
    return false;
  };

  const handleContinue = () => {
    if (isPublicReg) {
      loadTournamentData({
        ...data,
        isPublicRegistration: true,
        registrationOpen: true,
        maxTeams: maxTeams,
        teams: data.teams,
        bracketSeeded: false,
      });
      if (data.teams.length > 0) {
        router.push('/tournaments/create/members');
      } else {
        router.push('/tournaments/create/finalize');
      }
      return;
    }

    // Normal flow
    if (!isValidTeamCount()) {
      if (data.format === 'double_elimination') {
        alert('Thể thức nhánh thắng - thua yêu cầu ít nhất 4 đội và số đội phải là lũy thừa của 2 (4, 8, 16 hoặc 32 đội).');
      } else if (data.format === 'league' || data.format === 'battle_royale') {
        alert('Thể thức Giải đấu yêu cầu ít nhất 2 đội.');
      } else {
        alert('Thể thức loại trực tiếp yêu cầu ít nhất 2 đội và số đội phải là lũy thừa của 2 (2, 4, 8, 16 hoặc 32 đội).');
      }
      return;
    }
    router.push('/tournaments/create/members');
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
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-16">
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
          <button className="text-[#22c55e] whitespace-nowrap">Danh sách đội</button>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-white/40 whitespace-nowrap">Thành viên</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>

          <span className="text-white/40 whitespace-nowrap">Quản lý đội</span>
          {data.sport !== 'battle_royale' && data.format !== 'league' && (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                <path d="M6 2L10 8L6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-white/40 whitespace-nowrap">Sắp xếp & Tạo đội</span>
            </>
          )}

        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-1">Danh sách đội</h1>
          <p className="text-white/60">Quản lý hoặc mở cho các đội đăng ký tự do</p>
        </div>

        {/* Self-registration Toggle */}
        <div className="mb-8 p-6 rounded-2xl bg-[#0f1419] border border-white/[0.06] flex items-center justify-between shadow-lg">
          <div>
            <h3 className="font-semibold text-white mb-1">Cho phép các đội tự đăng ký trực tuyến</h3>
            <p className="text-xs text-white/50">Người tham gia sẽ tự điền tên đội và thành viên qua trang Live, thay vì admin phải nhập tay</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsPublicReg(!isPublicReg);
            }}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${isPublicReg ? 'bg-[#22c55e]' : 'bg-white/[0.1]'
              }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${isPublicReg ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
          </button>
        </div>

        {isPublicReg && (
          <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0b0f15] mb-6 flex items-start gap-3 shadow-lg">
            <div className="w-8 h-8 rounded-full bg-[#22c55e]/15 text-[#22c55e] flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-xs text-white">Chế độ tự đăng ký đang bật</h4>
              <p className="text-[11px] text-white/50 leading-relaxed mt-0.5">
                Người tham gia có thể đăng ký trực tuyến qua trang Live. Tuy nhiên, bạn vẫn có thể thêm trước các đội đặc cách hoặc đội hạt giống thủ công dưới đây.
              </p>
            </div>
          </div>
        )}

        {/* Teams Grid */}
        <div className="space-y-3 mb-8">
          {data.teams.map((team, idx) => (
            <div
              key={team.id}
              className="flex items-center justify-between p-4 rounded-lg bg-[#0f1419] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 group"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="text-white/40 font-semibold flex-shrink-0">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{team.name}</h3>
                  <p className="text-sm text-white/50">{team.members.length} thành viên</p>
                </div>
              </div>
              <button
                onClick={() => removeTeam(team.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M15 5L5 15M5 5L15 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add Team Form */}
        {showForm ? (
          <div className="p-4 rounded-lg bg-[#0f1419] border border-white/[0.06] mb-8">
            <label className="block text-sm font-semibold mb-2">Tên đội</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                if (errors.teamName) setErrors({ ...errors, teamName: '' });
              }}
              placeholder="VD: Team A, FC Barcelona..."
              className={`w-full px-4 py-3 rounded-lg bg-[#080b10] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none mb-3 ${errors.teamName ? 'border-red-500' : 'border-white/[0.06] focus:border-[#22c55e]'
                }`}
              autoFocus
            />
            {errors.teamName && <p className="text-red-500 text-sm mb-3">{errors.teamName}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowForm(false);
                  setTeamName('');
                  setErrors({});
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200"
              >
                Hủy
              </button>
              <button
                onClick={handleAddTeam}
                className="flex-1 px-4 py-2 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
              >
                Thêm đội
              </button>
            </div>
          </div>
        ) : (

          <button
            onClick={() => setShowForm(true)}
            disabled={data.teams.length >= maxTeams}
            className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-white/[0.06] text-white font-semibold hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
          >
            + Thêm đội
          </button>
        )}

        {/* Invalid team count warning */}
        {!isPublicReg && !isValidTeamCount() && data.teams.length > 0 && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm mb-6 flex items-start gap-2.5">
            <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="font-semibold mb-0.5">Số lượng đội không hợp lệ</div>
              {data.format === 'double_elimination'
                ? `Thể thức nhánh thắng - thua yêu cầu số lượng đội là lũy thừa của 2 và tối thiểu 4 đội (4, 8, 16 hoặc 32 đội). Hiện tại có ${data.teams.length} đội.`
                : (data.format === 'league' || data.format === 'battle_royale')
                  ? `Thể thức Giải đấu Sinh tồn / League yêu cầu tối thiểu 2 đội. Hiện tại có ${data.teams.length} đội.`
                  : `Thể thức loại trực tiếp yêu cầu số lượng đội phải là lũy thừa của 2 (2, 4, 8, 16 hoặc 32 đội). Hiện tại có ${data.teams.length} đội.`
              }
            </div>
          </div>

        )}

        {/* CTA Buttons */}
        <div className="flex gap-4">
          <Link
            href="/tournaments/create/info"
            className="flex-1 px-6 py-3 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200 text-center"
          >
            Quay lại
          </Link>
          <button
            onClick={handleContinue}
            disabled={!isPublicReg && !isValidTeamCount()}
            className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tiếp tục
          </button>
        </div>
      </section>
    </main>
  );
}
