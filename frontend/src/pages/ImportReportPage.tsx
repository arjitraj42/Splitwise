import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { ArrowLeft, CheckCircle2, AlertTriangle, FileSpreadsheet, Download, Info } from 'lucide-react';

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

interface Expense {
  id: number;
  description: string;
  date: string;
  amountInInr: number;
}

interface ImportReport {
  batch: {
    id: number;
    filename: string;
    createdAt: string;
  };
  totalRows: number;
  committed: number;
  anomalyCount: number;
  anomalies: Anomaly[];
  expenses: Expense[];
  normalizations: string[];
}

const ImportReportPage: React.FC = () => {
  const { groupId, batchId } = useParams<{ groupId: string; batchId: string }>();

  // 1. Fetch group detail
  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}`);
      return data;
    },
  });

  // 2. Fetch Import Report
  const { data: report, isLoading, error } = useQuery<ImportReport>({
    queryKey: ['import-report', batchId],
    queryFn: async () => {
      const { data } = await api.get(`/imports/${batchId}/report`);
      return data;
    },
  });

  const handleExportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import_report_batch_${batchId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 text-red-600 font-semibold border border-red-100">
        Failed to load import job report.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumbs */}
      <nav className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Link to="/groups" className="hover:text-brand-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <Link to={`/groups/${groupId}`} className="hover:text-brand-600 transition-colors">{group?.name}</Link>
        <span>/</span>
        <span className="text-slate-600">Import Report</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Link to={`/groups/${groupId}`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Import Report</h1>
            <p className="text-sm text-slate-500 font-medium">CSV processing summary for {report.batch.filename}</p>
          </div>
        </div>
        <button
          onClick={handleExportJSON}
          className="btn-primary py-2.5 px-4 flex items-center gap-1.5 text-xs font-bold shadow-md self-start"
        >
          <Download className="w-4 h-4" />
          Export Report as JSON
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Rows</p>
            <p className="text-2xl font-bold font-display mt-0.5 text-slate-900">{report.totalRows}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Imported Rows</p>
            <p className="text-2xl font-bold font-display mt-0.5 text-green-600">{report.committed}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Anomaly Flags</p>
            <p className="text-2xl font-bold font-display mt-0.5 text-amber-600">{report.anomalyCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Normalizations & Imported list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Normalizations details */}
          {report.normalizations && report.normalizations.length > 0 && (
            <div className="bg-slate-50 border border-slate-150/60 rounded-3xl p-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                Name Normalizations Log
              </h3>
              <ul className="space-y-1.5 list-disc pl-5 text-xs text-slate-600 font-semibold leading-relaxed">
                {report.normalizations.map((log, index) => (
                  <li key={index}>{log}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Imported details */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-slide-up">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Successfully Imported</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {report.expenses.map((e) => (
                <div key={e.id} className="p-4 hover:bg-slate-50/40 transition-colors flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">{e.description}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">{new Date(e.date).toLocaleDateString()}</span>
                  </div>
                  <span className="font-bold text-green-600">+₹{e.amountInInr.toFixed(2)}</span>
                </div>
              ))}
              {report.expenses.length === 0 && (
                <p className="text-slate-400 text-xs py-8 text-center">No rows imported in this batch.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Anomalies & actions taken summary */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Anomalies & Actions Log</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-120 overflow-y-auto">
            {report.anomalies.map((a) => (
              <div key={a.id} className="p-4 space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-500">Row {a.rowNumber} • {a.detectorName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      a.status === 'APPROVED'
                        ? 'bg-green-50 text-green-700'
                        : a.status === 'REJECTED'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <div className="font-semibold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100/50">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Original Data</span>
                  <span className="font-mono text-[10px]">
                    "{a.rowData.description}" (₹{a.rowData.amount}) paid by {a.rowData.paid_by}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold italic">
                  Suggested Action: {a.suggestedAction}
                </p>
              </div>
            ))}

            {report.anomalies.length === 0 && (
              <p className="text-slate-400 text-xs py-8 text-center">No anomalies flagged in this batch.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportReportPage;
export { ImportReportPage };
