export interface ReportWeekSpec {
  year: number;
  month: number;
  week: 1 | 2 | 3 | 4;
  type: 'monthly' | 'weekly';
  baseMonday: string; // "YYYY-MM-DD"
  submitDate: string; // "YYYY-MM-DD" (기준 월요일 5일 전, 전주 수요일)
}

export interface MonthReportSchedule {
  year: number;
  month: number;
  prevMonthMondayCount: number;
  currentMonthMondayCount: number;
  weeks: [ReportWeekSpec, ReportWeekSpec, ReportWeekSpec, ReportWeekSpec];
  restMonday: string | null; // 휴지주 월요일 ("YYYY-MM-DD" or null)
}

export interface DateWeekBadge {
  date: string;
  weekMonday: string;
  isRestWeek: boolean;
  label: string; // 예: "10월 2주차" 또는 "12월 휴지주"
  subLabel?: string; // 휴지주일 때 예: "10월 1주차 제출주"
  targetYear: number;
  targetMonth: number;
  targetWeek: 1 | 2 | 3 | 4;
  reportSpec: ReportWeekSpec;
}

export interface CollectionPeriod {
  perfStart: string; // 실적 시작일 "YYYY-MM-DD"
  perfEnd: string;   // 실적 종료일 "YYYY-MM-DD"
  planStart: string; // 계획 시작일 "YYYY-MM-DD"
  planEnd: string;   // 계획 종료일 "YYYY-MM-DD"
}

export interface VerificationTestCaseResult {
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateYMD(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseDateYMD(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y || 2026, month: m || 1, day: d || 1 };
}

export function toLocalDate(dateStr: string): Date {
  const { year, month, day } = parseDateYMD(dateStr);
  return new Date(year, month - 1, day);
}

export function fromLocalDate(d: Date): string {
  return formatDateYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function addDays(dateStr: string, days: number): string {
  const d = toLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return fromLocalDate(d);
}

export function diffDays(targetDateStr: string, baseDateStr: string): number {
  const t = toLocalDate(targetDateStr);
  const b = toLocalDate(baseDateStr);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((t.getTime() - b.getTime()) / msPerDay);
}

export function getTodayYMD(): string {
  return fromLocalDate(new Date());
}

export function getDayOfWeekKo(dateStr: string): string {
  const d = toLocalDate(dateStr);
  return DAY_NAMES_KO[d.getDay()];
}

/**
 * 날짜를 "10.7." 또는 "9.30." 형식으로 반환
 */
export function formatShortMonthDay(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(m) || isNaN(d)) return dateStr;
  return `${m}.${d}.`;
}

/**
 * 날짜를 "10/5" 또는 연도가 다를 때 "2026/12/30" 형식으로 반환
 */
export function formatSlashDate(dateStr: string, refYear?: number): string {
  const { year, month, day } = parseDateYMD(dateStr);
  if (refYear !== undefined && year !== refYear) {
    return `${year}/${month}/${day}`;
  }
  return `${month}/${day}`;
}

/**
 * 날짜를 "2026. 10. 05. (월)" 형식으로 반환
 */
export function formatFullDateKo(dateStr: string, withDayOfWeek = true): string {
  const { year, month, day } = parseDateYMD(dateStr);
  const base = `${year}. ${pad2(month)}. ${pad2(day)}.`;
  return withDayOfWeek ? `${base} (${getDayOfWeekKo(dateStr)})` : base;
}

/**
 * 특정 연·월(1~12)에 속한 모든 월요일("YYYY-MM-DD") 배열을 오름차순 반환
 */
export function getMondaysInMonth(year: number, month: number): string[] {
  const mondays: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getDay() === 1) {
      mondays.push(formatDateYMD(year, month, day));
    }
  }
  return mondays;
}

/**
 * 이전 달의 (year, month) 반환
 */
export function getPrevYearMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

/**
 * 다음 달의 (year, month) 반환
 */
export function getNextYearMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

/**
 * 특정 연·월의 마지막 날짜("YYYY-MM-DD") 반환
 */
export function getFirstAndLastDayOfMonth(year: number, month: number): { firstDay: string; lastDay: string } {
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    firstDay: formatDateYMD(year, month, 1),
    lastDay: formatDateYMD(year, month, daysInMonth),
  };
}

/**
 * 핵심 규칙: M월의 보고 주차(1~4주차) 기준 월요일, 제출일(5일 전 수요일), 휴지주 계산
 * - 전달(M-1월)에 월요일이 5개 있었다면:
 *   · 전달의 5번째 월요일 = M월 1주차
 *   · M월의 1·2·3번째 월요일 = M월 2·3·4주차
 *   · M월의 4번째 월요일 = 정기보고가 없는 "휴지주" (5번째가 있으면 M+1월 1주차로 넘어감)
 * - 전달에 월요일이 4개였다면:
 *   · M월의 1~4번째 월요일 = M월 1~4주차 (5번째가 있으면 M+1월 1주차로 넘어감)
 */
