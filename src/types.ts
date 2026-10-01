export type LogBulletType =
  | 'task'
  | 'done'
  | 'event'
  | 'note'
  | 'migrated'
  | 'scheduled'
  | 'dropped';

export interface LogItem {
  id: string;
  date: string; // "YYYY-MM-DD"
  month: string; // "YYYY-MM"
  bullet: LogBulletType;
  star: boolean;
  task: string; // 과제명 태그
  text: string;
  doneDate?: string; // "YYYY-MM-DD"
  from?: string; // "YYYY-MM-DD" (이월 원래 날짜)
  pos: number;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown; // v4 호환 및 알 수 없는 필드 보존
}

export interface ProjectStep {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface ProjectRow {
  id: string;
  name: string; // 예: "1차시"
  memo: string;
  due: string; // "YYYY-MM-DD" or ""
  checks: Record<string, string>; // { [stepId]: "YYYY-MM-DD" }
  [key: string]: unknown;
}

export interface ProjectMilestone {
  id: string;
  name: string; // 예: 착수보고, 중간보고, 검수, 납품
  dueDate: string; // "YYYY-MM-DD" or ""
  doneDate: string; // "YYYY-MM-DD" or ""
  memo?: string;
  [key: string]: unknown;
}

export interface ProjectTab {
  id: string;
  name: string; // 과제명
  vendor?: string; // 개발업체
  contractStart?: string; // 계약기간 시작 "YYYY-MM-DD"
  contractEnd?: string; // 계약기간 끝 "YYYY-MM-DD"
  lessonCount?: number; // 차시 수
  manager?: string; // 담당자
  memo?: string; // 과제 메모
  steps: ProjectStep[];
  rows: ProjectRow[];
  milestones?: ProjectMilestone[];
  updatedAt?: number;
  [key: string]: unknown;
}

export interface ChecklistData {
  activeTab: string;
  hideDone: boolean;
  tabs: ProjectTab[];
  [key: string]: unknown;
}

export interface ReportSectionItem {
  text: string;
  [key: string]: unknown;
}

export interface ReportSection {
  heading: string;
  items: ReportSectionItem[];
  [key: string]: unknown;
}

export interface ReportEntry {
  id: string;
  targetYear: number;
  targetMonth: number;
  targetWeek: 1 | 2 | 3 | 4;
  sections: ReportSection[];
  updatedAt: number;
  [key: string]: unknown;
}

export interface WorkVibeData {
  entries: ReportEntry[];
  logs: LogItem[];
  checklist: ChecklistData;
  timetable?: unknown[]; // v4 호환 보존
  lastRolloverDate?: string; // 마지막 자동 이월 기준일
  [key: string]: unknown; // 기타 알 수 없는 최상위 필드 보존
}

export type ActiveMenuId = '01' | '02' | '03' | '04' | '05';
