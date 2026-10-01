import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  CheckSquare,
  FileEdit,
  Archive,
  Database,
  CheckCircle2,
  Menu,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  ActiveMenuId,
  ChecklistData,
  LogItem,
  ReportEntry,
  WorkVibeData,
} from './types';
import {
  formatFullDateKo,
  formatShortMonthDay,
  getDateWeekBadge,
  getTodayYMD,
} from './utils/weekCalculator';
import {
  STORAGE_KEY,
  createInitialWorkVibeData,
  normalizeWorkVibeData,
  rolloverPastIncompleteTasks,
} from './utils/sampleData';
import { DailyLogView } from './components/DailyLogView';
import { ProjectChecklistView } from './components/ProjectChecklistView';
import { ReportBuilderView } from './components/ReportBuilderView';
import { ReportHistoryView } from './components/ReportHistoryView';
import { BackupDataView } from './components/BackupDataView';

const NAV_ITEMS: Array<{
  id: ActiveMenuId;
  num: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: '01',
    num: '01',
    label: '업무일지',
    desc: '데일리 · 위클리 · 먼슬리',
    icon: BookOpen,
  },
  {
    id: '02',
    num: '02',
    label: '용역 과제',
    desc: '전체 현황 · 차시별 진척',
    icon: CheckSquare,
  },
  {
    id: '03',
    num: '03',
    label: '주·월간 보고 작성',
    desc: '자동 수집 및 초안 편집',
    icon: FileEdit,
  },
  {
    id: '04',
    num: '04',
    label: '보고 기록',
    desc: '저장된 보고서 관리',
    icon: Archive,
  },
  {
    id: '05',
    num: '05',
    label: '백업·데이터 관리',
    desc: 'v4/v5 백업 및 검증',
    icon: Database,
  },
];

