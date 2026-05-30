import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AlertCircle, Check, Clipboard, FileText, Loader2, Terminal } from 'lucide-react';
import { getAnalysisDetail, type AnalysisIssue, type AnalysisRecord } from '../lib/api';

interface ReportLocationState {
  report?: AnalysisRecord;
}

const severityClasses: Record<string, string> = {
  high: 'border-red-500/50 bg-red-500/10 text-red-300',
  medium: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-200',
  low: 'border-green-500/50 bg-green-500/10 text-green-300',
};

function normalizeSeverity(severity?: string) {
  const value = severity?.toLowerCase() || 'low';
  return ['high', 'medium', 'low'].includes(value) ? value : 'low';
}

function getIssueType(issue: AnalysisIssue) {
  if (issue.issue_type) return issue.issue_type;

  const text = `${issue.issue || ''} ${issue.explanation || ''} ${issue.recommendation || ''}`.toLowerCase();
  if (text.includes('unused') || text.includes('idle') || text.includes('orphan')) return 'unused';
  if (text.includes('misconfig') || text.includes('pricing') || text.includes('retention')) return 'misconfigured';
  return 'over-provisioned';
}

function getIssueExplanation(issue: AnalysisIssue) {
  return issue.explanation || issue.issue || issue.recommendation || 'No explanation provided.';
}

export default function Report() {
  const { id } = useParams();
  const location = useLocation();
  const initialReport = (location.state as ReportLocationState | null)?.report;
  const [report, setReport] = useState<AnalysisRecord | null>(initialReport || null);
  const [loading, setLoading] = useState(Boolean(id) && !initialReport);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id || initialReport) return;

    async function loadReport() {
      setError('');
      setLoading(true);
      try {
        setReport(await getAnalysisDetail(id as string));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load report');
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, [id, initialReport]);

  const issues = useMemo(() => report?.analysis_result?.issues || [], [report]);
  const fixCommands = report?.analysis_result?.fix_commands || [];

  const copyCommand = async (command: string, index: number) => {
    await navigator.clipboard.writeText(command);
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 p-6 text-gray-300">
        <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
        Loading report...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-4 rounded-xl border border-gray-700 bg-gray-800 p-6">
        <div className="flex items-start gap-3 text-red-300">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
          <span>{error || 'No report is available yet.'}</span>
        </div>
        <Link to="/dashboard" className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
          Run Analysis
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-blue-500/10 p-2">
          <FileText className="h-6 w-6 text-blue-300" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Analysis Report</h1>
          <p className="text-sm text-gray-400">{report.resource_group}</p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <div className="text-sm text-gray-400">Resources Scanned</div>
          <div className="mt-2 text-3xl font-bold text-white">{report.resources_scanned ?? 0}</div>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <div className="text-sm text-gray-400">Issues Found</div>
          <div className="mt-2 text-3xl font-bold text-white">{report.issues_found ?? issues.length}</div>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <div className="text-sm text-gray-400">Estimated Savings</div>
          <div className="mt-2 text-3xl font-bold text-white">{report.estimated_savings || 'Unknown'}</div>
        </div>
      </section>

      {report.analysis_result?.summary && (
        <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
          <h2 className="mb-2 text-lg font-semibold text-white">Summary</h2>
          <p className="leading-7 text-gray-300">{report.analysis_result.summary}</p>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Issues</h2>
          <span className="text-sm text-gray-400">{issues.length} total</span>
        </div>

        {issues.length === 0 ? (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-6 text-green-200">
            No cost issues were found for this resource group.
          </div>
        ) : (
          issues.map((issue, index) => {
            const severity = normalizeSeverity(issue.severity);
            const command = issue.fix_command || fixCommands[index] || '';

            return (
              <article key={`${issue.resource_name || 'resource'}-${index}`} className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{issue.resource_name || 'Unnamed resource'}</h3>
                    <p className="mt-1 text-sm capitalize text-gray-400">{getIssueType(issue)}</p>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase ${severityClasses[severity]}`}>
                    {severity}
                  </span>
                </div>

                <p className="leading-7 text-gray-300">{getIssueExplanation(issue)}</p>

                {issue.recommendation && (
                  <p className="mt-3 text-sm text-blue-200">
                    <span className="font-semibold text-blue-100">Recommendation:</span> {issue.recommendation}
                  </p>
                )}

                {command && (
                  <div className="mt-5 overflow-hidden rounded-lg border border-gray-700 bg-gray-950">
                    <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <Terminal className="h-4 w-4" />
                        Fix command
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyCommand(command, index)}
                        className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
                      >
                        {copiedIndex === index ? <Check className="h-4 w-4 text-green-300" /> : <Clipboard className="h-4 w-4" />}
                        {copiedIndex === index ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="overflow-x-auto p-4 text-sm text-green-200"><code>{command}</code></pre>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
