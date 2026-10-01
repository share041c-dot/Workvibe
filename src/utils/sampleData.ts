import {
  ChecklistData,
  LogItem,
  ProjectMilestone,
  ProjectRow,
  ProjectStep,
  ProjectTab,
  ReportEntry,
  WorkVibeData,
} from '../types';
import { getTodayYMD } from './weekCalculator';

export const STORAGE_KEY = 'report-helper-v5';

export const DEFAULT_STEP_NAMES = [
  '기획',
  '원고',
  '스토리보드',
  '개발',
  '검수',
  '탑재',
];

export function createDefaultSteps(): ProjectStep[] {
  return DEFAULT_STEP_NAMES.map((name, idx) => ({
    id: `step-${idx + 1}-${Date.now().toString(36)}`,
    name,
  }));
}

export function createLessonRows(count: number, startIdx = 1): ProjectRow[] {
  const rows: ProjectRow[] = [];
  const safeCount = Math.max(0, Math.min(200, Math.floor(count)));
  for (let i = 0; i < safeCount; i++) {
    const num = startIdx + i;
    rows.push({
      id: `row-${num}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${num}차시`,
      memo: '',
      due: '',
      checks: {},
    });
  }
  return rows;
}

export function createDefaultMilestones(): ProjectMilestone[] {
  return [
    { id: 'ms-1', name: '착수보고', dueDate: '2026-05-15', doneDate: '2026-05-14' },
    { id: 'ms-2', name: '중간보고', dueDate: '2026-08-20', doneDate: '2026-08-19' },
    { id: 'ms-3', name: '검수', dueDate: '2026-10-25', doneDate: '' },
    { id: 'ms-4', name: '납품', dueDate: '2026-11-20', doneDate: '' },
  ];
}

