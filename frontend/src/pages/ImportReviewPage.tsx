import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { AlertTriangle, CheckCircle, XCircle, ArrowLeft, ArrowRight, Eye } from 'lucide-react';

interface Anomaly {
  id: number;
  rowNumber: number;
  detectorName: string;
  suggestedAction: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rowData: {
    date: string;
    description: string;
    amount: string;
    currency: string;
    paid_by: string;
    split_with?: string;
  };
}

const ImportReviewPage: React.FC = () => {
  const { groupId, batchId } = useParams<{ groupId: string; batchId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [resolvingId, setResolvingId] = useState<number | null>(null);

  // 1. Fetch group detail
  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}`);
      return data;
    },
  });

  // 2. Fetch anomalies in this batch
  const { data: anomalies, isLoading, error } = useQuery<Anomaly[]>({
    queryKey: ['anomalies', batchId],
    queryFn: async () => {
      const { data } = await api.get(`/imports/${batchId}/anomalies`);
      // Row data is serialized in SQLite/Prisma, but returned as parsed objects in controller
      return data.map((a: any) => ({
        ...a,
        rowData: typeof a.rowData === 'string' ? JSON.parse(a.rowData) : a.rowData,
      }));
    },
  });

  // Mutation to resolve anomaly
  const resolveMutation = useMutation({
    mutationFn: async (payload: { anomalyId: number; action: 'APPROVED' | 'REJECTED' }) => {
      return api.patch(`/imports/anomalies/${payload.anomalyId}/resolve`, {
        action: payload.action,
        groupId: Number(groupId),
      });
    },
    onSuccess: (data) => {
      setResolvingId(null);
      queryClient.invalidateQueries({ queryKey: ['anomalies', batchId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
      queryClient.invalidateQueries({ queryKey: ['balances', groupId] });

      // Check if all are resolved
      const freshAnomalies = queryClient.getQueryData<Anomaly[]>(['anomalies', batchId]);
      if (freshAnomalies) {
        // If the one we just resolved was the last pending, navigate to report
        const updated = freshAnomalies.map((a) => (a.id === data.data.id ? data.data : a));
        const pending = updated.filter((a) => a.status === 'PENDING');
        if (pending.length === 0) {
          navigate(`/groups/${groupId}/import/${batchId}/report`);
        }
      }
    },
  });

  const handleResolve = (anomalyId: number, action: 'APPROVED' | 'REJECTED') => {
    setResolvingId(anomalyId);
    resolveMutation.mutate({ anomalyId, action });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (error || !anomalies) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 text-red-600 font-semibold border border-red-100">
        Failed to load anomalies review queue.
      </div>
    );
  }

  const pendingAnomalies = anomalies.filter((a) => a.status === 'PENDING');
  const resolvedAnomalies = anomalies.filter((a) => a.status !== 'PENDING');

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumbs */}
      <nav className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Link to="/groups" className="hover:text-brand-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <Link to={`/groups/${groupId}`} className="hover:text-brand-600 transition-colors">{group?.name}</Link>
        <span>/</span>
        <span className="text-slate-600">Review Anomalies</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Link to={`/groups/${groupId}/import`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Review Anomalies</h1>
            <p className="text-sm text-slate-500 font-medium">
              {pendingAnomalies.length} items require approval before importing to {group?.name}
            </p>
          </div>
        </div>
        {pendingAnomalies.length === 0 && (
          <Link to={`/groups/${groupId}/import/${batchId}/report`} className="btn-primary py-2.5 px-4 flex items-center gap-1.5 text-xs font-bold shadow-md">
            View Final Report
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="space-y-6">
        {pendingAnomalies.map((a) => (
          <div key={a.id} className="bg-white rounded-3xl border border-amber-200/80 shadow-sm overflow-hidden animate-slide-up">
            {/* Header info */}
            <div className="px-6 py-4 bg-amber-50/50 border-b border-amber-100/50 flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  Row {a.rowNumber} • {a.detectorName.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 italic">
                Suggested Action: {a.suggestedAction}
              </p>
            </div>

            {/* Content info */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Row data dump */}
              <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Date</span>
                  <p className="text-xs font-bold text-slate-800 mt-1">{a.rowData.date || '(empty)'}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Description</span>
                  <p className="text-xs font-bold text-slate-800 mt-1 truncate" title={a.rowData.description}>{a.rowData.description || '(empty)'}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Amount</span>
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    {a.rowData.amount || '0'} {a.rowData.currency}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Paid By</span>
                  <p className="text-xs font-bold text-slate-800 mt-1">{a.rowData.paid_by || '(empty)'}</p>
                </div>
                {a.rowData.split_with && (
                  <div className="col-span-full border-t border-slate-100/80 pt-2.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Split With</span>
                    <p className="text-xs font-bold text-slate-700 mt-1">{a.rowData.split_with}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="md:col-span-4 flex gap-3 h-fit">
                <button
                  onClick={() => handleResolve(a.id, 'REJECTED')}
                  disabled={resolvingId === a.id}
                  className="btn-secondary w-full py-2.5 flex items-center justify-center gap-1.5 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => handleResolve(a.id, 'APPROVED')}
                  disabled={resolvingId === a.id}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
              </div>
            </div>
          </div>
        ))}

        {pendingAnomalies.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 font-display">All anomalies resolved!</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Click the button in the top right to view the final import job report.</p>
          </div>
        )}

        {/* Resolved Anomalies logs */}
        {resolvedAnomalies.length > 0 && (
          <div className="bg-slate-50 border border-slate-150/60 rounded-3xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Resolved in this Session</h3>
            <div className="space-y-3">
              {resolvedAnomalies.map((a) => (
                <div key={a.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500">Row {a.rowNumber}:</span>
                    <span className="font-bold text-slate-800">{a.rowData.description || 'Expense'}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold text-slate-600">₹{parseFloat(a.rowData.amount).toFixed(2)}</span>
                  </div>
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                        a.status === 'APPROVED'
                          ? 'bg-green-50 text-green-700 border border-green-150'
                          : 'bg-red-50 text-red-700 border border-red-150'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportReviewPage;
export { ImportReviewPage };
