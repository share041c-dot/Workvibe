import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Copy,
  Save,
  RotateCcw,
  Calendar,
  ArrowRight,
  PlusCircle,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  ListChecks,
  History,
  BookMarked,
} from 'lucide-react';
import {
  ReportEntry,
  ReportSection,
  WorkVibeData,
} from '../types';
import {
  CollectionPeriod,
  addDays,
  formatFullDateKo,
  formatSlashDate,
  getDateWeekBadge,
  getDefaultCollectionPeriod,
  getMonthReportSchedule,
  getPrevYearMonth,
  getReportWeekSpec,
  getTodayYMD,
} from '../utils/weekCalculator';
import {
  collectReportData,
  formatSectionsToPlainText,
  parsePlainTextToSections,
} from '../utils/reportGenerator';

interface ReportBuilderViewProps {
  data: WorkVibeData;
  initialTarget?: {
    year: number;
    month: number;
    week: 1 | 2 | 3 | 4;
  } | null;
  onClearInitialTarget: () => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  onSaveReport: (entry: ReportEntry) => void;
  showToast: (msg: string) => void;
}

const SYMBOLS = ['□', '①', '②', '③', '④', '⑤', 'ㅇ', '※'];

export const ReportBuilderView: React.FC<ReportBuilderViewProps> = ({
  data,
  initialTarget,
  onClearInitialTarget,
  isDirty,
  setIsDirty,
  onSaveReport,
  showToast,
}) => {
  const today = getTodayYMD();
  const todayBadge = useMemo(() => getDateWeekBadge(today), [today]);

  const [targetYear, setTargetYear] = useState<number>(
    initialTarget?.year ?? todayBadge.targetYear
  );
  const [targetMonth, setTargetMonth] = useState<number>(
    initialTarget?.month ?? todayBadge.targetMonth
  );
  const [targetWeek, setTargetWeek] = useState<1 | 2 | 3 | 4>(
    initialTarget?.week ?? todayBadge.targetWeek
  );

  // 이전 연도 같은 월·주차 참고 카드 상태
  const [refYear, setRefYear] = useState<number>(
    (initialTarget?.year ?? todayBadge.targetYear) - 1
  );
  const [pastRefText, setPastRefText] = useState<string>('');

  const [pendingTarget, setPendingTarget] = useState<{
    year: number;
    month: number;
    week: 1 | 2 | 3 | 4;
  } | null>(null);

  const [period, setPeriod] = useState<CollectionPeriod>(() =>
    getDefaultCollectionPeriod(
      initialTarget?.year ?? todayBadge.targetYear,
      initialTarget?.month ?? todayBadge.targetMonth,
      initialTarget?.week ?? todayBadge.targetWeek
    )
  );
  const [includePastIncomplete, setIncludePastIncomplete] =
    useState<boolean>(true);

  const [editorMode, setEditorMode] = useState<'structured' | 'raw'>('structured');
  const [draftSections, setDraftSections] = useState<ReportSection[]>([]);
  const [rawDraftText, setRawDraftText] = useState<string>('');

  const activeInputRef = useRef<{
    type: 'heading' | 'item' | 'raw';
    secIdx?: number;
    itemIdx?: number;
    el: HTMLInputElement | HTMLTextAreaElement | null;
  } | null>(null);

  useEffect(() => {
    if (initialTarget) {
      applyTargetChange(
        initialTarget.year,
        initialTarget.month,
        initialTarget.week
      );
      onClearInitialTarget();
    }
  }, [initialTarget]);

  const weekSpec = useMemo(
    () => getReportWeekSpec(targetYear, targetMonth, targetWeek),
    [targetYear, targetMonth, targetWeek]
  );

  const monthSchedule = useMemo(
    () => getMonthReportSchedule(targetYear, targetMonth),
    [targetYear, targetMonth]
  );

  const existingSavedEntry = useMemo(() => {
    return data.entries.find(
      (e) =>
        e.targetYear === targetYear &&
        e.targetMonth === targetMonth &&
        e.targetWeek === targetWeek
    );
  }, [data.entries, targetYear, targetMonth, targetWeek]);

  // 참고 카드 1: 직전 시기 보고 정보 계산
  const prevPeriodInfo = useMemo(() => {
    const prevMonday = addDays(weekSpec.baseMonday, -7);
    const prevBadge = getDateWeekBadge(prevMonday);

    // 직전 월요일이 휴지주인 경우 vs 정규 주차인 경우
    let prevTargetYear = prevBadge.targetYear;
    let prevTargetMonth = prevBadge.targetMonth;
    let prevTargetWeek: 1 | 2 | 3 | 4 = prevBadge.targetWeek;

    if (prevBadge.isRestWeek) {
      // 휴지주 바로 전 정규 보고는 전달 4주차
      const prevM = getPrevYearMonth(targetYear, targetMonth);
      prevTargetYear = prevM.year;
      prevTargetMonth = prevM.month;
      prevTargetWeek = 4;
    }

    const savedPrevEntry = data.entries.find(
      (e) =>
        e.targetYear === prevTargetYear &&
        e.targetMonth === prevTargetMonth &&
        e.targetWeek === prevTargetWeek
    );

    const prevPeriodRange = getDefaultCollectionPeriod(
      prevTargetYear,
      prevTargetMonth,
      prevTargetWeek
    );
    const autoPrevCollected = collectReportData(
      data,
      prevTargetYear,
      prevTargetMonth,
      prevTargetWeek,
      prevPeriodRange,
      false
    );

    const sectionsToUse = savedPrevEntry
      ? savedPrevEntry.sections
      : autoPrevCollected.sections;

    return {
      isImmediateRestWeek: prevBadge.isRestWeek,
      restWeekLabel: prevBadge.label,
      restMonday: prevMonday,
      year: prevTargetYear,
      month: prevTargetMonth,
      week: prevTargetWeek,
      hasSaved: Boolean(savedPrevEntry),
      sections: sectionsToUse,
      plainText: formatSectionsToPlainText(sectionsToUse),
    };
  }, [weekSpec.baseMonday, targetYear, targetMonth, data]);

  // 참고 카드 2: 같은 월·주차에 저장된 기록이 있는 과거/타 연도 목록(칩 표시용)
  const recordedYearsForSameMonthWeek = useMemo(() => {
    const years = new Set<number>();
    for (const e of data.entries) {
      if (
        e.targetMonth === targetMonth &&
        e.targetWeek === targetWeek &&
        e.targetYear !== targetYear
      ) {
        years.add(e.targetYear);
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [data.entries, targetMonth, targetWeek, targetYear]);

  // refYear, targetMonth, targetWeek 변경 시 과거 자료 텍스트 동기화
  useEffect(() => {
    const match = data.entries.find(
      (e) =>
        e.targetYear === refYear &&
        e.targetMonth === targetMonth &&
        e.targetWeek === targetWeek
    );
    if (match) {
      setPastRefText(formatSectionsToPlainText(match.sections));
    } else {
      setPastRefText('');
    }
  }, [refYear, targetMonth, targetWeek, data.entries]);

  const collected = useMemo(() => {
    return collectReportData(
      data,
      targetYear,
      targetMonth,
      targetWeek,
      period,
      includePastIncomplete
    );
  }, [
    data,
    targetYear,
    targetMonth,
    targetWeek,
    period,
    includePastIncomplete,
  ]);

  const previewPlainText = useMemo(
    () => formatSectionsToPlainText(collected.sections),
    [collected.sections]
  );

  const applyTargetChange = (
    y: number,
    m: number,
    w: 1 | 2 | 3 | 4
  ) => {
    setTargetYear(y);
    setTargetMonth(m);
    setTargetWeek(w);
    if (refYear === y) {
      setRefYear(y - 1);
    }
    const defaultPer = getDefaultCollectionPeriod(y, m, w);
    setPeriod(defaultPer);

    const saved = data.entries.find(
      (e) =>
        e.targetYear === y && e.targetMonth === m && e.targetWeek === w
    );

    if (saved) {
      const cloned = saved.sections.map((s) => ({
        ...s,
        items: s.items.map((it) => ({ ...it })),
      }));
      setDraftSections(cloned);
      setRawDraftText(formatSectionsToPlainText(cloned));
    } else {
      const autoCol = collectReportData(
        data,
        y,
        m,
        w,
        defaultPer,
        includePastIncomplete
      );
      setDraftSections(autoCol.sections);
      setRawDraftText(formatSectionsToPlainText(autoCol.sections));
    }
    setIsDirty(false);
  };

  useEffect(() => {
    applyTargetChange(targetYear, targetMonth, targetWeek);
  }, []);

  const requestTargetChange = (
    y: number,
    m: number,
    w: 1 | 2 | 3 | 4
  ) => {
    if (y === targetYear && m === targetMonth && w === targetWeek) return;
    if (isDirty) {
      setPendingTarget({ year: y, month: m, week: w });
    } else {
      applyTargetChange(y, m, w);
    }
  };

  const handleReplaceDraft = () => {
    const cloned: ReportSection[] = collected.sections.map((s) => ({
      heading: s.heading,
      items: s.items.map((it) => ({ text: it.text })),
    }));
    setDraftSections(cloned);
    setRawDraftText(formatSectionsToPlainText(cloned));
    setIsDirty(true);
    showToast('자동 수집 내용을 초안에 채웠습니다(교체).');
  };

  const handleFillDraftFromSections = (
    sourceSections: ReportSection[],
    sourceLabel: string
  ) => {
    const cloned: ReportSection[] = sourceSections.map((s) => ({
      heading: s.heading,
      items: s.items.map((it) => ({ text: it.text })),
    }));
    setDraftSections(cloned);
    setRawDraftText(formatSectionsToPlainText(cloned));
    setIsDirty(true);
    showToast(`${sourceLabel} 내용을 초안에 채웠습니다.`);
  };

  const handleAppendDraft = () => {
    const baseSections =
      editorMode === 'raw'
        ? parsePlainTextToSections(rawDraftText)
        : draftSections;

    let nextSections: ReportSection[];
    if (baseSections.length === 0) {
      nextSections = collected.sections.map((s) => ({
        heading: s.heading,
        items: s.items.map((it) => ({ text: it.text })),
      }));
    } else {
      nextSections = baseSections.map((sec, idx) => {
        const matchingCollected =
          collected.sections.find((c) => c.heading === sec.heading) ||
          collected.sections[idx];
        if (!matchingCollected) return sec;
        const existingTexts = new Set(sec.items.map((i) => i.text.trim()));
        const newItems = matchingCollected.items
          .filter((i) => !existingTexts.has(i.text.trim()))
          .map((i) => ({ text: i.text }));
        return {
          ...sec,
          items: [...sec.items, ...newItems],
        };
      });
    }

    setDraftSections(nextSections);
    setRawDraftText(formatSectionsToPlainText(nextSections));
    setIsDirty(true);
    showToast('자동 수집 내용을 초안 뒤에 덧붙였습니다.');
  };

  const handleInsertSymbol = (symbol: string) => {
    const insertStr = symbol === 'ㅇ' ? ' ㅇ ' : `${symbol} `;

    if (editorMode === 'raw') {
      const el =
        activeInputRef.current?.type === 'raw'
          ? (activeInputRef.current.el as HTMLTextAreaElement | null)
          : null;
      if (el) {
        const start = el.selectionStart ?? rawDraftText.length;
        const end = el.selectionEnd ?? rawDraftText.length;
        const next =
          rawDraftText.slice(0, start) + insertStr + rawDraftText.slice(end);
        setRawDraftText(next);
        setDraftSections(parsePlainTextToSections(next));
        setIsDirty(true);
        setTimeout(() => {
          el.focus();
          const pos = start + insertStr.length;
          el.setSelectionRange(pos, pos);
        }, 0);
      } else {
        const next = rawDraftText
          ? `${rawDraftText}\n${insertStr}`
          : insertStr;
        setRawDraftText(next);
        setDraftSections(parsePlainTextToSections(next));
        setIsDirty(true);
      }
      return;
    }

    const active = activeInputRef.current;
    if (
      active &&
      active.el &&
      active.secIdx !== undefined &&
      draftSections[active.secIdx]
    ) {
      const el = active.el;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;

      if (active.type === 'heading') {
        const curr = draftSections[active.secIdx].heading;
        const nextVal = curr.slice(0, start) + symbol + ' ' + curr.slice(end);
        const next = draftSections.map((s, idx) =>
          idx === active.secIdx ? { ...s, heading: nextVal } : s
        );
        setDraftSections(next);
        setRawDraftText(formatSectionsToPlainText(next));
        setIsDirty(true);
        return;
      }

      if (active.type === 'item' && active.itemIdx !== undefined) {
        const curr =
          draftSections[active.secIdx].items[active.itemIdx]?.text || '';
        const nextVal = curr.slice(0, start) + insertStr + curr.slice(end);
        const next = draftSections.map((s, idx) => {
          if (idx !== active.secIdx) return s;
          return {
            ...s,
            items: s.items.map((it, iIdx) =>
              iIdx === active.itemIdx ? { ...it, text: nextVal } : it
            ),
          };
        });
        setDraftSections(next);
        setRawDraftText(formatSectionsToPlainText(next));
        setIsDirty(true);
        setTimeout(() => {
          el.focus();
          const pos = start + insertStr.length;
          el.setSelectionRange(pos, pos);
        }, 0);
        return;
      }
    }

    const next = [...draftSections];
    if (next.length === 0) {
      next.push({
        heading: collected.perfHeading,
        items: [{ text: insertStr }],
      });
    } else {
      next[0] = {
        ...next[0],
        items: [...next[0].items, { text: insertStr }],
      };
    }
    setDraftSections(next);
    setRawDraftText(formatSectionsToPlainText(next));
    setIsDirty(true);
  };

  const handleSave = () => {
    const finalSections =
      editorMode === 'raw'
        ? parsePlainTextToSections(rawDraftText)
        : draftSections;

    const entry: ReportEntry = {
      id:
        existingSavedEntry?.id ||
        `entry-${targetYear}-${targetMonth}-${targetWeek}`,
      targetYear,
      targetMonth,
      targetWeek,
      sections: finalSections,
      updatedAt: Date.now(),
    };

    onSaveReport(entry);
    setDraftSections(finalSections);
    setRawDraftText(formatSectionsToPlainText(finalSections));
    setIsDirty(false);
    showToast(
      existingSavedEntry
        ? `${targetYear}년 ${targetMonth}월 ${targetWeek}주차 보고서를 덮어쓰기 저장했습니다.`
        : `${targetYear}년 ${targetMonth}월 ${targetWeek}주차 보고서를 저장했습니다.`
    );
  };

  // 과거 연도 참고 자료 직접 입력·저장
  const handleSavePastReference = () => {
    const parsed = parsePlainTextToSections(pastRefText);
    const finalSections =
      parsed.length > 0
        ? parsed
        : [
            {
              heading: `${targetMonth}월 ${targetWeek}주차 추진실적`,
              items: [{ text: pastRefText.trim() || ' ㅇ 내용 없음' }],
            },
          ];

    const existingPast = data.entries.find(
      (e) =>
        e.targetYear === refYear &&
        e.targetMonth === targetMonth &&
        e.targetWeek === targetWeek
    );

    const entry: ReportEntry = {
      id:
        existingPast?.id ||
        `entry-${refYear}-${targetMonth}-${targetWeek}`,
      targetYear: refYear,
      targetMonth,
      targetWeek,
      sections: finalSections,
      updatedAt: Date.now(),
    };

    onSaveReport(entry);
    showToast(
      `${refYear}년 ${targetMonth}월 ${targetWeek}주차 과거 보고 자료를 저장했습니다.`
    );
  };

  const handleCopyText = async (textToCopy: string, label = '초안 텍스트') => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast(`${label}가 클립보드에 복사되었습니다. 한글·메일에 붙여넣으세요.`);
    } catch {
      showToast('클립보드 복사에 실패했습니다. 텍스트를 직접 선택해 복사해주세요.');
    }
  };

  return (
    <div className="space-y-5">
      {pendingTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-lg w-full max-w-md p-5 shadow-xl space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-[var(--accent-rose)] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
                  저장하지 않은 초안이 있습니다
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  현재 작성 중인 초안을 저장하지 않고{' '}
                  <strong>
                    {pendingTarget.year}년 {pendingTarget.month}월{' '}
                    {pendingTarget.week}주차
                  </strong>
                  로 이동하시겠습니까?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPendingTarget(null)}
                className="px-3 py-1.5 rounded border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-sub)] cursor-pointer"
              >
                계속 작성하기
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = pendingTarget;
                  setPendingTarget(null);
                  applyTargetChange(t.year, t.month, t.week);
                }}
                className="px-3.5 py-1.5 rounded bg-[var(--accent-rose)] text-white font-semibold cursor-pointer"
              >
                저장 안 하고 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. 대상 시기 선택 및 자동 수집 기간 설정 */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={targetYear}
              onChange={(e) =>
                requestTargetChange(
                  Number(e.target.value),
                  targetMonth,
                  targetWeek
                )
              }
              className="px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-xs font-semibold font-mono-num text-[var(--text-main)] outline-none"
            >
              {[2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>

            <select
              value={targetMonth}
              onChange={(e) =>
                requestTargetChange(
                  targetYear,
                  Number(e.target.value),
                  targetWeek
                )
              }
              className="px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-xs font-semibold font-mono-num text-[var(--text-main)] outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>

            <div className="inline-flex rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-0.5">
              {([1, 2, 3, 4] as const).map((w) => {
                const active = targetWeek === w;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => requestTargetChange(targetYear, targetMonth, w)}
                    className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent-rose)] text-white font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {w}주차 {w === 1 ? '(월간)' : '(주간)'}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() =>
                requestTargetChange(
                  todayBadge.targetYear,
                  todayBadge.targetMonth,
                  todayBadge.targetWeek
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-strong)] bg-[var(--bg-sub)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-main)] cursor-pointer whitespace-nowrap"
            >
              <Calendar className="w-3.5 h-3.5 text-[var(--accent-rose)]" />
              오늘 기준으로
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-1 rounded font-semibold whitespace-nowrap ${
                weekSpec.type === 'monthly'
                  ? 'bg-[var(--accent-rose-soft)] text-[var(--accent-rose)]'
                  : 'bg-[var(--accent-sage-soft)] text-[var(--accent-sage)]'
              }`}
            >
              {weekSpec.type === 'monthly' ? '월간보고 (1주차)' : '주간보고'}
            </span>
            <span className="font-mono-num text-[var(--text-muted)]">
              기준 월요일: <strong className="text-[var(--text-main)]">{formatFullDateKo(weekSpec.baseMonday)}</strong>
            </span>
            <span>·</span>
            <span className="font-mono-num text-[var(--text-muted)]">
              제출(마감)일: <strong className="text-[var(--accent-rose)]">{formatFullDateKo(weekSpec.submitDate)}</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded bg-[var(--bg-sub)] text-[11px] text-[var(--text-muted)] font-mono-num">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-[var(--text-main)]">
              {targetYear}년 {targetMonth}월 일정:
            </span>
            {monthSchedule.weeks.map((w) => (
              <span
                key={w.week}
                className={
                  w.week === targetWeek
                    ? 'font-bold text-[var(--accent-rose)] underline'
                    : ''
                }
              >
                {w.week}주차 {formatSlashDate(w.baseMonday)}(제출{' '}
                {formatSlashDate(w.submitDate, targetYear)})
              </span>
            ))}
            {monthSchedule.restMonday && (
              <span className="text-[var(--warn-amber)] font-semibold">
                · {formatSlashDate(monthSchedule.restMonday)}은 휴지주
              </span>
            )}
          </div>
          <span>
            전달 월요일 {monthSchedule.prevMonthMondayCount}개
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end pt-1 text-xs">
          <div className="lg:col-span-5">
            <label className="block font-semibold text-[var(--text-main)] mb-1">
              추진실적 수집 기간 ({weekSpec.type === 'monthly' ? '기본: 전월 1일~말일' : '기본: 제출일-7일 ~ 제출일-1일'})
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={period.perfStart}
                onChange={(e) =>
                  setPeriod((p) => ({ ...p, perfStart: e.target.value }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] font-mono-num text-[var(--text-main)]"
              />
              <span className="text-[var(--text-muted)]">~</span>
              <input
                type="date"
                value={period.perfEnd}
                onChange={(e) =>
                  setPeriod((p) => ({ ...p, perfEnd: e.target.value }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] font-mono-num text-[var(--text-main)]"
              />
            </div>
          </div>

          <div className="lg:col-span-5">
            <label className="block font-semibold text-[var(--text-main)] mb-1">
              추진계획 수집 기간 ({weekSpec.type === 'monthly' ? '기본: 당월 1일~말일' : '기본: 제출일 ~ 제출일+6일'})
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={period.planStart}
                onChange={(e) =>
                  setPeriod((p) => ({ ...p, planStart: e.target.value }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] font-mono-num text-[var(--text-main)]"
              />
              <span className="text-[var(--text-muted)]">~</span>
              <input
                type="date"
                value={period.planEnd}
                onChange={(e) =>
                  setPeriod((p) => ({ ...p, planEnd: e.target.value }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] font-mono-num text-[var(--text-main)]"
              />
            </div>
          </div>

          <div className="lg:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setPeriod(
                  getDefaultCollectionPeriod(targetYear, targetMonth, targetWeek)
                );
                showToast('기본 수집 기간으로 복원했습니다.');
              }}
              className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-[var(--text-main)] font-medium cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              기본 기간으로
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[var(--text-main)]">
            <input
              type="checkbox"
              checked={includePastIncomplete}
              onChange={(e) => setIncludePastIncomplete(e.target.checked)}
              className="accent-[var(--accent-rose)]"
            />
            <span>
              계획 시작일({period.planStart}) 이전 날짜에 남아 있는 미완료 할 일도 계획에 포함 (월·화요일에 보고서를 써도 누락 방지)
            </span>
          </label>

          {existingSavedEntry && (
            <span className="inline-flex items-center gap-1 text-[var(--accent-sage)] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />이 시기 보고서가 이미 저장되어 있습니다 (저장 시 덮어쓰기)
            </span>
          )}
        </div>
      </div>

      {/* 1.5 참고 카드 2개: [직전 시기 보고] & [이전 연도 같은 월·주차 보고] */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 참고 카드 1: 직전 시기 보고 */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 flex flex-col justify-between gap-3">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] pb-2.5">
              <div className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-[var(--accent-rose)]" />
                <h3 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
                  참고 1 · 직전 시기 보고
                </h3>
              </div>
              <span className="text-xs font-mono-num text-[var(--text-muted)]">
                {prevPeriodInfo.isImmediateRestWeek
                  ? `${prevPeriodInfo.restWeekLabel} (${prevPeriodInfo.restMonday})`
                  : `${prevPeriodInfo.year}년 ${prevPeriodInfo.month}월 ${prevPeriodInfo.week}주차`}
              </span>
            </div>

            {prevPeriodInfo.isImmediateRestWeek && (
              <div className="px-3 py-2 rounded bg-[var(--warn-amber-soft)] border border-[var(--warn-amber)] text-xs text-[var(--warn-amber)] font-semibold flex items-center justify-between">
                <span>정기 보고가 없는 주였어요 ({prevPeriodInfo.restWeekLabel})</span>
                <span className="font-normal text-[11px]">
                  아래는 직전 정규 보고({prevPeriodInfo.month}월 {prevPeriodInfo.week}주차)입니다
                </span>
              </div>
            )}

            <pre className="w-full h-36 overflow-y-auto p-3 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-xs leading-relaxed text-[var(--text-main)] whitespace-pre-wrap font-sans">
              {prevPeriodInfo.plainText || '직전 시기 보고 기록이 없습니다.'}
            </pre>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-[var(--text-muted)]">
              {prevPeriodInfo.hasSaved ? '저장된 보고서 본문' : '일지 기반 자동 요약본'}
            </span>
            <button
              type="button"
              onClick={() =>
                handleFillDraftFromSections(
                  prevPeriodInfo.sections,
                  `직전 시기(${prevPeriodInfo.year}년 ${prevPeriodInfo.month}월 ${prevPeriodInfo.week}주차)`
                )
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[var(--border-strong)] bg-[var(--bg-sub)] hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-main)] cursor-pointer whitespace-nowrap"
            >
              <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-rose)]" />
              이 내용을 초안에 채우기
            </button>
          </div>
        </div>

        {/* 참고 카드 2: 이전 연도 같은 월·주차 보고 */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 flex flex-col justify-between gap-3">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] pb-2.5">
              <div className="flex items-center gap-1.5">
                <BookMarked className="w-4 h-4 text-[var(--accent-sage)]" />
                <h3 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
                  참고 2 · 이전 연도 같은 월·주차 보고 ({targetMonth}월 {targetWeek}주차)
                </h3>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <select
                  value={refYear}
                  onChange={(e) => setRefYear(Number(e.target.value))}
                  className="px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-main)] font-mono-num font-semibold text-[var(--text-main)] outline-none"
                >
                  {[2022, 2023, 2024, 2025, 2026]
                    .filter((y) => y !== targetYear)
                    .map((y) => (
                      <option key={y} value={y}>
                        {y}년
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* 기록 있는 연도 칩 표시 */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-[var(--text-muted)]">
                기록 있는 연도:
              </span>
              {recordedYearsForSameMonthWeek.length === 0 ? (
                <span className="text-[11px] text-[var(--text-subtle)]">
                  아직 저장된 과거 연도 기록이 없습니다 (아래에 직접 입력·저장 가능)
                </span>
              ) : (
                recordedYearsForSameMonthWeek.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setRefYear(y)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold cursor-pointer ${
                      refYear === y
                        ? 'bg-[var(--accent-sage)] text-white'
                        : 'bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] hover:opacity-85'
                    }`}
                  >
                    {y}년
                  </button>
                ))
              )}
            </div>

            {/* 과거 자료 직접 입력·수정란 */}
            <textarea
              rows={5}
              value={pastRefText}
              onChange={(e) => setPastRefText(e.target.value)}
              placeholder={`${refYear}년 ${targetMonth}월 ${targetWeek}주차 과거 보고 자료를 직접 붙여넣거나 입력해 저장해두면 매년 참고할 수 있습니다.`}
              className="w-full h-36 p-3 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-xs leading-relaxed text-[var(--text-main)] outline-none focus:border-[var(--accent-sage)] resize-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleSavePastReference}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              {refYear}년 과거 자료 저장
            </button>

            <button
              type="button"
              onClick={() => {
                const parsed = parsePlainTextToSections(pastRefText);
                if (parsed.length === 0) {
                  showToast('채울 과거 보고 내용이 없습니다.');
                  return;
                }
                handleFillDraftFromSections(
                  parsed,
                  `${refYear}년 ${targetMonth}월 ${targetWeek}주차`
                );
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[var(--border-strong)] bg-[var(--bg-sub)] hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-main)] cursor-pointer whitespace-nowrap"
            >
              <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-rose)]" />
              이 내용을 초안에 채우기
            </button>
          </div>
        </div>
      </div>

      {/* 2. 좌우 2단 레이아웃: 자동 수집 미리보기 vs 초안 편집기 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
          <div className="p-3.5 bg-[var(--bg-sub)] border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
                자동 수집 미리보기
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                과제명별 묶음 · ★ 중요 우선 정렬 · 용역 공정률 자동 요약
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopyText(previewPlainText, '미리보기 텍스트')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-xs text-[var(--text-main)] cursor-pointer whitespace-nowrap"
            >
              <Copy className="w-3 h-3" />
              미리보기 복사
            </button>
          </div>

          <div className="p-4 space-y-3">
            <pre className="w-full min-h-[280px] max-h-[420px] overflow-y-auto p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-xs leading-relaxed text-[var(--text-main)] whitespace-pre-wrap font-sans">
              {previewPlainText || '해당 기간에 수집된 실적·계획이 없습니다.'}
            </pre>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleReplaceDraft}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[var(--accent-rose)] hover:bg-[var(--accent-rose-hover)] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                초안에 채우기(교체)
              </button>
              <button
                type="button"
                onClick={handleAppendDraft}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-[var(--border-strong)] bg-[var(--bg-sub)] hover:bg-[var(--bg-hover)] text-[var(--text-main)] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[var(--accent-sage)]" />
                초안 뒤에 덧붙이기
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 보고서 초안 편집기 */}
        <div className="lg:col-span-7 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
          <div className="p-3.5 bg-[var(--bg-sub)] border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
                보고서 초안 편집기
              </h3>
              {isDirty && (
                <span className="text-[11px] font-semibold text-[var(--accent-rose)]">
                  ● 수정됨 (미저장)
                </span>
              )}
            </div>

            <div className="inline-flex rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (editorMode === 'raw') {
                    setDraftSections(parsePlainTextToSections(rawDraftText));
                  }
                  setEditorMode('structured');
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm cursor-pointer whitespace-nowrap ${
                  editorMode === 'structured'
                    ? 'bg-[var(--accent-rose)] text-white font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                구분·항목 편집
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editorMode === 'structured') {
                    setRawDraftText(formatSectionsToPlainText(draftSections));
                  }
                  setEditorMode('raw');
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm cursor-pointer whitespace-nowrap ${
                  editorMode === 'raw'
                    ? 'bg-[var(--accent-rose)] text-white font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                전문 텍스트 편집
              </button>
            </div>
          </div>

          <div className="px-4 py-2.5 bg-[var(--bg-main)] border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[var(--text-muted)] mr-1 font-medium">
                기호 삽입:
              </span>
              {SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleInsertSymbol(sym);
                  }}
                  className="w-7 h-7 rounded border border-[var(--border-strong)] bg-[var(--bg-card)] hover:bg-[var(--bg-sub)] text-[var(--text-main)] font-semibold flex items-center justify-center transition-colors cursor-pointer"
                  title={`${sym} 기호 삽입`}
                >
                  {sym}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const text =
                    editorMode === 'raw'
                      ? rawDraftText
                      : formatSectionsToPlainText(draftSections);
                  handleCopyText(text, '보고서 초안');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[var(--border-strong)] bg-[var(--bg-card)] hover:bg-[var(--bg-sub)] text-[var(--text-main)] font-semibold cursor-pointer whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                텍스트 복사
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-white font-semibold cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                저장
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {editorMode === 'raw' ? (
              <textarea
                rows={16}
                value={rawDraftText}
                onFocus={(e) => {
                  activeInputRef.current = { type: 'raw', el: e.currentTarget };
                }}
                onChange={(e) => {
                  setRawDraftText(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="□ 추진실적 및 추진계획 내용을 자유롭게 편집하세요."
                className="w-full p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-xs sm:text-sm leading-relaxed text-[var(--text-main)] outline-none focus:border-[var(--accent-rose)] resize-y"
              />
            ) : (
              <div className="space-y-4">
                {draftSections.map((sec, secIdx) => (
                  <div
                    key={secIdx}
                    className="p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] space-y-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--accent-rose)] select-none">
                        □
                      </span>
                      <input
                        type="text"
                        value={sec.heading}
                        onFocus={(e) => {
                          activeInputRef.current = {
                            type: 'heading',
                            secIdx,
                            el: e.currentTarget,
                          };
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = draftSections.map((s, idx) =>
                            idx === secIdx ? { ...s, heading: val } : s
                          );
                          setDraftSections(next);
                          setRawDraftText(formatSectionsToPlainText(next));
                          setIsDirty(true);
                        }}
                        className="flex-1 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] text-xs sm:text-sm font-bold text-[var(--text-main)] outline-none focus:border-[var(--accent-rose)]"
                      />
                      {draftSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = draftSections.filter(
                              (_, idx) => idx !== secIdx
                            );
                            setDraftSections(next);
                            setRawDraftText(formatSectionsToPlainText(next));
                            setIsDirty(true);
                          }}
                          className="text-xs text-[var(--text-subtle)] hover:text-[var(--danger-red)] px-1.5 py-1 cursor-pointer"
                          title="이 구분 삭제"
                        >
                          구분 삭제
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5 pl-2 sm:pl-4">
                      {sec.items.map((item, itemIdx) => {
                        const isTaskHeader = /^[①②③④⑤⑥⑦⑧⑨⑩]/.test(
                          item.text.trim()
                        );
                        return (
                          <div
                            key={itemIdx}
                            className="flex items-center gap-1.5"
                          >
                            <input
                              type="text"
                              value={item.text}
                              onFocus={(e) => {
                                activeInputRef.current = {
                                  type: 'item',
                                  secIdx,
                                  itemIdx,
                                  el: e.currentTarget,
                                };
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                const next = draftSections.map((s, idx) => {
                                  if (idx !== secIdx) return s;
                                  return {
                                    ...s,
                                    items: s.items.map((it, iIdx) =>
                                      iIdx === itemIdx
                                        ? { ...it, text: val }
                                        : it
                                    ),
                                  };
                                });
                                setDraftSections(next);
                                setRawDraftText(formatSectionsToPlainText(next));
                                setIsDirty(true);
                              }}
                              className={`flex-1 px-2.5 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)] text-xs outline-none focus:border-[var(--accent-rose)] ${
                                isTaskHeader
                                  ? 'font-bold text-[var(--text-main)]'
                                  : 'text-[var(--text-main)]'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = draftSections.map((s, idx) => {
                                  if (idx !== secIdx) return s;
                                  const nextItems = [...s.items];
                                  nextItems.splice(itemIdx + 1, 0, {
                                    text: ' ㅇ ',
                                  });
                                  return { ...s, items: nextItems };
                                });
                                setDraftSections(next);
                                setRawDraftText(formatSectionsToPlainText(next));
                                setIsDirty(true);
                              }}
                              className="p-1 text-[var(--text-subtle)] hover:text-[var(--accent-sage)] cursor-pointer"
                              title="아래에 항목 추가"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = draftSections.map((s, idx) => {
                                  if (idx !== secIdx) return s;
                                  return {
                                    ...s,
                                    items: s.items.filter(
                                      (_, iIdx) => iIdx !== itemIdx
                                    ),
                                  };
                                });
                                setDraftSections(next);
                                setRawDraftText(formatSectionsToPlainText(next));
                                setIsDirty(true);
                              }}
                              className="p-1 text-[var(--text-subtle)] hover:text-[var(--danger-red)] cursor-pointer"
                              title="항목 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const next = draftSections.map((s, idx) =>
                              idx === secIdx
                                ? {
                                    ...s,
                                    items: [
                                      ...s.items,
                                      { text: '① 신규 과제명' },
                                    ],
                                  }
                                : s
                            );
                            setDraftSections(next);
                            setRawDraftText(formatSectionsToPlainText(next));
                            setIsDirty(true);
                          }}
                          className="text-[11px] px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-sub)] text-[var(--text-main)] cursor-pointer"
                        >
                          + ① 과제 줄 추가
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = draftSections.map((s, idx) =>
                              idx === secIdx
                                ? {
                                    ...s,
                                      items: [
                                      ...s.items,
                                      { text: ' ㅇ 세부 추진내용' },
                                    ],
                                  }
                                : s
                            );
                            setDraftSections(next);
                            setRawDraftText(formatSectionsToPlainText(next));
                            setIsDirty(true);
                          }}
                          className="text-[11px] px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-sub)] text-[var(--text-main)] cursor-pointer"
                        >
                          + ㅇ 세부항목 줄 추가
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const next = [
                      ...draftSections,
                      {
                        heading: '특이사항 및 협조요청',
                        items: [{ text: ' ※ ' }],
                      },
                    ];
                    setDraftSections(next);
                    setRawDraftText(formatSectionsToPlainText(next));
                    setIsDirty(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[var(--border-strong)] bg-[var(--bg-sub)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-main)] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />새 구분(□ 섹션) 추가
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
