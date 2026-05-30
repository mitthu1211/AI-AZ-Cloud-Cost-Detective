import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { WS_BASE_URL } from '../lib/api';

interface ProgressTrackerProps {
  analysisId: string | null;
  onComplete?: () => void;
}

export default function ProgressTracker({ analysisId, onComplete }: ProgressTrackerProps) {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!analysisId) return;

    const ws = new WebSocket(`${WS_BASE_URL}/progress/${analysisId}`);
    
    ws.onmessage = (event) => {
      const message = event.data;
      setMessages(prev => [...prev, message]);
      if (message === 'Analysis complete') {
        setTimeout(() => {
          onComplete?.();
        }, 1000);
      }
    };

    return () => {
      ws.close();
    };
  }, [analysisId, onComplete]);

  if (!analysisId) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mt-8">
      <h3 className="text-lg font-medium text-white mb-4">Analysis Progress</h3>
      <div className="space-y-4">
        {messages.map((msg, idx) => {
          const isComplete = msg === 'Analysis complete';
          const isError = msg.toLowerCase().startsWith('error');
          const isLast = idx === messages.length - 1;
          
          return (
            <div key={idx} className="flex items-center gap-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              {isError ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : isComplete || !isLast ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              )}
              <span className={isError ? "text-red-400 font-medium" : isComplete ? "text-green-400 font-medium" : "text-gray-300"}>
                {msg}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
