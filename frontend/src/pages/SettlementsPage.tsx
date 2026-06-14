import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import SettleUpModal from '../components/SettleUpModal';
import { Calendar, Plus, ArrowLeft, DollarSign, MessageCircle } from 'lucide-react';

interface Settlement {
  id: number;
  fromUser: {
    id: number;
    name: string;
  };
  toUser: {
    id: number;
    name: string;
  };
  amount: number;
  currency: string;
  exchangeRate: number;
  normalizedAmountInInr: number;
  settlementDate: string;
  note: string | null;
}

const SettlementsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const queryClient = useQueryClient();
  const [isSettleUpOpen, setIsSettleUpOpen] = useState(false);

  // 1. Fetch Group Details
  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}`);
      return data;
    },
  });

  // 2. Fetch Settlements
  const { data: settlements, isLoading, error } = useQuery<Settlement[]>({
    queryKey: ['settlements', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/settlements?groupId=${groupId}`);
      return data;
    },
  });

  const formatCurrency = (amount: number, currency: string, amountInInr: number) => {
    if (currency === 'INR') {
      return <span className="font-bold text-slate-900">₹{amountInInr.toFixed(2)}</span>;
    }
    return (
      <div className="flex flex-col items-end">
        <span className="font-bold text-slate-900">₹{amountInInr.toFixed(2)}</span>
        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
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
        <span className="text-slate-600">Settlements</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/groups/${groupId}`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Settlements</h1>
            <p className="text-sm text-slate-500 font-medium">Record of payments made to settle balances in {group?.name}</p>
          </div>
        </div>
        <button
          onClick={() => setIsSettleUpOpen(true)}
          className="btn-primary py-2.5 px-4 flex items-center gap-1.5 text-xs font-bold"
        >
          <Plus className="w-4 h-4" />
          Settle Up
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 text-red-600 font-semibold border border-red-100">
          Failed to load settlements.
        </div>
      )}

      {/* Settlements List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {settlements?.map((s) => (
            <div key={s.id} className="p-6 hover:bg-slate-50/20 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-brand-700 flex items-center justify-center font-bold">
                  🤝
                </div>
                <div>
                  <p className="text-sm text-slate-800 font-medium">
                    <span className="font-bold text-slate-900">{s.fromUser.name}</span> paid{' '}
                    <span className="font-bold text-slate-900">{s.toUser.name}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(s.settlementDate).toLocaleDateString()}
                    {s.note && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                          <MessageCircle className="w-3 h-3 text-slate-400" />
                          {s.note}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                {formatCurrency(s.amount, s.currency, s.normalizedAmountInInr)}
              </div>
            </div>
          ))}

          {(!settlements || settlements.length === 0) && (
            <div className="p-16 text-center">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-5 h-5 text-slate-300" />
              </div>
              <h3 className="text-base font-bold text-slate-800 font-display">No settlements logged</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Group balances are settled through direct transfer logs recorded here.</p>
            </div>
          )}
        </div>
      </div>

      <SettleUpModal
        isOpen={isSettleUpOpen}
        onClose={() => setIsSettleUpOpen(false)}
        groupId={groupId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['settlements', groupId] });
          queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
        }}
      />
    </div>
  );
};

export default SettlementsPage;
export { SettlementsPage };
