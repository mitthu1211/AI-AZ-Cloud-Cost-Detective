const API_BASE_URL = 'http://localhost:8000/api';
export const WS_BASE_URL = 'ws://localhost:8000/ws';

export interface ResourceGroup {
  name: string;
  location: string;
}

export interface AnalysisIssue {
  resource_name?: string;
  issue?: string;
  issue_type?: string;
  severity?: 'high' | 'medium' | 'low' | string;
  explanation?: string;
  recommendation?: string;
  fix_command?: string;
}

export interface AnalysisResult {
  summary?: string;
  issues?: AnalysisIssue[];
  estimated_savings?: string;
  fix_commands?: string[];
}

export interface AnalysisRecord {
  id: number;
  resource_group: string;
  resources_scanned: number;
  issues_found: number;
  estimated_savings: string;
  analysis_result?: AnalysisResult;
  status: string;
  created_at: string | null;
}

export interface AnalyzeResponse {
  status: string;
  resource_group: string;
  resources_count: number;
  analysis: AnalysisResult;
  saved_analysis?: AnalysisRecord | null;
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const authHeader = getAuthHeader();
  Object.entries(authHeader).forEach(([key, value]) => headers.set(key, value));

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'API request failed');
  }

  return response.json();
}

export async function signup(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Signup failed');
  }

  return response.json();
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Login failed');
  }

  return response.json();
}

export async function getResourceGroups(): Promise<ResourceGroup[]> {
  const response = await fetchWithAuth('/resource-groups');
  return response.data;
}

export async function runAnalysis(resourceGroup: string, analysisId: string): Promise<AnalyzeResponse> {
  return fetchWithAuth('/analyze', {
    method: 'POST',
    body: JSON.stringify({ resource_group: resourceGroup, analysis_id: analysisId }),
  });
}

export async function getHistory(): Promise<AnalysisRecord[]> {
  const response = await fetchWithAuth('/history');
  return response.data;
}

export async function getAnalysisDetail(analysisId: string): Promise<AnalysisRecord> {
  const response = await fetchWithAuth(`/history/${analysisId}`);
  return response.data;
}