export function getMonthReportSchedule(year: number, month: number): MonthReportSchedule {
  const prev = getPrevYearMonth(year, month);
  const prevMondays = getMondaysInMonth(prev.year, prev.month);
  const currMondays = getMondaysInMonth(year, month);

  let baseMondays: [string, string, string, string];
  let restMonday: string | null = null;

  if (prevMondays.length === 5) {
    baseMondays = [
      prevMondays[4],
      currMondays[0],
      currMondays[1],
      currMondays[2],
    ];
    restMonday = currMondays[3] || null;
  } else {
    baseMondays = [
      currMondays[0],
      currMondays[1],
      currMondays[2],
      currMondays[3],
    ];
    restMonday = null;
  }

  const weeks = baseMondays.map((monday, idx) => {
    const weekNum = (idx + 1) as 1 | 2 | 3 | 4;
    return {
      year,
      month,
      week: weekNum,
      type: weekNum === 1 ? 'monthly' : 'weekly',
      baseMonday: monday,
      submitDate: addDays(monday, -5), // 기준 월요일 5일 전 (전주 수요일)
    } satisfies ReportWeekSpec;
  }) as [ReportWeekSpec, ReportWeekSpec, ReportWeekSpec, ReportWeekSpec];

  return {
    year,
    month,
    prevMonthMondayCount: prevMondays.length,
    currentMonthMondayCount: currMondays.length,
    weeks,
    restMonday,
  };
}

/**
 * 특정 (year, month, week)의 보고 주차 정보 반환
 */
export function getReportWeekSpec(year: number, month: number, week: 1 | 2 | 3 | 4): ReportWeekSpec {
  const schedule = getMonthReportSchedule(year, month);
  return schedule.weeks[week - 1];
}

/**
 * 주어진 날짜("YYYY-MM-DD")가 속한 주(월~일)의 월요일("YYYY-MM-DD") 반환
 */
export function getMondayOfWeek(dateStr: string): string {
  const d = toLocalDate(dateStr);
  const day = d.getDay(); // 0(일) ~ 6(토)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return fromLocalDate(d);
}

/**
 * 특정 날짜("YYYY-MM-DD")에 대한 주차 배지 정보 및 기본 보고 대상 주차 반환
 */
export function getDateWeekBadge(dateStr: string): DateWeekBadge {
  const weekMonday = getMondayOfWeek(dateStr);
  const { year, month } = parseDateYMD(weekMonday);
  const prev = getPrevYearMonth(year, month);
  const next = getNextYearMonth(year, month);

  const candidateMonths = [
    { y: prev.year, m: prev.month },
    { y: year, m: month },
    { y: next.year, m: next.month },
  ];

  // 1. 정규 1~4주차의 기준 월요일과 일치하는지 확인
  for (const cand of candidateMonths) {
    const sched = getMonthReportSchedule(cand.y, cand.m);
    for (const w of sched.weeks) {
      if (w.baseMonday === weekMonday) {
        return {
          date: dateStr,
          weekMonday,
          isRestWeek: false,
          label: `${cand.m}월 ${w.week}주차`,
          targetYear: cand.y,
          targetMonth: cand.m,
          targetWeek: w.week,
          reportSpec: w,
        };
      }
    }
  }

  // 2. 휴지주 월요일과 일치하는지 확인 (휴지주의 수요일은 다음 달 1주차 제출일)
  for (const cand of candidateMonths) {
    const sched = getMonthReportSchedule(cand.y, cand.m);
    if (sched.restMonday === weekMonday) {
      const nextOfRest = getNextYearMonth(cand.y, cand.m);
      const nextWeek1 = getReportWeekSpec(nextOfRest.year, nextOfRest.month, 1);
      return {
        date: dateStr,
        weekMonday,
        isRestWeek: true,
        label: `${cand.m}월 휴지주`,
        subLabel: `${nextOfRest.month}월 1주차 제출주`,
        targetYear: nextOfRest.year,
        targetMonth: nextOfRest.month,
        targetWeek: 1,
        reportSpec: nextWeek1,
      };
    }
  }

  // Fallback
  const fallbackSpec = getReportWeekSpec(year, month, 1);
  return {
    date: dateStr,
    weekMonday,
    isRestWeek: false,
    label: `${month}월 1주차`,
    targetYear: year,
    targetMonth: month,
    targetWeek: 1,
    reportSpec: fallbackSpec,
  };
}

/**
 * 자동 수집 기본 기간 계산
 * · 월간(1주차): 실적 = 전월 1일~말일, 계획 = 당월 1일~말일
 * · 주간(2~4주차): 실적 = 제출일-7일 ~ 제출일-1일, 계획 = 제출일 ~ 제출일+6일
 */
