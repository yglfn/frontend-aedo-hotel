import { Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import type { HousekeepingTaskStatus } from '../../types';
import './TaskCard.css';

export interface HousekeepingTask {
  id: number;
  room: { room_number: string };
  status: HousekeepingTaskStatus;
  notes: string;
  priority: 'high' | 'normal';
}

interface TaskCardProps {
  task: HousekeepingTask;
  onUpdateStatus: (id: number, newStatus: HousekeepingTaskStatus) => void;
}

export function TaskCard({ task, onUpdateStatus }: TaskCardProps) {
  const isPending = task.status === 'pending';
  const inProgress = task.status === 'in_progress';

  return (
    <div className={`task-card status-${task.status} priority-${task.priority}`}>
      <div className="task-card-header">
        <h3 className="task-room-number">Kamar {task.room.room_number}</h3>
        {task.priority === 'high' && <span className="priority-badge">Prioritas</span>}
      </div>
      
      <p className="task-notes">{task.notes}</p>
      
      <div className="task-actions">
        {isPending && (
          <Button 
            size="sm" 
            variant="secondary" 
            className="w-full"
            onClick={() => onUpdateStatus(task.id, 'in_progress')}
          >
            <Clock size={16} className="mr-2" /> Mulai Bersihkan
          </Button>
        )}
        
        {inProgress && (
          <Button 
            size="sm" 
            variant="primary" 
            className="w-full"
            onClick={() => onUpdateStatus(task.id, 'completed')}
          >
            <CheckCircle2 size={16} className="mr-2" /> Tandai Selesai
          </Button>
        )}

        {task.status === 'completed' && (
          <div className="task-completed-label">
            <CheckCircle2 size={16} /> Selesai
          </div>
        )}
      </div>
    </div>
  );
}
