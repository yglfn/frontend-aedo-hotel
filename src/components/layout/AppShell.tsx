import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import './AppShell.css';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main-wrapper">
        <Topbar />
        <main className="app-content">
          <div className="app-content-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
