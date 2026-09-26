export interface User {
  id: string; full_name: string; email: string; role: 'USER' | 'ADMIN' | 'OWNER';
  bio: string; title: string; location: string; avatar_url: string;
  preferences: Record<string, any>; created_at: string;
}
export interface Page<T> { items: T[]; total?: number; page?: number; unread?: number; has_more?: boolean; }
export interface Project {
  id: string; name: string; slug: string; description: string; short_description: string;
  category: string; status: string; progress: number; is_public: boolean; is_portfolio?: boolean;
  technologies: string[]; tags: string[]; features: string[]; start_date: string; end_date: string;
  github_url: string; live_url: string; documentation: string; architecture: string;
  challenges: string; solutions: string; future_improvements: string; screenshots: string[];
  logo_url: string; created_at: string; updated_at: string;
}
export interface Note { id: string; title: string; content: string; category: string; tags: string[];
  pinned: boolean; favorite: boolean; archived: boolean; updated_at: string; }
export interface Task { id: string; title: string; description: string; status: string; priority: string;
  due_date: string; project_id: string | null; progress: number; tags: string[];
  subtasks: {title: string; done: boolean}[]; comments: {content: string; author: string; created_at: string}[]; }
export interface Goal { id: string; title: string; description: string; deadline: string; priority: string;
  progress: number; milestones: {title: string; done: boolean}[]; }
export interface Notification { id: string; title: string; body: string; kind: string; link: string; is_read: boolean; created_at: string; }
export interface Member { id: string; full_name: string; title?: string; online: boolean; }
export interface Message { id: string; conversation_id: string; sender_id: string; content: string; attachment_id?: string;
  created_at: string; read_at?: string; attachment_url?: string; }
export interface Conversation { id: string; member: Member; last_message?: Message; unread: number; }
export interface Portfolio { name: string; title: string; bio: string; location: string; email: string;
  github_url: string; linkedin_url: string; skills: string[]; journey: {label: string; title: string; description: string}[];
  achievements: string[]; vision: string; }
export interface Report {
  kpis: Record<string, number>;
  monthly: {month: string; label: string; projects: number; activity: number; learning_minutes: number; completed_tasks: number}[];
  technologies: {name: string; count: number}[]; project_status: Record<string, number>;
  task_status: Record<string, number>; goal_progress: {name: string; progress: number}[];
  recent_projects: Project[]; activity: {id: string; action: string; resource_type: string; created_at: string}[];
  days: number; generated_at: string;
}
export interface SearchResult { id: string; title: string; kind: string; link: string; }

