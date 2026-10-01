import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  Search,
  Check,
  AlertTriangle,
  Clock,
  ArrowUp,
  ArrowDown,
  Settings2,
  Flag,
  BarChart3,
} from 'lucide-react';
import {
  ChecklistData,
  ProjectMilestone,
  ProjectRow,
  ProjectStep,
  ProjectTab,
} from '../types';
import {
  diffDays,
  formatShortMonthDay,
  getTodayYMD,
} from '../utils/weekCalculator';
import { calculateProjectProgress } from '../utils/reportGenerator';
import {
  createDefaultSteps,
  createLessonRows,
} from '../utils/sampleData';

interface ProjectChecklistViewProps {
  checklist: ChecklistData;
  onUpdateChecklist: (updater: (prev: ChecklistData) => ChecklistData) => void;
  showToast: (msg: string) => void;
}

type RowStatusFilter = 'all' | 'urgent_overdue' | 'in_progress';

export const ProjectChecklistView: React.FC<ProjectChecklistViewProps> = ({
  checklist,
  onUpdateChecklist,
  showToast,
}) => {
  const today = getTodayYMD();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newVendor, setNewVendor] = useState('');
  const [newContractStart, setNewContractStart] = useState(today);
  const [newContractEnd, setNewContractEnd] = useState('2026-12-15');
  const [newLessonCount, setNewLessonCount] = useState<number>(20);
  const [newManager, setNewManager] = useState('');
  const [newMemo, setNewMemo] = useState('');

  const [showStepEditor, setShowStepEditor] = useState(false);
  const [newStepName, setNewStepName] = useState('');

  const [newMsName, setNewMsName] = useState('');
  const [newMsDue, setNewMsDue] = useState('');

  const [statusFilter, setStatusFilter] = useState<RowStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);

  const [confirmDeleteTabId, setConfirmDeleteTabId] = useState<string | null>(null);

  const [editingCheckCell, setEditingCheckCell] = useState<{
    rowId: string;
    stepId: string;
  } | null>(null);

  const activeTab: ProjectTab | undefined = useMemo(() => {
    return (
      checklist.tabs.find((t) => t.id === checklist.activeTab) ||
      checklist.tabs[0]
    );
  }, [checklist]);

  const updateActiveTab = (updater: (tab: ProjectTab) => ProjectTab) => {
    if (!activeTab) return;
    const now = Date.now();
    onUpdateChecklist((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) =>
        t.id === activeTab.id ? { ...updater(t), updatedAt: now } : t
      ),
    }));
  };

  const progressSummary = useMemo(() => {
    if (!activeTab) return null;
    return calculateProjectProgress(activeTab);
  }, [activeTab]);

  const isRowAllDone = (row: ProjectRow, steps: ProjectStep[]): boolean => {
    if (steps.length === 0) return false;
    return steps.every((s) => Boolean(row.checks?.[s.id]));
  };

  const getRowDueStatus = (
    row: ProjectRow,
    steps: ProjectStep[]
  ): 'overdue' | 'urgent' | 'normal' => {
    if (!row.due || isRowAllDone(row, steps)) return 'normal';
    const d = diffDays(row.due, today);
    if (d < 0) return 'overdue';
    if (d <= 3) return 'urgent';
    return 'normal';
  };

  // 전체 과제 현황 요약 데이터 (과제별 공정률 막대, 다가오는 마일스톤 3개, 지연 건수)
  const overallOverview = useMemo(() => {
    const projectStats = checklist.tabs.map((tab) => {
      const prog = calculateProjectProgress(tab);
      let overdueRows = 0;
      for (const r of tab.rows) {
        if (r.due && !isRowAllDone(r, tab.steps) && diffDays(r.due, today) < 0) {
          overdueRows++;
        }
      }
      let overdueMilestones = 0;
      for (const ms of tab.milestones || []) {
        if (!ms.doneDate && ms.dueDate && diffDays(ms.dueDate, today) < 0) {
          overdueMilestones++;
        }
      }
      return {
        tabId: tab.id,
        name: tab.name,
        vendor: tab.vendor || '',
        progressRate: prog.progressRate,
        checkedCells: prog.checkedCells,
        totalCells: prog.totalCells,
        overdueRows,
        overdueMilestones,
      };
    });

    const upcomingMilestones: Array<{
      id: string;
      tabId: string;
      projectName: string;
      milestoneName: string;
      dueDate: string;
      dDay: number;
    }> = [];

    for (const tab of checklist.tabs) {
      for (const ms of tab.milestones || []) {
        if (!ms.doneDate && ms.dueDate) {
          upcomingMilestones.push({
            id: `${tab.id}-${ms.id}`,
            tabId: tab.id,
            projectName: tab.name,
            milestoneName: ms.name,
            dueDate: ms.dueDate,
            dDay: diffDays(ms.dueDate, today),
          });
        }
      }
    }

    upcomingMilestones.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const totalOverdueRows = projectStats.reduce((s, p) => s + p.overdueRows, 0);
    const totalOverdueMilestones = projectStats.reduce(
      (s, p) => s + p.overdueMilestones,
      0
    );

    return {
      projectStats,
      upcomingTop3: upcomingMilestones.slice(0, 3),
      totalOverdueCount: totalOverdueRows + totalOverdueMilestones,
      totalOverdueRows,
      totalOverdueMilestones,
    };
  }, [checklist.tabs, today]);

  const filteredRows = useMemo(() => {
    if (!activeTab) return [];
    const q = searchQuery.trim().toLowerCase();

    return activeTab.rows.filter((row) => {
      const allDone = isRowAllDone(row, activeTab.steps);
      if (checklist.hideDone && allDone) return false;

      const dueStatus = getRowDueStatus(row, activeTab.steps);
      if (statusFilter === 'urgent_overdue') {
        if (dueStatus !== 'overdue' && dueStatus !== 'urgent') return false;
      } else if (statusFilter === 'in_progress') {
        if (allDone) return false;
      }

      if (q) {
        const matchName = row.name.toLowerCase().includes(q);
        const matchMemo = (row.memo || '').toLowerCase().includes(q);
        if (!matchName && !matchMemo) return false;
      }

      return true;
    });
  }, [activeTab, checklist.hideDone, statusFilter, searchQuery, today]);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newProjectName.trim() || `신규 이러닝 용역 과제`;
    const count = Math.max(1, Math.min(200, Number(newLessonCount) || 1));
    const now = Date.now();
    const newTabId = `tab-${now}`;

    const defaultSteps = createDefaultSteps();
    const generatedRows = createLessonRows(count, 1);
    const defaultMilestones: ProjectMilestone[] = [
      { id: `ms-${now}-1`, name: '착수보고', dueDate: '', doneDate: '' },
      { id: `ms-${now}-2`, name: '중간보고', dueDate: '', doneDate: '' },
      { id: `ms-${now}-3`, name: '검수', dueDate: '', doneDate: '' },
      { id: `ms-${now}-4`, name: '납품', dueDate: newContractEnd || '', doneDate: '' },
    ];

    const newTab: ProjectTab = {
      id: newTabId,
      name: trimmedName,
      vendor: newVendor.trim(),
      contractStart: newContractStart,
      contractEnd: newContractEnd,
      lessonCount: count,
      manager: newManager.trim(),
      memo: newMemo.trim(),
      steps: defaultSteps,
      rows: generatedRows,
      milestones: defaultMilestones,
      updatedAt: now,
    };

    onUpdateChecklist((prev) => ({
      ...prev,
      activeTab: newTabId,
      tabs: [...prev.tabs, newTab],
    }));

    setShowAddModal(false);
    setNewProjectName('');
    setNewVendor('');
    setNewManager('');
    setNewMemo('');
    showToast(`"${trimmedName}" 과제(1차시~${count}차시)가 생성되었습니다.`);
  };

  const handleApplyLessonCountRows = (targetCount: number) => {
    if (!activeTab) return;
    const safeCount = Math.max(1, Math.min(200, Math.floor(targetCount)));
    const currentLen = activeTab.rows.length;

    if (safeCount > currentLen) {
      const added = createLessonRows(safeCount - currentLen, currentLen + 1);
      updateActiveTab((tab) => ({
        ...tab,
        lessonCount: safeCount,
        rows: [...tab.rows, ...added],
      }));
      showToast(`${currentLen + 1}차시 ~ ${safeCount}차시 행을 자동으로 추가했습니다.`);
    } else {
      updateActiveTab((tab) => ({
        ...tab,
        lessonCount: safeCount,
      }));
      showToast(`차시 수가 ${safeCount}차시로 설정되었습니다.`);
    }
  };

  const handleToggleCellCheck = (rowId: string, stepId: string) => {
    updateActiveTab((tab) => ({
      ...tab,
      rows: tab.rows.map((r) => {
        if (r.id !== rowId) return r;
        const nextChecks = { ...(r.checks || {}) };
        if (nextChecks[stepId]) {
          delete nextChecks[stepId];
        } else {
          nextChecks[stepId] = today;
        }
        return { ...r, checks: nextChecks };
      }),
    }));
  };

  const handleChangeCellCheckDate = (
    rowId: string,
    stepId: string,
    newDate: string
  ) => {
    updateActiveTab((tab) => ({
      ...tab,
      rows: tab.rows.map((r) => {
        if (r.id !== rowId) return r;
        const nextChecks = { ...(r.checks || {}) };
        if (!newDate) {
          delete nextChecks[stepId];
        } else {
          nextChecks[stepId] = newDate;
        }
        return { ...r, checks: nextChecks };
      }),
    }));
    setEditingCheckCell(null);
  };

  const handleDropRow = (targetRowId: string) => {
    if (!draggedRowId || draggedRowId === targetRowId || !activeTab) {
      setDraggedRowId(null);
      setDragOverRowId(null);
      return;
    }

    updateActiveTab((tab) => {
      const nextRows = [...tab.rows];
      const fromIdx = nextRows.findIndex((r) => r.id === draggedRowId);
      const toIdx = nextRows.findIndex((r) => r.id === targetRowId);
      if (fromIdx < 0 || toIdx < 0) return tab;
      const [moved] = nextRows.splice(fromIdx, 1);
      nextRows.splice(toIdx, 0, moved);
      return { ...tab, rows: nextRows };
    });

    setDraggedRowId(null);
    setDragOverRowId(null);
  };

  const handleMoveRowByOffset = (rowId: string, offset: -1 | 1) => {
    updateActiveTab((tab) => {
      const nextRows = [...tab.rows];
      const idx = nextRows.findIndex((r) => r.id === rowId);
      const targetIdx = idx + offset;
      if (idx < 0 || targetIdx < 0 || targetIdx >= nextRows.length) return tab;
      const [moved] = nextRows.splice(idx, 1);
      nextRows.splice(targetIdx, 0, moved);
      return { ...tab, rows: nextRows };
    });
  };

  return (
    <div className="space-y-5">
      {/* 0. 전체 과제 현황 요약 카드 (과제별 공정률 막대, 다가오는 마일스톤 3개, 지연 건수) */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--accent-rose)]" />
            <h3 className="font-serif-kr text-sm sm:text-base font-bold text-[var(--text-main)]">
              전체 과제 현황 요약
            </h3>
          </div>

          {/* 지연 건수 배지 */}
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-1 rounded font-semibold font-mono-num ${
                overallOverview.totalOverdueCount > 0
                  ? 'bg-[var(--danger-red-soft)] text-[var(--danger-red)]'
                  : 'bg-[var(--accent-sage-soft)] text-[var(--accent-sage)]'
              }`}
            >
              전체 지연 {overallOverview.totalOverdueCount}건 (차시 {overallOverview.totalOverdueRows} · 마일스톤 {overallOverview.totalOverdueMilestones})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 왼쪽: 과제별 공정률 막대 */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="text-xs font-semibold text-[var(--text-muted)]">
              과제별 공정률 ({overallOverview.projectStats.length}개 과제)
            </div>
            {overallOverview.projectStats.length === 0 ? (
              <p className="text-xs text-[var(--text-subtle)] py-2">
                등록된 용역 과제가 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {overallOverview.projectStats.map((p) => {
                  const isSelected = activeTab?.id === p.tabId;
                  return (
                    <div
                      key={p.tabId}
                      onClick={() =>
                        onUpdateChecklist((prev) => ({
                          ...prev,
                          activeTab: p.tabId,
                        }))
                      }
                      className={`p-2.5 rounded border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[var(--accent-rose)] bg-[var(--bg-sub)]/60'
                          : 'border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-[var(--text-main)] truncate">
                            {p.name}
                          </span>
                          {p.vendor && (
                            <span className="text-[11px] text-[var(--text-muted)] truncate">
                              · {p.vendor}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-mono-num">
                          {(p.overdueRows > 0 || p.overdueMilestones > 0) && (
                            <span className="text-[11px] text-[var(--danger-red)] font-semibold">
                              지연 {p.overdueRows + p.overdueMilestones}건
                            </span>
                          )}
                          <span className="font-bold text-[var(--accent-sage)]">
                            {p.progressRate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[var(--bg-sub)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent-sage)] transition-all duration-200"
                          style={{ width: `${p.progressRate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 오른쪽: 다가오는 마일스톤 3개 */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-xs font-semibold text-[var(--text-muted)]">
              다가오는 마일스톤 (최대 3개)
            </div>
            {overallOverview.upcomingTop3.length === 0 ? (
              <div className="p-4 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-xs text-[var(--text-subtle)] text-center">
                예정된 미완료 마일스톤이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {overallOverview.upcomingTop3.map((ms) => {
                  const isOverdue = ms.dDay < 0;
                  const isUrgent = ms.dDay >= 0 && ms.dDay <= 3;
                  return (
                    <div
                      key={ms.id}
                      onClick={() =>
                        onUpdateChecklist((prev) => ({
                          ...prev,
                          activeTab: ms.tabId,
                        }))
                      }
                      className={`p-2.5 rounded border flex items-center justify-between gap-2 text-xs cursor-pointer ${
                        isOverdue
                          ? 'bg-[var(--danger-red-soft)] border-[var(--danger-red)]'
                          : isUrgent
                            ? 'bg-[var(--warn-amber-soft)] border-[var(--warn-amber)]'
                            : 'bg-[var(--bg-main)] border-[var(--border-color)] hover:bg-[var(--bg-sub)]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--text-main)] truncate">
                          {ms.milestoneName}{' '}
                          <span className="font-normal text-[var(--text-muted)]">
                            · {ms.projectName}
                          </span>
                        </div>
                        <div className="font-mono-num text-[11px] text-[var(--text-muted)]">
                          예정일: {ms.dueDate}
                        </div>
                      </div>
                      <span
                        className={`font-mono-num text-xs font-bold shrink-0 ${
                          isOverdue
                            ? 'text-[var(--danger-red)]'
                            : isUrgent
                              ? 'text-[var(--warn-amber)]'
                              : 'text-[var(--accent-sage)]'
                        }`}
                      >
                        {ms.dDay === 0
                          ? 'D-Day'
                          : ms.dDay < 0
                            ? `지연 D+${Math.abs(ms.dDay)}`
                            : `D-${ms.dDay}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상단 과제 탭 바 */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {checklist.tabs.map((tab) => {
            const isActive = activeTab?.id === tab.id;
            const prog = calculateProjectProgress(tab);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  onUpdateChecklist((prev) => ({ ...prev, activeTab: tab.id }))
                }
                className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--accent-rose)] border-[var(--accent-rose)] text-white font-semibold'
                    : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-sub)]'
                }`}
              >
                <span className="truncate max-w-[180px]">{tab.name}</span>
                <span
                  className={`font-mono-num text-[11px] ${
                    isActive ? 'text-white/90' : 'text-[var(--accent-sage)]'
                  }`}
                >
                  {prog.progressRate}%
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          이러닝 용역 과제 추가
        </button>
      </div>

      {/* 새 과제 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-lg w-full max-w-lg p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="font-serif-kr text-base font-bold text-[var(--text-main)]">
                새 이러닝 용역 과제 추가
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                닫기 ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1">
                  과제명 *
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="예: 2026년 직무역량 강화 이러닝 콘텐츠 개발"
                  className="w-full px-3 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[var(--accent-rose)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">
                    개발업체
                  </label>
                  <input
                    type="text"
                    value={newVendor}
                    onChange={(e) => setNewVendor(e.target.value)}
                    placeholder="예: (주)에듀테크솔루션"
                    className="w-full px-3 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[var(--accent-rose)]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">
                    담당자
                  </label>
                  <input
                    type="text"
                    value={newManager}
                    onChange={(e) => setNewManager(e.target.value)}
                    placeholder="예: 홍길동 주무관"
                    className="w-full px-3 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[var(--accent-rose)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">
                    계약 시작일
                  </label>
                  <input
                    type="date"
                    value={newContractStart}
                    onChange={(e) => setNewContractStart(e.target.value)}
                    className="w-full px-2.5 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] font-mono-num outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">
                    계약 종료일
                  </label>
                  <input
                    type="date"
                    value={newContractEnd}
                    onChange={(e) => setNewContractEnd(e.target.value)}
                    className="w-full px-2.5 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] font-mono-num outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-main)] mb-1">
                    차시 수 (자동 행 생성)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={newLessonCount}
                    onChange={(e) => setNewLessonCount(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] font-mono-num outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1">
                  과제 메모
                </label>
                <input
                  type="text"
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  placeholder="과업 특이사항, 산출물 기준 등"
                  className="w-full px-3 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div className="p-2.5 rounded bg-[var(--bg-sub)] text-[11px] text-[var(--text-muted)]">
                · 기본 진행 단계: <strong>기획 → 원고 → 스토리보드 → 개발 → 검수 → 탑재</strong> (생성 후 수정 가능)
                <br />· 입력한 차시 수({newLessonCount || 1}차시)에 맞춰 <strong>1차시 ~ {newLessonCount || 1}차시</strong> 행이 자동 생성됩니다.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-sub)] cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[var(--accent-rose)] hover:bg-[var(--accent-rose-hover)] text-white font-semibold cursor-pointer"
                >
                  과제 생성하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!activeTab ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-8 text-center space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            등록된 이러닝 용역 과제가 없습니다.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[var(--accent-rose)] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />첫 용역 과제 추가하기
          </button>
        </div>
      ) : (
        <>
          {/* 1. 과제 기본정보 카드 */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] pb-2.5">
              <h3 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
                과제 기본정보
              </h3>
              <div className="flex items-center gap-2">
                {confirmDeleteTabId === activeTab.id ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[var(--danger-red)] font-semibold">
                      이 과제를 삭제할까요?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const deletedName = activeTab.name;
                        onUpdateChecklist((prev) => {
                          const remaining = prev.tabs.filter(
                            (t) => t.id !== activeTab.id
                          );
                          return {
                            ...prev,
                            activeTab: remaining[0]?.id || '',
                            tabs: remaining,
                          };
                        });
                        setConfirmDeleteTabId(null);
                        showToast(`"${deletedName}" 과제가 삭제되었습니다.`);
                      }}
                      className="px-2 py-0.5 rounded bg-[var(--danger-red)] text-white cursor-pointer"
                    >
                      삭제 확인
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTabId(null)}
                      className="px-2 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteTabId(activeTab.id)}
                    className="inline-flex items-center gap-1 text-xs text-[var(--text-subtle)] hover:text-[var(--danger-red)] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    과제 삭제
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  과제명
                </label>
                <input
                  type="text"
                  value={activeTab.name}
                  onChange={(e) =>
                    updateActiveTab((t) => ({ ...t, name: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] font-medium outline-none focus:border-[var(--accent-rose)]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  개발업체
                </label>
                <input
                  type="text"
                  value={activeTab.vendor || ''}
                  placeholder="수행사명 입력"
                  onChange={(e) =>
                    updateActiveTab((t) => ({ ...t, vendor: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[var(--accent-rose)]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  담당자
                </label>
                <input
                  type="text"
                  value={activeTab.manager || ''}
                  placeholder="담당자 성명"
                  onChange={(e) =>
                    updateActiveTab((t) => ({ ...t, manager: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[var(--accent-rose)]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  계약기간 (시작 ~ 끝)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={activeTab.contractStart || ''}
                    onChange={(e) =>
                      updateActiveTab((t) => ({
                        ...t,
                        contractStart: e.target.value,
                      }))
                    }
                    className="w-full px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] font-mono-num outline-none"
                  />
                  <span className="text-[var(--text-muted)]">~</span>
                  <input
                    type="date"
                    value={activeTab.contractEnd || ''}
                    onChange={(e) =>
                      updateActiveTab((t) => ({
                        ...t,
                        contractEnd: e.target.value,
                      }))
                    }
                    className="w-full px-2 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] font-mono-num outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  차시 수 (행 자동생성)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={activeTab.lessonCount ?? activeTab.rows.length}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateActiveTab((t) => ({ ...t, lessonCount: val }));
                    }}
                    className="w-20 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] font-mono-num outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleApplyLessonCountRows(
                        activeTab.lessonCount ?? activeTab.rows.length
                      )
                    }
                    className="px-2.5 py-1.5 rounded border border-[var(--border-strong)] bg-[var(--bg-sub)] hover:bg-[var(--bg-hover)] text-[var(--text-main)] font-medium whitespace-nowrap cursor-pointer"
                  >
                    차시 행 반영
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-5">
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  과제 메모
                </label>
                <input
                  type="text"
                  value={activeTab.memo || ''}
                  placeholder="과제 관련 메모 입력"
                  onChange={(e) =>
                    updateActiveTab((t) => ({ ...t, memo: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[var(--accent-rose)]"
                />
              </div>
            </div>
          </div>

          {/* 2. 단계별 완료 수 및 전체 공정률 요약 */}
          {progressSummary && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
                    단계별 완료 현황 및 공정률
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono-num">
                    ㅇ {progressSummary.summaryLine}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-[var(--text-muted)] block">
                      전체 공정률 ({progressSummary.checkedCells}/{progressSummary.totalCells}칸)
                    </span>
                    <span className="font-mono-num text-xl font-bold text-[var(--accent-sage)]">
                      {progressSummary.progressRate}%
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStepEditor((v) => !v)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-xs text-[var(--text-main)] cursor-pointer whitespace-nowrap"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    진행 단계 관리
                  </button>
                </div>
              </div>

              <div className="w-full h-2.5 rounded-full bg-[var(--bg-sub)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-sage)] transition-all duration-200"
                  style={{ width: `${progressSummary.progressRate}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                {progressSummary.stepStats.map((st) => {
                  const pct =
                    st.totalRows > 0
                      ? Math.round((st.doneCount / st.totalRows) * 100)
                      : 0;
                  return (
                    <div
                      key={st.stepId}
                      className="p-2.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--text-main)] truncate">
                          {st.stepName}
                        </span>
                        <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                          {pct}%
                        </span>
                      </div>
                      <div className="font-mono-num text-sm font-bold text-[var(--accent-sage)] mt-1">
                        {st.doneCount}{' '}
                        <span className="text-xs font-normal text-[var(--text-muted)]">
                          / {st.totalRows}차시
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {showStepEditor && (
                <div className="p-3 rounded border border-[var(--border-strong)] bg-[var(--bg-sub)] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-main)]">
                      진행 단계 이름 변경 · 추가 · 삭제
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowStepEditor(false)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                    >
                      닫기
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeTab.steps.map((step) => (
                      <div
                        key={step.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)]"
                      >
                        <input
                          type="text"
                          value={step.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateActiveTab((t) => ({
                              ...t,
                              steps: t.steps.map((s) =>
                                s.id === step.id ? { ...s, name: val } : s
                              ),
                            }));
                          }}
                          className="w-20 bg-transparent border-0 outline-none text-xs text-[var(--text-main)] font-medium"
                        />
                        {activeTab.steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveTab((t) => ({
                                ...t,
                                steps: t.steps.filter((s) => s.id !== step.id),
                              }))
                            }
                            className="text-[var(--text-subtle)] hover:text-[var(--danger-red)] cursor-pointer"
                            title="단계 삭제"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}

                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        value={newStepName}
                        onChange={(e) => setNewStepName(e.target.value)}
                        placeholder="새 단계 이름"
                        className="w-28 px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)] text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const name = newStepName.trim();
                          if (!name) return;
                          updateActiveTab((t) => ({
                            ...t,
                            steps: [
                              ...t.steps,
                              { id: `step-${Date.now()}`, name },
                            ],
                          }));
                          setNewStepName('');
                        }}
                        className="px-2.5 py-1 rounded bg-[var(--accent-rose)] text-white font-medium cursor-pointer whitespace-nowrap"
                      >
                        + 단계 추가
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. 과제별 마일스톤 */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-[var(--accent-rose)]" />
                <h3 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
                  과제 마일스톤 (착수·중간·검수·납품)
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <input
                  type="text"
                  value={newMsName}
                  onChange={(e) => setNewMsName(e.target.value)}
                  placeholder="마일스톤명 (예: 최종보고)"
                  className="w-36 px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
                <input
                  type="date"
                  value={newMsDue}
                  onChange={(e) => setNewMsDue(e.target.value)}
                  className="px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] font-mono-num outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newMsName.trim();
                    if (!name) return;
                    const newMs: ProjectMilestone = {
                      id: `ms-${Date.now()}`,
                      name,
                      dueDate: newMsDue,
                      doneDate: '',
                    };
                    updateActiveTab((t) => ({
                      ...t,
                      milestones: [...(t.milestones || []), newMs],
                    }));
                    setNewMsName('');
                    setNewMsDue('');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--accent-rose)] text-white font-medium cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  추가
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              {(activeTab.milestones || []).map((ms) => {
                const isMsDone = Boolean(ms.doneDate);
                const msDiff =
                  !isMsDone && ms.dueDate ? diffDays(ms.dueDate, today) : 999;
                const isMsOverdue = !isMsDone && ms.dueDate && msDiff < 0;
                const isMsUrgent =
                  !isMsDone && ms.dueDate && msDiff >= 0 && msDiff <= 3;

                return (
                  <div
                    key={ms.id}
                    className={`p-3 rounded border flex flex-col justify-between gap-2 ${
                      isMsOverdue
                        ? 'bg-[var(--danger-red-soft)] border-[var(--danger-red)]'
                        : isMsUrgent
                          ? 'bg-[var(--warn-amber-soft)] border-[var(--warn-amber)]'
                          : 'bg-[var(--bg-main)] border-[var(--border-color)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            updateActiveTab((t) => ({
                              ...t,
                              milestones: (t.milestones || []).map((m) =>
                                m.id === ms.id
                                  ? { ...m, doneDate: m.doneDate ? '' : today }
                                  : m
                              ),
                            }));
                          }}
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                            isMsDone
                              ? 'bg-[var(--accent-sage)] border-[var(--accent-sage)] text-white'
                              : 'bg-[var(--bg-card)] border-[var(--border-strong)]'
                          }`}
                        >
                          {isMsDone && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </button>
                        <input
                          type="text"
                          value={ms.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateActiveTab((t) => ({
                              ...t,
                              milestones: (t.milestones || []).map((m) =>
                                m.id === ms.id ? { ...m, name: val } : m
                              ),
                            }));
                          }}
                          className={`w-full bg-transparent border-0 outline-none font-semibold truncate ${
                            isMsDone
                              ? 'line-through text-[var(--text-muted)]'
                              : 'text-[var(--text-main)]'
                          }`}
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isMsOverdue && (
                          <span className="text-[11px] font-bold text-[var(--danger-red)] whitespace-nowrap">
                            지연
                          </span>
                        )}
                        {isMsUrgent && (
                          <span className="text-[11px] font-bold text-[var(--warn-amber)] whitespace-nowrap">
                            임박
                          </span>
                        )}
                        {isMsDone && (
                          <span className="text-[11px] font-bold text-[var(--accent-sage)] whitespace-nowrap">
                            완료
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveTab((t) => ({
                              ...t,
                              milestones: (t.milestones || []).filter(
                                (m) => m.id !== ms.id
                              ),
                            }))
                          }
                          className="text-[var(--text-subtle)] hover:text-[var(--danger-red)] cursor-pointer ml-1"
                          title="마일스톤 삭제"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div>
                        <span className="text-[var(--text-muted)] block">
                          예정일
                        </span>
                        <input
                          type="date"
                          value={ms.dueDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateActiveTab((t) => ({
                              ...t,
                              milestones: (t.milestones || []).map((m) =>
                                m.id === ms.id ? { ...m, dueDate: val } : m
                              ),
                            }));
                          }}
                          className="w-full bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)] font-mono-num text-[var(--text-main)]"
                        />
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] block">
                          완료일
                        </span>
                        <input
                          type="date"
                          value={ms.doneDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateActiveTab((t) => ({
                              ...t,
                              milestones: (t.milestones || []).map((m) =>
                                m.id === ms.id ? { ...m, doneDate: val } : m
                              ),
                            }));
                          }}
                          className="w-full bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)] font-mono-num text-[var(--text-main)]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. 차시·산출물 × 단계 체크 표 */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
            <div className="p-3.5 bg-[var(--bg-sub)] border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-sm cursor-pointer whitespace-nowrap ${
                      statusFilter === 'all'
                        ? 'bg-[var(--accent-rose)] text-white font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    전체 ({activeTab.rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('urgent_overdue')}
                    className={`px-2.5 py-1 rounded-sm cursor-pointer whitespace-nowrap ${
                      statusFilter === 'urgent_overdue'
                        ? 'bg-[var(--accent-rose)] text-white font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    임박·지연
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('in_progress')}
                    className={`px-2.5 py-1 rounded-sm cursor-pointer whitespace-nowrap ${
                      statusFilter === 'in_progress'
                        ? 'bg-[var(--accent-rose)] text-white font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    진행 중
                  </button>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)]">
                  <Search className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="차시·산출물·메모 검색"
                    className="w-36 sm:w-44 bg-transparent border-0 outline-none text-xs text-[var(--text-main)]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[var(--text-subtle)] hover:text-[var(--text-main)] cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[var(--text-main)]">
                  <input
                    type="checkbox"
                    checked={checklist.hideDone}
                    onChange={(e) =>
                      onUpdateChecklist((prev) => ({
                        ...prev,
                        hideDone: e.target.checked,
                      }))
                    }
                    className="accent-[var(--accent-sage)]"
                  />
                  <span>완료 행 숨기기</span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextNum = activeTab.rows.length + 1;
                  const newRow: ProjectRow = {
                    id: `row-${Date.now()}`,
                    name: `${nextNum}차시`,
                    memo: '',
                    due: '',
                    checks: {},
                  };
                  updateActiveTab((t) => ({
                    ...t,
                    rows: [...t.rows, newRow],
                    lessonCount: t.rows.length + 1,
                  }));
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--accent-rose)] hover:bg-[var(--accent-rose-hover)] text-white font-medium cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />행 추가
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--bg-sub)] border-b border-[var(--border-color)] text-[var(--text-muted)]">
                    <th className="py-2.5 px-2 text-center w-14 whitespace-nowrap">
                      순서
                    </th>
                    <th className="py-2.5 px-2.5 text-left min-w-[110px] whitespace-nowrap">
                      차시·산출물
                    </th>
                    {activeTab.steps.map((step) => (
                      <th
                        key={step.id}
                        className="py-2.5 px-2 text-center min-w-[68px] whitespace-nowrap"
                      >
                        {step.name}
                      </th>
                    ))}
                    <th className="py-2.5 px-2.5 text-left min-w-[140px] whitespace-nowrap">
                      기한 (상태)
                    </th>
                    <th className="py-2.5 px-2.5 text-left min-w-[160px] whitespace-nowrap">
                      메모
                    </th>
                    <th className="py-2.5 px-2 text-center w-10 whitespace-nowrap">
                      삭제
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeTab.steps.length + 5}
                        className="py-8 text-center text-[var(--text-muted)]"
                      >
                        조건에 해당하는 차시·산출물 행이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const dueStatus = getRowDueStatus(row, activeTab.steps);
                      const allDone = isRowAllDone(row, activeTab.steps);
                      const isDragOver = dragOverRowId === row.id;

                      return (
                        <tr
                          key={row.id}
                          draggable
                          onDragStart={() => setDraggedRowId(row.id)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragOverRowId !== row.id) {
                              setDragOverRowId(row.id);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverRowId === row.id) {
                              setDragOverRowId(null);
                            }
                          }}
                          onDrop={() => handleDropRow(row.id)}
                          onDragEnd={() => {
                            setDraggedRowId(null);
                            setDragOverRowId(null);
                          }}
                          className={`transition-colors ${
                            isDragOver
                              ? 'bg-[var(--bg-hover)]'
                              : dueStatus === 'overdue'
                                ? 'bg-[var(--danger-red-soft)]'
                                : dueStatus === 'urgent'
                                  ? 'bg-[var(--warn-amber-soft)]'
                                  : allDone
                                    ? 'bg-[var(--bg-sub)]/50'
                                    : 'hover:bg-[var(--bg-sub)]/60'
                          }`}
                        >
                          <td className="py-2 px-1.5 text-center">
                            <div className="inline-flex items-center gap-0.5 text-[var(--text-subtle)]">
                              <span
                                className="cursor-grab active:cursor-grabbing p-0.5 hover:text-[var(--text-main)]"
                                title="끌어서 순서 변경"
                              >
                                <GripVertical className="w-3.5 h-3.5" />
                              </span>
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => handleMoveRowByOffset(row.id, -1)}
                                  className="hover:text-[var(--text-main)] cursor-pointer"
                                  title="위로 이동"
                                >
                                  <ArrowUp className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveRowByOffset(row.id, 1)}
                                  className="hover:text-[var(--text-main)] cursor-pointer"
                                  title="아래로 이동"
                                >
                                  <ArrowDown className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </td>

                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveTab((t) => ({
                                  ...t,
                                  rows: t.rows.map((r) =>
                                    r.id === row.id ? { ...r, name: val } : r
                                  ),
                                }));
                              }}
                              className={`w-full bg-transparent border-0 outline-none font-semibold ${
                                allDone
                                  ? 'text-[var(--accent-sage)]'
                                  : 'text-[var(--text-main)]'
                              }`}
                            />
                          </td>

                          {activeTab.steps.map((step) => {
                            const checkedDate = row.checks?.[step.id];
                            const isEditingThis =
                              editingCheckCell?.rowId === row.id &&
                              editingCheckCell?.stepId === step.id;

                            return (
                              <td
                                key={step.id}
                                className="py-1.5 px-1.5 text-center align-middle relative"
                              >
                                <div className="flex flex-col items-center justify-center min-h-[38px]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleCellCheck(row.id, step.id)
                                    }
                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                                      checkedDate
                                        ? 'bg-[var(--accent-sage)] border-[var(--accent-sage)] text-white'
                                        : 'bg-[var(--bg-card)] border-[var(--border-strong)] hover:border-[var(--accent-sage)]'
                                    }`}
                                    title={
                                      checkedDate
                                        ? `${step.name} 완료 (${checkedDate}) - 클릭 시 해제`
                                        : `${step.name} 완료 체크`
                                    }
                                  >
                                    {checkedDate && (
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                    )}
                                  </button>

                                  {checkedDate && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingCheckCell(
                                          isEditingThis
                                            ? null
                                            : { rowId: row.id, stepId: step.id }
                                        )
                                      }
                                      className="mt-0.5 font-mono-num text-[10px] leading-tight text-[var(--accent-sage)] hover:underline cursor-pointer"
                                      title="클릭하여 완료일 수정"
                                    >
                                      {formatShortMonthDay(checkedDate)}
                                    </button>
                                  )}

                                  {isEditingThis && (
                                    <div className="absolute z-30 top-full mt-1 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded p-1.5 shadow-lg">
                                      <input
                                        type="date"
                                        value={checkedDate}
                                        onChange={(e) =>
                                          handleChangeCellCheckDate(
                                            row.id,
                                            step.id,
                                            e.target.value
                                          )
                                        }
                                        onBlur={() => setEditingCheckCell(null)}
                                        autoFocus
                                        className="text-[11px] font-mono-num bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-1 py-0.5"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          <td className="py-2 px-2.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="date"
                                value={row.due || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateActiveTab((t) => ({
                                    ...t,
                                    rows: t.rows.map((r) =>
                                      r.id === row.id ? { ...r, due: val } : r
                                    ),
                                  }));
                                }}
                                className="px-1.5 py-0.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] font-mono-num text-[11px] text-[var(--text-main)] outline-none"
                              />
                              {dueStatus === 'overdue' && (
                                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[var(--danger-red)] whitespace-nowrap">
                                  <AlertTriangle className="w-3 h-3" />
                                  지연
                                </span>
                              )}
                              {dueStatus === 'urgent' && (
                                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[var(--warn-amber)] whitespace-nowrap">
                                  <Clock className="w-3 h-3" />
                                  임박
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={row.memo || ''}
                              placeholder="비고·메모"
                              onChange={(e) => {
                                const val = e.target.value;
                                updateActiveTab((t) => ({
                                  ...t,
                                  rows: t.rows.map((r) =>
                                    r.id === row.id ? { ...r, memo: val } : r
                                  ),
                                }));
                              }}
                              className="w-full px-2 py-1 rounded border border-transparent hover:border-[var(--border-color)] focus:border-[var(--accent-rose)] bg-transparent focus:bg-[var(--bg-card)] text-xs text-[var(--text-main)] outline-none"
                            />
                          </td>

                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                updateActiveTab((t) => ({
                                  ...t,
                                  rows: t.rows.filter((r) => r.id !== row.id),
                                }))
                              }
                              className="text-[var(--text-subtle)] hover:text-[var(--danger-red)] p-1 cursor-pointer"
                              title="행 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
