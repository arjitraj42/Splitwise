import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { ArrowLeft, User, HelpCircle, ArrowRight, RefreshCw } from 'lucide-react';

interface UserDetail {
  id: number;
  name: string;
  email: string;
}

interface UserBalance {
  user: UserDetail;
  joinedAt: string;
  leftAt: string | null;
  netBalance: number;
  totalPaid: number;
  totalOwed: number;
  totalSent: number;
  totalReceived: number;
}

interface SimplifiedDebt {
  fromUser: { id: number; name: string };
  toUser: { id: number; name: string };
  amount: number;
}

interface LedgerBreakdown {
  user: UserDetail;
  joinedAt: string;
  leftAt: string | null;
  netBalance: number;
  totalPaid: number;
  totalOwed: number;
  totalSent: number;
  totalReceived: number;
  breakdown: {
    paidExpenses: { id: number; description: string; date: string; amountInInr: number; currency: string; amount: number }[];
    splitRows: { id: number; shareAmount: number; expense: { id: number; description: string; date: string; amountInInr: number; currency: string; amount: number } }[];
    sentPayments: { id: number; amount: number; currency: string; normalizedAmountInInr: number; settlementDate: string; toUser: { name: string } }[];
    receivedPayments: { id: number; amount: number; currency: string; normalizedAmountInInr: number; settlementDate: string; fromUser: { name: string } }[];
  };
}

const BalancesPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // 1. Fetch Group Details
  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}`);
      return data;
    },
  });

  // 2. Fetch Group Balances & Simplified Debts
  const { data: balanceData, isLoading, error } = useQuery<{ balances: UserBalance[]; simplifiedDebts: SimplifiedDebt[] }>({
    queryKey: ['balances', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/balances/group/${groupId}`);
      return data;
    },
  });

  // 3. Fetch User Ledger Breakdown
  const { data: ledger, isLoading: ledgerLoading } = useQuery<LedgerBreakdown>({
    queryKey: ['ledger', groupId, selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null as any;
      const { data } = await api.get(`/balances/explain/${selectedUserId}?groupId=${groupId}`);
      // The endpoint returns { groups: [ { groupId, breakdown, ... } ] }
      // Let's adapt it to select the group-specific breakdown
      const groupExp = data.groups.find((g: any) => g.groupId === Number(groupId));
      return {
        user: { id: selectedUserId, name: '', email: '' }, // we can populate from balances list
        ...groupExp,
      };
    },
    enabled: !!selectedUserId,
  });

  useEffect(() => {
    const urlUserId = searchParams.get('userId');
    if (urlUserId) {
      setSelectedUserId(Number(urlUserId));
    } else if (balanceData && balanceData.balances.length > 0) {
      // Default to first member in list
      const active = balanceData.balances.filter(b => !b.leftAt);
      if (active.length > 0) {
        setSelectedUserId(active[0].user.id);
        setSearchParams({ userId: active[0].user.id.toString() });
      }
    }
  }, [searchParams, balanceData]);

  const selectUser = (userId: number) => {
    setSelectedUserId(userId);
    setSearchParams({ userId: userId.toString() });
  };

  const fmt = (n: number) =>
    `₹${Number(Math.abs(n)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const balances = balanceData?.balances || [];
  const simplifiedDebts = balanceData?.simplifiedDebts || [];
  const selectedBalance = balances.find((b) => b.user.id === selectedUserId);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumbs */}
      <nav className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Link to="/groups" className="hover:text-brand-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <Link to={`/groups/${groupId}`} className="hover:text-brand-600 transition-colors">{group?.name}</Link>
        <span>/</span>
        <span className="text-slate-600">Balances</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/groups/${groupId}`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Balances & Ledger</h1>
          <p className="text-sm text-slate-500 font-medium">Verify splits auditability and see optimized repayments</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 text-red-600 font-semibold border border-red-100">
          Failed to fetch group balances.
        </div>
      )}

      {/* Aisha's Section: Debt Simplification Cards */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-lg">
            💸
          </div>
          <div>
            <h3 className="text-base font-bold font-display text-white">Suggested Repayments</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Greedy Debt Simplification (Minimized Transfers)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {simplifiedDebts.map((d, idx) => (
            <div key={idx} className="bg-slate-850 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-brand-500/40 transition-all duration-300">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-400 mb-4">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {d.fromUser.name}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {d.toUser.name}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Settlement Amount</p>
                <p className="text-2xl font-bold font-display text-white mt-1">₹{d.amount.toFixed(2)}</p>
              </div>
            </div>
          ))}

          {simplifiedDebts.length === 0 && (
            <div className="col-span-full py-6 text-center text-slate-500 font-semibold text-sm">
              ✨ Group is fully settled up! No repayments pending.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Members Balances list */}
        <div className="lg:col-span-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Member Net Balances</h4>
          {balances.map((b) => {
            const isOwed = b.netBalance > 0;
            const owes = b.netBalance < 0;
            const isSelected = selectedUserId === b.user.id;

            return (
              <div
                key={b.user.id}
                onClick={() => selectUser(b.user.id)}
                className={`bg-white rounded-2xl p-4 cursor-pointer transition-all duration-200 border-2 flex items-center justify-between ${
                  isSelected
                    ? 'border-brand-500 shadow-md ring-4 ring-brand-50'
                    : 'border-transparent shadow-sm border-slate-100 hover:border-brand-200/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm uppercase ${
                      isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {b.user.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{b.user.name}</span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                      {isOwed ? 'Gets back' : owes ? 'Owes' : 'Settled'}
                      {b.leftAt && <span className="ml-1 text-[9px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-full uppercase">Left</span>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-bold text-sm ${isOwed ? 'text-green-600' : owes ? 'text-red-600' : 'text-slate-500'}`}>
                    {b.netBalance > 0 ? '+' : b.netBalance < 0 ? '-' : ''}
                    {fmt(b.netBalance)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right column: Drill-down explain calculation */}
        <div className="lg:col-span-7 sticky top-8">
          {selectedUserId && selectedBalance ? (
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 space-y-6">
              {/* Ledger Header */}
              <div className="pb-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xl uppercase">
                    {selectedBalance.user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-display text-slate-950">{selectedBalance.user.name}'s Ledger</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                      Active: {new Date(selectedBalance.joinedAt).toLocaleDateString()}
                      {selectedBalance.leftAt ? ` - ${new Date(selectedBalance.leftAt).toLocaleDateString()}` : ' - Present'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Net Balance</span>
                  <span className={`text-xl font-bold font-display ${selectedBalance.netBalance > 0 ? 'text-green-600' : selectedBalance.netBalance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {selectedBalance.netBalance > 0 ? '+' : ''}
                    {selectedBalance.netBalance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Formula explanation (Rohan's Request) */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs space-y-2">
                <p className="font-bold text-slate-800 flex items-center gap-1">
                  <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  How is this calculated?
                </p>
                <div className="font-mono text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-150/60 leading-relaxed">
                  Net Balance = (Paid + Sent) - (Owed + Rcvd)
                  <br />
                  Net = ({selectedBalance.totalPaid.toFixed(2)} + {selectedBalance.totalSent.toFixed(2)}) - ({selectedBalance.totalOwed.toFixed(2)} + {selectedBalance.totalReceived.toFixed(2)})
                  <br />
                  Net = {(selectedBalance.totalPaid + selectedBalance.totalSent).toFixed(2)} - {(selectedBalance.totalOwed + selectedBalance.totalReceived).toFixed(2)}
                  <br />
                  Net = {selectedBalance.netBalance.toFixed(2)}
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Paid Expenses</span>
                  <p className="font-bold font-display text-slate-900 mt-1">₹{selectedBalance.totalPaid.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Owed Shares</span>
                  <p className="font-bold font-display text-slate-900 mt-1">₹{selectedBalance.totalOwed.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Settlements Sent</span>
                  <p className="font-bold font-display text-slate-900 mt-1">₹{selectedBalance.totalSent.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Settlements Rcvd</span>
                  <p className="font-bold font-display text-slate-900 mt-1">₹{selectedBalance.totalReceived.toFixed(2)}</p>
                </div>
              </div>

              {/* Drill-down sections */}
              {ledgerLoading ? (
                <div className="py-12 flex justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
                </div>
              ) : ledger ? (
                <div className="space-y-4">
                  {/* Paid Expenses list */}
                  <div>
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Expenses Paid</h5>
                    <div className="bg-slate-50/20 rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100 px-4">
                      {ledger.breakdown.paidExpenses.map((e) => (
                        <div key={e.id} className="flex justify-between items-center py-2.5 text-xs">
                          <div>
                            <span className="font-semibold text-slate-800">{e.description}</span>
                            <span className="text-[9px] text-slate-400 block">{new Date(e.date).toLocaleDateString()}</span>
                          </div>
                          <span className="font-bold text-green-600">+{e.amountInInr.toFixed(2)}</span>
                        </div>
                      ))}
                      {ledger.breakdown.paidExpenses.length === 0 && (
                        <p className="text-slate-400 text-xs py-3 text-center">No paid expenses.</p>
                      )}
                    </div>
                  </div>

                  {/* Share Owed list */}
                  <div>
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Shares Owed</h5>
                    <div className="bg-slate-50/20 rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100 px-4">
                      {ledger.breakdown.splitRows.map((r) => (
                        <div key={r.id} className="flex justify-between items-center py-2.5 text-xs">
                          <div>
                            <span className="font-semibold text-slate-800">{r.expense.description}</span>
                            <span className="text-[9px] text-slate-400 block">{new Date(r.expense.date).toLocaleDateString()}</span>
                          </div>
                          <span className="font-bold text-red-500">-{r.shareAmount.toFixed(2)}</span>
                        </div>
                      ))}
                      {ledger.breakdown.splitRows.length === 0 && (
                        <p className="text-slate-400 text-xs py-3 text-center">No shares owed.</p>
                      )}
                    </div>
                  </div>

                  {/* Payments Sent list */}
                  <div>
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Settlements Sent</h5>
                    <div className="bg-slate-50/20 rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100 px-4">
                      {ledger.breakdown.sentPayments.map((p) => (
                        <div key={p.id} className="flex justify-between items-center py-2.5 text-xs">
                          <div>
                            <span className="font-semibold text-slate-800">Paid {p.toUser?.name}</span>
                            <span className="text-[9px] text-slate-400 block">{new Date(p.settlementDate).toLocaleDateString()}</span>
                          </div>
                          <span className="font-bold text-green-600">+{p.normalizedAmountInInr.toFixed(2)}</span>
                        </div>
                      ))}
                      {ledger.breakdown.sentPayments.length === 0 && (
                        <p className="text-slate-400 text-xs py-3 text-center">No settlements sent.</p>
                      )}
                    </div>
                  </div>

                  {/* Payments Received list */}
                  <div>
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Settlements Received</h5>
                    <div className="bg-slate-50/20 rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100 px-4">
                      {ledger.breakdown.receivedPayments.map((p) => (
                        <div key={p.id} className="flex justify-between items-center py-2.5 text-xs">
                          <div>
                            <span className="font-semibold text-slate-800">Received from {p.fromUser?.name}</span>
                            <span className="text-[9px] text-slate-400 block">{new Date(p.settlementDate).toLocaleDateString()}</span>
                          </div>
                          <span className="font-bold text-red-500">-{p.normalizedAmountInInr.toFixed(2)}</span>
                        </div>
                      ))}
                      {ledger.breakdown.receivedPayments.length === 0 && (
                        <p className="text-slate-400 text-xs py-3 text-center">No settlements received.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-12 text-center text-slate-400">
              Select a member on the left to inspect their detailed ledger calculations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BalancesPage;
export { BalancesPage };