export function createInitialWorkVibeData(): WorkVibeData {
  const today = getTodayYMD();
  const now = Date.now();

  // 1번 과제: 2026년 이러닝 콘텐츠 개발 (20차시)
  const steps1: ProjectStep[] = [
    { id: 's-plan', name: '기획' },
    { id: 's-ms', name: '원고' },
    { id: 's-sb', name: '스토리보드' },
    { id: 's-dev', name: '개발' },
    { id: 's-qa', name: '검수' },
    { id: 's-lms', name: '탑재' },
  ];

  // 20차시 × 6단계 = 120칸 중 72칸 완료 = 정확히 60% 공정률
  const rows1: ProjectRow[] = Array.from({ length: 20 }, (_, i) => {
    const num = i + 1;
    const checks: Record<string, string> = {};
    checks['s-plan'] = '2026-06-20';
    checks['s-ms'] = '2026-07-25';
    if (num <= 16) {
      checks['s-sb'] = num <= 12 ? '2026-08-28' : '2026-09-24';
    }
    if (num <= 12) {
      checks['s-dev'] = num <= 9 ? '2026-09-18' : '2026-10-02';
    }
    if (num <= 4) {
      checks['s-qa'] = '2026-09-29';
    }

    let due = '2026-10-30';
    let memo = '';
    if (num === 5) {
      due = today; // 임박 예시
      memo = 'SME 자문위원 2차 피드백 반영 확인';
    } else if (num === 13) {
      due = '2026-09-28'; // 지연 예시
      memo = '성우 내레이션 재녹음본 수급 대기';
    } else if (num === 17) {
      due = '2026-10-08';
      memo = '인포그래픽 도식 수정 요청';
    } else if (num <= 4) {
      due = '2026-10-15';
      memo = 'LMS 테스트 서버 탑재 대기';
    }

    return {
      id: `p1-row-${num}`,
      name: `${num}차시`,
      memo,
      due,
      checks,
    };
  });

  // 2번 과제: 디지털 윤리 마이크로러닝 개발 (10차시)
  const steps2: ProjectStep[] = [
    { id: 's2-plan', name: '기획' },
    { id: 's2-ms', name: '원고' },
    { id: 's2-sb', name: '스토리보드' },
    { id: 's2-dev', name: '개발' },
    { id: 's2-qa', name: '검수' },
    { id: 's2-lms', name: '탑재' },
  ];

  const rows2: ProjectRow[] = Array.from({ length: 10 }, (_, i) => {
    const num = i + 1;
    const checks: Record<string, string> = {
      's2-plan': '2026-08-10',
      's2-ms': '2026-09-05',
    };
    if (num <= 6) checks['s2-sb'] = '2026-09-22';
    if (num <= 3) checks['s2-dev'] = '2026-09-29';
    return {
      id: `p2-row-${num}`,
      name: `${num}차시`,
      memo: num === 4 ? '모션그래픽 시안 확정 필요' : '',
      due: num <= 5 ? '2026-10-14' : '2026-10-28',
      checks,
    };
  });

  const logs: LogItem[] = [
    {
      id: 'log-1',
      date: '2026-09-29',
      month: '2026-09',
      bullet: 'done',
      star: true,
      task: '2026년 이러닝 콘텐츠 개발',
      text: '1~4차시 프로토타입 및 본개발분 품질 검수 완료',
      doneDate: '2026-09-29',
      pos: 1,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: 'log-2',
      date: '2026-09-30',
      month: '2026-09',
      bullet: 'done',
      star: true,
      task: '2026년 이러닝 콘텐츠 개발',
      text: '13~16차시 스토리보드 수정본 최종 승인 통보',
      doneDate: '2026-09-30',
      pos: 1,
      createdAt: now - 86400000,
      updatedAt: now - 86400000,
    },
    {
      id: 'log-3',
      date: '2026-09-30',
      month: '2026-09',
      bullet: 'event',
      star: false,
      task: '2026년 이러닝 콘텐츠 개발',
      text: '수행사 주간 공정 점검 화상회의 (14:00)',
      pos: 2,
      createdAt: now - 80000000,
      updatedAt: now - 80000000,
    },
    {
      id: 'log-4',
      date: '2026-09-30',
      month: '2026-09',
      bullet: 'task',
      star: true,
      task: '이러닝 운영 지침 개정',
      text: '수료 기준 및 웹접근성 검수 지침 개정안 관계부서 의견 조회',
      from: '2026-09-28',
      pos: 3,
      createdAt: now - 70000000,
      updatedAt: now - 70000000,
    },
    {
      id: 'log-5',
      date: '2026-09-30',
      month: '2026-09',
      bullet: 'note',
      star: false,
      task: '2026년 이러닝 콘텐츠 개발',
      text: '한국교육학술정보원 표준 메타데이터 규격 v2.4 적용 여부 확인 메모',
      pos: 4,
      createdAt: now - 60000000,
      updatedAt: now - 60000000,
    },
    {
      id: 'log-6',
      date: '2026-10-02',
      month: '2026-10',
      bullet: 'done',
      star: true,
      task: '2026년 이러닝 콘텐츠 개발',
      text: '스토리보드 검토 의견 회신',
      doneDate: '2026-10-02',
      pos: 1,
      createdAt: now - 50000000,
      updatedAt: now - 50000000,
    },
    {
      id: 'log-7',
      date: '2026-10-05',
      month: '2026-10',
      bullet: 'done',
      star: false,
      task: '이러닝 운영 지침 개정',
      text: '개정안 초안 작성',
      doneDate: '2026-10-05',
      pos: 1,
      createdAt: now - 40000000,
      updatedAt: now - 40000000,
    },
    {
      id: 'log-10-6-todo',
      date: '2026-10-06',
      month: '2026-10',
      bullet: 'task',
      star: false,
      task: '이러닝 운영 지침 개정',
      text: '관계부서 검토 의견 취합 및 대조표 정리',
      pos: 1,
      createdAt: now - 35000000,
      updatedAt: now - 35000000,
    },
    {
      id: 'log-8',
      date: '2026-10-08',
      month: '2026-10',
      bullet: 'task',
      star: true,
      task: '2026년 이러닝 콘텐츠 개발',
      text: '5~12차시 개발물 전문가 1차 검수 위원회 개최 준비',
      pos: 1,
      createdAt: now - 30000000,
      updatedAt: now - 30000000,
    },
    {
      id: 'log-9',
      date: '2026-10-12',
      month: '2026-10',
      bullet: 'event',
      star: false,
      task: '이러닝 운영 지침 개정',
      text: '하반기 이러닝 운영위원회 안건 상정 및 심의',
      pos: 1,
      createdAt: now - 20000000,
      updatedAt: now - 20000000,
    },
    {
      id: 'log-undated-2026-10',
      date: '',
      month: '2026-10',
      bullet: 'task',
      star: false,
      task: '이러닝 운영 지침 개정',
      text: '10월 중 전 부서 사이버교육 이수율 중간 독려 공문 발송',
      pos: 1,
      createdAt: now - 15000000,
      updatedAt: now - 15000000,
    },
  ];

  const entries: ReportEntry[] = [
    {
      id: 'entry-2026-9-4',
      targetYear: 2026,
      targetMonth: 9,
      targetWeek: 4,
      sections: [
        {
          heading: '금주(9월 4주차) 추진실적',
          items: [
            { text: '① 2026년 이러닝 콘텐츠 개발' },
            { text: ' ㅇ 1~9차시 HTML5 본개발 산출물 수령 및 기능 점검(9.18.)' },
            { text: ' ㅇ 진척현황: 전체 20차시 중 기획 20, 원고 20, 스토리보드 12, 개발 9 완료(공정률 51%)' },
            { text: '② 디지털 윤리 마이크로러닝 개발' },
            { text: ' ㅇ 1~6차시 스토리보드 확정 및 디자인 시안 승인(9.16.)' },
          ],
        },
        {
          heading: '차주 추진계획',
          items: [
            { text: '① 2026년 이러닝 콘텐츠 개발' },
            { text: ' ㅇ 13~16차시 스토리보드 보완본 검토 및 승인(9.24.)' },
            { text: ' ㅇ 1~4차시 개발물 초기 검수 진행' },
          ],
        },
      ],
      updatedAt: now - 86400000 * 10,
    },
    {
      id: 'entry-2025-10-1',
      targetYear: 2025,
      targetMonth: 10,
      targetWeek: 1,
      sections: [
        {
          heading: '9월 추진실적',
          items: [
            { text: '① 2025년 직무교육 이러닝 콘텐츠 개발' },
            { text: ' ㅇ 전 차시(15차시) 스토리보드 확정 및 프로토타입 검수 완료(9.22.)' },
            { text: '② 학습관리시스템(LMS) 정기 기능 개선' },
            { text: ' ㅇ 모바일 수료증 발급 모듈 패치 적용(9.26.)' },
          ],
        },
        {
          heading: '10월 추진계획',
          items: [
            { text: '① 2025년 직무교육 이러닝 콘텐츠 개발' },
            { text: ' ㅇ 1~15차시 HTML5 본개발 완료 및 내·외부 전문가 검수 실시' },
          ],
        },
      ],
      updatedAt: now - 86400000 * 365,
    },
    {
      id: 'entry-2025-10-2',
      targetYear: 2025,
      targetMonth: 10,
      targetWeek: 2,
      sections: [
        {
          heading: '금주(10월 2주차) 추진실적',
          items: [
            { text: '① 2025년 직무교육 이러닝 콘텐츠 개발' },
            { text: ' ㅇ 1~10차시 본개발 산출물 1차 검수 및 수정사항 시트 송부(10.6.)' },
          ],
        },
        {
          heading: '차주 추진계획',
          items: [
            { text: '① 2025년 직무교육 이러닝 콘텐츠 개발' },
            { text: ' ㅇ 11~15차시 본개발 완료분 수령 및 통합 품질 검수' },
          ],
        },
      ],
      updatedAt: now - 86400000 * 358,
    },
  ];

  return {
    entries,
    logs,
    checklist: {
      activeTab: 'tab-elearning-2026',
      hideDone: false,
      tabs: [
        {
          id: 'tab-elearning-2026',
          name: '2026년 이러닝 콘텐츠 개발',
          vendor: '(주)에듀테크솔루션',
          contractStart: '2026-05-01',
          contractEnd: '2026-11-30',
          lessonCount: 20,
          manager: '김지훈 주무관',
          memo: '공공기관 필수 직무교육 과정 20차시 신규 개발 용역 (웹접근성 인증 포함)',
          steps: steps1,
          rows: rows1,
          milestones: createDefaultMilestones(),
          updatedAt: now,
        },
        {
          id: 'tab-micro-2026',
          name: '디지털 윤리 마이크로러닝 개발',
          vendor: '(주)러닝크리에이티브',
          contractStart: '2026-07-15',
          contractEnd: '2026-11-15',
          lessonCount: 10,
          manager: '김지훈 주무관',
          memo: '전 직원 대상 10분 내외 숏폼 이러닝 10차시 제작',
          steps: steps2,
          rows: rows2,
          milestones: [
            { id: 'ms2-1', name: '착수보고', dueDate: '2026-07-25', doneDate: '2026-07-24' },
            { id: 'ms2-2', name: '중간보고', dueDate: '2026-09-25', doneDate: '2026-09-25' },
            { id: 'ms2-3', name: '검수', dueDate: '2026-10-28', doneDate: '' },
            { id: 'ms2-4', name: '납품', dueDate: '2026-11-12', doneDate: '' },
          ],
          updatedAt: now,
        },
      ],
    },
    timetable: [],
    lastRolloverDate: today,
  };
}

