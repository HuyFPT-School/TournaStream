'use client';

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTournament, Member } from '@/app/contexts/TournamentContext';
import { useState, useRef } from 'react';

const positions = [
  'Cầu thủ',
  'Đội trưởng',
  'Thủ môn',
  'Huấn luyện viên',
  'Dự bị',
];

export default function MemberDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { data, addMember, updateMember } = useTournament();
  const teamId = params.teamId as string;
  const memberId = params.memberId as string;

  const team = data.teams.find(t => t.id === teamId);
  const existingMember = team?.members.find(m => m.id === memberId);

  const [name, setName] = useState(existingMember?.name || '');
  const [position, setPosition] = useState(existingMember?.position || 'Cầu thủ');
  const [image, setImage] = useState<string | null>(existingMember?.image || null);
  const [imagePreview, setImagePreview] = useState<string | null>(existingMember?.image || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImage(dataUrl);
        setImagePreview(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Vui lòng nhập tên thành viên';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const memberData: Member = {
        id: existingMember?.id || Date.now().toString(),
        name,
        position,
        image: image || undefined,
      };

      if (existingMember) {
        updateMember(teamId, memberId, memberData);
      } else {
        addMember(teamId, memberData);
      }

      router.back();
    }
  };

  if (!team) {
    return (
      <main className="min-h-screen bg-[#080b10] text-white font-sans flex items-center justify-center">
        <p>Đội không tồn tại</p>
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
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-1">
            {existingMember ? 'Chỉnh sửa' : 'Thêm'} thành viên
          </h1>
          <p className="text-white/60">Đội: {team.name}</p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold mb-3">Ảnh thành viên</label>
            <div className="flex gap-6 items-start">
              {/* Preview */}
              <div className="flex-shrink-0">
                {imagePreview ? (
                  <div className="relative w-32 h-32">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full rounded-lg object-cover"
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all duration-200"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-lg bg-[#0f1419] border-2 border-dashed border-white/[0.06] flex items-center justify-center">
                    <span className="text-4xl">📸</span>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-white/[0.06] text-white font-semibold hover:border-white/[0.12] transition-all duration-200 mb-3"
                >
                  Chọn ảnh
                </button>
                <p className="text-sm text-white/50">
                  Định dạng: JPG, PNG, GIF. Kích thước tối đa: 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Member Name */}
          <div>
            <label className="block text-sm font-semibold mb-2">Tên thành viên</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              placeholder="VD: Nguyễn Văn A"
              className={`w-full px-4 py-3 rounded-lg bg-[#0f1419] border transition-all duration-200 text-white placeholder-white/30 focus:outline-none ${
                errors.name ? 'border-red-500' : 'border-white/[0.06] focus:border-[#22c55e]'
              }`}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-semibold mb-2">Vị trí</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#0f1419] border border-white/[0.06] text-white focus:outline-none focus:border-[#22c55e] transition-all duration-200"
            >
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4 mt-12">
          <button
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 rounded-lg border border-white/[0.06] text-white font-semibold hover:bg-white/[0.05] transition-all duration-200"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 rounded-lg bg-[#22c55e] text-[#080b10] font-semibold hover:bg-[#16a34a] transition-all duration-200"
          >
            {existingMember ? 'Cập nhật' : 'Thêm'} thành viên
          </button>
        </div>
      </section>
    </main>
  );
}
