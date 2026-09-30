import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  UserCheck,
  Clock,
  ShieldCheck,
  Search,
  CheckCircle2,
  X,
  Cpu,
  Wrench,
  PackageCheck
} from 'lucide-react';

export type ToastType =
  | 'IOT_ALERT'
  | 'AI_AGENT'
  | 'DISPATCH'
  | 'LOTO'
  | 'INSPECTION'
  | 'REPAIR_COMPLETE'
  | 'DOWNTIME_RESOLVED'
  | 'INFO';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  subtitle?: string;
  message: string;
  metaBadge?: string;
  metaDetails?: Array<{ label: string; value: string }>;
  timestamp: string;
  durationMs?: number;
}

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const TYPE_CONFIG: Record<
  ToastType,
  {
    badge: string;
    badgeBg: string;
    badgeText: string;
    border: string;
    glow: string;
    icon: React.ReactNode;
    progressBarBg: string;
  }
> = {
  IOT_ALERT: {
    badge: 'IOT EDGE ALERT',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-400',
    border: 'border-red-500/40',
    glow: 'shadow-[0_8px_30px_rgba(239,68,68,0.25)]',
    icon: <AlertTriangle className="text-red-400 animate-pulse" size={18} />,
    progressBarBg: 'bg-red-500'
  },
  AI_AGENT: {
    badge: 'AI ORCHESTRATOR TRIGGERED',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
    border: 'border-purple-500/40',
    glow: 'shadow-[0_8px_30px_rgba(168,85,247,0.25)]',
    icon: <Bot className="text-purple-400" size={18} />,
    progressBarBg: 'bg-purple-500'
  },
  DISPATCH: {
    badge: 'TECHNICIAN ASSIGNED & DISPATCHED',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    border: 'border-blue-500/40',
    glow: 'shadow-[0_8px_30px_rgba(59,130,246,0.25)]',
    icon: <UserCheck className="text-blue-400" size={18} />,
    progressBarBg: 'bg-blue-500'
  },
  LOTO: {
    badge: 'OSHA 1910.147 LOTO APPLIED',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    border: 'border-amber-500/40',
    glow: 'shadow-[0_8px_30px_rgba(245,158,11,0.25)]',
    icon: <ShieldCheck className="text-amber-400" size={18} />,
    progressBarBg: 'bg-amber-500'
  },
  INSPECTION: {
    badge: 'PHYSICAL INSPECTION & ATP ALLOCATED',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-300',
    border: 'border-cyan-500/40',
    glow: 'shadow-[0_8px_30px_rgba(6,182,212,0.25)]',
    icon: <Search className="text-cyan-400" size={18} />,
    progressBarBg: 'bg-cyan-500'
  },
  REPAIR_COMPLETE: {
    badge: 'REPAIR COMPLETE — IOT VERIFYING',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-300',
    border: 'border-indigo-500/40',
    glow: 'shadow-[0_8px_30px_rgba(99,102,241,0.25)]',
    icon: <Wrench className="text-indigo-400" size={18} />,
    progressBarBg: 'bg-indigo-500'
  },
  DOWNTIME_RESOLVED: {
    badge: 'MACHINE RUNNING & DOWNTIME LOGGED',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400',
    border: 'border-emerald-500/40',
    glow: 'shadow-[0_8px_30px_rgba(16,185,129,0.25)]',
    icon: <CheckCircle2 className="text-emerald-400" size={18} />,
    progressBarBg: 'bg-emerald-500'
  },
  INFO: {
    badge: 'SYSTEM NOTIFICATION',
    badgeBg: 'bg-slate-500/20',
    badgeText: 'text-slate-300',
    border: 'border-slate-500/40',
    glow: 'shadow-[0_8px_30px_rgba(100,116,139,0.2)]',
    icon: <Cpu className="text-slate-400" size={18} />,
    progressBarBg: 'bg-slate-500'
  }
};

const ToastCard: React.FC<{
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const duration = toast.durationMs || 6500;
  const [progress, setProgress] = useState(100);
  const cfg = TYPE_CONFIG[toast.type] || TYPE_CONFIG.INFO;
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismissRef.current(toast.id);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [toast.id, duration]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border ${cfg.border} bg-[#0F172A]/95 backdrop-blur-md p-4 text-white ${cfg.glow} transition-all duration-300 transform translate-x-0 pointer-events-auto hover:scale-[1.01]`}
      style={{
        animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-white/5 border border-white/10">
            {cfg.icon}
          </div>
          <span
            className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText} border border-white/10`}
          >
            {cfg.badge}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
            <Clock size={11} />
            {toast.timestamp}
          </span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="mb-1.5">
        <h4 className="text-sm font-bold text-white tracking-tight flex items-center justify-between">
          <span>{toast.title}</span>
          {toast.metaBadge && (
            <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded font-mono font-medium">
              {toast.metaBadge}
            </span>
          )}
        </h4>
        {toast.subtitle && (
          <p className="text-xs font-semibold text-slate-300 mt-0.5">{toast.subtitle}</p>
        )}
      </div>

      {/* Message Body */}
      <p className="text-xs text-slate-300/90 leading-relaxed">{toast.message}</p>

      {/* Metadata Pills */}
      {toast.metaDetails && toast.metaDetails.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-2">
          {toast.metaDetails.map((meta, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded text-[11px] border border-white/5"
            >
              <span className="text-slate-400 font-medium">{meta.label}:</span>
              <span className="text-white font-semibold font-mono">{meta.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Auto-Dismiss Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
        <div
          className={`h-full ${cfg.progressBarBg} transition-all duration-75`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const ToastNotificationContainer: React.FC<ToastNotificationProps> = ({
  toasts,
  onDismiss
}) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside
      aria-label="Real-time notifications"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-[92vw] sm:w-[420px] pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </aside>
  );
};
