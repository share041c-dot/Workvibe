import {
  ProjectTab,
  ReportSection,
  WorkVibeData,
} from '../types';
import {
  CollectionPeriod,
  formatShortMonthDay,
  getPrevYearMonth,
  pad2,
} from './weekCalculator';

export const CIRCLED_NUMBERS = [
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
];

export interface StepStat {
  stepId: string;
  stepName: string;
  doneCount: number;
  totalRows: number;
}

export interface ProjectProgressSummary {
  totalRows: number;
  totalSteps: number;
  totalCells: number;
  checkedCells: number;
  progressRate: number; // 0 ~ 100
  stepStats: StepStat[];
  summaryLine: string; // "진척현황: 전체 20차시 중 원고 20, 스토리보드 16, 개발 12, 검수 8 완료(공정률 60%)"
}

/**
 * 용역 과제 탭의 단계별 완료 수, 공정률, 진척현황 요약 문구 계산
 * 공정률 = 체크된 칸 수 ÷ (행 수 × 단계 수) × 100
 */
export function calculateProjectProgress(tab: ProjectTab): ProjectProgressSummary {
  const totalRows = tab.rows.length;
  const totalSteps = tab.steps.length;
  const totalCells = totalRows * totalSteps;

  let checkedCells = 0;
  const stepStats: StepStat[] = tab.steps.map((step) => {
    let doneCount = 0;
    for (const row of tab.rows) {
      if (row.checks && row.checks[step.id]) {
        doneCount++;
        checkedCells++;
      }
    }
    return {
      stepId: step.id,
      stepName: step.name,
      doneCount,
      totalRows,
    };
  });

  const progressRate =
    totalCells > 0 ? Math.round((checkedCells / totalCells) * 100) : 0;

  const activeStepStats = stepStats.filter((s) => s.doneCount > 0);
  const stepParts =
    activeStepStats.length > 0
      ? activeStepStats.map((s) => `${s.stepName} ${s.doneCount}`).join(', ')
      : stepStats.map((s) => `${s.stepName} 0`).join(', ');

  const unitLabel = `${totalRows}차시`;
  const summaryLine = `진척현황: 전체 ${unitLabel} 중 ${stepParts} 완료(공정률 ${progressRate}%)`;

  return {
    totalRows,
    totalSteps,
    totalCells,
    checkedCells,
    progressRate,
    stepStats,
    summaryLine,
  };
}

export interface CollectedBullet {
  text: string;
  star: boolean;
  date: string;
  source: 'log' | 'project' | 'summary';
}

export interface GroupedTaskCollection {
  taskName: string;
  hasStar: boolean;
  isServiceProject: boolean;
  items: CollectedBullet[];
  progressSummaryLine?: string;
}