/**
 * v4 또는 외부 백업 JSON을 v5 구조로 정규화하되 알 수 없는 필드는 모두 보존
 */
export function normalizeWorkVibeData(raw: unknown): WorkVibeData {
  if (!raw || typeof raw !== 'object') {
    return createInitialWorkVibeData();
  }

  const obj = raw as Record<string, unknown>;

  const rawEntries = Array.isArray(obj.entries) ? obj.entries : [];
  const entries: ReportEntry[] = rawEntries
    .filter((e): e is Record<string, unknown> => Boolean(e && typeof e === 'object'))
    .map((e, idx) => {
      const targetWeekNum = Number(e.targetWeek);
      const validWeek: 1 | 2 | 3 | 4 =
        targetWeekNum === 1 || targetWeekNum === 2 || targetWeekNum === 3 || targetWeekNum === 4
          ? targetWeekNum
          : 1;
      const rawSections = Array.isArray(e.sections) ? e.sections : [];
      const sections = rawSections
        .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
        .map((s) => ({
          ...s,
          heading: typeof s.heading === 'string' ? s.heading : '',
          items: Array.isArray(s.items)
            ? s.items
                .filter((it): it is Record<string, unknown> => Boolean(it && typeof it === 'object'))
                .map((it) => ({
                  ...it,
                  text: typeof it.text === 'string' ? it.text : '',
                }))
            : [],
        }));

      return {
        ...e,
        id: typeof e.id === 'string' && e.id ? e.id : `entry-${idx}-${Date.now()}`,
        targetYear: Number(e.targetYear) || 2026,
        targetMonth: Number(e.targetMonth) || 1,
        targetWeek: validWeek,
        sections,
        updatedAt: Number(e.updatedAt) || Date.now(),
      };
    });

  const rawLogs = Array.isArray(obj.logs) ? obj.logs : [];
  const logs: LogItem[] = rawLogs
    .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === 'object'))
    .map((l, idx) => {
      // 날짜 없는 이달 할 일(date === "") 보존 지원
      const dateStr =
        typeof l.date === 'string'
          ? l.date
          : getTodayYMD();
      const monthStr =
        typeof l.month === 'string' && l.month
          ? l.month
          : dateStr
            ? dateStr.slice(0, 7)
            : getTodayYMD().slice(0, 7);
      const bulletVal = typeof l.bullet === 'string' ? l.bullet : 'task';
      return {
        ...l,
        id: typeof l.id === 'string' && l.id ? l.id : `log-${idx}-${Date.now()}`,
        date: dateStr,
        month: monthStr,
        bullet: bulletVal as LogItem['bullet'],
        star: Boolean(l.star),
        task: typeof l.task === 'string' ? l.task : '',
        text: typeof l.text === 'string' ? l.text : '',
        doneDate: typeof l.doneDate === 'string' ? l.doneDate : undefined,
        from: typeof l.from === 'string' ? l.from : undefined,
        pos: typeof l.pos === 'number' ? l.pos : idx + 1,
        createdAt: Number(l.createdAt) || Date.now(),
        updatedAt: Number(l.updatedAt) || Date.now(),
      };
    });

  const rawChecklist =
    obj.checklist && typeof obj.checklist === 'object'
      ? (obj.checklist as Record<string, unknown>)
      : {};
  const rawTabs = Array.isArray(rawChecklist.tabs) ? rawChecklist.tabs : [];

  const tabs: ProjectTab[] = rawTabs
    .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
    .map((t, idx) => {
      const steps: ProjectStep[] = Array.isArray(t.steps)
        ? t.steps
            .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
            .map((s, sIdx) => ({
              ...s,
              id: typeof s.id === 'string' && s.id ? s.id : `step-${sIdx}`,
              name: typeof s.name === 'string' ? s.name : `단계 ${sIdx + 1}`,
            }))
        : createDefaultSteps();

      const rows: ProjectRow[] = Array.isArray(t.rows)
        ? t.rows
            .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
            .map((r, rIdx) => {
              const rawChecks =
                r.checks && typeof r.checks === 'object'
                  ? (r.checks as Record<string, unknown>)
                  : {};
              const checks: Record<string, string> = {};
              for (const [k, v] of Object.entries(rawChecks)) {
                if (typeof v === 'string' && v) {
                  checks[k] = v;
                }
              }
              return {
                ...r,
                id: typeof r.id === 'string' && r.id ? r.id : `row-${rIdx}`,
                name: typeof r.name === 'string' ? r.name : `${rIdx + 1}차시`,
                memo: typeof r.memo === 'string' ? r.memo : '',
                due: typeof r.due === 'string' ? r.due : '',
                checks,
              };
            })
        : [];

      const milestones: ProjectMilestone[] = Array.isArray(t.milestones)
        ? t.milestones
            .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
            .map((m, mIdx) => ({
              ...m,
              id: typeof m.id === 'string' && m.id ? m.id : `ms-${mIdx}`,
              name: typeof m.name === 'string' ? m.name : '',
              dueDate: typeof m.dueDate === 'string' ? m.dueDate : '',
              doneDate: typeof m.doneDate === 'string' ? m.doneDate : '',
              memo: typeof m.memo === 'string' ? m.memo : undefined,
            }))
        : [];

      return {
        ...t,
        id: typeof t.id === 'string' && t.id ? t.id : `tab-${idx}-${Date.now()}`,
        name: typeof t.name === 'string' ? t.name : `용역 과제 ${idx + 1}`,
        vendor: typeof t.vendor === 'string' ? t.vendor : '',
        contractStart: typeof t.contractStart === 'string' ? t.contractStart : '',
        contractEnd: typeof t.contractEnd === 'string' ? t.contractEnd : '',
        lessonCount: typeof t.lessonCount === 'number' ? t.lessonCount : rows.length,
        manager: typeof t.manager === 'string' ? t.manager : '',
        memo: typeof t.memo === 'string' ? t.memo : '',
        steps,
        rows,
        milestones,
        updatedAt: Number(t.updatedAt) || 0,
      };
    });

  const activeTab =
    typeof rawChecklist.activeTab === 'string' &&
    tabs.some((t) => t.id === rawChecklist.activeTab)
      ? rawChecklist.activeTab
      : tabs[0]?.id || '';

  const checklist: ChecklistData = {
    ...rawChecklist,
    activeTab,
    hideDone: Boolean(rawChecklist.hideDone),
    tabs,
  };

  return {
    ...obj,
    entries,
    logs,
    checklist,
    timetable: Array.isArray(obj.timetable) ? obj.timetable : [],
  };
}

