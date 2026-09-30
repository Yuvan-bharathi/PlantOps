import React, { useState, useEffect, useRef } from 'react';
import {
  Radio, X, Send, AlertTriangle, ShieldCheck, ShoppingCart, 
  Bot, CheckCircle2, ChevronRight, MessageSquare, Zap, Clock,
  DollarSign, Wrench, UserCheck, Flame, RefreshCw, Check
} from 'lucide-react';
import { api, socket } from '../../services/api';
import { UserProfile } from '../Operations/LoginPage';
import { CustomSelect } from '../common/CustomSelect';

export interface IntercomMessage {
  id: string;
  sender_role: string;
  sender_name: string;
  recipient_role: string;
  channel: 'BROADCAST' | 'ESCALATION' | 'SPARE_REQUEST' | 'SAFETY_LOTO' | 'PO_APPROVAL' | 'AI_ASSISTANT';
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL' | 'EMERGENCY';
  title: string;
  message: string;
  metadata?: any;
  status: 'OPEN' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'RESOLVED' | 'ACKNOWLEDGED';
  resolution_note?: string;
  created_at: string;
}

interface PlantIntercomDrawerProps {
  currentUser: UserProfile;
  onAddToast?: (toast: any) => void;
}

export const PlantIntercomDrawer: React.FC<PlantIntercomDrawerProps> = ({
  currentUser,
  onAddToast
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'channel' | 'escalations' | 'quick' | 'copilot'>('channel');
  const [messages, setMessages] = useState<IntercomMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotHistory, setCopilotHistory] = useState<Array<{ role: 'user' | 'ai'; text: string; time: string }>>([
    {
      role: 'ai',
      text: `Hello ${currentUser.name}. I am the PlantOps Industrial AI Copilot. I can assist you with OSHA 1910.147 LOTO compliance, machine manuals, spare parts ATP, and autonomous work order orchestration.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [copilotThinking, setCopilotThinking] = useState(false);

  // Quick Escalation Form State
  const [quickType, setQuickType] = useState<'SPARE_REQUEST' | 'SAFETY_LOTO' | 'EMERGENCY_BUDGET' | 'BROADCAST'>('SPARE_REQUEST');
  const [quickMachine, setQuickMachine] = useState('CNC-01');
  const [quickPart, setQuickPart] = useState('Angular Contact Spindle Bearing (7008-H)');
  const [quickDetails, setQuickDetails] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = () => {
    setLoading(true);
    api.getIntercomMessages(currentUser.roleKey)
      .then(res => {
        if (res.success && res.data) {
          setMessages(res.data);
        }
      })
      .catch(err => console.warn('Failed to fetch intercom messages:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMessages();

    socket.on('intercom:new_message', (msg: IntercomMessage) => {
      setMessages(prev => [msg, ...prev.filter(m => m.id !== msg.id)]);
      if (onAddToast && msg.sender_role !== currentUser.roleKey) {
        onAddToast({
          type: msg.channel === 'SAFETY_LOTO' ? 'LOTO' : msg.priority === 'CRITICAL' ? 'IOT_ALERT' : 'INFO',
          title: `Intercom: ${msg.title}`,
          subtitle: `From ${msg.sender_name} (${msg.sender_role})`,
          message: msg.message,
          metaBadge: msg.channel
        });
      }
    });

    socket.on('intercom:escalation_raised', (msg: IntercomMessage) => {
      setMessages(prev => [msg, ...prev.filter(m => m.id !== msg.id)]);
    });

    socket.on('intercom:message_resolved', (data: any) => {
      setMessages(prev => prev.map(m => m.id === data.id ? { ...m, status: 'RESOLVED', resolution_note: data.resolutionNote } : m));
    });

    socket.on('procurement:po_approved', (data: any) => {
      setMessages(prev => prev.map(m => {
        const poMatch = m.metadata?.poId === data.poId || m.id === data.poId;
        return poMatch ? { ...m, status: 'APPROVED', resolution_note: `Approved by ${data.approvedBy}` } : m;
      }));
    });

    return () => {
      socket.off('intercom:new_message');
      socket.off('intercom:escalation_raised');
      socket.off('intercom:message_resolved');
      socket.off('procurement:po_approved');
    };
  }, [currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const payload = {
      senderRole: currentUser.roleKey,
      senderName: currentUser.name,
      recipientRole: 'ALL',
      channel: 'BROADCAST',
      priority: 'NORMAL',
      title: `Message from ${currentUser.name}`,
      message: chatInput.trim()
    };

    setChatInput('');
    try {
      await api.sendIntercomMessage(payload);
    } catch (err: any) {
      console.error('Failed to send intercom message:', err);
    }
  };

  const handleSendCopilot = async (promptText?: string) => {
    const text = promptText || copilotInput;
    if (!text.trim()) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setCopilotHistory(prev => [...prev, { role: 'user', text, time: userTime }]);
    if (!promptText) setCopilotInput('');
    setCopilotThinking(true);

    try {
      const res = await api.queryAICopilot(text, currentUser.roleKey, currentUser.name);
      if (res.success && res.data) {
        const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setCopilotHistory(prev => [...prev, { role: 'ai', text: res.data.reply, time: aiTime }]);
      }
    } catch (err: any) {
      setCopilotHistory(prev => [...prev, { role: 'ai', text: 'Encountered error querying Industrial AI orchestrator. Please retry.', time: '' }]);
    } finally {
      setCopilotThinking(false);
    }
  };

  const handleQuickEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickSubmitting(true);

    let title = '';
    let targetRole = 'SUPERVISOR';
    let details = quickDetails;

    if (quickType === 'SPARE_REQUEST') {
      title = `Urgent Spare Part Request: ${quickMachine}`;
      targetRole = 'INVENTORY_MGMT';
      details = details || `Technician ${currentUser.name} requires ${quickPart} for immediate repair on ${quickMachine}.`;
    } else if (quickType === 'SAFETY_LOTO') {
      title = `OSHA LOTO Safety Hold: ${quickMachine}`;
      targetRole = 'SUPERVISOR';
      details = details || `Zero energy isolation hold reported on ${quickMachine}. Main breaker locked with Padlock. Work suspended until supervisor clearance.`;
    } else if (quickType === 'EMERGENCY_BUDGET') {
      title = `Emergency Spend Authorization: ${quickMachine}`;
      targetRole = 'MANAGER';
      details = details || `Critical component failure on ${quickMachine} requires emergency tooling purchase authorization.`;
    } else {
      title = `Plant Announcement from ${currentUser.name}`;
      targetRole = 'ALL';
      details = details || `Floor update regarding active production shift.`;
    }

    try {
      await api.escalateIssue({
        senderRole: currentUser.roleKey,
        senderName: currentUser.name,
        targetRole,
        type: quickType,
        title,
        details,
        metadata: { machineCode: quickMachine, part: quickPart, timestamp: new Date().toISOString() }
      });

      if (onAddToast) {
        onAddToast({
          type: 'INFO',
          title: 'Escalation Dispatched',
          subtitle: `Routed to ${targetRole}`,
          message: title
        });
      }
      setQuickDetails('');
      setActiveTab('escalations');
    } catch (err: any) {
      console.error('Failed to escalate issue:', err);
    } finally {
      setQuickSubmitting(false);
    }
  };

  const handleManagerApprovePO = async (poId: string) => {
    try {
      await api.approvePOByManager(poId, currentUser.name);
      if (onAddToast) {
        onAddToast({
          type: 'PO_APPROVED',
          title: 'Purchase Order Authorized',
          subtitle: `Authorized by ${currentUser.name}`,
          message: `PO #${poId} approved and released to vendor NSK Precision Bearings.`
        });
      }
      loadMessages();
    } catch (err: any) {
      console.error('PO approval failed:', err);
    }
  };

  const handleResolveEscalation = async (msgId: string, resolutionText: string) => {
    try {
      await api.resolveIntercomMessage(msgId, currentUser.name, resolutionText);
      loadMessages();
    } catch (err: any) {
      console.error('Resolve escalation failed:', err);
    }
  };

  const openEscalationsCount = messages.filter(m => m.status === 'OPEN' || m.status === 'PENDING_APPROVAL').length;

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-[9900]">
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-full shadow-2xl font-bold text-sm transition-all duration-300 transform hover:scale-105 ${
            isOpen 
              ? 'bg-[#1E293B] text-white ring-4 ring-[#1E293B]/20' 
              : 'bg-gradient-to-r from-[#2B4C7E] to-[#1E293B] text-white ring-4 ring-[#2B4C7E]/30 hover:shadow-cyan-900/30'
          }`}
        >
          <div className="relative">
            <Radio className={`w-5 h-5 ${isOpen ? 'animate-pulse text-[#38BDF8]' : 'text-[#38BDF8]'}`} />
            {openEscalationsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#EF4444] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                {openEscalationsCount}
              </span>
            )}
          </div>
          <span className="tracking-wide">Plant Intercom & AI</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/10">
            {currentUser.roleKey.split('_')[0]}
          </span>
        </button>
      </div>

      {/* Expandable Intercom & AI Drawer */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[490px] max-w-[94vw] h-[660px] max-h-[86vh] bg-[#FFFFFF] border border-[#CBD5E1] rounded-2xl shadow-2xl z-[9901] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-[#1E293B] to-[#2B4C7E] text-white flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#38BDF8]/20 border border-[#38BDF8]/40 flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#38BDF8] animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight">PlantOps Intercom Hub</h3>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                    LIVE
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Logged in as <strong className="text-white">{currentUser.name}</strong> ({currentUser.role})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadMessages}
                title="Refresh feed"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="grid grid-cols-4 bg-[#F8FAFC] border-b border-[#E2E8F0] p-1 gap-1 text-[11px] font-bold text-[#64748B]">
            <button
              onClick={() => setActiveTab('channel')}
              className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'channel' ? 'bg-[#FFFFFF] text-[#1E293B] shadow-sm font-black border border-[#CBD5E1]' : 'hover:text-[#1E293B]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#2B4C7E]" />
              <span>Channel</span>
            </button>
            <button
              onClick={() => setActiveTab('escalations')}
              className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all relative ${
                activeTab === 'escalations' ? 'bg-[#FFFFFF] text-[#1E293B] shadow-sm font-black border border-[#CBD5E1]' : 'hover:text-[#1E293B]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Escalations</span>
              {openEscalationsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#EF4444] text-white text-[9px] flex items-center justify-center">
                  {openEscalationsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('quick')}
              className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'quick' ? 'bg-[#FFFFFF] text-[#1E293B] shadow-sm font-black border border-[#CBD5E1]' : 'hover:text-[#1E293B]'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>1-Click</span>
            </button>
            <button
              onClick={() => setActiveTab('copilot')}
              className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'copilot' ? 'bg-[#FFFFFF] text-[#1E293B] shadow-sm font-black border border-[#CBD5E1]' : 'hover:text-[#1E293B]'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>AI Copilot</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#F8FAFC]">
            {/* TAB 1: Live Intercom Channel Feed */}
            {activeTab === 'channel' && (
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No recent intercom broadcasts. Broadcast a message below!
                  </div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-xl border text-xs transition-all ${
                        msg.sender_role === 'AI_COPILOT'
                          ? 'bg-[#F0F9FF] border-[#BAE6FD]'
                          : msg.priority === 'CRITICAL' || msg.priority === 'EMERGENCY'
                          ? 'bg-[#FEF2F2] border-[#FECACA]'
                          : 'bg-white border-[#E2E8F0] shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            msg.sender_role === 'AI_COPILOT'
                              ? 'bg-[#0284C7] text-white'
                              : msg.sender_role === 'MANAGER'
                              ? 'bg-[#8B5CF6] text-white'
                              : msg.sender_role === 'SUPERVISOR'
                              ? 'bg-[#2B4C7E] text-white'
                              : msg.sender_role === 'INVENTORY_MGMT'
                              ? 'bg-[#059669] text-white'
                              : 'bg-[#D97706] text-white'
                          }`}>
                            {msg.sender_name} ({msg.sender_role.replace('_', ' ')})
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {msg.channel}
                        </span>
                      </div>
                      <div className="font-bold text-[#1E293B] mb-1">{msg.title}</div>
                      <p className="text-slate-600 leading-relaxed">{msg.message}</p>
                      {msg.resolution_note && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] text-[#059669] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{msg.resolution_note}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* TAB 2: Active Escalation Center */}
            {activeTab === 'escalations' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl text-xs text-[#92400E] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#D97706]" />
                  <span>
                    Cross-role escalation cards requiring action or clearance.
                  </span>
                </div>

                {messages.filter(m => m.channel !== 'BROADCAST').map(esc => {
                  const isManagerPO = esc.channel === 'PO_APPROVAL' && esc.status === 'PENDING_APPROVAL';
                  const isSpareReq = esc.channel === 'SPARE_REQUEST' && esc.status === 'OPEN';
                  const isSafetyLoto = esc.channel === 'SAFETY_LOTO' && esc.status === 'OPEN';

                  return (
                    <div
                      key={esc.id}
                      className="p-4 bg-white border border-[#CBD5E1] rounded-xl shadow-sm text-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          esc.priority === 'CRITICAL' ? 'bg-[#EF4444] text-white' : 'bg-[#F59E0B] text-white'
                        }`}>
                          {esc.priority} • {esc.channel}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          esc.status === 'APPROVED' || esc.status === 'RESOLVED'
                            ? 'bg-[#10B981]/20 text-[#10B981]'
                            : 'bg-[#F59E0B]/20 text-[#D97706]'
                        }`}>
                          {esc.status}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-[#1E293B] text-sm">{esc.title}</h4>
                        <p className="text-slate-600 mt-1 leading-relaxed">{esc.message}</p>
                      </div>

                      {/* 1-Click Action Gateways */}
                      {isManagerPO && currentUser.roleKey === 'MANAGER' && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500">
                            Threshold: &gt; $1,000.00
                          </span>
                          <button
                            onClick={() => handleManagerApprovePO(esc.metadata?.poId || esc.id)}
                            className="px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>1-Click Authorize PO</span>
                          </button>
                        </div>
                      )}

                      {isSpareReq && currentUser.roleKey === 'INVENTORY_MGMT' && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Target: Central Spares BAY-B</span>
                          <button
                            onClick={() => handleResolveEscalation(esc.id, 'Part staged at Bay B shelf 4 for technician pickup.')}
                            className="px-3 py-1.5 bg-[#2B4C7E] hover:bg-[#1E3A5F] text-white font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Acknowledge & Stage Part</span>
                          </button>
                        </div>
                      )}

                      {isSafetyLoto && currentUser.roleKey === 'SUPERVISOR' && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">OSHA 1910.147 Hold</span>
                          <button
                            onClick={() => handleResolveEscalation(esc.id, 'Safety boundary inspected & cleared for isolation by Marcus Vance.')}
                            className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Clear Safety Hold</span>
                          </button>
                        </div>
                      )}

                      {esc.resolution_note && (
                        <div className="p-2 bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg text-[11px] text-[#15803D] flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>{esc.resolution_note}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: 1-Click Quick Escalation Drawer */}
            {activeTab === 'quick' && (
              <form onSubmit={handleQuickEscalate} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Select Escalation Template
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickType('SPARE_REQUEST')}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        quickType === 'SPARE_REQUEST'
                          ? 'border-[#2B4C7E] bg-[#F0F4FA] text-[#2B4C7E] font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Wrench className="w-4 h-4 text-[#2B4C7E]" />
                      <span>Request Spares</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickType('SAFETY_LOTO')}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        quickType === 'SAFETY_LOTO'
                          ? 'border-[#EF4444] bg-[#FEF2F2] text-[#EF4444] font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-[#EF4444]" />
                      <span>Report LOTO Hold</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickType('EMERGENCY_BUDGET')}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        quickType === 'EMERGENCY_BUDGET'
                          ? 'border-[#10B981] bg-[#F0FDF4] text-[#10B981] font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <DollarSign className="w-4 h-4 text-[#10B981]" />
                      <span>Emergency Spend</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickType('BROADCAST')}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        quickType === 'BROADCAST'
                          ? 'border-[#8B5CF6] bg-[#F5F3FF] text-[#8B5CF6] font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Radio className="w-4 h-4 text-[#8B5CF6]" />
                      <span>Floor Broadcast</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Target Machine</label>
                    <CustomSelect
                      value={quickMachine}
                      onChange={(val) => setQuickMachine(val)}
                      options={[
                        { value: 'CNC-01', label: 'CNC-01 (5-Axis Milling)' },
                        { value: 'CNC-02', label: 'CNC-02 (Turning Center)' },
                        { value: 'CNC-03', label: 'CNC-03 (High-Precision Mill)' },
                        { value: 'ROBOT-01', label: 'ROBOT-01 (Articulated Robot)' },
                        { value: 'PUMP-01', label: 'PUMP-01 (Hydraulic Coolant Pump)' },
                        { value: 'MIXER-01', label: 'MIXER-01 (Chemical Mixer)' },
                        { value: 'ASMB-01', label: 'ASMB-01 (Torque Station)' },
                        { value: 'PACK-01', label: 'PACK-01 (Form-Fill Sealer)' },
                      ]}
                      fullWidth
                      size="sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Required Part / Focus</label>
                    <CustomSelect
                      value={quickPart}
                      onChange={(val) => setQuickPart(val)}
                      options={[
                        { value: 'Angular Contact Spindle Bearing (7008-H)', label: 'Angular Bearing 7008-H' },
                        { value: 'Ceramic Hybrid Bearing SKF-6205', label: 'Ceramic Bearing SKF-6205' },
                        { value: 'Hydraulic Return Line Filter 10-Micron', label: '10µ Filter Cartridge' },
                        { value: 'Agitator Helical Lip Seal Kit', label: 'Agitator Lip Seal Kit' },
                        { value: 'Teflon Sealing Tape Strip', label: 'Teflon Sealer Tape' },
                      ]}
                      fullWidth
                      size="sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Specific Notes / Urgent Reason
                  </label>
                  <textarea
                    rows={3}
                    value={quickDetails}
                    onChange={e => setQuickDetails(e.target.value)}
                    placeholder="Describe specific symptoms, lock number, or vendor quote details..."
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl p-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={quickSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-[#2B4C7E] to-[#1E293B] hover:from-[#1E3A5F] hover:to-[#0F172A] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{quickSubmitting ? 'Dispatching...' : 'Dispatch Escalation Ticket'}</span>
                </button>
              </form>
            )}

            {/* TAB 4: Industrial AI Copilot */}
            {activeTab === 'copilot' && (
              <div className="flex flex-col h-full space-y-3">
                {/* Prompt Pills */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleSendCopilot('What are the OSHA 1910.147 LOTO steps for CNC-01?')}
                    className="px-2.5 py-1 bg-white border border-[#CBD5E1] rounded-full text-[10px] font-bold text-[#2B4C7E] hover:bg-[#F0F4FA] transition-colors"
                  >
                    🛡️ OSHA LOTO Steps
                  </button>
                  <button
                    onClick={() => handleSendCopilot('Check bearing stock and bin location for CNC-01 spindle.')}
                    className="px-2.5 py-1 bg-white border border-[#CBD5E1] rounded-full text-[10px] font-bold text-[#059669] hover:bg-[#F0FDF4] transition-colors"
                  >
                    📦 Check Bearing Stock
                  </button>
                  <button
                    onClick={() => handleSendCopilot('What PM routines are scheduled for today?')}
                    className="px-2.5 py-1 bg-white border border-[#CBD5E1] rounded-full text-[10px] font-bold text-[#8B5CF6] hover:bg-[#F5F3FF] transition-colors"
                  >
                    📅 PM Schedule Summary
                  </button>
                </div>

                {/* Chat History */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {copilotHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl text-xs ${
                        item.role === 'user'
                          ? 'bg-[#2B4C7E] text-white ml-8 rounded-tr-none'
                          : 'bg-white border border-[#CBD5E1] text-[#1E293B] mr-6 rounded-tl-none shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 opacity-75 text-[10px]">
                        <span>{item.role === 'user' ? currentUser.name : '🤖 Antigravity AI Copilot'}</span>
                        <span>{item.time}</span>
                      </div>
                      <div className="whitespace-pre-line leading-relaxed">{item.text}</div>
                    </div>
                  ))}
                  {copilotThinking && (
                    <div className="p-3 bg-white border border-[#CBD5E1] rounded-xl text-xs text-slate-500 mr-6 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-[#0284C7] animate-spin" />
                      <span>Industrial AI synthesizing sensor logs & SOP manuals...</span>
                    </div>
                  )}
                </div>

                {/* Copilot Input */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSendCopilot();
                  }}
                  className="flex items-center gap-2 pt-2 border-t border-[#E2E8F0]"
                >
                  <input
                    type="text"
                    value={copilotInput}
                    onChange={e => setCopilotInput(e.target.value)}
                    placeholder="Ask Copilot about SOPs, LOTO, spares, or machine specs..."
                    className="flex-1 bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl shadow-sm transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Footer Input Bar for Channel */}
          {activeTab === 'channel' && (
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-white border-t border-[#E2E8F0] flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={`Broadcast to plant floor as ${currentUser.name}...`}
                className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]"
              />
              <button
                type="submit"
                className="p-2 bg-[#2B4C7E] hover:bg-[#1E3A5F] text-white rounded-xl shadow-sm transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
};
