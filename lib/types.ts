export type EventType = "Lecture" | "Assignment" | "Study";

export interface ScheduleEvent {
  id: number;
  user_id: string;
  title: string;
  type: EventType;
  day: string;
  start_hour: number;
  duration: number;
}

export interface Workout {
  id: number;
  user_id: string;
  name: string;
  date: string;
  duration: number;
  steps: number;
}

export interface AIError {
  message: string;
}