export default function App() {
  const today = getTodayYMD();
  const todayBadge = useMemo(() => getDateWeekBadge(today), [today]);

  const [data, setData] = useState<WorkVibeData>(() => {
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        const normalized = normalizeWorkVibeData(parsed);
        if (normalized.lastRolloverDate !== today) {
          const { updatedLogs } = rolloverPastIncompleteTasks(
            normalized.logs,
            today
          );
          return {
            ...normalized,
            logs: updatedLogs,
            lastRolloverDate: today,
          };
        }
        return normalized;
      }
    } catch {
      // 파싱 실패 시 초기 데이터로 복원
    }
    return createInitialWorkVibeData();
  });

  const [activeMenu, setActiveMenu] = useState<ActiveMenuId>('01');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedLogDate, setSelectedLogDate] = useState<string>(today);

  const [isReportDraftDirty, setIsReportDraftDirty] = useState(false);
  const [pendingMenuId, setPendingMenuId] = useState<ActiveMenuId | null>(null);
  const [reportTargetOverride, setReportTargetOverride] = useState<{
    year: number;
    month: number;
    week: 1 | 2 | 3 | 4;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // 용량 초과 등 예외 안전 처리
    }
  }, [data]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isReportDraftDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isReportDraftDirty]);

  const handleSelectMenu = (menuId: ActiveMenuId) => {
    setMobileMenuOpen(false);
    if (menuId === activeMenu) return;
    if (activeMenu === '03' && isReportDraftDirty) {
      setPendingMenuId(menuId);
      return;
    }
    setActiveMenu(menuId);
  };

  const handleUpdateLogs = useCallback(
    (updater: (prev: LogItem[]) => LogItem[]) => {
      setData((prev) => ({
        ...prev,
        logs: updater(prev.logs),
      }));
    },
    []
  );

  const handleRolloverToDate = useCallback(
    (targetDate: string) => {
      setData((prev) => {
        const { updatedLogs, rolledCount } = rolloverPastIncompleteTasks(
          prev.logs,
          targetDate
        );
        if (rolledCount > 0) {
          setTimeout(() => {
            showToast(
              `지난 미완료 할 일 ${rolledCount}건을 ${formatShortMonthDay(targetDate)} 노트 맨 위로 이월했습니다.`
            );
          }, 0);
        }
        return {
          ...prev,
          logs: updatedLogs,
          lastRolloverDate: targetDate,
        };
      });
    },
    [showToast]
  );

  const handleUpdateChecklist = useCallback(
    (updater: (prev: ChecklistData) => ChecklistData) => {
      setData((prev) => ({
        ...prev,
        checklist: updater(prev.checklist),
      }));
    },
    []
  );

  const handleSaveReport = useCallback((newEntry: ReportEntry) => {
    setData((prev) => {
      const existingIdx = prev.entries.findIndex(
        (e) =>
          e.targetYear === newEntry.targetYear &&
          e.targetMonth === newEntry.targetMonth &&
          e.targetWeek === newEntry.targetWeek
      );
      let nextEntries: ReportEntry[];
      if (existingIdx >= 0) {
        nextEntries = prev.entries.map((e, idx) =>
          idx === existingIdx ? { ...e, ...newEntry } : e
        );
      } else {
        nextEntries = [newEntry, ...prev.entries];
      }
      return {
        ...prev,
        entries: nextEntries,
      };
    });
  }, []);

  const handleDeleteEntry = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.id !== id),
    }));
  }, []);

  const handleEditEntryFromHistory = useCallback((entry: ReportEntry) => {
    setReportTargetOverride({
      year: entry.targetYear,
      month: entry.targetMonth,
      week: entry.targetWeek,
    });
    setActiveMenu('03');
  }, []);

  const handleJumpToReport = useCallback(
    (year: number, month: number, week: 1 | 2 | 3 | 4) => {
      setReportTargetOverride({ year, month, week });
      setActiveMenu('03');
    },
    []
  );

  const handleResetAllData = useCallback(() => {
    const emptyData: WorkVibeData = {
      entries: [],
      logs: [],
      checklist: {
        activeTab: '',
        hideDone: false,
        tabs: [],
      },
      timetable: [],
      lastRolloverDate: today,
    };
    setData(emptyData);
    setIsReportDraftDirty(false);
    showToast('전체 데이터가 초기화되었습니다.');
  }, [today, showToast]);

  const projectNames = useMemo(
    () => data.checklist.tabs.map((t) => t.name),
    [data.checklist.tabs]
  );

  const currentNavMeta =
    NAV_ITEMS.find((n) => n.id === activeMenu) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg-main)] text-[var(--text-main)] overflow-x-hidden">
      {pendingMenuId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-lg w-full max-w-md p-5 shadow-xl space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-[var(--accent-rose)] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
                  저장하지 않은 보고서 초안이 있습니다
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  작성 중인 초안을 저장하지 않고 다른 메뉴로 이동하시겠습니까?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPendingMenuId(null)}
                className="px-3 py-1.5 rounded border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-sub)] cursor-pointer"
              >
                계속 작성하기
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingMenuId;
                  setPendingMenuId(null);
                  setIsReportDraftDirty(false);
                  setActiveMenu(target);
                }}
                className="px-3.5 py-1.5 rounded bg-[var(--accent-rose)] text-white font-semibold cursor-pointer"
              >
                저장 안 하고 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모바일 상단 헤더 (360px 폭 대응) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[var(--bg-sub)] border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <span className="font-serif-kr text-lg font-bold tracking-tight text-[var(--text-main)]">
            워크바이브
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            · {currentNavMeta.num} {currentNavMeta.label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="p-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] cursor-pointer"
          aria-label="메뉴 열기"
        >
          {mobileMenuOpen ? (
            <X className="w-4 h-4" />
          ) : (
            <Menu className="w-4 h-4" />
          )}
        </button>
      </header>

      {/* 왼쪽 세로 메뉴 */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex md:flex-col md:w-64 shrink-0 bg-[var(--bg-sub)] border-b md:border-b-0 md:border-r border-[var(--border-color)] justify-between`}
      >
        <div className="p-4 sm:p-5 space-y-5">
          <div className="hidden md:block pb-4 border-b border-[var(--border-color)]">
            <h1 className="font-serif-kr text-xl font-bold tracking-tight text-[var(--text-main)]">
              워크바이브
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              이러닝 용역개발 주·월간 보고 도우미
            </p>
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectMenu(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent-rose)] text-white shadow-xs'
                      : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-[var(--accent-rose)]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
                      <span
                        className={`font-mono-num ${
                          isActive ? 'text-white/90' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {item.num}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    <div
                      className={`text-[11px] truncate ${
                        isActive ? 'text-white/80' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {item.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 m-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-[var(--accent-sage)] font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>브라우저에 자동 저장됨</span>
          </div>

          <div className="pt-2 border-t border-[var(--border-color)] space-y-1">
            <div className="text-[11px] text-[var(--text-muted)]">오늘 날짜</div>
            <div className="font-mono-num font-bold text-[var(--text-main)]">
              {formatFullDateKo(today)}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded bg-[var(--accent-sage-soft)] text-[var(--accent-sage)] font-semibold text-[11px]">
                {todayBadge.label}
              </span>
              {todayBadge.subLabel && (
                <span className="text-[11px] text-[var(--accent-rose)] font-medium">
                  ({todayBadge.subLabel})
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* 오른쪽 메인 콘텐츠 영역 */}
      <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        <div className="mb-5 pb-3 border-b border-[var(--border-color)] flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono-num text-sm font-bold text-[var(--accent-rose)]">
              {currentNavMeta.num}
            </span>
            <h2 className="font-serif-kr text-lg sm:text-xl font-bold text-[var(--text-main)]">
              {currentNavMeta.label}
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              · {currentNavMeta.desc}
            </span>
          </div>

          <div className="text-xs text-[var(--text-muted)] font-mono-num">
            보고 대상: {todayBadge.targetYear}년 {todayBadge.targetMonth}월{' '}
            {todayBadge.targetWeek}주차 (제출 {todayBadge.reportSpec.submitDate})
          </div>
        </div>

        {activeMenu === '01' && (
          <DailyLogView
            data={data}
            logs={data.logs}
            projectNames={projectNames}
            selectedDate={selectedLogDate}
            onSelectDate={setSelectedLogDate}
            onUpdateLogs={handleUpdateLogs}
            onRolloverToDate={handleRolloverToDate}
            onJumpToReport={handleJumpToReport}
            showToast={showToast}
          />
        )}

        {activeMenu === '02' && (
          <ProjectChecklistView
            checklist={data.checklist}
            onUpdateChecklist={handleUpdateChecklist}
            showToast={showToast}
          />
        )}

        {activeMenu === '03' && (
          <ReportBuilderView
            data={data}
            initialTarget={reportTargetOverride}
            onClearInitialTarget={() => setReportTargetOverride(null)}
            isDirty={isReportDraftDirty}
            setIsDirty={setIsReportDraftDirty}
            onSaveReport={handleSaveReport}
            showToast={showToast}
          />
        )}

        {activeMenu === '04' && (
          <ReportHistoryView
            entries={data.entries}
            onEditEntry={handleEditEntryFromHistory}
            onDeleteEntry={handleDeleteEntry}
            showToast={showToast}
          />
        )}

        {activeMenu === '05' && (
          <BackupDataView
            data={data}
            onReplaceAllData={(nextData) => setData(nextData)}
            onResetAllData={handleResetAllData}
            showToast={showToast}
          />
        )}
      </main>

      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] sm:max-w-md px-4 py-2.5 rounded-lg bg-[var(--text-main)] text-[var(--bg-card)] text-xs font-medium shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--accent-sage)] shrink-0" />
          <span className="leading-snug">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
