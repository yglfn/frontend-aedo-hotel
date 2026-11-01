import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Objek yang sedang ditampilkan, dipakai sebagai teks pendamping ("Laporan Shift"). */
  subject?: string;
  /** Aksi perbaikan, mis. memuat ulang data. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Penahan error render: tanpa ini satu field laporan yang bentuknya tidak sesuai
 * langsung membuat seluruh halaman putih. Yang rusak hanya bagian isinya,
 * navigasi dan periode tetap bisa dipakai.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state = { error: null } as ErrorBoundaryState;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Gagal menampilkan laporan', error, info);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="report-error">
        <p className="callout callout-danger">
          <span>
            <span className="callout-judul">
              {this.props.subject ? `${this.props.subject} gagal ditampilkan` : 'Laporan gagal ditampilkan'}
            </span>
            <span className="callout-meta">Bagian lain tetap bisa dibuka. Coba muat ulang data laporan ini.</span>
          </span>
        </p>
        <Button variant="secondary" size="sm" onClick={this.handleReset}>
          Muat ulang
        </Button>
      </div>
    );
  }
}
