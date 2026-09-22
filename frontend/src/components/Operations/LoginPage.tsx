import React, { useState } from 'react';
import { 
  Shield, Key, User, CheckCircle2, ArrowRight, Lock, 
  Building2, Cpu, Wrench, Boxes, ShoppingCart, ShieldCheck
} from 'lucide-react';

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarBg: string;
  permissions: string[];
}

export const USER_ROLES: UserProfile[] = [
  {
    id: 'ROLE-01',
    name: 'Priya Patel',
    role: 'Plant Operations Manager',
    email: 'priya.patel@plantops.industrial',
    avatarBg: 'bg-blue-600',
    permissions: ['All Plant Systems', 'Executive Dashboards', 'Policy Approvals', 'ISO/OSHA Certifications']
  },
  {
    id: 'ROLE-02',
    name: 'Arun Kumar',
    role: 'Lead Maintenance Engineer',
    email: 'arun.kumar@plantops.industrial',
    avatarBg: 'bg-teal-700',
    permissions: ['Work Order Dispatch', 'OSHA LOTO Execution', 'Vibration Analysis', 'Emergency Shutdown']
  },
  {
    id: 'ROLE-03',
    name: 'John Miller',
    role: 'Senior CNC Technician',
    email: 'john.miller@plantops.industrial',
    avatarBg: 'bg-amber-600',
    permissions: ['Machine Operations', 'Physical Repair Check', 'LOTO Verification', 'Telemetry Feeds']
  },
  {
    id: 'ROLE-04',
    name: 'Sarah Jenkins',
    role: 'Inventory & Materials Manager',
    email: 'sarah.jenkins@plantops.industrial',
    avatarBg: 'bg-purple-600',
    permissions: ['Spare Parts Register', 'ATP Stock Reservations', 'Bin Allocation', 'Safety Stock Buffers']
  },
  {
    id: 'ROLE-05',
    name: 'David Vance',
    role: 'Autonomous Procurement Officer',
    email: 'david.vance@plantops.industrial',
    avatarBg: 'bg-emerald-600',
    permissions: ['Auto-PO Validation', 'Vendor SLA Audits', 'Spend Cap Authorizations', 'Goods Inward']
  },
  {
    id: 'ROLE-06',
    name: 'System Administrator',
    role: 'Industrial IT / OT Admin',
    email: 'admin@plantops.industrial',
    avatarBg: 'bg-slate-700',
    permissions: ['MQTT Broker Config', 'AI Agent Parameters', 'Audit Log Export', 'Role Management']
  }
];

interface LoginPageProps {
  currentUser: UserProfile;
  onLogin: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ currentUser, onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<UserProfile>(currentUser || USER_ROLES[0]);
  const [email, setEmail] = useState(selectedRole.email);
  const [password, setPassword] = useState('••••••••••••');
  const [loggingIn, setLoggingIn] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const handleSelect = (user: UserProfile) => {
    setSelectedRole(user);
    setEmail(user.email);
    setPassword('••••••••••••');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setTimeout(() => {
      setLoggingIn(false);
      setSuccessMsg(true);
      setTimeout(() => {
        onLogin(selectedRole);
      }, 600);
    }, 500);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: Role Selector */}
        <div className="lg:col-span-7 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shadow-sm">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1E293B]">Role-Based Access Control (RBAC)</h2>
                <p className="text-xs text-[#64748B]">Select an industrial persona to authenticate with authorized scope</p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {USER_ROLES.map((role) => {
                const isSelected = selectedRole.id === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleSelect(role)}
                    className={`w-full p-3.5 rounded-xl text-left border transition-all flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'bg-[#EAE7E0] border-[#2563EB] shadow-sm' 
                        : 'bg-white border-[#DDD9D0] hover:bg-[#F3F1EC]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl ${role.avatarBg} text-white flex items-center justify-center font-bold text-xs flex-shrink-0`}>
                        {role.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#1E293B] truncate">{role.name}</div>
                        <div className="text-xs text-[#0F766E] font-medium truncate">{role.role}</div>
                        <div className="text-[10px] text-[#64748B] font-mono mt-0.5 truncate">{role.email}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-[#2563EB] flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#DDD9D0] flex items-center justify-between text-xs text-[#64748B]">
            <span>Security Standard: ISO 27001 / IEC 62443</span>
            <span className="font-semibold text-[#1E293B]">PlantOps OT Gateway v2.4</span>
          </div>
        </div>

        {/* Right Column: Authentication Form */}
        <div className="lg:col-span-5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-center pb-4 mb-4 border-b border-[#DDD9D0]">
              <div className="w-12 h-12 rounded-2xl bg-[#2563EB] flex items-center justify-center text-white mx-auto shadow-md mb-2.5">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#1E293B]">PLANTOPS Authentication</h3>
              <p className="text-xs text-[#64748B] mt-0.5">Autonomous Factory Operations Center</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1E293B] mb-1.5">Authorized Identity</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-medium focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E293B] mb-1.5">Security Token / Password</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-medium focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#DDD9D0] space-y-1.5">
                <div className="text-[11px] font-bold text-[#1E293B] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0F766E]" />
                  Active Permissions
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedRole.permissions.map((p, i) => (
                    <span key={i} className="text-[10px] bg-[#F3F1EC] text-[#334155] px-2 py-0.5 rounded-md font-medium border border-[#DDD9D0]">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn || successMsg}
                className="w-full mt-2 py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-75"
              >
                {loggingIn ? (
                  <span>Authenticating Session...</span>
                ) : successMsg ? (
                  <span className="flex items-center gap-1.5 text-emerald-100">
                    <CheckCircle2 className="w-4 h-4 text-white" /> Access Granted
                  </span>
                ) : (
                  <>
                    <span>Enter PlantOps Operations</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="text-center text-[11px] text-[#64748B] mt-4 pt-3 border-t border-[#DDD9D0]">
            Role-Based Authorization Active &bull; MFA Verified
          </div>
        </div>

      </div>
    </div>
  );
};
