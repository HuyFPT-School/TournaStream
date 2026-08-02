'use client';

import { useState } from 'react';

interface FormatGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormat?: string;
}

/* ─── SVG Animated Arrow ─── */
const StepArrow = () => (
  <div className="flex justify-center py-1">
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none" className="text-[#22c55e] animate-bounce" style={{ animationDuration: '2s' }}>
      <path d="M12 2v20M12 22l-6-6M12 22l6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

/* ─── Step Card ─── */
const StepCard = ({ number, title, description, highlight }: { number: number; title: string; description: string; highlight?: boolean }) => (
  <div className={`flex items-start gap-3 p-3 rounded-lg transition-all ${highlight ? 'bg-[#22c55e]/10 border border-[#22c55e]/30' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${highlight ? 'bg-[#22c55e] text-[#080b10]' : 'bg-white/10 text-white/70'}`}>
      {number}
    </div>
    <div>
      <div className={`text-sm font-semibold mb-0.5 ${highlight ? 'text-[#22c55e]' : 'text-white/90'}`}>{title}</div>
      <div className="text-xs text-white/50 leading-relaxed">{description}</div>
    </div>
  </div>
);

/* ─── Single Elimination SVG Flow ─── */
const SingleEliminationDiagram = () => (
  <svg viewBox="0 0 400 200" className="w-full h-auto" fill="none">
    {/* Round 1 */}
    <rect x="10" y="10" width="80" height="28" rx="6" fill="#1a2332" stroke="#22c55e" strokeWidth="1.5" />
    <text x="50" y="28" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="bold">Đội A</text>
    <rect x="10" y="48" width="80" height="28" rx="6" fill="#1a2332" stroke="#ffffff20" strokeWidth="1" />
    <text x="50" y="66" textAnchor="middle" fill="#ffffff80" fontSize="10">Đội B</text>
    <rect x="10" y="120" width="80" height="28" rx="6" fill="#1a2332" stroke="#22c55e" strokeWidth="1.5" />
    <text x="50" y="138" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="bold">Đội C</text>
    <rect x="10" y="158" width="80" height="28" rx="6" fill="#1a2332" stroke="#ffffff20" strokeWidth="1" />
    <text x="50" y="176" textAnchor="middle" fill="#ffffff80" fontSize="10">Đội D</text>

    {/* Connector lines R1 -> R2 */}
    <path d="M90 24 L130 24 L130 80 L160 80" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 2">
      <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
    </path>
    <path d="M90 62 L120 62 L120 80 L130 80" stroke="#ffffff30" strokeWidth="1" />
    <path d="M90 134 L130 134 L130 100 L160 100" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 2">
      <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
    </path>
    <path d="M90 172 L120 172 L120 100 L130 100" stroke="#ffffff30" strokeWidth="1" />

    {/* Semi-final */}
    <rect x="160" y="65" width="90" height="28" rx="6" fill="#1a2332" stroke="#22c55e" strokeWidth="1.5" />
    <text x="205" y="83" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="bold">Bán kết</text>
    <rect x="160" y="105" width="90" height="28" rx="6" fill="#1a2332" stroke="#ffffff20" strokeWidth="1" />
    <text x="205" y="123" textAnchor="middle" fill="#ffffff80" fontSize="10">Bán kết</text>

    {/* Connector lines R2 -> Final */}
    <path d="M250 80 L280 80 L280 95 L310 95" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 2">
      <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
    </path>

    {/* Final */}
    <rect x="310" y="80" width="80" height="32" rx="8" fill="#22c55e20" stroke="#22c55e" strokeWidth="2" />
    <text x="350" y="100" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="bold">Chung kết</text>

    {/* Trophy */}
    <text x="350" y="130" textAnchor="middle" fill="#fbbf24" fontSize="10" fontWeight="bold">VÔ ĐỊCH</text>

    {/* Labels */}
    <text x="50" y="198" textAnchor="middle" fill="#ffffff40" fontSize="8">Vòng 1</text>
    <text x="205" y="198" textAnchor="middle" fill="#ffffff40" fontSize="8">Bán kết</text>
    <text x="350" y="198" textAnchor="middle" fill="#ffffff40" fontSize="8">Chung kết</text>

    {/* X mark on losers */}
    <g opacity="0.4">
      <line x1="30" y1="52" x2="42" y2="72" stroke="#ef4444" strokeWidth="1.5" />
      <line x1="42" y1="52" x2="30" y2="72" stroke="#ef4444" strokeWidth="1.5" />
      <text x="56" y="85" fill="#ef4444" fontSize="7">Loại</text>
    </g>
  </svg>
);

/* ─── Double Elimination SVG Flow ─── */
const DoubleEliminationDiagram = () => (
  <svg viewBox="0 0 440 240" className="w-full h-auto" fill="none">
    {/* Upper Bracket Label */}
    <rect x="5" y="5" width="430" height="90" rx="8" fill="#22c55e08" stroke="#22c55e30" strokeWidth="1" strokeDasharray="4 2" />
    <text x="20" y="22" fill="#22c55e" fontSize="9" fontWeight="bold">NHÁNH THẮNG (Upper Bracket)</text>

    {/* Upper R1 */}
    <rect x="20" y="35" width="70" height="22" rx="5" fill="#1a2332" stroke="#22c55e" strokeWidth="1.5" />
    <text x="55" y="50" textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="bold">Đội A</text>
    <rect x="20" y="62" width="70" height="22" rx="5" fill="#1a2332" stroke="#22c55e" strokeWidth="1.5" />
    <text x="55" y="77" textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="bold">Đội B</text>

    {/* Upper R2 */}
    <path d="M90 46 L120 46 L120 55 L140 55" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 2">
      <animate attributeName="stroke-dashoffset" values="5;0" dur="1.5s" repeatCount="indefinite" />
    </path>
    <path d="M90 73 L120 73 L120 55 L140 55" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 2">
      <animate attributeName="stroke-dashoffset" values="5;0" dur="1.5s" repeatCount="indefinite" />
    </path>
    <rect x="140" y="42" width="80" height="26" rx="5" fill="#1a2332" stroke="#22c55e" strokeWidth="1.5" />
    <text x="180" y="59" textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="bold">Thắng Upper</text>

    {/* Arrow: Upper loser drops down */}
    <path d="M130 73 L130 140" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7">
      <animate attributeName="stroke-dashoffset" values="7;0" dur="1s" repeatCount="indefinite" />
    </path>
    <text x="115" y="110" fill="#ef4444" fontSize="7" opacity="0.7" transform="rotate(-90, 115, 110)">Thua → Rơi xuống</text>

    {/* Grand Final connection */}
    <path d="M220 55 L300 55 L300 125 L340 125" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 2">
      <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
    </path>

    {/* Lower Bracket */}
    <rect x="5" y="115" width="320" height="70" rx="8" fill="#ef444408" stroke="#ef444430" strokeWidth="1" strokeDasharray="4 2" />
    <text x="20" y="132" fill="#ef4444" fontSize="9" fontWeight="bold">NHÁNH THUA (Lower Bracket)</text>

    {/* Lower R1 */}
    <rect x="20" y="145" width="80" height="26" rx="5" fill="#1a2332" stroke="#ef4444" strokeWidth="1" opacity="0.8" />
    <text x="60" y="162" textAnchor="middle" fill="#ef4444" fontSize="8">Thua từ Upper</text>

    {/* Lower R2 */}
    <path d="M100 158 L140 158" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2">
      <animate attributeName="stroke-dashoffset" values="5;0" dur="1.5s" repeatCount="indefinite" />
    </path>
    <rect x="140" y="145" width="80" height="26" rx="5" fill="#1a2332" stroke="#fbbf24" strokeWidth="1.5" />
    <text x="180" y="162" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold">Thắng Lower</text>

    {/* Lower loser = eliminated */}
    <path d="M160 175 L160 195" stroke="#ef4444" strokeWidth="1" opacity="0.5" />
    <text x="160" y="210" textAnchor="middle" fill="#ef4444" fontSize="8" opacity="0.6">BỊ LOẠI</text>

    {/* Lower winner to Grand Final */}
    <path d="M220 158 L300 158 L300 140 L340 140" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 2">
      <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
    </path>

    {/* Grand Final */}
    <rect x="340" y="110" width="90" height="40" rx="8" fill="#22c55e15" stroke="#22c55e" strokeWidth="2" />
    <text x="385" y="128" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="bold">CHUNG KẾT</text>
    <text x="385" y="142" textAnchor="middle" fill="#22c55e" fontSize="7">TỔNG</text>

    {/* Trophy */}
    <text x="385" y="170" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="bold">VÔ ĐỊCH</text>

    {/* Bracket Reset note */}
    <text x="385" y="195" textAnchor="middle" fill="#ffffff30" fontSize="7">* Nếu Nhánh Thua thắng</text>
    <text x="385" y="205" textAnchor="middle" fill="#ffffff30" fontSize="7">→ Đấu thêm 1 trận quyết định</text>
  </svg>
);

/* ─── Round Robin SVG Flow ─── */
const RoundRobinDiagram = () => (
  <svg viewBox="0 0 440 230" className="w-full h-auto" fill="none">
    {/* Group Stage Area */}
    <rect x="5" y="5" width="200" height="140" rx="8" fill="#3b82f620" stroke="#3b82f650" strokeWidth="1" strokeDasharray="4 2" />
    <text x="105" y="22" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">VÒNG BẢNG (Group Stage)</text>

    {/* Group A */}
    <rect x="15" y="30" width="85" height="105" rx="6" fill="#1a2332" stroke="#3b82f640" strokeWidth="1" />
    <text x="57" y="45" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">Bảng A</text>
    <text x="57" y="60" textAnchor="middle" fill="#ffffff70" fontSize="7">Đội 1 vs Đội 2</text>
    <text x="57" y="72" textAnchor="middle" fill="#ffffff70" fontSize="7">Đội 1 vs Đội 3</text>
    <text x="57" y="84" textAnchor="middle" fill="#ffffff70" fontSize="7">Đội 2 vs Đội 3</text>
    <line x1="25" y1="95" x2="90" y2="95" stroke="#ffffff15" strokeWidth="1" />
    <text x="57" y="108" textAnchor="middle" fill="#22c55e" fontSize="7" fontWeight="bold">Top 1, Top 2</text>
    <text x="57" y="120" textAnchor="middle" fill="#22c55e" fontSize="7">→ Đi tiếp</text>
    <text x="57" y="132" textAnchor="middle" fill="#ef4444" fontSize="6" opacity="0.6">Top 3: Loại</text>

    {/* Group B */}
    <rect x="110" y="30" width="85" height="105" rx="6" fill="#1a2332" stroke="#3b82f640" strokeWidth="1" />
    <text x="152" y="45" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">Bảng B</text>
    <text x="152" y="60" textAnchor="middle" fill="#ffffff70" fontSize="7">Đội 4 vs Đội 5</text>
    <text x="152" y="72" textAnchor="middle" fill="#ffffff70" fontSize="7">Đội 4 vs Đội 6</text>
    <text x="152" y="84" textAnchor="middle" fill="#ffffff70" fontSize="7">Đội 5 vs Đội 6</text>
    <line x1="120" y1="95" x2="185" y2="95" stroke="#ffffff15" strokeWidth="1" />
    <text x="152" y="108" textAnchor="middle" fill="#22c55e" fontSize="7" fontWeight="bold">Top 1, Top 2</text>
    <text x="152" y="120" textAnchor="middle" fill="#22c55e" fontSize="7">→ Đi tiếp</text>
    <text x="152" y="132" textAnchor="middle" fill="#ef4444" fontSize="6" opacity="0.6">Top 3: Loại</text>

    {/* Arrow Group -> Knockout */}
    <path d="M205 75 L240 75" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 2">
      <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
    </path>
    <polygon points="238,70 248,75 238,80" fill="#22c55e" opacity="0.8">
      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
    </polygon>

    {/* Knockout Stage Area */}
    <rect x="250" y="5" width="185" height="140" rx="8" fill="#22c55e08" stroke="#22c55e30" strokeWidth="1" strokeDasharray="4 2" />
    <text x="342" y="22" textAnchor="middle" fill="#22c55e" fontSize="9" fontWeight="bold">VÒNG KNOCKOUT</text>

    {/* Semi-finals */}
    <rect x="265" y="35" width="70" height="22" rx="5" fill="#1a2332" stroke="#22c55e" strokeWidth="1.5" />
    <text x="300" y="50" textAnchor="middle" fill="#22c55e" fontSize="7" fontWeight="bold">A1 vs B2</text>
    <rect x="265" y="65" width="70" height="22" rx="5" fill="#1a2332" stroke="#22c55e" strokeWidth="1.5" />
    <text x="300" y="80" textAnchor="middle" fill="#22c55e" fontSize="7" fontWeight="bold">B1 vs A2</text>

    {/* Connector to Final */}
    <path d="M335 46 L360 46 L360 65 L375 65" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 2">
      <animate attributeName="stroke-dashoffset" values="5;0" dur="1.5s" repeatCount="indefinite" />
    </path>
    <path d="M335 76 L360 76 L360 65 L375 65" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 2">
      <animate attributeName="stroke-dashoffset" values="5;0" dur="1.5s" repeatCount="indefinite" />
    </path>

    {/* Final */}
    <rect x="375" y="50" width="50" height="30" rx="6" fill="#22c55e20" stroke="#22c55e" strokeWidth="2" />
    <text x="400" y="69" textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="bold">CK</text>

    {/* Trophy */}
    <text x="400" y="100" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold">VÔ ĐỊCH</text>

    {/* Points Scoring Guide */}
    <rect x="5" y="155" width="430" height="68" rx="8" fill="#fbbf2408" stroke="#fbbf2430" strokeWidth="1" strokeDasharray="4 2" />
    <text x="20" y="172" fill="#fbbf24" fontSize="9" fontWeight="bold">CÁCH TÍNH ĐIỂM VÒNG BẢNG</text>

    <rect x="20" y="180" width="60" height="20" rx="4" fill="#22c55e20" stroke="#22c55e50" strokeWidth="1" />
    <text x="50" y="194" textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="bold">Thắng: 3đ</text>

    <rect x="90" y="180" width="60" height="20" rx="4" fill="#3b82f620" stroke="#3b82f650" strokeWidth="1" />
    <text x="120" y="194" textAnchor="middle" fill="#3b82f6" fontSize="8" fontWeight="bold">Hòa: 1đ</text>

    <rect x="160" y="180" width="60" height="20" rx="4" fill="#ef444420" stroke="#ef444450" strokeWidth="1" />
    <text x="190" y="194" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold">Thua: 0đ</text>

    <text x="240" y="194" fill="#ffffff50" fontSize="7">Xếp hạng: Điểm → Hiệu số → Bàn thắng</text>

    {/* Labels */}
    <text x="105" y="220" textAnchor="middle" fill="#ffffff30" fontSize="8">Giai đoạn 1</text>
    <text x="342" y="220" textAnchor="middle" fill="#ffffff30" fontSize="8">Giai đoạn 2</text>
  </svg>
);

/* ─── Battle Royale SVG Flow ─── */
const BattleRoyaleDiagram = () => (
  <svg viewBox="0 0 440 180" className="w-full h-auto" fill="none">
    {/* Match boxes */}
    <rect x="10" y="10" width="90" height="55" rx="8" fill="#1a2332" stroke="#8b5cf6" strokeWidth="1.5" />
    <text x="55" y="30" textAnchor="middle" fill="#8b5cf6" fontSize="9" fontWeight="bold">Trận 1</text>
    <text x="55" y="45" textAnchor="middle" fill="#ffffff50" fontSize="7">Tất cả đội</text>
    <text x="55" y="57" textAnchor="middle" fill="#ffffff50" fontSize="7">cùng thi đấu</text>

    <path d="M100 38 L130 38" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 2">
      <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
    </path>

    <rect x="130" y="10" width="90" height="55" rx="8" fill="#1a2332" stroke="#8b5cf6" strokeWidth="1.5" />
    <text x="175" y="30" textAnchor="middle" fill="#8b5cf6" fontSize="9" fontWeight="bold">Trận 2</text>
    <text x="175" y="45" textAnchor="middle" fill="#ffffff50" fontSize="7">Tất cả đội</text>
    <text x="175" y="57" textAnchor="middle" fill="#ffffff50" fontSize="7">cùng thi đấu</text>

    <path d="M220 38 L250 38" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 2">
      <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
    </path>

    <text x="265" y="42" fill="#ffffff40" fontSize="14">...</text>

    <path d="M280 38 L310 38" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 2">
      <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
    </path>

    <rect x="310" y="10" width="90" height="55" rx="8" fill="#1a2332" stroke="#8b5cf6" strokeWidth="1.5" />
    <text x="355" y="30" textAnchor="middle" fill="#8b5cf6" fontSize="9" fontWeight="bold">Trận N</text>
    <text x="355" y="45" textAnchor="middle" fill="#ffffff50" fontSize="7">Trận cuối</text>
    <text x="355" y="57" textAnchor="middle" fill="#ffffff50" fontSize="7">cùng</text>

    {/* Arrow down to leaderboard */}
    <path d="M220 65 L220 85" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 2">
      <animate attributeName="stroke-dashoffset" values="6;0" dur="1.5s" repeatCount="indefinite" />
    </path>
    <polygon points="215,83 220,93 225,83" fill="#fbbf24" opacity="0.8">
      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
    </polygon>

    {/* Leaderboard */}
    <rect x="60" y="95" width="320" height="75" rx="8" fill="#fbbf2408" stroke="#fbbf2430" strokeWidth="1" />
    <text x="220" y="112" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="bold">BẢNG XẾP HẠNG TỔNG (Tích lũy qua các trận)</text>

    <text x="100" y="132" textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="bold">Điểm Thứ Hạng</text>
    <text x="100" y="145" textAnchor="middle" fill="#ffffff50" fontSize="7">Top 1: 10đ, Top 2: 6đ</text>
    <text x="100" y="157" textAnchor="middle" fill="#ffffff50" fontSize="7">Top 3: 5đ, ...</text>

    <text x="220" y="140" textAnchor="middle" fill="#ffffff30" fontSize="16">+</text>

    <text x="310" y="132" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold">Điểm Hạ Gục</text>
    <text x="310" y="145" textAnchor="middle" fill="#ffffff50" fontSize="7">Mỗi kill = +1 điểm</text>

    <text x="220" y="165" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold">Tổng điểm cao nhất = VÔ ĐỊCH</text>
  </svg>
);

/* ─── Format Data ─── */
const FORMAT_GUIDES = [
  {
    id: 'single_elimination',
    name: 'Loại Trực Tiếp',
    nameEn: 'Single Elimination',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v5m-3 0h6M4 7h16M4 7a3 3 0 003 3h10a3 3 0 003-3M4 7V4a1 1 0 011-1h14a1 1 0 011 1v3M4 7a4 4 0 004 4h8a4 4 0 004-4" />
      </svg>
    ),
    color: '#22c55e',
    diagram: <SingleEliminationDiagram />,
    steps: [
      { title: 'Xếp cặp đấu', description: 'Các đội được xếp cặp ngẫu nhiên hoặc theo thứ hạng hạt giống' },
      { title: 'Thi đấu từng vòng', description: 'Đội thắng đi tiếp vào vòng trong, đội thua bị LOẠI ngay lập tức' },
      { title: 'Bán kết → Chung kết', description: 'Tiếp tục cho đến khi chỉ còn 2 đội tranh chung kết' },
      { title: 'Xác định nhà vô địch', description: 'Đội thắng trận chung kết giành chức vô địch!' },
    ],
    tip: 'Phù hợp cho giải đấu có nhiều đội, thời gian tổ chức ngắn và cần sự kịch tính cao.',
    warning: 'Đội thua chỉ được thi đấu 1 trận duy nhất rồi bị loại.',
  },
  {
    id: 'double_elimination',
    name: 'Nhánh Thắng - Nhánh Thua',
    nameEn: 'Double Elimination',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m-7-5h3m-3 4h3m-6 2a9 9 0 1118 0v1.5a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 14.5V13z" />
      </svg>
    ),
    color: '#8b5cf6',
    diagram: <DoubleEliminationDiagram />,
    steps: [
      { title: 'Bắt đầu ở Nhánh Thắng', description: 'Tất cả đội bắt đầu thi đấu ở Nhánh Thắng (Upper Bracket)' },
      { title: 'Thua → Rơi xuống Nhánh Thua', description: 'Đội thua ở Nhánh Thắng sẽ rơi xuống Nhánh Thua để có cơ hội thứ 2' },
      { title: 'Thua ở Nhánh Thua → Loại', description: 'Nếu thua tiếp ở Nhánh Thua thì mới chính thức bị loại' },
      { title: 'Chung Kết Tổng', description: 'Đội cuối cùng của Nhánh Thắng gặp đội cuối của Nhánh Thua' },
      { title: 'Bracket Reset (nếu có)', description: 'Nếu đội Nhánh Thua thắng Chung Kết, phải đấu thêm 1 trận quyết định' },
    ],
    tip: 'Thể thức tiêu chuẩn của Esport chuyên nghiệp, đảm bảo tính công bằng tối đa.',
    warning: 'Số trận đấu nhiều hơn, cần thời gian tổ chức dài hơn.',
  },
  {
    id: 'round_robin',
    name: 'Vòng Bảng & Knockout',
    nameEn: 'Round Robin + Knockout',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: '#3b82f6',
    diagram: <RoundRobinDiagram />,
    steps: [
      { title: 'Chia bảng đấu', description: 'Các đội được chia thành nhiều bảng (A, B, C...) theo hạt giống' },
      { title: 'Đấu vòng tròn', description: 'Mỗi đội đấu với TẤT CẢ đội khác trong cùng bảng' },
      { title: 'Tính điểm xếp hạng', description: 'Thắng +3đ, Hòa +1đ, Thua 0đ. Xếp hạng theo Điểm → Hiệu số → Bàn thắng' },
      { title: 'Top đội đi tiếp', description: 'Top 1-2 mỗi bảng (tùy cấu hình) tiến vào vòng Knockout' },
      { title: 'Knockout → Chung kết', description: 'Vòng Knockout = Loại trực tiếp cho đến khi tìm ra nhà vô địch' },
    ],
    tip: 'Giúp các đội có cơ hội cọ xát tối thiểu 2-3 trận tại vòng bảng trước khi bước vào các trận sinh tử.',
    warning: 'Cần tối thiểu 4 đội (2 đội/bảng × 2 bảng) cho thể thức này.',
  },
  {
    id: 'battle_royale',
    name: 'Giải Sinh Tồn',
    nameEn: 'Battle Royale / PUBG',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    color: '#8b5cf6',
    diagram: <BattleRoyaleDiagram />,
    steps: [
      { title: 'Nhiều đội cùng đấu', description: 'Tất cả đội tham gia cùng một trận đấu đồng thời (ví dụ: PUBG 16 đội)' },
      { title: 'Ghi nhận kết quả', description: 'Sau mỗi trận: ghi nhận Thứ hạng (Placement) và Số lượt hạ gục (Kills)' },
      { title: 'Tính điểm tích lũy', description: 'Điểm Thứ Hạng + Điểm Kill được cộng dồn qua nhiều trận' },
      { title: 'Xác định vô địch', description: 'Sau tất cả trận đấu, đội có tổng điểm cao nhất là nhà vô địch!' },
    ],
    tip: 'Phù hợp cho các game Battle Royale như PUBG, Free Fire, Fortnite...',
    warning: 'Điểm thứ hạng tiêu chuẩn: Top 1 (10đ), Top 2 (6đ), Top 3 (5đ)... Mỗi kill +1đ.',
  },
];

