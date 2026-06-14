import React, { useState, useEffect } from 'react';
import api from '../api/axios';

interface SettleUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId?: string | null;
  onSuccess?: () => void;
}

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

interface Group {
  groupId: number;
  groupName: string;
  userBalance: number;
}

const SettleUpModal: React.FC<SettleUpModalProps> = ({ isOpen, onClose, groupId = null, onSuccess }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [fromUserId, setFromUserId] = useState<string>('');
  const [toUserId, setToUserId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setAmount('');
      setNote('');
      setCurrency('INR');
      setSettlementDate(new Date().toISOString().slice(0, 10));
      setFromUserId('');
      setToUserId('');

      if (groupId) {
        setSelectedGroupId(groupId);
      } else {
        setSelectedGroupId('');
        // Fetch user groups to let them select
        api.get('/balances/explain/0') // Or load groups endpoint
          .then(() => api.get('/groups'))
          .then(({ data }) => {
            const mapped = data.map((g: any) => ({
              groupId: g.id,
              groupName: g.name,
              userBalance: 0,
            }));
            setGroups(mapped);
          })
          .catch(() => setError('Failed to load groups'));
      }
    }
  }, [isOpen, groupId]);

  useEffect(() => {
    if (selectedGroupId) {
      api.get(`/groups/${selectedGroupId}`)
        .then(({ data }) => {
          // memberships are in details
          const active = (data.memberships || []).filter((m: Member) => !m.leftAt);
          setMembers(active);
          if (active.length > 0) {
            setFromUserId(active[0].user.id.toString());
            if (active.length > 1) {
              setToUserId(active[1].user.id.toString());
            } else {
              setToUserId('');
            }
          }
        })
        .catch(() => setError('Failed to load group members'));
    } else {
      setMembers([]);
    }
  }, [selectedGroupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !fromUserId || !toUserId || !amount) {
      setError('Please fill in all required fields');
      return;
    }
    if (fromUserId === toUserId) {
      setError('Sender and receiver must be different members');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/settlements', {
        groupId: Number(selectedGroupId),
        fromUserId: Number(fromUserId),
        toUserId: Number(toUserId),
        amount: Number(amount),
        currency,
        settlementDate: new Date(settlementDate).toISOString(),
        note: note.trim() || undefined,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to record settlement');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-100 animate-slide-up">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold font-display text-slate-950">Record a Settlement</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-xl border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!groupId && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Select Group
              </label>
              <select
                required
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="input-premium py-2"
              >
                <option value="">-- Choose a Group --</option>
                {groups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.groupName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedGroupId && members.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Sender
                  </label>
                  <select
                    required
                    value={fromUserId}
                    onChange={(e) => setFromUserId(e.target.value)}
                    className="input-premium py-2"
                  >
                    {members.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Recipient
                  </label>
                  <select
                    required
                    value={toUserId}
                    onChange={(e) => setToUserId(e.target.value)}
                    className="input-premium py-2"
                  >
                    {members.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
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

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={settlementDate}
                  onChange={(e) => setSettlementDate(e.target.value)}
                  className="input-premium py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Note / Reference
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. UPI, cash transfer"
                  className="input-premium py-2"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={onClose} className="btn-secondary w-full py-2.5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      Recording...
                    </>
                  ) : (
                    'Record'
                  )}
                </button>
              </div>
            </>
          ) : selectedGroupId ? (
            <p className="text-sm text-slate-500 text-center py-4">Loading members...</p>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">
              Select a group to load members.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default SettleUpModal;
export { SettleUpModal };
