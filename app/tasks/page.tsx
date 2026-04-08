import { redirect } from 'next/navigation';

/** Legacy URL — task list lives on Dashboard. */
export default function TasksRedirect() {
  redirect('/dashboard');
}
