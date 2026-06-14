import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { Calendar, Plus, Trash2, ArrowLeft, X, IndianRupee } from 'lucide-react';

interface ExpenseSplit {
  id: number;
  userId: number;
  shareAmount: number;
  user: {
    id: number;
    name: string;
  };
}

interface Expense {
  id: number;
  description: string;
  amount: number;
  currency: string;
  amountInInr: number;
  exchangeRate: number;
  date: string;
  splitType: string;
  paidBy: {
    id: number;
    name: string;
  };
  splits: ExpenseSplit[];
}

interface Member {
  userId: number;
  user: {
    id: number;
    name: string;
  };
  joinedAt: string;
  leftAt: string | null;
}

const ExpensesPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [paidById, setPaidById] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [splitType, setSplitType] = useState<'EQUAL' | 'EXACT' | 'PERCENTAGE'>('EQUAL');

  // Split-specific values
  const [checkedUsers, setCheckedUsers] = useState<Record<number, boolean>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<number, string>>({});
  const [percentages, setPercentages] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // 1. Fetch Group Details (for memberships)
  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}`);
      return data;
    },
  });

  // 2. Fetch Expenses
  const { data: expenses, isLoading, error } = useQuery<Expense[]>({
    queryKey: ['expenses', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/expenses?groupId=${groupId}`);
      return data;
    },
  });

  const activeMembers = (group?.memberships || []).filter((m: Member) => {
    const d = new Date(date);
    const j = new Date(m.joinedAt);
    const l = m.leftAt ? new Date(m.leftAt) : null;
    return j <= d && (!l || d < l);
  });

  // Initialize split fields when modal opens
  const openAddModal = () => {
    setDesc('');
    setAmount('');
    setCurrency('INR');
    setDate(new Date().toISOString().slice(0, 10));
    setSplitType('EQUAL');
    setFormError('');
    setIsAddOpen(true);

    if (activeMembers.length > 0) {
      setPaidById(activeMembers[0].user.id.toString());
      // Setup checkboxes
      const checks: Record<number, boolean> = {};
      const exacts: Record<number, string> = {};
      const pcts: Record<number, string> = {};
      activeMembers.forEach((m: Member) => {
        checks[m.user.id] = true;
        exacts[m.user.id] = '';
        pcts[m.user.id] = '';
      });
      setCheckedUsers(checks);
      setExactAmounts(exacts);
      setPercentages(pcts);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/expenses', payload);
    },
    onSuccess: () => {
      setIsAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.error || 'Failed to create expense');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid amount');
      return;
    }

    const payload: any = {
      groupId: Number(groupId),
      paidById: Number(paidById),
      amount: amt,
      currency,
      description: desc.trim(),
      date: new Date(date).toISOString(),
      splitType,
      splitData: {},
    };

    if (splitType === 'EQUAL') {
      const selectedIds = Object.keys(checkedUsers)
        .map(Number)
        .filter((id) => checkedUsers[id]);

      if (selectedIds.length === 0) {
        setFormError('Select at least one member to split with');
        return;
      }
      payload.splitData.userIds = selectedIds;
    } else if (splitType === 'EXACT') {
      const splits = activeMembers.map((m: Member) => ({
        userId: m.user.id,
        amount: Number(exactAmounts[m.user.id] || 0),
      }));
      const sum = splits.reduce((s, x) => s + x.amount, 0);
      if (Math.abs(sum - amt) > 0.01) {
        setFormError(`Split amounts sum (₹${sum.toFixed(2)}) must match total amount (₹${amt.toFixed(2)})`);
        return;
      }
      payload.splitData.splits = splits;
    } else if (splitType === 'PERCENTAGE') {
      const splits = activeMembers.map((m: Member) => ({
        userId: m.user.id,
        percentage: Number(percentages[m.user.id] || 0),
      }));
      const sum = splits.reduce((s, x) => s + x.percentage, 0);
      if (Math.abs(sum - 100) > 0.01) {
        setFormError(`Percentages must sum to exactly 100% (currently ${sum.toFixed(1)}%)`);
        return;
      }
      payload.splitData.splits = splits;
    }

    createMutation.mutate(payload);
  };

  const formatCurrency = (amount: number, currency: string, amountInInr: number) => {
    if (currency === 'INR') {
      return <span className="font-bold text-slate-900">₹{amountInInr.toFixed(2)}</span>;
    }
    return (
      <div className="flex flex-col items-end">
        <span className="font-bold text-slate-900">₹{amountInInr.toFixed(2)}</span>
        <span className="text-[10px] text-slate-400 font-semibold">
          ({currency} {amount.toFixed(2)})
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumbs */}
      <nav className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Link to="/groups" className="hover:text-brand-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <Link to={`/groups/${groupId}`} className="hover:text-brand-600 transition-colors">{group?.name}</Link>
        <span>/</span>
        <span className="text-slate-600">Expenses</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/groups/${groupId}`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Expenses</h1>
            <p className="text-sm text-slate-500 font-medium">Logged expenses for {group?.name}</p>
          </div>
        </div>
        <button onClick={openAddModal} className="btn-primary py-2.5 px-4 flex items-center gap-1.5 text-xs font-bold">
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 text-red-600 font-semibold border border-red-100">
          Failed to load expenses list.
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {expenses?.map((e) => (
            <div key={e.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm uppercase shrink-0">
                  {e.paidBy.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{e.description}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(e.date).toLocaleDateString()}
                    <span>•</span>
                    <span>Paid by {e.paidBy.name}</span>
                    <span>•</span>
                    <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">{e.splitType}</span>
                  </p>
                  {/* Splits Details */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {e.splits.map((s) => (
                      <span key={s.id} className="text-[10px] font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                        {s.user.name}: ₹{s.shareAmount.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-50 shrink-0">
                <div className="text-right">
                  {formatCurrency(e.amount, e.currency, e.amountInInr)}
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this expense?')) deleteMutation.mutate(e.id);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {(!expenses || expenses.length === 0) && (
            <div className="p-16 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-6 h-6 text-slate-300" />
              </div>
              <h3 className="text-base font-bold text-slate-800 font-display">No expenses found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Create a new expense or upload a CSV containing group transactions.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold font-display text-slate-950">Add New Expense</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-4 rounded-2xl bg-red-50 text-red-600 text-xs font-semibold border border-red-100">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="e.g. Electricity Bill"
                  className="input-premium py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="input-premium py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="input-premium py-2"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Paid By
                  </label>
                  <select
                    value={paidById}
                    onChange={(e) => setPaidById(e.target.value)}
                    className="input-premium py-2"
                  >
                    {activeMembers.map((m: Member) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input-premium py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Split Strategy
                </label>
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                  {(['EQUAL', 'EXACT', 'PERCENTAGE'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSplitType(type)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${
                        splitType === type
                          ? 'bg-white text-brand-700 shadow-sm border border-slate-100'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Split Input Area */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 max-h-48 overflow-y-auto space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Split Details</p>

                {splitType === 'EQUAL' &&
                  activeMembers.map((m: Member) => (
                    <label key={m.user.id} className="flex items-center gap-3 text-sm font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!checkedUsers[m.user.id]}
                        onChange={(e) =>
                          setCheckedUsers({
                            ...checkedUsers,
                            [m.user.id]: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4.5 w-4.5"
                      />
                      {m.user.name}
                    </label>
                  ))}

                {splitType === 'EXACT' &&
                  activeMembers.map((m: Member) => (
                    <div key={m.user.id} className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-semibold text-slate-700">{m.user.name}</span>
                      <div className="relative w-32 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={exactAmounts[m.user.id] || ''}
                          onChange={(e) =>
                            setExactAmounts({
                              ...exactAmounts,
                              [m.user.id]: e.target.value,
                            })
                          }
                          className="input-premium py-1 pl-6 text-xs text-right"
                        />
                      </div>
                    </div>
                  ))}

                {splitType === 'PERCENTAGE' &&
                  activeMembers.map((m: Member) => (
                    <div key={m.user.id} className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-semibold text-slate-700">{m.user.name}</span>
                      <div className="relative w-24 shrink-0">
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={percentages[m.user.id] || ''}
                          onChange={(e) =>
                            setPercentages({
                              ...percentages,
                              [m.user.id]: e.target.value,
                            })
                          }
                          className="input-premium py-1 pr-6 text-xs text-right"
                        />
                      </div>
                    </div>
                  ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn-secondary w-full py-2.5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending ? 'Saving...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
export { ExpensesPage };