/* ─── Main Modal Component ─── */
export default function FormatGuideModal({ isOpen, onClose, initialFormat }: FormatGuideModalProps) {
  const [activeTab, setActiveTab] = useState(initialFormat || 'single_elimination');

  if (!isOpen) return null;

  const guide = FORMAT_GUIDES.find(g => g.id === activeTab) || FORMAT_GUIDES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0c1118] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 flex-shrink-0">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Hướng dẫn thể thức thi đấu
          </h3>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/70 hover:bg-white/5 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-1 px-4 py-3 border-b border-white/[0.06] overflow-x-auto flex-shrink-0">
          {FORMAT_GUIDES.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveTab(f.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                activeTab === f.id
                  ? 'text-white shadow-lg'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
              style={activeTab === f.id ? { backgroundColor: `${f.color}20`, color: f.color, boxShadow: `0 0 12px ${f.color}20` } : {}}
            >
              <span className={activeTab === f.id ? '' : 'opacity-50'}>{f.icon}</span>
              {f.name}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${guide.color}20`, color: guide.color }}>
              {guide.icon}
            </div>
            <div>
              <h4 className="text-base font-black text-white">{guide.name}</h4>
              <p className="text-xs text-white/40">{guide.nameEn}</p>
            </div>
          </div>

          {/* SVG Diagram */}
          <div className="rounded-xl border border-white/[0.06] bg-[#0a0f16] p-4 overflow-hidden">
            <div className="text-[10px] text-white/30 mb-2 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
              </svg>
              SƠ ĐỒ LUỒNG THI ĐẤU
            </div>
            {guide.diagram}
          </div>

          {/* Steps with Arrows */}
          <div>
            <div className="text-xs text-white/40 font-semibold mb-3 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              CÁCH CHƠI TỪNG BƯỚC
            </div>
            <div className="space-y-0">
              {guide.steps.map((step, idx) => (
                <div key={idx}>
                  <StepCard
                    number={idx + 1}
                    title={step.title}
                    description={step.description}
                    highlight={idx === guide.steps.length - 1}
                  />
                  {idx < guide.steps.length - 1 && <StepArrow />}
                </div>
              ))}
            </div>
          </div>

          {/* Tips & Warnings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[#22c55e]/5 border border-[#22c55e]/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-4 h-4 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-xs font-bold text-[#22c55e]">Phù hợp cho</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{guide.tip}</p>
            </div>

            <div className="p-3 rounded-lg bg-[#fbbf24]/5 border border-[#fbbf24]/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-4 h-4 text-[#fbbf24]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-xs font-bold text-[#fbbf24]">Lưu ý</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{guide.warning}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
