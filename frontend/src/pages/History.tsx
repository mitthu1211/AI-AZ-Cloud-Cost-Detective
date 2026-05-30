import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, ChevronRight, History as HistoryIcon, Loader2 } from 'lucide-react';
import { getHistory, type AnalysisRecord } from '../lib/api';

function formatDate(value: string | null) {
  if (!value) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function History() {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadHistory() {
      setError('');
      setLoading(true);
      try {
        setRecords(await getHistory());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load history');
      } finally {
        setLoading(false);
      }
    }

    void loadHistory();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-blue-500/10 p-2">
          <HistoryIcon className="h-6 w-6 text-blue-300" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Analysis History</h1>
          <p className="text-sm text-gray-400">Review previous resource group scans and reports</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 p-6 text-gray-300">
          <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
          Loading history...
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-8 text-center">
          <h2 className="text-xl font-semibold text-white">No analyses yet</h2>
          <p className="mt-2 text-gray-400">Run your first scan from the dashboard.</p>
          <Link
            to="/dashboard"
            className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800">
          {records.map((record) => (
            <Link
              key={record.id}
              to={`/report/${record.id}`}
              className="grid gap-4 border-b border-gray-700 p-5 transition-colors last:border-b-0 hover:bg-gray-700/50 md:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-white">{record.resource_group}</h2>
                  <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-300">
                    {record.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <CalendarClock className="h-4 w-4" />
                  {formatDate(record.created_at)}
                </div>
              </div>

              <div className="flex items-center justify-between gap-6 md:justify-end">
                <div className="grid grid-cols-3 gap-4 text-right text-sm">
                  <div>
                    <div className="font-semibold text-white">{record.resources_scanned ?? 0}</div>
                    <div className="text-gray-500">resources</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{record.issues_found ?? 0}</div>
                    <div className="text-gray-500">issues</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{record.estimated_savings || 'Unknown'}</div>
                    <div className="text-gray-500">savings</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