export function getDefaultCollectionPeriod(
  year: number,
  month: number,
  week: 1 | 2 | 3 | 4
): CollectionPeriod {
  const spec = getReportWeekSpec(year, month, week);

  if (week === 1) {
    const prev = getPrevYearMonth(year, month);
    const prevBounds = getFirstAndLastDayOfMonth(prev.year, prev.month);
    const currBounds = getFirstAndLastDayOfMonth(year, month);
    return {
      perfStart: prevBounds.firstDay,
      perfEnd: prevBounds.lastDay,
      planStart: currBounds.firstDay,
      planEnd: currBounds.lastDay,
    };
  } else {
    return {
      perfStart: addDays(spec.submitDate, -7),
      perfEnd: addDays(spec.submitDate, -1),
      planStart: spec.submitDate,
      planEnd: addDays(spec.submitDate, 6),
    };
  }
}

/**
 * 프롬프트에 명시된 검증용 정답 테스트 함수
 * · 2026년 10월: 1주차 10/5(제출 9/30), 2주차 10/12(제출 10/7), 3주차 10/19(제출 10/14), 4주차 10/26(제출 10/21)
 * · 2026년 11월: 1주차 11/2(제출 10/28), 2주차 11/9, 3주차 11/16, 4주차 11/23
 * · 2026년 12월: 1주차 11/30(제출 11/25), 2주차 12/7, 3주차 12/14, 4주차 12/21, 12/28은 휴지주
 * · 2027년 1월: 1주차 1/4(제출 2026/12/30)
 */
export function verifyReportWeekCalculations(): {
  allPassed: boolean;
  results: VerificationTestCaseResult[];
} {
  const oct2026 = getMonthReportSchedule(2026, 10);
  const nov2026 = getMonthReportSchedule(2026, 11);
  const dec2026 = getMonthReportSchedule(2026, 12);
  const jan2027 = getMonthReportSchedule(2027, 1);

  const octActual = oct2026.weeks
    .map((w) => `${w.week}주차 ${formatSlashDate(w.baseMonday)}(제출 ${formatSlashDate(w.submitDate)})`)
    .join(', ');
  const octExpected =
    '1주차 10/5(제출 9/30), 2주차 10/12(제출 10/7), 3주차 10/19(제출 10/14), 4주차 10/26(제출 10/21)';

  const novActual = [
    `1주차 ${formatSlashDate(nov2026.weeks[0].baseMonday)}(제출 ${formatSlashDate(nov2026.weeks[0].submitDate)})`,
    `2주차 ${formatSlashDate(nov2026.weeks[1].baseMonday)}`,
    `3주차 ${formatSlashDate(nov2026.weeks[2].baseMonday)}`,
    `4주차 ${formatSlashDate(nov2026.weeks[3].baseMonday)}`,
  ].join(', ');
  const novExpected = '1주차 11/2(제출 10/28), 2주차 11/9, 3주차 11/16, 4주차 11/23';

  const decActual = [
    `1주차 ${formatSlashDate(dec2026.weeks[0].baseMonday)}(제출 ${formatSlashDate(dec2026.weeks[0].submitDate)})`,
    `2주차 ${formatSlashDate(dec2026.weeks[1].baseMonday)}`,
    `3주차 ${formatSlashDate(dec2026.weeks[2].baseMonday)}`,
    `4주차 ${formatSlashDate(dec2026.weeks[3].baseMonday)}`,
    dec2026.restMonday ? `${formatSlashDate(dec2026.restMonday)}은 휴지주` : '휴지주 없음',
  ].join(', ');
  const decExpected =
    '1주차 11/30(제출 11/25), 2주차 12/7, 3주차 12/14, 4주차 12/21, 12/28은 휴지주';

  const janActual = `1주차 ${formatSlashDate(jan2027.weeks[0].baseMonday)}(제출 ${formatSlashDate(jan2027.weeks[0].submitDate, 2027)})`;
  const janExpected = '1주차 1/4(제출 2026/12/30)';

  const results: VerificationTestCaseResult[] = [
    {
      title: '2026년 10월',
      expected: octExpected,
      actual: octActual,
      passed: octActual === octExpected,
    },
    {
      title: '2026년 11월',
      expected: novExpected,
      actual: novActual,
      passed: novActual === novExpected,
    },
    {
      title: '2026년 12월',
      expected: decExpected,
      actual: decActual,
      passed: decActual === decExpected,
    },
    {
      title: '2027년 1월',
      expected: janExpected,
      actual: janActual,
      passed: janActual === janExpected,
    },
  ];

  return {
    allPassed: results.every((r) => r.passed),
    results,
  };
}
