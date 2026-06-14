import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import SettleUpModal from '../components/SettleUpModal';
import { Users, Receipt, Calendar, UserPlus, UserMinus, Plus, FileSpreadsheet, ArrowRight, DollarSign } from 'lucide-react';

interface Member {
  userId: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  joinedAt: string;
  leftAt: string | null;
}

interface GroupDetails {
  id: number;
  name: string;
  createdAt: string;
  memberships: Member[];
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
}

interface BalanceSummary {
  user: {
    id: number;
    name: string;
    email: string;
  };
  joinedAt: string;
  leftAt: string | null;
  netBalance: number;
  totalPaid: number;
  totalOwed: number;
}

interface UserDetail {
  id: number;
  name: string;
  email: string;
}

const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [isSettleUpOpen, setIsSettleUpOpen] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

  // Form states
  const [selectedUserId, setSelectedUserId] = useState('');
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().slice(0, 10));
  const [leftAt, setLeftAt] = useState(new Date().toISOString().slice(0, 10));

  // 1. Fetch Group Details
  const { data: group, isLoading: groupLoading, error: groupError } = useQuery<GroupDetails>({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}`);
      return data;
    },
  });

  // 2. Fetch Recent Expenses
  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ['expenses', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/expenses?groupId=${groupId}`);
      return data;
    },
  });

  // 3. Fetch Group Balances
  const { data: balanceData, isLoading: balancesLoading } = useQuery<{ balances: BalanceSummary[] }>({
    queryKey: ['balances', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/balances/group/${groupId}`);
      return data;
    },
  });

  // 4. Fetch all system users (for adding members)
  const { data: systemUsers } = useQuery<UserDetail[]>({
    queryKey: ['system-users'],
    queryFn: async () => {
      const { data } = await api.get('/auth/users'); // we can fetch all users
      return data;
    },
  });

  // Mutations
  const addMemberMutation = useMutation({
    mutationFn: async (payload: { userId: number; joinedAt: string }) => {
      return api.post(`/groups/${groupId}/members`, payload);
    },
    onSuccess: () => {
      setIsAddingMember(false);
      setSelectedUserId('');
      setJoinedAt(new Date().toISOString().slice(0, 10));
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (payload: { userId: number; leftAt: string }) => {
      return api.delete(`/groups/${groupId}/members/${payload.userId}`, {
        data: { leftAt: payload.leftAt },
      });
    },
    onSuccess: () => {
      setRemovingMemberId(null);
      setLeftAt(new Date().toISOString().slice(0, 10));
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
    },
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    addMemberMutation.mutate({
      userId: Number(selectedUserId),
      joinedAt: new Date(joinedAt).toISOString(),
    });
  };

  const handleRemoveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (removingMemberId === null) return;
    removeMemberMutation.mutate({
      userId: removingMemberId,
      leftAt: new Date(leftAt).toISOString(),
    });
  };

  const handleReaddMember = (userId: number) => {
    addMemberMutation.mutate({
      userId,
      joinedAt: new Date().toISOString(),
    });
  };

  const formatCurrency = (amount: number, currency: string, amountInInr: number) => {
    if (currency === 'INR') {
      return <span className="font-bold text-slate-900">₹{amountInInr.toFixed(2)}</span>;
    }
    return (
      <div className="flex flex-col items-end">
        <span className="font-bold text-slate-900">₹{amountInInr.toFixed(2)}</span>
        <span className="text-[10px] text-slate-400 font-semibold">
          (${amount.toFixed(2)} USD)
        </span>
      </div>
    );
  };

  if (groupLoading || expensesLoading || balancesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (groupError || !group) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 text-red-600 font-semibold border border-red-100">
        Group details failed to load.
      </div>
    );
  }

  const balances = balanceData?.balances || [];
  const activeMembersCount = balances.filter((b) => !b.leftAt).length;

  // Filter out system users who are already group members
  const availableUsers = (systemUsers || []).filter(
    (u) => !balances.some((b) => b.user.id === u.id && !b.leftAt)
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumbs */}
      <nav className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Link to="/groups" className="hover:text-brand-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-600">{group.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">{group.name}</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {activeMembersCount} active members
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsSettleUpOpen(true)}
            className="btn-secondary py-2.5 px-4 flex items-center gap-1.5 text-xs font-bold"
          >
            <DollarSign className="w-4 h-4 text-brand-600" />
            Settle Up
          </button>
          <Link to={`/groups/${groupId}/expenses`} className="btn-primary py-2.5 px-4 flex items-center gap-1.5 text-xs font-bold">
            <Plus className="w-4 h-4" />
            Add Expense
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Balances & Expenses */}
        <div className="lg:col-span-2 space-y-8">
          {/* Balance Summary Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Group Balances</h3>
              <Link to={`/groups/${groupId}/balances`} className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                View Explanation &rarr;
              </Link>
            </div>
            
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {balances.filter((b) => !b.leftAt).map((b) => (
                <Link
                  key={b.user.id}
                  to={`/groups/${groupId}/balances?userId=${b.user.id}`}
                  className="p-4 rounded-2xl border border-slate-100 flex items-center justify-between bg-slate-50/10 hover:border-brand-200 hover:bg-slate-50 transition-all duration-200 group"
                >
                  <div>
                    <p className="font-bold text-slate-800 text-sm group-hover:text-brand-600 transition-colors">{b.user.name}</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Paid: ₹{b.totalPaid.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    {b.netBalance > 0 ? (
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full">
                          owed
                        </span>
                        <p className="text-sm font-bold text-green-600 mt-1">₹{b.netBalance.toFixed(2)}</p>
                      </div>
                    ) : b.netBalance < 0 ? (
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full">
                          owes
                        </span>
                        <p className="text-sm font-bold text-red-600 mt-1">₹{Math.abs(b.netBalance).toFixed(2)}</p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          settled
                        </span>
                        <p className="text-sm font-bold text-slate-400 mt-1">₹0.00</p>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Expenses List */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Recent Expenses</h3>
              <Link to={`/groups/${groupId}/expenses`} className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            
            <div className="divide-y divide-slate-100">
              {expenses?.slice(0, 5).map((e) => (
                <div key={e.id} className="p-6 hover:bg-slate-50/40 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm uppercase">
                      {e.paidBy.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{e.description}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(e.date).toLocaleDateString()} • Paid by {e.paidBy.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {formatCurrency(e.amount, e.currency, e.amountInInr)}
                    <span className="inline-block mt-1 px-2.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-full uppercase tracking-wider">
                      {e.splitType}
                    </span>
                  </div>
                </div>
              ))}

              {(!expenses || expenses.length === 0) && (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Receipt className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-semibold text-sm">No expenses logged yet</p>
                  <p className="text-xs text-slate-400 mt-1">Add an expense or upload a CSV to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Tools */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to={`/groups/${groupId}/import`} className="bg-white hover:border-brand-200 hover:shadow-md transition-all duration-300 border border-slate-200/60 rounded-2xl p-5 flex items-center justify-center gap-3 text-brand-800 font-semibold text-sm shadow-sm">
              <FileSpreadsheet className="w-5 h-5 text-brand-600" />
              Import Expenses from CSV
            </Link>
            <button
              onClick={() => setIsSettleUpOpen(true)}
              className="bg-white hover:border-brand-200 hover:shadow-md transition-all duration-300 border border-slate-200/60 rounded-2xl p-5 flex items-center justify-center gap-3 text-brand-800 font-semibold text-sm shadow-sm"
            >
              <DollarSign className="w-5 h-5 text-brand-600" />
              Record a Settlement Payment
            </button>
          </div>
        </div>

        {/* Right Column: Member Management */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Group Members</h3>
              <button
                onClick={() => {
                  setIsAddingMember(!isAddingMember);
                  setRemovingMemberId(null);
                }}
                className="text-xs font-bold text-brand-600 hover:text-brand-700"
              >
                {isAddingMember ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {/* Add Member Form */}
            {isAddingMember && (
              <form onSubmit={handleAddMember} className="p-4 border-b border-slate-100 bg-brand-50/10 space-y-3 animate-fade-in">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Select System User
                  </label>
                  <select
                    required
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="input-premium py-1.5 text-xs"
                  >
                    <option value="">-- Select User --</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Joined Date
                  </label>
                  <input
                    type="date"
                    required
                    value={joinedAt}
                    onChange={(e) => setJoinedAt(e.target.value)}
                    className="input-premium py-1.5 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addMemberMutation.isPending || !selectedUserId}
                  className="btn-primary text-xs w-full py-2 flex items-center justify-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Member
                </button>
              </form>
            )}

            {/* Remove Member Form */}
            {removingMemberId !== null && (
              <form onSubmit={handleRemoveMember} className="p-4 border-b border-slate-100 bg-red-50/10 space-y-3 animate-fade-in">
                <p className="text-xs font-bold text-red-700">
                  Select Leave Date for {balances.find((b) => b.user.id === removingMemberId)?.user.name}:
                </p>
                <div>
                  <input
                    type="date"
                    required
                    value={leftAt}
                    onChange={(e) => setLeftAt(e.target.value)}
                    className="input-premium py-1.5 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRemovingMemberId(null)}
                    className="btn-secondary text-xs w-full py-1.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={removeMemberMutation.isPending}
                    className="btn-danger text-xs w-full py-1.5 flex items-center justify-center gap-1"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    Confirm
                  </button>
                </div>
              </form>
            )}

            {/* Members List */}
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Active</p>
                <div className="space-y-2">
                  {balances.filter((b) => !b.leftAt).map((b) => (
                    <div key={b.user.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm uppercase">
                          {b.user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{b.user.name}</p>
                          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                            Joined {new Date(b.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {b.user.id !== currentUser?.id && (
                        <button
                          onClick={() => {
                            setRemovingMemberId(b.user.id);
                            setLeftAt(new Date().toISOString().slice(0, 10));
                            setIsAddingMember(false);
                          }}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100/60 px-2 py-1 rounded-md transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Left members */}
              {balances.some((b) => b.leftAt) && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Past Members</p>
                  <div className="space-y-2">
                    {balances.filter((b) => b.leftAt).map((b) => (
                      <div key={b.user.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/60 opacity-80">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm uppercase">
                            {b.user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-500 text-sm">{b.user.name}</p>
                            <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                              {new Date(b.joinedAt).toLocaleDateString()} - {new Date(b.leftAt!).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleReaddMember(b.user.id)}
                          className="text-[10px] font-bold text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100/60 px-2 py-1 rounded-md transition-colors"
                        >
                          Re-add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settle Up Modal */}
      <SettleUpModal
        isOpen={isSettleUpOpen}
        onClose={() => setIsSettleUpOpen(false)}
        groupId={groupId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
          queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
        }}
      />
    </div>
  );
};

export default GroupDetailPage;
export { GroupDetailPage };
