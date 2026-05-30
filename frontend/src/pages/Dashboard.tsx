import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, CloudCog, Loader2, Play, RefreshCw } from 'lucide-react';
import ProgressTracker from '../components/ProgressTracker';
import { getResourceGroups, runAnalysis, type AnalyzeResponse, type ResourceGroup } from '../lib/api';

function createAnalysisId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Dashboard() {
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisResponse, setAnalysisResponse] = useState<AnalyzeResponse | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadResourceGroups = useCallback(async () => {
    setError('');
    setLoadingGroups(true);
    try {
      const groups = await getResourceGroups();
      setResourceGroups(groups);
      setSelectedGroup((current) => current || groups[0]?.name || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load resource groups');
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadResourceGroups();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadResourceGroups]);

  const handleRunAnalysis = async () => {
    if (!selectedGroup) return;

    const nextAnalysisId = createAnalysisId();
    setAnalysisId(nextAnalysisId);
    setAnalysisResponse(null);
    setError('');
    setRunning(true);

    try {
      const response = await runAnalysis(selectedGroup, nextAnalysisId);
      setAnalysisResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setRunning(false);
    }
  };

  const openReport = () => {
    if (!analysisResponse) return;

    if (analysisResponse.saved_analysis?.id) {
      navigate(`/report/${analysisResponse.saved_analysis.id}`, {
        state: { report: analysisResponse.saved_analysis },
      });
      return;
    }

    navigate('/report', {
      state: {
        report: {
          resource_group: analysisResponse.resource_group,
          resources_scanned: analysisResponse.resources_count,
          issues_found: analysisResponse.analysis.issues?.length || 0,
          estimated_savings: analysisResponse.analysis.estimated_savings || 'Unknown',
          analysis_result: analysisResponse.analysis,
          status: analysisResponse.status,
          created_at: new Date().toISOString(),
        },
      },
    });
  };

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-300">
              <CloudCog className="h-4 w-4" />
              Azure Resource Group Scanner
            </div>
            <h1 className="text-3xl font-bold text-white">Run Cost Analysis</h1>
          </div>
          <button
            type="button"
            onClick={() => void loadResourceGroups()}
            disabled={loadingGroups}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-blue-400 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loadingGroups ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Resource Group</label>
            <select
              value={selectedGroup}
              onChange={(event) => setSelectedGroup(event.target.value)}
              disabled={loadingGroups || running}
              className="h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-gray-100 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">{loadingGroups ? 'Loading resource groups...' : 'Select a resource group'}</option>
              {resourceGroups.map((group) => (
                <option key={group.name} value={group.name}>
                  {group.name} ({group.location})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void handleRunAnalysis()}
              disabled={!selectedGroup || running}
              className="flex h-11 min-w-40 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? 'Running...' : 'Run Analysis'}
            </button>
          </div>
        </div>
      </section>

      <ProgressTracker key={analysisId || 'idle'} analysisId={analysisId} onComplete={openReport} />

      {analysisResponse && (
        <section className="rounded-xl border border-green-500/40 bg-green-500/10 p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Activity className="mt-1 h-5 w-5 text-green-300" />
              <div>
                <h2 className="text-lg font-semibold text-white">Analysis complete</h2>
                <p className="text-sm text-green-100">
                  {analysisResponse.resources_count} resources scanned in {analysisResponse.resource_group}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openReport}
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-green-400"
            >
              View Report
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
