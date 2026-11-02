import {
  Check,
  LayoutDashboard,
  UserCog,
  FileCheck,
  Activity,
  Clock,
  Search,
  LogOut,
  Menu,
  Calendar,
  X,
  CreditCard,
  Wallet,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  adminDashboard,
  adminWorkers,
  adminUsers,
  adminPayments,
  adminPayouts,
  adminUpdatePayoutStatus,
  setApproval,
  setAccountStatus,
} from '../../services/api';
import { Badge, Button, Field, Modal, Textarea, Input } from '../../components/ui/primitives';
import { EmptyState } from '../../components/ui/states';
import { AiControlCenter } from '../../features/ai-admin/AiControlCenter';
import { Logo } from '../../components/brand/Logo';
import { useAuth } from '../../context/AuthContext';
import type { Payment, Payout } from '../../types';

type AppRow = any;
type AdminNav = 'overview' | 'users' | 'verifications' | 'payments' | 'ai';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeNav, setActiveNav] = useState<AdminNav>('overview');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingWorkers, setPendingWorkers] = useState<AppRow[]>([]);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [payoutsList, setPayoutsList] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(false);

  // Payout disbursement modal state
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, w, u, p, po] = await Promise.all([
        adminDashboard(),
        adminWorkers('pending'),
        adminUsers(),
        adminPayments().catch(() => ({ items: [] })),
        adminPayouts().catch(() => ({ items: [] })),
      ]);
      setStats(s.stats || {});
      setPendingWorkers(w.items || []);
      setUsersList(u.items || []);
      setPaymentsList(p.items || []);
      setPayoutsList(po.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleApprove(id: string) {
    try {
      await setApproval(id, 'approved');
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
      alert('Payout marked as PAID successfully!');
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

  const navItems = [
    { id: 'overview' as AdminNav, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'payments' as AdminNav, label: 'Payments & Revenue', icon: CreditCard, badge: (stats.pendingPayoutsTotal ?? 0) > 0 ? `₹${stats.pendingPayoutsTotal}` : undefined },
    { id: 'users' as AdminNav, label: 'User Management', icon: UserCog },
    { id: 'verifications' as AdminNav, label: 'Worker Applications', icon: FileCheck, badge: (stats.pendingApplications ?? 0) > 0 ? String(stats.pendingApplications) : undefined },
    { id: 'ai' as AdminNav, label: 'AI Status', icon: Activity },
  ];

  const today = new Date();

  return (
    <div className='min-h-screen' style={{ background: '#F5F8FD' }}>
      {/* Header */}
      <header className='sticky top-0 z-50 border-b bg-white shadow-sm'>
        <div className='flex h-16 items-center justify-between px-4 lg:px-6'>
          <div className='flex items-center gap-4'>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className='rounded-lg p-2 hover:bg-slate-100 lg:hidden'>
              <Menu size={20} />
            </button>
            <div className='hidden lg:flex items-center gap-3'>
              <Logo size='sm' />
            </div>
            <div className='hidden md:flex items-center gap-2 rounded-lg border border-line px-3 py-1.5'>
              <Search size={16} className='text-muted' />
              <input type='text' placeholder='Search platform...' className='w-64 bg-transparent text-sm outline-none' />
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <Button variant='secondary' size='sm' onClick={() => loadAll()} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
            <div className='flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 bg-slate-50'>
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm'>
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className='hidden sm:block text-left'>
                <p className='text-xs font-bold text-ink leading-tight'>{user?.name || 'Admin'}</p>
                <p className='text-[10px] text-muted leading-tight'>Administrator</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className='flex'>
        {/* Left Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-white border-r border-line shadow-lg transition-transform lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ top: '64px', height: 'calc(100vh - 64px)' }}
        >
          <div className='flex h-full flex-col'>
            <nav className='flex-1 space-y-1 p-3 overflow-y-auto'>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveNav(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={18} className={active ? 'text-blue-600' : 'text-slate-400'} />
                    <span className='flex-1 text-left'>{item.label}</span>
                    {item.badge && (
                      <span className='rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white'>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className='border-t border-line p-3'>
              <button
                onClick={logout}
                className='flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition'
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className='flex-1 p-4 lg:p-7 overflow-y-auto'>
          <section className='max-w-[1400px] space-y-6'>
            {/* OVERVIEW TAB */}
            {activeNav === 'overview' && (
              <div className='space-y-6'>
                {/* Welcome Banner */}
                <div
                  className='relative overflow-hidden rounded-2xl p-6 md:p-8 border border-blue-100 shadow-sm'
                  style={{ background: 'linear-gradient(135deg, #EAF3FF 0%, #FFFFFF 100%)' }}
                >
                  <h1 className='text-2xl font-black text-slate-800 md:text-3xl'>
                    Welcome back, {user?.name?.split(' ')[0] || 'Admin'}! 👋
                  </h1>
                  <p className='mt-2 text-sm text-slate-600 max-w-xl'>
                    Manage your marketplace platform, monitor customer payments, track revenue, and verify local service professionals.
                  </p>
                  <div className='mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500'>
                    <span className='inline-flex items-center gap-1.5'>
                      <Calendar size={14} className='text-blue-600' />
                      {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <span className='inline-flex items-center gap-1.5'>
                      <Clock size={14} className='text-blue-600' />
                      {today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* 6 Platform KPI Cards */}
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                  <div className='rounded-2xl border border-line bg-white p-5 shadow-sm'>
                    <div className='flex items-center justify-between text-muted'>
                      <span className='text-xs font-bold uppercase tracking-wider'>Total Users</span>
                      <UserCog size={18} className='text-blue-600' />
                    </div>
                    <p className='mt-2 text-2xl font-black text-slate-900'>{stats.totalUsers ?? 0}</p>
                    <p className='mt-1 text-xs text-muted'>{stats.totalCustomers ?? 0} customers &middot; {stats.totalWorkers ?? 0} workers</p>
                  </div>

                  <div className='rounded-2xl border border-line bg-white p-5 shadow-sm'>
                    <div className='flex items-center justify-between text-muted'>
                      <span className='text-xs font-bold uppercase tracking-wider'>Verified Workers</span>
                      <Check size={18} className='text-emerald-600' />
                    </div>
                    <p className='mt-2 text-2xl font-black text-slate-900'>{stats.approvedWorkers ?? 0}</p>
                    <p className='mt-1 text-xs text-emerald-600 font-semibold'>Visible in public search</p>
                  </div>

                  <div className='rounded-2xl border border-line bg-white p-5 shadow-sm'>
                    <div className='flex items-center justify-between text-muted'>
                      <span className='text-xs font-bold uppercase tracking-wider'>Pending Applications</span>
                      <FileCheck size={18} className='text-amber-500' />
                    </div>
                    <p className='mt-2 text-2xl font-black text-slate-900'>{stats.pendingApplications ?? 0}</p>
                    <p className='mt-1 text-xs text-amber-600 font-semibold'>Requires admin verification</p>
                  </div>

                  {/* Payment volume */}
                  <div className='rounded-2xl border border-line bg-white p-5 shadow-sm'>
                    <div className='flex items-center justify-between text-muted'>
                      <span className='text-xs font-bold uppercase tracking-wider'>Gross Volume</span>
                      <CreditCard size={18} className='text-blue-600' />
                    </div>
                    <p className='mt-2 text-2xl font-black text-slate-900'>₹{stats.totalVolume ?? 0}</p>
                    <p className='mt-1 text-xs text-muted'>{stats.paymentsReceived ?? 0} successful payments</p>
                  </div>

                  {/* Platform Commission Revenue */}
                  <div className='rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm'>
                    <div className='flex items-center justify-between text-emerald-700'>
                      <span className='text-xs font-bold uppercase tracking-wider'>Platform Commission (10%)</span>
                      <TrendingUp size={18} className='text-emerald-600' />
                    </div>
                    <p className='mt-2 text-2xl font-black text-emerald-700'>₹{stats.totalCommission ?? 0}</p>
                    <p className='mt-1 text-xs text-emerald-600 font-semibold'>Net platform revenue earned</p>
                  </div>

                  {/* Worker Payouts Pending */}
                  <div className='rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm'>
                    <div className='flex items-center justify-between text-amber-700'>
                      <span className='text-xs font-bold uppercase tracking-wider'>Pending Worker Payouts</span>
                      <Wallet size={18} className='text-amber-600' />
                    </div>
                    <p className='mt-2 text-2xl font-black text-amber-700'>₹{stats.pendingPayoutsTotal ?? 0}</p>
                    <p className='mt-1 text-xs text-amber-700 font-semibold'>Disbursed: ₹{stats.totalPayoutsPaid ?? 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* PAYMENTS & REVENUE TAB */}
            {activeNav === 'payments' && (
              <div className='space-y-6'>
                {/* Header Summary */}
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                  <div>
                    <h2 className='text-xl font-black text-slate-900'>Payments & Financial Transactions</h2>
                    <p className='mt-1 text-sm text-muted'>
                      Monitor real-time Razorpay customer payments, track platform commission fees, and disburse payouts to local workers.
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge tone='success'>Razorpay Gateway Active</Badge>
                  </div>
                </div>

                {/* 4 Financial Stat Cards */}
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                  <div className='rounded-xl border border-line bg-white p-5 shadow-sm'>
                    <p className='text-xs font-bold uppercase tracking-wider text-muted'>Total Payment Volume</p>
                    <p className='mt-2 text-2xl font-black text-slate-900'>₹{stats.totalVolume ?? 0}</p>
                    <p className='mt-1 text-xs text-muted'>{stats.paymentsReceived ?? 0} completed charges</p>
                  </div>
                  <div className='rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm'>
                    <p className='text-xs font-bold uppercase tracking-wider text-emerald-700'>Platform Commission</p>
                    <p className='mt-2 text-2xl font-black text-emerald-700'>₹{stats.totalCommission ?? 0}</p>
                    <p className='mt-1 text-xs text-emerald-600 font-semibold'>10% platform fee</p>
                  </div>
                  <div className='rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm'>
                    <p className='text-xs font-bold uppercase tracking-wider text-amber-700'>Pending Payouts</p>
                    <p className='mt-2 text-2xl font-black text-amber-700'>₹{stats.pendingPayoutsTotal ?? 0}</p>
                    <p className='mt-1 text-xs text-amber-700 font-semibold'>Awaiting admin transfer</p>
                  </div>
                  <div className='rounded-xl border border-line bg-white p-5 shadow-sm'>
                    <p className='text-xs font-bold uppercase tracking-wider text-muted'>Paid Out to Workers</p>
                    <p className='mt-2 text-2xl font-black text-slate-900'>₹{stats.totalPayoutsPaid ?? 0}</p>
                    <p className='mt-1 text-xs text-emerald-600 font-semibold'>Transferred to bank accounts</p>
                  </div>
                </div>

                {/* Transactions Table */}
                <div className='rounded-2xl border border-line bg-white shadow-sm overflow-hidden'>
                  <div className='border-b border-line px-5 py-4 flex items-center justify-between'>
                    <div>
                      <h3 className='text-base font-bold text-slate-900'>Customer Payment Ledger</h3>
                      <p className='text-xs text-muted mt-0.5'>Every service payment received through the gateway</p>
                    </div>
                    <Badge tone='brand'>{paymentsList.length} Payments</Badge>
                  </div>

                  {paymentsList.length === 0 ? (
                    <div className='p-8 text-center text-sm text-muted'>
                      No customer payments recorded yet. Payments will appear here once customers pay for completed worker services.
                    </div>
                  ) : (
                    <div className='overflow-x-auto'>
                      <table className='w-full text-sm text-left'>
                        <thead className='bg-slate-50 border-b border-line text-xs font-semibold text-muted uppercase tracking-wider'>
                          <tr>
                            <th className='px-5 py-3'>Transaction Ref</th>
                            <th className='px-5 py-3'>Gross Amount</th>
                            <th className='px-5 py-3'>Platform Fee (10%)</th>
                            <th className='px-5 py-3'>Worker Share</th>
                            <th className='px-5 py-3'>Status</th>
                            <th className='px-5 py-3'>Method</th>
                            <th className='px-5 py-3'>Date</th>
                          </tr>
                        </thead>
                        <tbody className='divide-y divide-line'>
                          {paymentsList.map((p) => (
                            <tr key={p._id} className='hover:bg-slate-50/70 transition'>
                              <td className='px-5 py-3 font-mono text-xs text-slate-700'>
                                <div className='font-bold text-ink'>{p.transactionRef}</div>
                                {p.providerPaymentId && (
                                  <div className='text-[10px] text-muted'>Razorpay: {p.providerPaymentId}</div>
                                )}
                              </td>
                              <td className='px-5 py-3 font-bold text-ink'>₹{p.amount}</td>
                              <td className='px-5 py-3 font-bold text-emerald-600'>+₹{p.commissionAmount}</td>
                              <td className='px-5 py-3 font-semibold text-slate-600'>₹{p.workerPayableAmount}</td>
                              <td className='px-5 py-3'>
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    p.status === 'COMPLETED'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : p.status === 'FAILED'
                                      ? 'bg-red-50 text-red-700 border border-red-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </td>
                              <td className='px-5 py-3 text-xs uppercase font-medium text-slate-500'>
                                {p.paymentMethod || 'UPI'}
                              </td>
                              <td className='px-5 py-3 text-xs text-muted'>
                                {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Worker Payouts Ledger */}
                <div className='rounded-2xl border border-line bg-white shadow-sm overflow-hidden'>
                  <div className='border-b border-line px-5 py-4 flex items-center justify-between'>
                    <div>
                      <h3 className='text-base font-bold text-slate-900'>Worker Payout Ledger</h3>
                      <p className='text-xs text-muted mt-0.5'>Disburse worker shares (90%) directly to worker accounts</p>
                    </div>
                    <Badge tone='brand'>{payoutsList.length} Payouts</Badge>
                  </div>

                  {payoutsList.length === 0 ? (
                    <div className='p-8 text-center text-sm text-muted'>
                      No pending payouts. When customer payments settle, worker payout vouchers are queued here.
                    </div>
                  ) : (
                    <div className='overflow-x-auto'>
                      <table className='w-full text-sm text-left'>
                        <thead className='bg-slate-50 border-b border-line text-xs font-semibold text-muted uppercase tracking-wider'>
                          <tr>
                            <th className='px-5 py-3'>Worker</th>
                            <th className='px-5 py-3'>Payable Amount</th>
                            <th className='px-5 py-3'>Service / Commission</th>
                            <th className='px-5 py-3'>Status</th>
                            <th className='px-5 py-3'>Reference</th>
                            <th className='px-5 py-3 text-right'>Action</th>
                          </tr>
                        </thead>
                        <tbody className='divide-y divide-line'>
                          {payoutsList.map((po) => {
                            const isPaid = po.status === 'PAID';
                            return (
                              <tr key={po._id} className='hover:bg-slate-50/70 transition'>
                                <td className='px-5 py-3 font-semibold text-ink'>
                                  {typeof po.workerId === 'object' && po.workerId !== null ? (po.workerId as any).name : 'Worker'}
                                </td>
                                <td className='px-5 py-3 font-bold text-emerald-700'>₹{po.workerPayableAmount}</td>
                                <td className='px-5 py-3 text-xs text-muted'>
                                  ₹{po.serviceAmount} gross &middot; -₹{po.commissionAmount} (10%)
                                </td>
                                <td className='px-5 py-3'>
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      isPaid
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}
                                  >
                                    {po.status}
                                  </span>
                                </td>
                                <td className='px-5 py-3 font-mono text-xs text-muted'>
                                  {po.providerPayoutRef || '—'}
                                </td>
                                <td className='px-5 py-3 text-right'>
                                  {!isPaid && (
                                    <Button
                                      size='sm'
                                      className='bg-emerald-600 hover:bg-emerald-700 text-white'
                                      onClick={() => {
                                        setSelectedPayout(po);
                                        setPayoutRef(`UTR-${Date.now().toString().slice(-8)}`);
                                      }}
                                    >
                                      Mark Paid
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* USERS TAB */}
            {activeNav === 'users' && (
              <div className='rounded-2xl border border-line bg-white shadow-sm overflow-hidden'>
                <div className='border-b border-line px-5 py-4'>
                  <h2 className='text-base font-bold text-ink'>User Management</h2>
                </div>
                <div className='overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead className='bg-slate-50 border-b border-line text-xs font-semibold text-muted uppercase'>
                      <tr>
                        <th className='px-5 py-3 text-left'>Name</th>
                        <th className='px-5 py-3 text-left'>Role</th>
                        <th className='px-5 py-3 text-left'>Status</th>
                        <th className='px-5 py-3 text-left'>Action</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-line'>
                      {usersList.map((u: any) => (
                        <tr key={u.id || u._id} className='hover:bg-slate-50 transition'>
                          <td className='px-5 py-3 font-medium text-ink'>
                            {u.name}
                            <div className='text-xs text-muted'>{u.email || u.phone}</div>
                          </td>
                          <td className='px-5 py-3'>
                            <Badge tone={u.role === 'admin' ? 'danger' : u.role === 'worker' ? 'brand' : 'default'}>
                              {u.role?.toUpperCase()}
                            </Badge>
                          </td>
                          <td className='px-5 py-3'>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                u.accountStatus === 'active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {u.accountStatus}
                            </span>
                          </td>
                          <td className='px-5 py-3'>
                            {u.role !== 'admin' && (
                              <Button
                                size='sm'
                                variant='secondary'
                                onClick={() => handleToggleUserStatus(u)}
                              >
                                {u.accountStatus === 'active' ? 'Suspend' : 'Activate'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VERIFICATIONS TAB */}
            {activeNav === 'verifications' && (
              <div className='rounded-2xl border border-line bg-white shadow-sm overflow-hidden'>
                <div className='border-b border-line px-5 py-4 flex items-center justify-between'>
                  <h2 className='text-base font-bold text-ink'>Worker Applications</h2>
                  <Badge tone='brand'>{pendingWorkers.length}</Badge>
                </div>
                <div className='p-5'>
                  {pendingWorkers.length === 0 ? (
                    <EmptyState title='No pending applications' message='All worker applications have been reviewed.' />
                  ) : (
                    <div className='space-y-3'>
                      {pendingWorkers.map((pw: any) => (
                        <div key={pw._id} className='rounded-xl border border-line p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                          <div>
                            <div className='flex gap-2 items-center'>
                              <span className='font-bold text-ink'>{pw.userId?.name}</span>
                              <Badge tone='warning'>PENDING REVIEW</Badge>
                            </div>
                            <p className='text-sm mt-1 text-slate-600'>{pw.professionalDescription || 'No description provided'}</p>
                            <p className='text-xs text-muted mt-1'>Categories: {(pw.serviceCategories || []).join(', ')}</p>
                          </div>
                          <div className='flex gap-2 shrink-0'>
                            <Button size='sm' className='bg-emerald-600 hover:bg-emerald-700 text-white' onClick={() => handleApprove(pw._id)}>
                              <Check size={14} /> Approve
                            </Button>
                            <Button size='sm' variant='secondary' className='text-red-600 hover:bg-red-50' onClick={() => setRejectId(pw._id)}>
                              <X size={14} /> Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI STATUS / CONTROL CENTER TAB */}
            {activeNav === 'ai' && <AiControlCenter />}
          </section>
        </main>
      </div>

      {sidebarOpen && <div className='fixed inset-0 z-30 bg-black/50 lg:hidden' onClick={() => setSidebarOpen(false)} />}

      {/* Reject Reason Modal */}
      {rejectId && (
        <Modal open={true} onClose={() => setRejectId(null)} title='Reject Application'>
          <div className='space-y-4'>
            <Field label='Reason for Rejection'>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder='Please specify why this application cannot be approved...'
              />
            </Field>
            <div className='flex justify-end gap-2'>
              <Button variant='secondary' onClick={() => setRejectId(null)}>Cancel</Button>
              <Button variant='danger' onClick={handleRejectConfirm} disabled={rejectReason.trim().length < 5}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Disburse Worker Payout Modal */}
      {selectedPayout && (
        <Modal open={true} onClose={() => setSelectedPayout(null)} title='Mark Worker Payout as Disbursed'>
          <form onSubmit={handleDisbursePayout} className='space-y-4'>
            <p className='text-xs text-muted'>
              Confirm that you have transferred <strong>₹{selectedPayout.workerPayableAmount}</strong> to the worker via NEFT, IMPS, or UPI.
            </p>

            <Field label='Bank Transfer Reference / UTR Number'>
              <Input
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                placeholder='e.g. UTR123456789 or UPI-REF-456'
                required
              />
            </Field>

            <Field label='Internal Note (Optional)'>
              <Input
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
                placeholder='e.g. Sent via HDFC Corporate Banking'
              />
            </Field>

            <div className='flex justify-end gap-2 pt-2'>
              <Button variant='secondary' type='button' onClick={() => setSelectedPayout(null)} disabled={payoutLoading}>
                Cancel
              </Button>
              <Button variant='primary' type='submit' disabled={payoutLoading || !payoutRef.trim()} className='bg-emerald-600 hover:bg-emerald-700'>
                {payoutLoading ? 'Saving...' : 'Confirm Disbursed'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
