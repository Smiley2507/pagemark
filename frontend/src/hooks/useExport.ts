import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export function useExportDocument() {
  const [loading, setLoading] = useState(false);

  const exportDocument = useCallback(async (
    projectId: number,
    documentId: number,
    format: 'markdown' | 'html' | 'pdf' = 'markdown',
    overrides?: Record<string, string>,
  ) => {
    setLoading(true);
    try {
      const baseURL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
      const params = new URLSearchParams({ format });
      if (overrides) {
        Object.entries(overrides).forEach(([key, val]) => {
          if (val) params.set(key, val);
        });
      }
      const res = await fetch(
        `${baseURL}/projects/${projectId}/documents/${documentId}/export?${params}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${documentId}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { exportDocument, loading };
}
