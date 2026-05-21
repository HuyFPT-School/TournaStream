"use client";

type ToastKind = "success" | "error";

type ToastProps = {
  kind: ToastKind;
  title?: string;
  message: string;
  visible: boolean;
  onClose: () => void;
};

export function Toast({ kind, title, message, visible, onClose }: ToastProps) {
  const tone =
    kind === "success"
      ? "border-[#22c55e]/40 bg-[#0f1419] text-[#22c55e]"
      : "border-red-500/40 bg-[#140a0f] text-red-400";

  return (
    <div
      className={`fixed top-6 right-6 z-50 min-w-[280px] max-w-[360px] rounded-xl border shadow-xl transition-all duration-300 ${tone} ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2 pointer-events-none"
      }`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-0.5">
          {kind === "success" ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M16.5 6L8.5 14L4 9.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 6V11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M10 15.5H10.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="10"
                cy="10"
                r="8"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          )}
        </div>
        <div className="flex-1">
          {title && (
            <p className="text-sm font-semibold text-white mb-0.5">{title}</p>
          )}
          <p className="text-sm text-white/80 leading-snug">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-white transition-colors"
          aria-label="Đóng thông báo"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M12 4L4 12M4 4L12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