function appendDateIfMissing(text: string, dateStr?: string): string {
  const trimmed = text.trim();
  if (!dateStr) return trimmed;
  const shortDate = formatShortMonthDay(dateStr);
  if (!shortDate) return trimmed;
  if (/\(\d{1,2}\.\d{1,2}\.?\)$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}(${shortDate})`;
}

function buildSortedGroupsFromMap(
  map: Map<string, CollectedBullet[]>,
  projectTabsByName: Map<string, ProjectTab>
): GroupedTaskCollection[] {
  const groups: GroupedTaskCollection[] = [];

  for (const [taskName, rawItems] of map.entries()) {
    const sortedItems = [...rawItems].sort((a, b) => {
      if (a.star !== b.star) return a.star ? -1 : 1;
      return (a.date || '').localeCompare(b.date || '');
    });

    const hasStar = sortedItems.some((i) => i.star);
    const matchedTab = projectTabsByName.get(taskName);
    let progressSummaryLine: string | undefined;

    if (matchedTab && matchedTab.rows.length > 0 && matchedTab.steps.length > 0) {
      const prog = calculateProjectProgress(matchedTab);
      progressSummaryLine = prog.summaryLine;
    }

    groups.push({
      taskName,
      hasStar,
      isServiceProject: Boolean(matchedTab),
      items: sortedItems,
      progressSummaryLine,
    });
  }

  groups.sort((a, b) => {
    if (a.hasStar !== b.hasStar) return a.hasStar ? -1 : 1;
    if (a.taskName === '기타 일반 업무' && b.taskName !== '기타 일반 업무') return 1;
    if (b.taskName === '기타 일반 업무' && a.taskName !== '기타 일반 업무') return -1;
    if (a.isServiceProject !== b.isServiceProject) return a.isServiceProject ? -1 : 1;
    return a.taskName.localeCompare(b.taskName, 'ko');
  });

  return groups;
}

function groupsToSectionItems(groups: GroupedTaskCollection[]): { text: string }[] {
  const lines: { text: string }[] = [];
  groups.forEach((group, idx) => {
    const circleNum = CIRCLED_NUMBERS[idx] || `(${idx + 1})`;
    lines.push({ text: `${circleNum} ${group.taskName}` });
    for (const item of group.items) {
      lines.push({ text: ` ㅇ ${item.text}` });
    }
    if (group.progressSummaryLine) {
      lines.push({ text: ` ㅇ ${group.progressSummaryLine}` });
    }
  });
  return lines;
}

/**
 * 주·월간 보고용 실적 및 계획 자동 수집
 */
export function collectReportData(
  data: WorkVibeData,
  year: number,
  month: number,
  week: 1 | 2 | 3 | 4,
  period: CollectionPeriod,
  includePastIncompleteTasks = true
): {
  perfHeading: string;
  planHeading: string;
  perfGroups: GroupedTaskCollection[];
  planGroups: GroupedTaskCollection[];
  sections: ReportSection[];
} {
  const isMonthly = week === 1;
  const prev = getPrevYearMonth(year, month);
  const targetMonthStr = `${year}-${pad2(month)}`;
  const prevMonthStr = `${prev.year}-${pad2(prev.month)}`;

  const perfHeading = isMonthly
    ? `${prev.month}월 추진실적`
    : `금주(${month}월 ${week}주차) 추진실적`;
  const planHeading = isMonthly
    ? `${month}월 추진계획`
    : `차주 추진계획`;

  const projectTabsByName = new Map<string, ProjectTab>();
  const safeTabs = data?.checklist?.tabs || [];
  const safeLogs = data?.logs || [];
  for (const tab of safeTabs) {
    projectTabsByName.set(tab.name.trim(), tab);
  }

  // 1. 실적(Performance) 수집
  const perfMap = new Map<string, CollectedBullet[]>();
  const addPerfItem = (taskName: string, item: CollectedBullet) => {
    const key = (taskName || '').trim() || '기타 일반 업무';
    const arr = perfMap.get(key) || [];
    arr.push(item);
    perfMap.set(key, arr);
  };

  const sortedLogs = [...safeLogs].sort((a, b) => {
    if ((a.date || '') !== (b.date || '')) {
      return (a.date || '').localeCompare(b.date || '');
    }
    return (a.pos ?? 0) - (b.pos ?? 0);
  });

  for (const log of sortedLogs) {
    if (!log.text || !log.text.trim()) continue;

    const isDone = log.bullet === 'done' || Boolean(log.doneDate);
    if (isDone) {
      const doneDate = log.doneDate || log.date || '';
      if (doneDate && doneDate >= period.perfStart && doneDate <= period.perfEnd) {
        addPerfItem(log.task, {
          text: appendDateIfMissing(log.text, doneDate),
          star: Boolean(log.star),
          date: doneDate,
          source: 'log',
        });
      } else if (!doneDate && isMonthly && log.month === prevMonthStr) {
        // 날짜 없는 전월 할 일이 완료된 경우
        addPerfItem(log.task, {
          text: log.text.trim(),
          star: Boolean(log.star),
          date: period.perfEnd,
          source: 'log',
        });
      }
      continue;
    }

    if (log.bullet === 'event' && log.date) {
      if (log.date >= period.perfStart && log.date <= period.perfEnd) {
        addPerfItem(log.task, {
          text: appendDateIfMissing(log.text, log.date),
          star: Boolean(log.star),
          date: log.date,
          source: 'log',
        });
      }
    }
  }

  // 1-B. 기간 안에 체크된 용역 과제 단계 ("3차시 – 개발 완료")
  for (const tab of safeTabs) {
    for (const row of tab.rows) {
      for (const step of tab.steps) {
        const checkedDate = row.checks?.[step.id];
        if (
          checkedDate &&
          checkedDate >= period.perfStart &&
          checkedDate <= period.perfEnd
        ) {
          addPerfItem(tab.name, {
            text: `${row.name} – ${step.name} 완료`,
            star: false,
            date: checkedDate,
            source: 'project',
          });
        }
      }
    }
  }

  // 2. 계획(Plan) 수집
  const planMap = new Map<string, CollectedBullet[]>();
  const addPlanItem = (taskName: string, item: CollectedBullet) => {
    const key = (taskName || '').trim() || '기타 일반 업무';
    const arr = planMap.get(key) || [];
    arr.push(item);
    planMap.set(key, arr);
  };

  const planStartMonth = period.planStart.slice(0, 7);
  const planEndMonth = period.planEnd.slice(0, 7);

  for (const log of sortedLogs) {
    if (!log.text || !log.text.trim()) continue;
    const isDone = log.bullet === 'done' || Boolean(log.doneDate);

    // 날짜 없는 이달 할 일 (먼슬리에서 입력한 항목 -> 월간보고 계획으로 모임)
    if (!log.date) {
      if (
        !isDone &&
        log.bullet !== 'note' &&
        (log.month === targetMonthStr ||
          (isMonthly && (log.month === planStartMonth || log.month === planEndMonth)))
      ) {
        addPlanItem(log.task, {
          text: log.text.trim(),
          star: Boolean(log.star),
          date: period.planStart,
          source: 'log',
        });
      }
      continue;
    }

    // 계획 기간 안 날짜의 할 일·일정
    if (log.date >= period.planStart && log.date <= period.planEnd) {
      if (
        !isDone &&
        (log.bullet === 'task' ||
          log.bullet === 'migrated' ||
          log.bullet === 'scheduled' ||
          log.bullet === 'event')
      ) {
        const formattedText =
          log.bullet === 'event'
            ? appendDateIfMissing(log.text, log.date)
            : log.text.trim();
        addPlanItem(log.task, {
          text: formattedText,
          star: Boolean(log.star),
          date: log.date,
          source: 'log',
        });
      }
      continue;
    }

    // 계획 시작일 이전 날짜에 남아 있는 미완료 할 일 (보고서를 월·화요일에 써도 빠지지 않도록. 옵션, 기본 켜짐)
    if (
      includePastIncompleteTasks &&
      log.date < period.planStart &&
      !isDone &&
      (log.bullet === 'task' || log.bullet === 'migrated' || log.bullet === 'scheduled')
    ) {
      addPlanItem(log.task, {
        text: log.text.trim(),
        star: Boolean(log.star),
        date: log.date,
        source: 'log',
      });
    }
  }

  // 2-B. 기한이 계획 기간 안인 미완료 용역 행 (다음 단계 이름 표시)
  for (const tab of safeTabs) {
    for (const row of tab.rows) {
      if (!row.due) continue;
      if (row.due >= period.planStart && row.due <= period.planEnd) {
        const nextStep = tab.steps.find((s) => !row.checks?.[s.id]);
        if (nextStep) {
          addPlanItem(tab.name, {
            text: `${row.name} – ${nextStep.name} 예정(${formatShortMonthDay(row.due)})`,
            star: false,
            date: row.due,
            source: 'project',
          });
        }
      }
    }
  }

  const perfGroups = buildSortedGroupsFromMap(perfMap, projectTabsByName);
  const planGroups = buildSortedGroupsFromMap(planMap, projectTabsByName);

  const sections: ReportSection[] = [
    {
      heading: perfHeading,
      items: groupsToSectionItems(perfGroups),
    },
    {
      heading: planHeading,
      items: groupsToSectionItems(planGroups),
    },
  ];

  return {
    perfHeading,
    planHeading,
    perfGroups,
    planGroups,
    sections,
  };
}

/**
 * 01 업무일지 - 먼슬리 하단 "기간 모아보기" (분기·반기·연간·직접지정) 수집 및 텍스트 생성
 * - 일정(event)은 오늘(todayStr) 기준으로 지난 것(date <= todayStr)은 실적, 다가올 것(date > todayStr)은 계획
 */
export function collectPeriodSummaryData(
  data: WorkVibeData,
  startDate: string,
  endDate: string,
  periodLabel: string,
  todayStr: string
): {
  perfCount: number;
  planCount: number;
  taskCount: number;
  recordedDaysCount: number;
  plainText: string;
  sections: ReportSection[];
} {
  const projectTabsByName = new Map<string, ProjectTab>();
  const safeTabs = data?.checklist?.tabs || [];
  const safeLogs = data?.logs || [];
  for (const tab of safeTabs) {
    projectTabsByName.set(tab.name.trim(), tab);
  }

  const perfMap = new Map<string, CollectedBullet[]>();
  const planMap = new Map<string, CollectedBullet[]>();
  const uniqueTasks = new Set<string>();
  const recordedDays = new Set<string>();

  let perfCount = 0;
  let planCount = 0;

  const addPerf = (taskName: string, item: CollectedBullet) => {
    const key = (taskName || '').trim() || '기타 일반 업무';
    uniqueTasks.add(key);
    const arr = perfMap.get(key) || [];
    arr.push(item);
    perfMap.set(key, arr);
    perfCount++;
  };

  const addPlan = (taskName: string, item: CollectedBullet) => {
    const key = (taskName || '').trim() || '기타 일반 업무';
    uniqueTasks.add(key);
    const arr = planMap.get(key) || [];
    arr.push(item);
    planMap.set(key, arr);
    planCount++;
  };

  const startMonth = startDate.slice(0, 7);
  const endMonth = endDate.slice(0, 7);

  const sortedLogs = [...safeLogs].sort((a, b) => {
    if ((a.date || '') !== (b.date || '')) {
      return (a.date || '').localeCompare(b.date || '');
    }
    return (a.pos ?? 0) - (b.pos ?? 0);
  });

  for (const log of sortedLogs) {
    if (!log.text || !log.text.trim()) continue;
    const isDone = log.bullet === 'done' || Boolean(log.doneDate);

    // 날짜 있는 기록의 기록일 집계
    if (log.date && log.date >= startDate && log.date <= endDate) {
      recordedDays.add(log.date);
    }

    // 1) 완료된 항목 -> 실적
    if (isDone) {
      const effectiveDate = log.doneDate || log.date || '';
      if (effectiveDate && effectiveDate >= startDate && effectiveDate <= endDate) {
        recordedDays.add(effectiveDate);
        addPerf(log.task, {
          text: appendDateIfMissing(log.text, effectiveDate),
          star: Boolean(log.star),
          date: effectiveDate,
          source: 'log',
        });
      } else if (!effectiveDate && log.month >= startMonth && log.month <= endMonth) {
        addPerf(log.task, {
          text: log.text.trim(),
          star: Boolean(log.star),
          date: endDate,
          source: 'log',
        });
      }
      continue;
    }

    // 2) 일정(event) -> 오늘 기준 지난 것(<= todayStr)은 실적, 다가올 것(> todayStr)은 계획
    if (log.bullet === 'event' && log.date) {
      if (log.date >= startDate && log.date <= endDate) {
        if (log.date <= todayStr) {
          addPerf(log.task, {
            text: appendDateIfMissing(log.text, log.date),
            star: Boolean(log.star),
            date: log.date,
            source: 'log',
          });
        } else {
          addPlan(log.task, {
            text: appendDateIfMissing(log.text, log.date),
            star: Boolean(log.star),
            date: log.date,
            source: 'log',
          });
        }
      }
      continue;
    }

    // 3) 미완료 할 일 (날짜 있는 것 & 날짜 없는 이달 할 일) -> 계획
    if (
      log.bullet === 'task' ||
      log.bullet === 'migrated' ||
      log.bullet === 'scheduled'
    ) {
      if (log.date && log.date >= startDate && log.date <= endDate) {
        addPlan(log.task, {
          text: log.text.trim(),
          star: Boolean(log.star),
          date: log.date,
          source: 'log',
        });
      } else if (!log.date && log.month >= startMonth && log.month <= endMonth) {
        addPlan(log.task, {
          text: log.text.trim(),
          star: Boolean(log.star),
          date: startDate,
          source: 'log',
        });
      }
    }
  }

  // 용역 과제 단계 완료(실적) 및 미완료 기한(계획)
  for (const tab of safeTabs) {
    for (const row of tab.rows) {
      for (const step of tab.steps) {
        const checkedDate = row.checks?.[step.id];
        if (checkedDate && checkedDate >= startDate && checkedDate <= endDate) {
          recordedDays.add(checkedDate);
          addPerf(tab.name, {
            text: `${row.name} – ${step.name} 완료`,
            star: false,
            date: checkedDate,
            source: 'project',
          });
        }
      }

      if (row.due && row.due >= startDate && row.due <= endDate) {
        const nextStep = tab.steps.find((s) => !row.checks?.[s.id]);
        if (nextStep) {
          addPlan(tab.name, {
            text: `${row.name} – ${nextStep.name} 예정(${formatShortMonthDay(row.due)})`,
            star: false,
            date: row.due,
            source: 'project',
          });
        }
      }
    }
  }

  const perfGroups = buildSortedGroupsFromMap(perfMap, projectTabsByName);
  const planGroups = buildSortedGroupsFromMap(planMap, projectTabsByName);

  const sections: ReportSection[] = [
    {
      heading: `${periodLabel} 추진실적`,
      items: groupsToSectionItems(perfGroups),
    },
    {
      heading: `${periodLabel} 추진계획`,
      items: groupsToSectionItems(planGroups),
    },
  ];

  return {
    perfCount,
    planCount,
    taskCount: uniqueTasks.size,
    recordedDaysCount: recordedDays.size,
    plainText: formatSectionsToPlainText(sections),
    sections,
  };
}

/**
 * ReportSection 배열을 한글·메일 붙여넣기용 평문 텍스트로 변환
 */
export function formatSectionsToPlainText(sections: ReportSection[]): string {
  return sections
    .map((sec) => {
      const cleanHeading = sec.heading.trim();
      const headingLine = cleanHeading.startsWith('□')
        ? cleanHeading
        : `□ ${cleanHeading}`;
      const itemLines = sec.items.map((item) => item.text);
      return [headingLine, ...itemLines].join('\n');
    })
    .join('\n\n');
}

/**
 * 평문 텍스트를 다시 ReportSection 배열로 파싱
 */
export function parsePlainTextToSections(text: string): ReportSection[] {
  const lines = text.split(/\r?\n/);
  const sections: ReportSection[] = [];
  let currentSection: ReportSection | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('□')) {
      const heading = trimmed.replace(/^□\s*/, '').trim();
      currentSection = {
        heading: heading || '보고 구분',
        items: [],
      };
      sections.push(currentSection);
    } else {
      if (!currentSection) {
        currentSection = {
          heading: '추진내용',
          items: [],
        };
        sections.push(currentSection);
      }
      currentSection.items.push({ text: rawLine });
    }
  }

  return sections;
}
