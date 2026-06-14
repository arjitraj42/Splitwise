import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { ArrowLeft, Upload, FileText, AlertCircle, RefreshCw } from 'lucide-react';

const ImportCSVPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch Group details
  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data } = await api.get(`/groups/${groupId}`);
      return data;
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file first');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('groupId', groupId || '');

    try {
      const { data } = await api.post('/imports/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { batchId, anomalyCount } = data;
      if (anomalyCount > 0) {
        // If anomalies exist, redirect to the Review queue page
        navigate(`/groups/${groupId}/import/${batchId}/review`);
      } else {
        // If clean, redirect directly to the Report page
        navigate(`/groups/${groupId}/import/${batchId}/report`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload and parse CSV file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumbs */}
      <nav className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Link to="/groups" className="hover:text-brand-600 transition-colors">Dashboard</Link>
        <span>/</span>
        <Link to={`/groups/${groupId}`} className="hover:text-brand-600 transition-colors">{group?.name}</Link>
        <span>/</span>
        <span className="text-slate-600">Import CSV</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/groups/${groupId}`} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">Import CSV</h1>
          <p className="text-sm text-slate-500 font-medium">Batch upload expenses to {group?.name}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8 space-y-6">
        <div className="bg-brand-50/20 border border-brand-100 rounded-2xl p-4 text-xs text-brand-800 space-y-2">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-brand-600 shrink-0" />
            CSV File Structure
          </p>
          <p className="font-medium text-slate-600 leading-relaxed">
            Please make sure your CSV contains the following column headers (case-insensitive):
            <br />
            <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-150/60 font-bold block mt-1.5">
              date, description, amount, currency, paid_by, split_with
            </code>
            <br />
            - <code className="font-mono text-slate-800 font-semibold">split_with</code> should contain a semicolon-separated list of names (e.g. <code className="font-mono text-xs">Aisha; Rohan; Priya</code>) or leave blank to split equally among all members active on the transaction date.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 text-red-600 text-xs font-semibold border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-6">
          {/* Dropzone */}
          <div className="border-2 border-dashed border-slate-200 hover:border-brand-400 bg-slate-50/50 hover:bg-brand-50/5 transition-all rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer relative group">
            <input
              type="file"
              accept=".csv"
              required
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-brand-100 group-hover:text-brand-700 transition-all mb-4">
              <Upload className="w-6 h-6" />
            </div>
            
            {file ? (
              <div className="text-center">
                <span className="font-bold text-slate-800 text-sm flex items-center justify-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-500" />
                  {file.name}
                </span>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">
                  {(file.size / 1024).toFixed(1)} KB • Click to swap file
                </p>
              </div>
            ) : (
              <div className="text-center">
                <span className="font-bold text-slate-700 text-sm">Select or Drag CSV file</span>
                <p className="text-xs text-slate-400 font-medium mt-1">Upload a CSV file containing transactions</p>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <Link to={`/groups/${groupId}`} className="btn-secondary w-full py-3">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !file}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Uploading and Parsing...
                </>
              ) : (
                'Import file'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImportCSVPage;
export { ImportCSVPage };
