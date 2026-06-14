import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import SettleUpModal from '../components/SettleUpModal';
import { Plus, CheckCircle2, TrendingUp, TrendingDown, Landmark, ChevronRight } from 'lucide-react';

interface GroupSummary {
  groupId: number;
  groupName: string;
  createdAt: string;
  memberCount: number;
  members: { id: number; name: string }[];
  userBalance: number;
}

interface DashboardData {
  totalBalance: number;
  youAreOwed: number;
  youOwe: number;
  groups: GroupSummary[];
}

const GroupsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isSettleUpOpen, setIsSettleUpOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creationError, setCreationError] = useState('');

  // 1. Fetch dashboard data using React Query
  const { data: dashboard, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      // The backend has `GET /api/balances/dashboard`
      // Wait, let's verify if `balances.routes.ts` mounts `/dashboard` - yes, line 9 of balance.routes.ts has `router.get('/dashboard', dashboardSummary);`
      const { data } = await api.get('/balances/dashboard');
      return data;
    },
  });

  // 2. Mutation to create a group
  const createGroupMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post('/groups', { name });
      return data;
    },
    onSuccess: () => {
      setNewGroupName('');
      setCreationError('');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      setCreationError(err.response?.data?.error || 'Failed to create group');
    },
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    createGroupMutation.mutate(newGroupName);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const summary = dashboard || { totalBalance: 0, youAreOwed: 0, youOwe: 0, groups: [] };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 font-medium">Overview of your shared balances across all groups</p>
        </div>
        <button
          onClick={() => setIsSettleUpOpen(true)}
          className="btn-secondary flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-brand-600" />
          Settle Up
        </button>
      </div>

      {(error || creationError) && (
        <div className="p-4 rounded-2xl bg-red-50 text-red-600 text-sm font-semibold border border-red-100">
          {error ? 'Failed to fetch dashboard data' : creationError}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Net Balance Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Balance</p>
            <p
              className={`text-2xl font-bold font-display mt-0.5 ${
                summary.totalBalance > 0
                  ? 'text-green-600'
                  : summary.totalBalance < 0
                  ? 'text-red-600'
                  : 'text-slate-900'
              }`}
            >
              {summary.totalBalance > 0 ? '+' : ''}
              ₹{summary.totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* You Are Owed Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">You are owed</p>
            <p className="text-2xl font-bold font-display text-green-600 mt-0.5">
              ₹{summary.youAreOwed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* You Owe Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">You owe</p>
            <p className="text-2xl font-bold font-display text-red-600 mt-0.5">
              ₹{summary.youOwe.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Create Group Panel */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-950 font-display">Create New Group</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Start sharing bills for a new trip, apartment, or dinner.</p>
        </div>
        <form onSubmit={handleCreateGroup} className="flex w-full md:w-auto gap-3">
          <input
            type="text"
            placeholder="e.g. Apartment Flatmates"
            required
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="input-premium md:w-64 py-2.5"
          />
          <button
            type="submit"
            disabled={createGroupMutation.isPending}
            className="btn-primary py-2.5 px-5 shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </form>
      </div>

      {/* Groups Section */}
      <div>
        <h2 className="text-lg font-bold font-display text-slate-900 mb-4">Your Groups</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {summary.groups.map((g) => (
            <Link key={g.groupId} to={`/groups/${g.groupId}`} className="block group">
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm h-full hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold font-display text-lg uppercase">
                      {g.groupName.charAt(0)}
                    </div>

                    <div className="text-right">
                      {g.userBalance > 0 ? (
                        <div>
                          <span className="text-[9px] uppercase tracking-wider font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            owed
                          </span>
                          <p className="text-sm font-bold text-green-600 mt-1">
                            ₹{g.userBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      ) : g.userBalance < 0 ? (
                        <div>
                          <span className="text-[9px] uppercase tracking-wider font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                            owe
                          </span>
                          <p className="text-sm font-bold text-red-600 mt-1">
                            ₹{Math.abs(g.userBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            settled
                          </span>
                          <p className="text-sm font-semibold text-slate-400 mt-1">₹0.00</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold font-display text-slate-900 group-hover:text-brand-600 transition-colors flex items-center gap-1">
                    {g.groupName}
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all text-brand-600" />
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    Created {new Date(g.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {/* Members Avatars Stack */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Members ({g.memberCount})</span>
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {g.members.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        title={m.name}
                        className="inline-block h-7.5 w-7.5 rounded-full ring-2 ring-white bg-slate-100 text-[10px] font-bold text-slate-700 flex items-center justify-center uppercase"
                      >
                        {m.name.charAt(0)}
                      </div>
                    ))}
                    {g.members.length > 3 && (
                      <div className="inline-block h-7.5 w-7.5 rounded-full ring-2 ring-white bg-slate-200 text-[9px] font-bold text-slate-600 flex items-center justify-center">
                        +{g.members.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {summary.groups.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200 border-dashed p-8">
              <p className="text-slate-400 font-medium">You don't belong to any groups yet.</p>
              <p className="text-xs text-slate-400 mt-1">Create one using the form above to start splitting expenses!</p>
            </div>
          )}
        </div>
      </div>

      {/* Settle Up Modal */}
      <SettleUpModal
        isOpen={isSettleUpOpen}
        onClose={() => setIsSettleUpOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}
      />
    </div>
  );
};

export default GroupsPage;
export { GroupsPage };
