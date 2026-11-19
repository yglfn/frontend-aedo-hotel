/* oxlint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import { FileImage, RefreshCw, UploadCloud, X } from 'lucide-react';
import './FileDropzone.css';

interface FileDropzoneProps {
  value: File | null;
  onChange: (file: File | undefined) => void;
  accept: string;
  maxSizeMB: number;
  error?: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export function FileDropzone({ value, onChange, accept, maxSizeMB, error }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!value || !value.type.startsWith('image/')) {
      setPreviewUrl('');
      return;
    }

    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const openPicker = () => inputRef.current?.click();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    onChange(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="file-dropzone-field">
      <div
        className={`file-dropzone${isDragging ? ' is-dragging' : ''}${value ? ' has-file' : ''}${error ? ' has-error' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Pilih bukti pembayaran"
        aria-describedby="payment-proof-help payment-proof-error"
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          className="file-dropzone-input"
          type="file"
          accept={accept}
          onChange={(event) => onChange(event.target.files?.[0])}
        />

        {value ? (
          <div className="file-dropzone-preview">
            <div className="file-dropzone-thumbnail">
              {previewUrl ? <img src={previewUrl} alt="Pratinjau bukti pembayaran" /> : <FileImage size={24} />}
            </div>
            <div className="file-dropzone-file-info">
              <strong title={value.name}>{value.name}</strong>
              <span>{formatFileSize(value.size)}</span>
            </div>
            <button
              type="button"
              className="file-dropzone-action"
              onClick={(event) => {
                event.stopPropagation();
                openPicker();
              }}
              aria-label="Ganti file bukti pembayaran"
            >
              <RefreshCw size={16} />
              <span>Ganti</span>
            </button>
            <button
              type="button"
              className="file-dropzone-remove"
              onClick={(event) => {
                event.stopPropagation();
                onChange(undefined);
                if (inputRef.current) inputRef.current.value = '';
              }}
              aria-label="Hapus file bukti pembayaran"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="file-dropzone-empty">
            <span className="file-dropzone-icon" aria-hidden="true">
              {isDragging ? <UploadCloud size={24} /> : <FileImage size={24} />}
            </span>
            <strong>{isDragging ? 'Lepaskan file di sini' : 'Seret & lepas bukti di sini'}</strong>
            <span className="file-dropzone-select">atau klik untuk memilih file</span>
            <span id="payment-proof-help" className="file-dropzone-help">
              JPEG, JPG, atau PNG · maksimal {maxSizeMB} MB
            </span>
          </div>
        )}
      </div>
      {error && <div id="payment-proof-error" className="file-dropzone-error" role="alert">{error}</div>}
    </div>
  );
}
