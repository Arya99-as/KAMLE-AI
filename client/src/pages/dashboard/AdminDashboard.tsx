import {
  Activity,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Eye,
  FileCheck,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Star,
  Tags,
  TrendingUp,
  UserCheck,
  UserCog,
  Wallet,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  adminDashboard,
  adminWorkers,
  adminUsers,
  adminPayments,
  adminPayouts,
  adminUpdatePayoutStatus,
  setApproval,
  setAccountStatus,
  adminGetConfig,
  adminUpdateConfig,
  adminEnquiries,
  adminResolveDispute,
  adminReviews,
  moderateReview,
  adminReports,
  setReportStatus,
  adminCategories,
  createCategory,
  updateCategory,
  adminAuditLogs,
  fetchWorkerDocument,
} from '../../services/api';
import { Badge, Button, Field, Input, Modal, Textarea } from '../../components/ui/primitives';
import { EmptyState } from '../../components/ui/states';
import { AiControlCenter } from '../../features/ai-admin/AiControlCenter';
import { useAuth } from '../../context/AuthContext';
import type { Enquiry, Payment, Payout } from '../../types';
import { StatCard } from '../../components/dashboard/StatCard';
import AdminQuotations from '../../components/dashboard/AdminQuotations';
import AdminPaymentRequests from '../../components/dashboard/AdminPaymentRequests';

type AdminNav =
  | 'overview'
  | 'quotations'
  | 'payment_requests'
  | 'payments'
  | 'payouts'
  | 'users'
  | 'enquiries'
  | 'verifications'
  | 'reviews'
  | 'reports'
  | 'categories'
  | 'audit'
  | 'ai'
  | 'settings';

