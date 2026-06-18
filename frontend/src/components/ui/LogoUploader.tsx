import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Image, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface LogoUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

export const LogoUploader: React.FC<LogoUploaderProps> = ({ value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are accepted');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File exceeds 5 MB limit');
      return;
    }

    setUploading(true);
    try {
      const baseURL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${baseURL}/upload/logo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      onChange(data.url);
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleRemove = () => {
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : value ? (
          <img src={value} alt="Logo" className="max-h-20 max-w-40 rounded object-contain" />
        ) : (
          <>
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Drop logo here or click to browse</p>
            <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPEG, WebP, SVG — up to 5 MB</p>
          </>
        )}
      </div>

      {value && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
          <img src={value} alt="" className="h-8 w-8 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="flex-1 truncate text-xs text-muted-foreground">{value}</span>
          <button
            onClick={handleRemove}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};
