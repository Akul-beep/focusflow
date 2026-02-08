import { MicroTask } from '@/types';

export interface TaskSchedulingRequest {
  tasks: Array<{
    title: string;
    description?: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    subject?: string;
  }>;
  availableHours: {
    [key: string]: number[]; // e.g., { "monday": [9, 10, 11, 14, 15, 16] }
  };
}

export interface ScheduledTask {
  taskId: string;
  scheduledTime: string;
  microTasks: Array<{
    title: string;
    description?: string;
    estimatedMinutes: number;
    order: number;
  }>;
}

export async function scheduleTasksWithAI(
  request: TaskSchedulingRequest
): Promise<ScheduledTask[]> {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'scheduleTasks',
        ...request,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to schedule tasks');
    }

    const data = await response.json();
    return data.scheduled;
  } catch (error) {
    console.error('Error scheduling tasks with AI:', error);
    throw error;
  }
}

export async function chunkTaskWithAI(
  title: string,
  description: string,
  estimatedHours: number
): Promise<MicroTask[]> {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chunkTask',
        title,
        description,
        estimatedHours,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || 'Failed to chunk task';
      const networkError = new Error(errorMessage);
      (networkError as any).networkIssue = errorData.networkIssue;
      throw networkError;
    }

    const data = await response.json();
    return data.microTasks;
  } catch (error) {
    console.error('Error chunking task with AI:', error);
    throw error;
  }
}