/**
 * 백업 JSON 불러오기 병합 함수
 * - 기존 데이터를 지우지 않고 합치기
 * - 같은 id는 updatedAt이 더 최근인 쪽 사용
 * - 전체 초기화 후 불러오기 시에도 원래 상태가 100% 복원되도록 보장
 */
export function mergeWorkVibeData(
  current: WorkVibeData,
  importedRaw: unknown
): {
  merged: WorkVibeData;
  stats: {
    addedEntries: number;
    updatedEntries: number;
    addedLogs: number;
    updatedLogs: number;
    addedTabs: number;
    updatedTabs: number;
  };
} {
  const incoming = normalizeWorkVibeData(importedRaw);
  const isCurrentEmpty =
    current.entries.length === 0 &&
    current.logs.length === 0 &&
    current.checklist.tabs.length === 0;

  const stats = {
    addedEntries: 0,
    updatedEntries: 0,
    addedLogs: 0,
    updatedLogs: 0,
    addedTabs: 0,
    updatedTabs: 0,
  };

  // 1. Entries 병합
  const entryMap = new Map<string, ReportEntry>();
  for (const e of current.entries) {
    entryMap.set(e.id, e);
  }
  for (const inc of incoming.entries) {
    const existingById = entryMap.get(inc.id);
    if (existingById) {
      if ((inc.updatedAt || 0) >= (existingById.updatedAt || 0)) {
        entryMap.set(inc.id, { ...existingById, ...inc });
        stats.updatedEntries++;
      }
    } else {
      const samePeriodEntry = Array.from(entryMap.values()).find(
        (x) =>
          x.targetYear === inc.targetYear &&
          x.targetMonth === inc.targetMonth &&
          x.targetWeek === inc.targetWeek
      );
      if (samePeriodEntry) {
        if ((inc.updatedAt || 0) >= (samePeriodEntry.updatedAt || 0)) {
          entryMap.delete(samePeriodEntry.id);
          entryMap.set(inc.id, { ...samePeriodEntry, ...inc });
          stats.updatedEntries++;
        }
      } else {
        entryMap.set(inc.id, inc);
        stats.addedEntries++;
      }
    }
  }

  // 2. Logs 병합
  const logMap = new Map<string, LogItem>();
  for (const l of current.logs) {
    logMap.set(l.id, l);
  }
  for (const inc of incoming.logs) {
    const existing = logMap.get(inc.id);
    if (existing) {
      if ((inc.updatedAt || 0) >= (existing.updatedAt || 0)) {
        logMap.set(inc.id, { ...existing, ...inc });
        stats.updatedLogs++;
      }
    } else {
      logMap.set(inc.id, inc);
      stats.addedLogs++;
    }
  }

  // 3. Checklist Tabs 병합
  const tabMap = new Map<string, ProjectTab>();
  for (const t of current.checklist.tabs) {
    tabMap.set(t.id, t);
  }
  for (const inc of incoming.checklist.tabs) {
    const existing = tabMap.get(inc.id);
    if (existing) {
      if ((inc.updatedAt || 0) >= (existing.updatedAt || 0)) {
        tabMap.set(inc.id, {
          ...existing,
          ...inc,
          vendor: inc.vendor || existing.vendor || '',
          contractStart: inc.contractStart || existing.contractStart || '',
          contractEnd: inc.contractEnd || existing.contractEnd || '',
          lessonCount: inc.lessonCount ?? existing.lessonCount ?? inc.rows.length,
          manager: inc.manager || existing.manager || '',
          memo: inc.memo || existing.memo || '',
          milestones:
            inc.milestones && inc.milestones.length > 0
              ? inc.milestones
              : existing.milestones || [],
        });
        stats.updatedTabs++;
      }
    } else {
      tabMap.set(inc.id, inc);
      stats.addedTabs++;
    }
  }

  const mergedTabs = Array.from(tabMap.values());
  const activeTab =
    (isCurrentEmpty ? incoming.checklist.activeTab : current.checklist.activeTab) ||
    incoming.checklist.activeTab ||
    mergedTabs[0]?.id ||
    '';

  const hideDone = isCurrentEmpty
    ? Boolean(incoming.checklist.hideDone)
    : Boolean(current.checklist.hideDone || incoming.checklist.hideDone);

  const mergedTimetable =
    Array.isArray(incoming.timetable) && incoming.timetable.length > 0
      ? incoming.timetable
      : current.timetable || [];

  const merged: WorkVibeData = {
    ...current,
    ...incoming,
    entries: Array.from(entryMap.values()).sort((a, b) => b.updatedAt - a.updatedAt),
    logs: Array.from(logMap.values()),
    checklist: {
      ...current.checklist,
      ...incoming.checklist,
      activeTab,
      hideDone,
      tabs: mergedTabs,
    },
    timetable: mergedTimetable,
  };

  return { merged, stats };
}