const NAV_ITEMS: Array<{ key: AdminNav; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview & KPIs', icon: LayoutDashboard },
  { key: 'quotations', label: 'Quotation & Payment Approval', icon: ClipboardCheck },
  { key: 'payment_requests', label: 'Payment Requests', icon: FileCheck },
  { key: 'payments', label: 'Payments & Revenue', icon: CreditCard },
  { key: 'payouts', label: 'Worker Payouts', icon: Wallet },
  { key: 'verifications', label: 'Worker Applications', icon: FileCheck },
  { key: 'users', label: 'User Management', icon: UserCog },
  { key: 'enquiries', label: 'Enquiries & Disputes', icon: ClipboardList },
  { key: 'reviews', label: 'Review Moderation', icon: Star },
  { key: 'reports', label: 'Complaints & Reports', icon: Flag },
  { key: 'categories', label: 'Service Categories', icon: Tags },
  { key: 'audit', label: 'Audit Log', icon: ScrollText },
  { key: 'ai', label: 'AI Control Center', icon: Activity },
  { key: 'settings', label: 'Commission & Rules', icon: BadgePercent },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Navigation State
  const [activeNav, setActiveNav] = useState<AdminNav>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data State
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pendingWorkers, setPendingWorkers] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [payoutsList, setPayoutsList] = useState<Payout[]>([]);
  const [enquiriesList, setEnquiriesList] = useState<Enquiry[]>([]);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Platform Config
  const [commissionRate, setCommissionRate] = useState<number>(10);
  const [payoutTerms, setPayoutTerms] = useState<string>('T+2 business days');
  const [configSaving, setConfigSaving] = useState(false);

  // Search and Filter States for Transactions
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Category create modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', icon: 'wrench' });
  const [categorySaving, setCategorySaving] = useState(false);

  // Verification Rejection Modal
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Payout Disbursement Modal
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      const [dash, w, u, p, po, cfg, enq, rev, rep, cats, audits] = await Promise.all([
        adminDashboard(),
        adminWorkers('pending'),
        adminUsers(),
        adminPayments().catch(() => null),
        adminPayouts().catch(() => null),
        adminGetConfig().catch(() => null),
        adminEnquiries().catch(() => null),
        adminReviews().catch(() => null),
        adminReports().catch(() => null),
        adminCategories().catch(() => null),
        adminAuditLogs().catch(() => null),
      ]);
      setStats(dash.stats || {});
      setPendingWorkers(w.items || []);
      setUsersList(u.items || []);
      setPaymentsList(p?.items || []);
      setPayoutsList(po?.items || []);
      setEnquiriesList(enq?.items || []);
      setReviewsList(rev?.items || []);
      setReportsList(rep?.items || []);
      setCategoriesList(cats?.categories || []);
      setAuditLogs(audits?.items || []);

      if (cfg && cfg.config) {
        setCommissionRate(cfg.config.commissionPercent ?? 10);
        setPayoutTerms(cfg.config.payoutTerms ?? 'T+2 business days');
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load admin console data.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleApproveWorker(id: string) {
    try {
      await setApproval(id, 'approved');
      alert('Worker verification application approved!');
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error approving application');
    }
  }

  async function handleRejectConfirm() {
    if (!rejectId) return;
    try {
      await setApproval(rejectId, 'rejected', rejectReason);
      setRejectId(null);
      setRejectReason('');
      alert('Worker application rejected.');
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error rejecting application');
    }
  }

  async function handleToggleUserStatus(u: any) {
    const next = u.accountStatus === 'active' ? 'suspended' : 'active';
    try {
      await setAccountStatus(u.id || u._id, next);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating user status');
    }
  }

  async function handleDisbursePayout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPayout || !payoutRef.trim()) return;
    setPayoutLoading(true);
    try {
      await adminUpdatePayoutStatus(selectedPayout._id, 'PAID', payoutRef.trim(), payoutNote);
      alert('Payout successfully marked as PAID! Transaction voucher recorded.');
      setSelectedPayout(null);
      setPayoutRef('');
      setPayoutNote('');
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update payout status');
    } finally {
      setPayoutLoading(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setConfigSaving(true);
    try {
      await adminUpdateConfig({
        commissionPercent: Number(commissionRate),
        payoutTerms,
      });
      alert('Platform commission & settlement policy updated successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update configuration');
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleResolveDispute(id: string, resolution: 'COMPLETED' | 'CANCELLED') {
    const note = window.prompt(
      resolution === 'COMPLETED'
        ? 'Resolution note (the job will be marked completed):'
        : 'Cancellation note:',
    );
    if (note === null) return;
    setActionBusy(id);
    try {
      await adminResolveDispute(id, resolution, note || undefined);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not resolve dispute');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleModerateReview(id: string, status: 'approved' | 'rejected') {
    setActionBusy(id);
    try {
      await moderateReview(id, status);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not moderate review');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleReportStatus(id: string, status: 'open' | 'reviewing' | 'resolved' | 'dismissed') {
    setActionBusy(id);
    try {
      await setReportStatus(id, status);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update report');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleToggleCategory(category: any) {
    setActionBusy(category._id);
    try {
      await updateCategory(category._id, {
        name: category.name,
        description: category.description,
        icon: category.icon,
        isActive: !category.isActive,
      });
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update category');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;
    setCategorySaving(true);
    try {
      await createCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        icon: categoryForm.icon.trim() || 'wrench',
      });
      setCategoryForm({ name: '', description: '', icon: 'wrench' });
      setCategoryModalOpen(false);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not create category');
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleViewDocument(profileId: string, index: number, label: string) {
    const key = `${profileId}:${index}`;
    const preview = window.open('', '_blank');
    setDocumentLoading(key);
    try {
      const blob = await fetchWorkerDocument(profileId, index);
      const url = URL.createObjectURL(blob);
      if (preview) {
        preview.location.href = url;
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      preview?.close();
      alert(err instanceof Error ? err.message : `Could not open ${label}`);
    } finally {
      setDocumentLoading(null);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Filtered Payments Ledger
  const filteredPayments = paymentsList.filter((p) => {
    const q = paymentSearch.toLowerCase();
    const matchSearch =
      !paymentSearch.trim() ||
      (p.transactionRef || '').toLowerCase().includes(q) ||
      (p.providerOrderId || '').toLowerCase().includes(q) ||
      (p.paymentMethod || '').toLowerCase().includes(q);
    const matchStatus = !paymentStatusFilter || p.status === paymentStatusFilter;
    return matchSearch && matchStatus;
  });

  // Calculate Financial Aggregates (prefer authoritative server aggregates)
  const computedTotalVolume = paymentsList
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const computedTotalCommission = paymentsList
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + (p.commissionAmount || 0), 0);
  const computedPendingPayout = payoutsList
    .filter((po) => po.status === 'PENDING' || po.status === 'PROCESSING')
    .reduce((sum, po) => sum + (po.workerPayableAmount || 0), 0);
  const computedPaidPayout = payoutsList
    .filter((po) => po.status === 'PAID')
    .reduce((sum, po) => sum + (po.workerPayableAmount || 0), 0);

  const totalVolume = stats.totalVolume ?? computedTotalVolume;
  const totalCommission = stats.totalCommission ?? computedTotalCommission;
  const pendingPayoutTotal = stats.pendingPayoutsTotal ?? computedPendingPayout;
  const paidPayoutTotal = stats.totalPayoutsPaid ?? computedPaidPayout;

  const filteredUsers = usersList.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q) ||
      String(u.phone || '').toLowerCase().includes(q)
    );
  });

  const filteredEnquiries = enquiriesList.filter((e) => !enquiryStatusFilter || e.status === enquiryStatusFilter);
  const filteredReviews = reviewsList.filter((r) => !reviewStatusFilter || r.moderationStatus === reviewStatusFilter);
  const filteredReports = reportsList.filter((r) => !reportStatusFilter || r.status === reportStatusFilter);
  const filteredAuditLogs = auditLogs.filter((a) => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(a.action || '').toLowerCase().includes(q) ||
      String(a.targetType || '').toLowerCase().includes(q) ||
      String(a.targetId || '').toLowerCase().includes(q)
    );
  });
  const filterTotals = {
    pendingApplications: stats.pendingApplications ?? pendingWorkers.length,
    disputed: stats.disputedRequests ?? enquiriesList.filter((e) => e.status === 'DISPUTED').length,
    openReports: stats.openReports ?? reportsList.filter((r) => ['open', 'reviewing'].includes(r.status)).length,
    pendingReviews: stats.pendingReviews ?? reviewsList.filter((r) => r.moderationStatus === 'pending').length,
    totalCategories: stats.totalCategories ?? categoriesList.length,
  };

  function displayName(value: unknown): string {
    if (!value) return '—';
    if (typeof value === 'string') return value;
    const obj = value as { name?: string };
    return obj.name || '—';
  }

  function statusTone(status: string): string {
    switch (status) {
      case 'COMPLETED':
      case 'approved':
      case 'PAID':
      case 'resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'DISPUTED':
      case 'REJECTED':
      case 'rejected':
      case 'FAILED':
      case 'dismissed':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'CANCELLED':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F8FD]">
      {/* 1. DEDICATED DARK NAVY SAAS SIDEBAR */}
      <aside
        className={`bg-[#101D43] text-white flex flex-col shrink-0 transition-all duration-300 z-30 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } hidden md:flex shadow-xl`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <Link to="/" className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md">
              <ShieldCheck size={20} className="text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <div className="text-base font-black tracking-tight text-white leading-tight">
                  KAMLE AI
                </div>
                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                  Admin Console
                </div>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <button
            onClick={() => setActiveNav('overview')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'overview'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <LayoutDashboard size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Overview & KPIs</span>}
          </button>

          <button
            onClick={() => setActiveNav('payments')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'payments'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Payments & Revenue</span>}
            </div>
          </button>

          <button
            onClick={() => setActiveNav('quotations')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'quotations'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <ClipboardCheck size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Quotation &amp; Payment Approval</span>}
            </div>
          </button>

          <button
            onClick={() => setActiveNav('payouts')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'payouts'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Wallet size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Worker Payouts</span>}
            </div>
            {!sidebarCollapsed && pendingPayoutTotal > 0 && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
                ₹{pendingPayoutTotal}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('verifications')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'verifications'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileCheck size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Worker Applications</span>}
            </div>
            {!sidebarCollapsed && pendingWorkers.length > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                {pendingWorkers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('users')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'users'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <UserCog size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>User Management</span>}
          </button>

          <button
            onClick={() => setActiveNav('enquiries')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'enquiries'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <ClipboardList size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Enquiries & Disputes</span>}
            </div>
            {!sidebarCollapsed && filterTotals.disputed > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                {filterTotals.disputed}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('reviews')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'reviews'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Star size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Review Moderation</span>}
            </div>
            {!sidebarCollapsed && filterTotals.pendingReviews > 0 && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
                {filterTotals.pendingReviews}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('reports')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'reports'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Flag size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Complaints & Reports</span>}
            </div>
            {!sidebarCollapsed && filterTotals.openReports > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                {filterTotals.openReports}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('categories')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'categories'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Tags size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Service Categories</span>}
          </button>

          <button
            onClick={() => setActiveNav('audit')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'audit'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <ScrollText size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Audit Log</span>}
          </button>

          <button
            onClick={() => setActiveNav('ai')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'ai'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Activity size={18} className="shrink-0 text-cyan-400" />
            {!sidebarCollapsed && <span>AI Control Center</span>}
          </button>

          <button
            onClick={() => setActiveNav('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeNav === 'settings'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <BadgePercent size={18} className="shrink-0 text-emerald-400" />
            {!sidebarCollapsed && <span>Commission & Rules</span>}
          </button>
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-white/10 transition"
          >
            <LogOut size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Admin Logout</span>}
          </button>
        </div>
      </aside>

      {/* 2. MAIN OPERATIONS AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-line bg-white flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Platform Operations Live
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadAll}
              disabled={refreshing}
              className="gap-1.5 text-xs font-semibold"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh Data
            </Button>

            {/* Admin Profile Pill */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-line">
              <div className="h-8 w-8 rounded-full bg-[#101D43] text-white font-black text-xs flex items-center justify-center">
                A
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-ink leading-tight">{user?.name || 'Admin'}</div>
                <div className="text-[10px] text-muted leading-tight">Super Administrator</div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile navigation drawer (previously toggled state with no UI) */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-slate-950/60"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#101D43] text-white flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-blue-400" />
                  <span className="text-sm font-black">Admin Console</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
                  aria-label="Close navigation"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setActiveNav(item.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                        activeNav === item.key
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon size={17} className="shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-white/10">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-white/10"
                >
                  <LogOut size={17} /> Admin Logout
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {loadError && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-start justify-between gap-3"
            >
              <span>{loadError}</span>
              <button onClick={loadAll} className="text-xs font-bold underline shrink-0">
                Retry
              </button>
            </div>
          )}
          {/* TAB 1: OVERVIEW & KPIS */}
          {activeNav === 'overview' && (
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="rounded-3xl bg-gradient-to-r from-[#101D43] to-blue-900 p-6 sm:p-8 text-white shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black">Financial & Operations Console</h1>
                    <p className="mt-1 text-sm text-blue-200">
                      Real-time oversight of customer settlements, worker payouts, and platform commission.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                      Default Commission: {commissionRate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Financial KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Total Payment Volume"
                  value={`₹${totalVolume.toLocaleString()}`}
                  icon={CreditCard}
                  sub="Settled through Razorpay"
                  tone="blue"
                  onClick={() => setActiveNav('payments')}
                />
                <StatCard
                  title="Platform Commission"
                  value={`₹${totalCommission.toLocaleString()}`}
                  icon={TrendingUp}
                  sub="10% Net platform fee collected"
                  tone="emerald"
                  onClick={() => setActiveNav('payments')}
                />
                <StatCard
                  title="Pending Payouts"
                  value={`₹${pendingPayoutTotal.toLocaleString()}`}
                  icon={Wallet}
                  sub="Vouchers awaiting disbursement"
                  tone="amber"
                  onClick={() => setActiveNav('payouts')}
                />
                <StatCard
                  title="Paid to Workers"
                  value={`₹${paidPayoutTotal.toLocaleString()}`}
                  icon={UserCheck}
                  sub="Transferred to verified accounts"
                  tone="purple"
                  onClick={() => setActiveNav('payouts')}
                />
              </div>

              {/* Operational KPI strip */}
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
                {[
                  { label: 'Pending Verifications', value: filterTotals.pendingApplications, target: 'verifications', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
                  { label: 'Disputed Jobs', value: filterTotals.disputed, target: 'enquiries', tone: 'text-rose-700 bg-rose-50 border-rose-200' },
                  { label: 'Open Reports', value: filterTotals.openReports, target: 'reports', tone: 'text-rose-700 bg-rose-50 border-rose-200' },
                  { label: 'Reviews Awaiting Moderation', value: filterTotals.pendingReviews, target: 'reviews', tone: 'text-blue-700 bg-blue-50 border-blue-200' },
                  { label: 'Service Categories', value: filterTotals.totalCategories, target: 'categories', tone: 'text-slate-700 bg-slate-50 border-line' },
                ].map((kpi) => (
                  <button
                    key={kpi.label}
                    onClick={() => setActiveNav(kpi.target as AdminNav)}
                    className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${kpi.tone}`}
                  >
                    <div className="text-2xl font-black leading-none">{kpi.value}</div>
                    <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wide opacity-80">
                      {kpi.label}
                    </div>
                  </button>
                ))}
              </div>

              {/* Two Column Quick Ledgers */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Payments Snapshot */}
                <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <h3 className="text-sm font-bold text-ink">Recent Customer Payments</h3>
                    <button
                      onClick={() => setActiveNav('payments')}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      View All →
                    </button>
                  </div>

                  {paymentsList.length === 0 ? (
                    <p className="text-xs text-muted py-6 text-center">No payment transactions recorded yet.</p>
                  ) : (
                    <div className="divide-y divide-line text-xs">
                      {paymentsList.slice(0, 5).map((p) => (
                        <div key={p._id} className="py-3 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-ink text-sm">₹{p.amount}</span>
                            <span className="text-muted block text-[11px] font-mono">{p.transactionRef}</span>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                p.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {p.status}
                            </span>
                            <span className="text-muted block text-[11px]">
                              Fee: ₹{p.commissionAmount}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Worker Applications Snapshot */}
                <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <h3 className="text-sm font-bold text-ink">Pending Worker Applications</h3>
                    <button
                      onClick={() => setActiveNav('verifications')}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Review All →
                    </button>
                  </div>

                  {pendingWorkers.length === 0 ? (
                    <p className="text-xs text-muted py-6 text-center">No worker applications pending review.</p>
                  ) : (
                    <div className="divide-y divide-line text-xs">
                      {pendingWorkers.slice(0, 5).map((w) => (
                        <div key={w._id} className="py-3 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-ink">{w.userId?.name || 'Worker'}</span>
                            <span className="text-muted block text-[11px]">
                              {(w.serviceCategories || []).join(', ') || 'General Service'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApproveWorker(w._id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-bold text-[11px]"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PAYMENTS & REVENUE (Customer Payment Ledger) */}
          {/* TAB: QUOTATION & PAYMENT APPROVAL */}
          {activeNav === 'quotations' && <AdminQuotations />}

          {/* TAB: PAYMENT REQUEST MANAGEMENT */}
          {activeNav === 'payment_requests' && <AdminPaymentRequests />}

          {/* TAB 2: PAYMENTS & REVENUE */}
          {activeNav === 'payments' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Customer Payment Ledger</h2>
                    <p className="text-xs text-muted">
                      Complete log of customer transactions processed via Razorpay Checkout
                    </p>
                  </div>

                  {/* Search and Status Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={paymentSearch}
                        onChange={(e) => setPaymentSearch(e.target.value)}
                        placeholder="Search ref or method..."
                        className="rounded-xl border border-line bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-ink focus:outline-none focus:bg-white"
                      />
                    </div>

                    <select
                      value={paymentStatusFilter}
                      onChange={(e) => setPaymentStatusFilter(e.target.value)}
                      className="rounded-xl border border-line bg-slate-50 px-3 py-1.5 text-xs text-ink font-semibold focus:outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="PENDING">Pending</option>
                      <option value="FAILED">Failed</option>
                      <option value="REFUNDED">Refunded</option>
                    </select>
                  </div>
                </div>

                {filteredPayments.length === 0 ? (
                  <EmptyState
                    title="No payments found"
                    message="No customer transactions matched your filter criteria."
                  />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-line">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-line font-bold uppercase tracking-wider text-muted">
                        <tr>
                          <th className="px-5 py-3.5">Gross Amount</th>
                          <th className="px-5 py-3.5">Platform Fee (10%)</th>
                          <th className="px-5 py-3.5">Worker Share (90%)</th>
                          <th className="px-5 py-3.5">Status</th>
                          <th className="px-5 py-3.5">Method</th>
                          <th className="px-5 py-3.5">Reference ID</th>
                          <th className="px-5 py-3.5">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {filteredPayments.map((p) => (
                          <tr key={p._id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-4 font-black text-ink text-sm">₹{p.amount}</td>
                            <td className="px-5 py-4 font-bold text-blue-700">₹{p.commissionAmount}</td>
                            <td className="px-5 py-4 font-bold text-emerald-700">
                              ₹{p.workerPayableAmount}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  p.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 uppercase font-semibold text-slate-700">
                              {p.paymentMethod || 'Razorpay / UPI'}
                            </td>
                            <td className="px-5 py-4 font-mono text-muted">
                              {p.transactionRef || p._id}
                            </td>
                            <td className="px-5 py-4 text-muted">
                              {new Date(p.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WORKER PAYOUTS LEDGER */}
          {activeNav === 'payouts' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Worker Payout Vouchers</h2>
                    <p className="text-xs text-muted">
                      Admin-authorized disbursements to workers for completed customer services
                    </p>
                  </div>
                  <div className="text-xs font-bold bg-amber-50 text-amber-800 px-3 py-1.5 rounded-xl border border-amber-200">
                    Pending Total: ₹{pendingPayoutTotal.toLocaleString()}
                  </div>
                </div>

                {payoutsList.length === 0 ? (
                  <EmptyState
                    title="No payouts queued"
                    message="Payout vouchers are automatically created when customers complete payments for finished services."
                  />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-line">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-line font-bold uppercase tracking-wider text-muted">
                        <tr>
                          <th className="px-5 py-3.5">Payable Amount</th>
                          <th className="px-5 py-3.5">Status</th>
                          <th className="px-5 py-3.5">Payout Method</th>
                          <th className="px-5 py-3.5">Reference ID</th>
                          <th className="px-5 py-3.5">Created At</th>
                          <th className="px-5 py-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {payoutsList.map((po) => (
                          <tr key={po._id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-4 font-black text-ink text-sm">
                              ₹{po.workerPayableAmount}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  po.status === 'PAID'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {po.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 uppercase font-semibold text-slate-700">
                              {po.method || 'Manual NEFT/UPI'}
                            </td>
                            <td className="px-5 py-4 font-mono text-muted">
                              {po.providerPayoutRef || po._id}
                            </td>
                            <td className="px-5 py-4 text-muted">
                              {new Date(po.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-4 text-right">
                              {po.status !== 'PAID' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => setSelectedPayout(po)}
                                  className="text-xs font-bold bg-blue-600 hover:bg-blue-700"
                                >
                                  Authorize / Mark Paid
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: WORKER VERIFICATIONS */}
          {activeNav === 'verifications' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                <div className="border-b border-line pb-4">
                  <h2 className="text-lg font-bold text-ink">Worker Verification Applications</h2>
                  <p className="text-xs text-muted">
                    Review background, skills, and identity documents submitted by local service providers
                  </p>
                </div>

                {pendingWorkers.length === 0 ? (
                  <EmptyState
                    title="All caught up!"
                    message="No worker applications are currently pending verification."
                  />
                ) : (
                  <div className="space-y-4">
                    {pendingWorkers.map((w) => (
                      <div
                        key={w._id}
                        className="rounded-2xl border border-line bg-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-ink">
                              {w.userId?.name || 'Worker'}
                            </span>
                            <span className="text-xs text-muted">({w.userId?.phone || 'No phone'})</span>
                            <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                              Pending Review
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium">
                            {w.professionalDescription || 'No description provided'}
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(w.serviceCategories || []).map((c: string) => (
                              <Badge key={c} tone="brand">
                                {c}
                              </Badge>
                            ))}
                          </div>
                          {(w.verificationDocuments || []).length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                                Verification documents:
                              </span>
                              {(w.verificationDocuments || []).map((doc: { label: string; url: string }, idx: number) => {
                                const key = `${w._id}:${idx}`;
                                return (
                                  <button
                                    key={key}
                                    onClick={() => handleViewDocument(w._id, idx, doc.label || `document ${idx + 1}`)}
                                    disabled={documentLoading === key}
                                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                                  >
                                    <Eye size={12} />
                                    {documentLoading === key ? 'Opening…' : doc.label || `Document ${idx + 1}`}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="pt-2 text-[11px] text-amber-700">
                              No verification documents uploaded.
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleApproveWorker(w._id)}
                            className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setRejectId(w._id)}
                            className="font-bold"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: USER MANAGEMENT */}
          {activeNav === 'users' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Platform Users</h2>
                    <p className="text-xs text-muted">
                      Manage customers, workers, and administrators registered on KAMLE AI
                    </p>
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search name, email or phone…"
                      className="rounded-xl border border-line bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-ink focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-line">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-line font-bold uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-5 py-3.5">Name</th>
                        <th className="px-5 py-3.5">Email / Phone</th>
                        <th className="px-5 py-3.5">Role</th>
                        <th className="px-5 py-3.5">Account Status</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filteredUsers.map((u) => (
                        <tr key={u.id || u._id} className="hover:bg-slate-50/70 transition">
                          <td className="px-5 py-4 font-bold text-ink">{u.name}</td>
                          <td className="px-5 py-4 text-muted">
                            {u.email} <span className="text-[11px]">({u.phone})</span>
                          </td>
                          <td className="px-5 py-4 uppercase font-bold text-slate-700">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-800'
                                  : u.role === 'worker'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                u.accountStatus === 'active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {u.accountStatus}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => handleToggleUserStatus(u)}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                                  u.accountStatus === 'active'
                                    ? 'text-rose-600 border-rose-200 hover:bg-rose-50'
                                    : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                                }`}
                              >
                                {u.accountStatus === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ENQUIRIES & DISPUTES */}
          {activeNav === 'enquiries' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Enquiries & Disputes</h2>
                    <p className="text-xs text-muted">
                      Monitor every service request and resolve customer/worker disputes.
                    </p>
                  </div>
                  <select
                    value={enquiryStatusFilter}
                    onChange={(e) => setEnquiryStatusFilter(e.target.value)}
                    className="rounded-xl border border-line bg-slate-50 px-3 py-1.5 text-xs text-ink font-semibold focus:outline-none"
                  >
                    <option value="">All statuses</option>
                    {['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REJECTED'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {filteredEnquiries.length === 0 ? (
                  <EmptyState title="No enquiries found" message="No service requests match the selected filter." />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-line">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-line font-bold uppercase tracking-wider text-muted">
                        <tr>
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3">Worker</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Created</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {filteredEnquiries.map((e) => (
                          <tr key={e._id} className="hover:bg-slate-50/70 transition align-top">
                            <td className="px-4 py-3 font-semibold text-ink">{displayName(e.customerId)}</td>
                            <td className="px-4 py-3 text-muted">{displayName(e.workerId)}</td>
                            <td className="px-4 py-3 text-muted">{e.serviceCategory || '—'}</td>
                            <td className="px-4 py-3 font-bold text-ink">₹{e.serviceAmount ?? 0}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(e.status)}`}>
                                {e.status}
                              </span>
                              {e.disputeReason && (
                                <div className="mt-1 max-w-[180px] text-[10px] text-rose-600">{e.disputeReason}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted">{new Date(e.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-right">
                              {e.status === 'DISPUTED' ? (
                                <div className="flex flex-wrap justify-end gap-1.5">
                                  <button
                                    onClick={() => handleResolveDispute(e._id, 'COMPLETED')}
                                    disabled={actionBusy === e._id}
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                  >
                                    Resolve → Completed
                                  </button>
                                  <button
                                    onClick={() => handleResolveDispute(e._id, 'CANCELLED')}
                                    disabled={actionBusy === e._id}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                                  >
                                    Cancel Job
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: REVIEW MODERATION */}
          {activeNav === 'reviews' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Review Moderation</h2>
                    <p className="text-xs text-muted">
                      Approve legitimate reviews or reject abusive content. Ratings recompute automatically.
                    </p>
                  </div>
                  <select
                    value={reviewStatusFilter}
                    onChange={(e) => setReviewStatusFilter(e.target.value)}
                    className="rounded-xl border border-line bg-slate-50 px-3 py-1.5 text-xs text-ink font-semibold focus:outline-none"
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {filteredReviews.length === 0 ? (
                  <EmptyState title="No reviews found" message="No reviews match the selected filter." />
                ) : (
                  <div className="space-y-3">
                    {filteredReviews.map((r) => (
                      <div key={r._id} className="rounded-2xl border border-line p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink">{displayName(r.customerId)}</span>
                            <span className="text-muted">→</span>
                            <span className="font-semibold text-slate-700">{displayName(r.workerId)}</span>
                            <span className="text-amber-500 font-bold">{'★'.repeat(Number(r.rating) || 0)}{'☆'.repeat(5 - (Number(r.rating) || 0))}</span>
                          </div>
                          <p className="text-xs text-slate-600">{r.comment || 'No comment provided.'}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted">
                            <span className={`rounded-full border px-2 py-0.5 font-bold ${statusTone(r.moderationStatus || 'pending')}`}>
                              {r.moderationStatus || 'pending'}
                            </span>
                            <span>{new Date(r.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {r.moderationStatus !== 'approved' && (
                            <button
                              onClick={() => handleModerateReview(r._id, 'approved')}
                              disabled={actionBusy === r._id}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          {r.moderationStatus !== 'rejected' && (
                            <button
                              onClick={() => handleModerateReview(r._id, 'rejected')}
                              disabled={actionBusy === r._id}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: COMPLAINTS & REPORTS */}
          {activeNav === 'reports' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Complaints & Reports</h2>
                    <p className="text-xs text-muted">
                      Triage user reports, record investigation progress, and close resolved cases.
                    </p>
                  </div>
                  <select
                    value={reportStatusFilter}
                    onChange={(e) => setReportStatusFilter(e.target.value)}
                    className="rounded-xl border border-line bg-slate-50 px-3 py-1.5 text-xs text-ink font-semibold focus:outline-none"
                  >
                    <option value="">All statuses</option>
                    <option value="open">Open</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>

                {filteredReports.length === 0 ? (
                  <EmptyState title="No reports found" message="No user reports match the selected filter." />
                ) : (
                  <div className="space-y-3">
                    {filteredReports.map((r: any) => (
                      <div key={r._id} className="rounded-2xl border border-line p-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-ink">{displayName(r.reporterId)}</span>
                            <span className="text-muted">reported</span>
                            <span className="font-semibold text-slate-700">
                              {displayName(r.reportedUserId)}
                              {r.reportedUserId?.role ? ` (${r.reportedUserId.role})` : ''}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(r.status)}`}>
                              {r.status}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-700">{r.reason}</p>
                          {r.details && <p className="text-xs text-muted">{r.details}</p>}
                          <p className="text-[10px] text-muted">{new Date(r.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 shrink-0">
                          {r.status !== 'reviewing' && (
                            <button
                              onClick={() => handleReportStatus(r._id, 'reviewing')}
                              disabled={actionBusy === r._id}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            >
                              Start Review
                            </button>
                          )}
                          {r.status !== 'resolved' && (
                            <button
                              onClick={() => handleReportStatus(r._id, 'resolved')}
                              disabled={actionBusy === r._id}
                              className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Mark Resolved
                            </button>
                          )}
                          {r.status !== 'dismissed' && (
                            <button
                              onClick={() => handleReportStatus(r._id, 'dismissed')}
                              disabled={actionBusy === r._id}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: SERVICE CATEGORIES */}
          {activeNav === 'categories' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Service Categories</h2>
                    <p className="text-xs text-muted">
                      Control the marketplace taxonomy used for discovery and AI matching.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setCategoryModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 font-bold gap-1.5"
                  >
                    <Plus size={14} /> New Category
                  </Button>
                </div>

                {categoriesList.length === 0 ? (
                  <EmptyState title="No categories yet" message="Create a service category to start organising worker discovery." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {categoriesList.map((c: any) => (
                      <div key={c._id} className="rounded-2xl border border-line p-4 flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-ink">{c.name}</h3>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                c.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {c.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted font-mono">{c.slug}</p>
                          <p className="mt-1 text-xs text-slate-600">{c.description || 'No description.'}</p>
                          {Array.isArray(c.keywords) && c.keywords.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {c.keywords.map((k: string) => (
                                <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{k}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleCategory(c)}
                          disabled={actionBusy === c._id}
                          className={`self-start rounded-lg border px-2.5 py-1 text-[11px] font-bold disabled:opacity-50 ${
                            c.isActive
                              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {c.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 10: AUDIT LOG */}
          {activeNav === 'audit' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Administrative Audit Log</h2>
                    <p className="text-xs text-muted">
                      Immutable trail of approvals, moderation, payout, category, and configuration actions.
                    </p>
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      placeholder="Search action, target or id…"
                      className="rounded-xl border border-line bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-ink focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>

                {filteredAuditLogs.length === 0 ? (
                  <EmptyState
                    title="No audit entries"
                    message="Administrative actions will appear here as they are performed."
                  />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-line">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-line font-bold uppercase tracking-wider text-muted">
                        <tr>
                          <th className="px-4 py-3">When</th>
                          <th className="px-4 py-3">Admin</th>
                          <th className="px-4 py-3">Action</th>
                          <th className="px-4 py-3">Target</th>
                          <th className="px-4 py-3">Metadata</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {filteredAuditLogs.map((a: any) => (
                          <tr key={a._id} className="hover:bg-slate-50/70 transition align-top">
                            <td className="px-4 py-3 text-muted whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                            <td className="px-4 py-3 font-semibold text-ink">{displayName(a.adminId)}</td>
                            <td className="px-4 py-3 font-mono text-[11px] text-blue-700">{a.action}</td>
                            <td className="px-4 py-3 text-muted">
                              {a.targetType}
                              {a.targetId ? <span className="block font-mono text-[10px]">{a.targetId}</span> : null}
                            </td>
                            <td className="px-4 py-3 text-muted">
                              <code className="block max-w-[280px] truncate font-mono text-[10px]">
                                {a.metadata && Object.keys(a.metadata).length > 0 ? JSON.stringify(a.metadata) : '—'}
                              </code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 11: AI STATUS / CONTROL CENTER */}
          {activeNav === 'ai' && (
            <div className="space-y-6">
              <AiControlCenter />
            </div>
          )}

          {/* TAB 7: COMMISSION & RULES CONFIGURATION */}
          {activeNav === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <div className="rounded-3xl border border-line bg-white p-6 sm:p-8 shadow-sm">
                <h2 className="text-lg font-bold text-ink">Platform Commission & Policies</h2>
                <p className="text-xs text-muted mt-1">
                  Configure default marketplace take-rate and payout settlement timeframes.
                </p>

                <form onSubmit={handleSaveConfig} className="mt-6 space-y-4">
                  <Field label="Default Marketplace Commission (%)">
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(Number(e.target.value))}
                      required
                    />
                  </Field>

                  <Field label="Standard Worker Payout Terms">
                    <Input
                      value={payoutTerms}
                      onChange={(e) => setPayoutTerms(e.target.value)}
                      placeholder="e.g. T+2 business days"
                      required
                    />
                  </Field>

                  <div className="rounded-2xl bg-blue-50/70 p-4 border border-blue-100 text-xs text-blue-900 space-y-1">
                    <span className="font-bold">Transparent Revenue Math Example:</span>
                    <div>₹1,000 Service Billed = ₹{1000 * (commissionRate / 100)} Platform Fee + ₹{1000 * (1 - commissionRate / 100)} Net Worker Share</div>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={configSaving}
                      className="bg-blue-600 hover:bg-blue-700 font-bold"
                    >
                      {configSaving ? 'Saving Policy...' : 'Save Configuration'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: Payout Disbursement Modal */}
      {selectedPayout && (
        <Modal
          open={Boolean(selectedPayout)}
          onClose={() => !payoutLoading && setSelectedPayout(null)}
          title="Disburse Worker Payout"
        >
          <form onSubmit={handleDisbursePayout} className="space-y-4">
            <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100 text-xs text-emerald-900">
              <div className="flex justify-between font-bold text-sm mb-1">
                <span>Disbursement Amount</span>
                <span className="text-base text-emerald-700">₹{selectedPayout.workerPayableAmount}</span>
              </div>
              <p>
                Confirm that the worker share of ₹{selectedPayout.workerPayableAmount} has been transferred via Razorpay Route or Bank NEFT.
              </p>
            </div>

            <Field label="Bank / Payout Reference (UTR / Trans ID)">
              <Input
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                placeholder="e.g. UTR-20261102-998811 or rzp_trf_xyz"
                required
              />
            </Field>

            <Field label="Audit Note (Optional)">
              <Input
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
                placeholder="e.g. Verified and approved via ICICI NEFT"
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setSelectedPayout(null)}
                disabled={payoutLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={payoutLoading || !payoutRef.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 font-bold"
              >
                {payoutLoading ? 'Recording Transfer...' : 'Confirm Paid'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Create Service Category */}
      {categoryModalOpen && (
        <Modal open={categoryModalOpen} onClose={() => !categorySaving && setCategoryModalOpen(false)} title="Create Service Category">
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <Field label="Category Name">
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Electrical Repairs"
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description shown to customers"
                maxLength={400}
              />
            </Field>
            <Field label="Icon key">
              <Input
                value={categoryForm.icon}
                onChange={(e) => setCategoryForm((f) => ({ ...f, icon: e.target.value }))}
                placeholder="wrench"
                maxLength={40}
              />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setCategoryModalOpen(false)} disabled={categorySaving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={categorySaving || categoryForm.name.trim().length < 2}
                className="bg-blue-600 hover:bg-blue-700 font-bold"
              >
                {categorySaving ? 'Creating…' : 'Create Category'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Reject Worker Application */}
      {rejectId && (
        <Modal
          open={Boolean(rejectId)}
          onClose={() => setRejectId(null)}
          title="Reject Worker Application"
        >
          <div className="space-y-4">
            <p className="text-xs text-muted">
              State the reason for rejecting this verification request. The worker will be notified to update their documents.
            </p>
            <Field label="Rejection Reason">
              <Textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Incomplete ID document or blurred photograph..."
              />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setRejectId(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRejectConfirm}
                disabled={rejectReason.trim().length < 5}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
