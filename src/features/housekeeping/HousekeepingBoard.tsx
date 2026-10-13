import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { TaskCard } from './TaskCard';
import type { HousekeepingTask } from './TaskCard';
import type { HousekeepingTaskStatus } from '../../types';
import './HousekeepingBoard.css';

export default function HousekeepingBoard() {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/housekeeping-tasks');
      const list = response.data.data || response.data;
      setTasks(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Failed to fetch housekeeping tasks', error);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: HousekeepingTaskStatus) => {
    try {
      await api.patch(`/api/v1/housekeeping-tasks/${id}`, { status: newStatus });
      await fetchTasks();
    } catch (error) {
      console.error('Failed to update task status', error);
      alert('Gagal mengupdate status housekeeping ke backend.');
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="housekeeping-page">
      <div className="page-header">
        <h1 className="text-h1">Housekeeping</h1>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-ink-500">Memuat data...</div>
      ) : (
        <div className="kanban-board">
          {/* Kolom Menunggu */}
          <div className="kanban-column">
            <div className="kanban-header">
              <h2 className="text-h4">Menunggu ({pendingTasks.length})</h2>
            </div>
            <div className="kanban-list">
              {pendingTasks.map(task => (
                <TaskCard key={task.id} task={task} onUpdateStatus={handleUpdateStatus} />
              ))}
              {pendingTasks.length === 0 && <div className="kanban-empty">Tidak ada tugas</div>}
            </div>
          </div>

          {/* Kolom Sedang Dikerjakan */}
          <div className="kanban-column">
            <div className="kanban-header">
              <h2 className="text-h4">Sedang Dikerjakan ({inProgressTasks.length})</h2>
            </div>
            <div className="kanban-list">
              {inProgressTasks.map(task => (
                <TaskCard key={task.id} task={task} onUpdateStatus={handleUpdateStatus} />
              ))}
              {inProgressTasks.length === 0 && <div className="kanban-empty">Tidak ada tugas</div>}
            </div>
          </div>

          {/* Kolom Selesai */}
          <div className="kanban-column">
            <div className="kanban-header">
              <h2 className="text-h4">Selesai ({completedTasks.length})</h2>
            </div>
            <div className="kanban-list">
              {completedTasks.map(task => (
                <TaskCard key={task.id} task={task} onUpdateStatus={handleUpdateStatus} />
              ))}
              {completedTasks.length === 0 && <div className="kanban-empty">Tidak ada tugas</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