/**
 * 자동 이월: 지난 날짜(date !== '' && date < targetDate)의 미완료 할 일(bullet === 'task' & !doneDate)을
 * targetDate 노트 맨 위로 옮기고 원래 날짜를 from 필드에 기록 ("9.30.부터 이월")
 */
export function rolloverPastIncompleteTasks(
  logs: LogItem[],
  targetDate: string
): { updatedLogs: LogItem[]; rolledCount: number } {
  const candidates = logs.filter(
    (l) =>
      Boolean(l.date) &&
      l.date < targetDate &&
      l.bullet === 'task' &&
      !l.doneDate &&
      l.text.trim().length > 0
  );

  if (candidates.length === 0) {
    return { updatedLogs: logs, rolledCount: 0 };
  }

  const now = Date.now();
  const targetMonth = targetDate.slice(0, 7);

  const candidateIds = new Set(candidates.map((c) => c.id));
  const shiftAmount = candidates.length;

  const updatedLogs = logs.map((l) => {
    if (candidateIds.has(l.id)) {
      const idx = candidates.findIndex((c) => c.id === l.id);
      return {
        ...l,
        from: l.from || l.date,
        date: targetDate,
        month: targetMonth,
        pos: idx + 1,
        updatedAt: now,
      };
    }
    if (l.date === targetDate) {
      return {
        ...l,
        pos: (l.pos || 1) + shiftAmount,
      };
    }
    return l;
  });

  return {
    updatedLogs,
    rolledCount: candidates.length,
  };
}
