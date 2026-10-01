import React, { useState, useMemo } from 'react';
import {
  Copy,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import { ReportEntry } from '../types';
import {
  formatFullDateKo,
  getReportWeekSpec,
} from '../utils/weekCalculator';
import { formatSectionsToPlainText } from '../utils/reportGenerator';

interface ReportHistoryViewProps {
  entries: ReportEntry[];
  onEditEntry: (entry: ReportEntry) => void;
  onDeleteEntry: (id: string) => void;
  showToast: (msg: string) => void;
}

export const ReportHistoryView: React.FC<ReportHistoryViewProps> = ({
  entries,
  onEditEntry,
  onDeleteEntry,
  showToast,
}) => {
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'monthly' | 'weekly'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(
    entries[0]?.id || null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const e of entries) {
      if (e.targetYear) years.add(e.targetYear);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return [...entries]
      .filter((entry) => {
        if (yearFilter !== 'all' && String(entry.targetYear) !== yearFilter) {
          return false;
        }
        const isMonthly = entry.targetWeek === 1;
        if (typeFilter === 'monthly' && !isMonthly) return false;
        if (typeFilter === 'weekly' && isMonthly) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.targetYear !== b.targetYear) return b.targetYear - a.targetYear;
        if (a.targetMonth !== b.targetMonth) return b.targetMonth - a.targetMonth;
        return b.targetWeek - a.targetWeek;
      });
  }, [entries, yearFilter, typeFilter]);

  const handleCopyEntry = async (entry: ReportEntry) => {
    const plain = formatSectionsToPlainText(entry.sections);
    try {
      await navigator.clipboard.writeText(plain);
      showToast(
        `${entry.targetYear}년 ${entry.targetMonth}월 ${entry.targetWeek}주차 보고서를 복사했습니다.`
      );
    } catch {
      showToast('클립보드 복사에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      {/* 상단 필터 바 */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 연도 필터 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-muted)] font-medium">연도:</span>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] font-mono-num text-[var(--text-main)] outline-none"
            >
              <option value="all">전체 연도</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}년
                </option>
              ))}
            </select>
          </div>

          {/* 유형 필터 */}
          <div className="inline-flex rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-0.5">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded-sm cursor-pointer whitespace-nowrap ${
                typeFilter === 'all'
                  ? 'bg-[var(--accent-rose)] text-white font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              전체 ({entries.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('monthly')}
              className={`px-3 py-1 rounded-sm cursor-pointer whitespace-nowrap ${
                typeFilter === 'monthly'
                  ? 'bg-[var(--accent-rose)] text-white font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              월간보고 (1주차)
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('weekly')}
              className={`px-3 py-1 rounded-sm cursor-pointer whitespace-nowrap ${
                typeFilter === 'weekly'
                  ? 'bg-[var(--accent-rose)] text-white font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              주간보고 (2~4주차)
            </button>
          </div>
        </div>

        <div className="text-[var(--text-muted)] font-mono-num">
          조회된 보고서 {filteredEntries.length}건
        </div>
      </div>

      {/* 보고 기록 목록 */}
      {filteredEntries.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-10 text-center space-y-2">
          <FileText className="w-8 h-8 text-[var(--text-subtle)] mx-auto" />
          <p className="text-sm text-[var(--text-muted)]">
            저장된 주·월간 보고 기록이 없습니다.
          </p>
          <p className="text-xs text-[var(--text-subtle)]">
            03 주·월간 보고 작성 메뉴에서 보고서를 작성하고 저장해보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const isMonthly = entry.targetWeek === 1;
            const spec = getReportWeekSpec(
              entry.targetYear,
              entry.targetMonth,
              entry.targetWeek
            );
            const itemCount = entry.sections.reduce(
              (sum, s) => sum + (s.items?.length || 0),
              0
            );
            const isExpanded = expandedId === entry.id;
            const plainText = formatSectionsToPlainText(entry.sections);

            return (
              <div
                key={entry.id}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden"
              >
                <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                  {/* 왼쪽: 유형 배지, 대상 시기, 제출일, 항목 수 */}
                  <div
                    onClick={() =>
                      setExpandedId(isExpanded ? null : entry.id)
                    }
                    className="flex flex-wrap items-center gap-2.5 cursor-pointer flex-1 min-w-[220px]"
                  >
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                        isMonthly
                          ? 'bg-[var(--accent-rose-soft)] text-[var(--accent-rose)]'
                          : 'bg-[var(--accent-sage-soft)] text-[var(--accent-sage)]'
                      }`}
                    >
                      {isMonthly ? '월간보고' : '주간보고'}
                    </span>

                    <h4 className="font-serif-kr text-base font-bold text-[var(--text-main)]">
                      {entry.targetYear}년 {entry.targetMonth}월{' '}
                      {entry.targetWeek}주차
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)] font-mono-num">
                      <span>제출일: {formatFullDateKo(spec.submitDate)}</span>
                      <span>·</span>
                      <span>기준 월요일: {spec.baseMonday}</span>
                      <span>·</span>
                      <span>항목 {itemCount}줄</span>
                    </div>
                  </div>

                  {/* 오른쪽: 수정 / 텍스트 복사 / 삭제 */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => onEditEntry(entry)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-strong)] bg-[var(--bg-sub)] hover:bg-[var(--bg-hover)] text-[var(--text-main)] font-medium cursor-pointer whitespace-nowrap"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[var(--accent-rose)]" />
                      수정
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyEntry(entry)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-[var(--text-main)] font-medium cursor-pointer whitespace-nowrap"
                    >
                      <Copy className="w-3.5 h-3.5 text-[var(--accent-sage)]" />
                      텍스트 복사
                    </button>

                    {confirmDeleteId === entry.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteEntry(entry.id);
                            setConfirmDeleteId(null);
                            showToast('보고 기록이 삭제되었습니다.');
                          }}
                          className="px-2.5 py-1.5 rounded bg-[var(--danger-red)] text-white font-semibold cursor-pointer whitespace-nowrap"
                        >
                          삭제 확인
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(entry.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--danger-red-soft)] text-[var(--text-muted)] hover:text-[var(--danger-red)] cursor-pointer whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        삭제
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : entry.id)
                      }
                      className="p-1.5 rounded text-[var(--text-muted)] hover:bg-[var(--bg-sub)] cursor-pointer"
                      title={isExpanded ? '내용 접기' : '내용 펼치기'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-[var(--border-color)] bg-[var(--bg-main)]">
                    <pre className="p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] text-xs leading-relaxed text-[var(--text-main)] whitespace-pre-wrap font-sans">
                      {plainText}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
