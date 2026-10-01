import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Calendar as CalendarIcon,
  Plus,
  CornerDownRight,
  Check,
  Trash2,
  Tag,
  Copy,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { LogBulletType, LogItem, WorkVibeData } from '../types';
import {
  addDays,
  formatShortMonthDay,
  getDateWeekBadge,
  getDayOfWeekKo,
  getMondayOfWeek,
  getNextYearMonth,
  getTodayYMD,
  pad2,
  parseDateYMD,
} from '../utils/weekCalculator';
import { collectPeriodSummaryData } from '../utils/reportGenerator';

export type LogViewMode = 'daily' | 'weekly' | 'monthly';

type PeriodPreset =
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'h1'
  | 'h2'
  | 'year'
  | 'custom';

interface DailyLogViewProps {
  data: WorkVibeData;
  logs: LogItem[];
  projectNames: string[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onUpdateLogs: (updater: (prev: LogItem[]) => LogItem[]) => void;
  onRolloverToDate: (targetDate: string) => void;
  onJumpToReport: (year: number, month: number, week: 1 | 2 | 3 | 4) => void;
  showToast: (msg: string) => void;
}

interface NoteRowProps {
  item: LogItem;
  index: number;
  totalCount: number;
  taskSuggestions: string[];
  autoFocusId: string | null;
  onClearAutoFocus: () => void;
  onChangeText: (id: string, text: string) => void;
  onToggleDone: (id: string) => void;
  onToggleStar: (id: string) => void;
  onChangeKind: (id: string, kind: 'task' | 'event' | 'note') => void;
  onChangeTaskTag: (id: string, taskName: string) => void;
  onCommitAndInsertAfter: (id: string, currentText: string) => void;
  onPasteMultiLines: (id: string, currentText: string, lines: string[]) => void;
  onDeleteLine: (id: string, focusIndex: number) => void;
  onMoveFocus: (targetIndex: number) => void;
  registerInputRef: (index: number, el: HTMLTextAreaElement | null) => void;
}

const NoteRow: React.FC<NoteRowProps> = React.memo(
  ({
    item,
    index,
    totalCount,
    taskSuggestions,
    autoFocusId,
    onClearAutoFocus,
    onChangeText,
    onToggleDone,
    onToggleStar,
    onChangeKind,
    onChangeTaskTag,
    onCommitAndInsertAfter,
    onPasteMultiLines,
    onDeleteLine,
    onMoveFocus,
    registerInputRef,
  }) => {
    const [localText, setLocalText] = useState(item.text);
    const [localTask, setLocalTask] = useState(item.task || '');
    const [showTaskDropdown, setShowTaskDropdown] = useState(false);

    const isComposingRef = useRef(false);
    const isTaskComposingRef = useRef(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const taskContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!isComposingRef.current && item.text !== localText) {
        setLocalText(item.text);
      }
    }, [item.text]);

    useEffect(() => {
      if (!isTaskComposingRef.current && (item.task || '') !== localTask) {
        setLocalTask(item.task || '');
      }
    }, [item.task]);

    const adjustHeight = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.max(28, el.scrollHeight)}px`;
    }, []);

    useEffect(() => {
      adjustHeight();
    }, [localText, adjustHeight]);

    useEffect(() => {
      if (autoFocusId === item.id && textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
        onClearAutoFocus();
      }
    }, [autoFocusId, item.id, onClearAutoFocus]);

    useEffect(() => {
      if (!showTaskDropdown) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (
          taskContainerRef.current &&
          !taskContainerRef.current.contains(e.target as Node)
        ) {
          setShowTaskDropdown(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showTaskDropdown]);

    const isDone = item.bullet === 'done' || Boolean(item.doneDate);
    const currentKind: 'task' | 'event' | 'note' =
      item.bullet === 'event'
        ? 'event'
        : item.bullet === 'note'
          ? 'note'
          : 'task';

    const filteredSuggestions = useMemo(() => {
      const q = localTask.trim().toLowerCase();
      if (!q) return taskSuggestions.slice(0, 8);
      return taskSuggestions
        .filter((s) => s.toLowerCase().includes(q))
        .slice(0, 8);
    }, [taskSuggestions, localTask]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // 한글 IME 조합 중에는 Enter·Backspace·방향키 처리 절대 금지
      if (
        e.nativeEvent.isComposing ||
        isComposingRef.current ||
        e.keyCode === 229
      ) {
        return;
      }

      const domValue = e.currentTarget.value;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // DOM 실제 값을 읽어 마지막 한글 음절 누락·중복 완벽 방지
        setLocalText(domValue);
        onCommitAndInsertAfter(item.id, domValue);
        return;
      }

      if (e.key === 'Backspace' && domValue === '') {
        e.preventDefault();
        onDeleteLine(item.id, Math.max(0, index - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        const el = e.currentTarget;
        const cursorPos = el.selectionStart ?? 0;
        const textBeforeCursor = domValue.slice(0, cursorPos);
        if (!textBeforeCursor.includes('\n') && index > 0) {
          e.preventDefault();
          onChangeText(item.id, domValue);
          onMoveFocus(index - 1);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        const el = e.currentTarget;
        const cursorPos = el.selectionStart ?? 0;
        const textAfterCursor = domValue.slice(cursorPos);
        if (!textAfterCursor.includes('\n') && index < totalCount - 1) {
          e.preventDefault();
          onChangeText(item.id, domValue);
          onMoveFocus(index + 1);
        }
        return;
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pasted = e.clipboardData.getData('text/plain');
      if (pasted && /\r?\n/.test(pasted)) {
        const rawLines = pasted
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        if (rawLines.length > 1) {
          e.preventDefault();
          onPasteMultiLines(item.id, e.currentTarget.value, rawLines);
        }
      }
    };

    return (
      <div className="note-lined-row group py-2.5 px-2 sm:px-3 flex flex-col gap-1.5">
        <div className="flex items-start gap-2 sm:gap-2.5">
          <div className="flex items-center gap-1.5 pt-1 shrink-0">
            <button
              type="button"
              onClick={() => onToggleDone(item.id)}
              title={isDone ? '완료 해제 (할 일로 변경)' : '완료 체크'}
              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                isDone
                  ? 'bg-[var(--accent-sage)] border-[var(--accent-sage)] text-white'
                  : 'bg-[var(--bg-card)] border-[var(--border-strong)] hover:border-[var(--accent-sage)]'
              }`}
            >
              {isDone && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
            </button>

            {currentKind === 'event' && !isDone && (
              <span
                className="text-xs font-bold text-[var(--accent-rose)] select-none"
                title="일정 ○"
              >
                ○
              </span>
            )}
            {currentKind === 'note' && !isDone && (
              <span
                className="text-xs font-bold text-[var(--text-muted)] select-none"
                title="메모 –"
              >
                –
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {item.from && (
              <div className="inline-flex items-center gap-1 text-[11px] font-mono-num text-[var(--accent-rose)] mb-0.5">
                <CornerDownRight className="w-3 h-3" />
                <span>{formatShortMonthDay(item.from)}부터 이월</span>
              </div>
            )}

            <textarea
              ref={(el) => {
                textareaRef.current = el;
                registerInputRef(index, el);
              }}
              rows={1}
              value={localText}
              placeholder={
                currentKind === 'event'
                  ? '일정을 입력하세요 (Enter: 다음 줄, Shift+Enter: 줄바꿈)'
                  : currentKind === 'note'
                    ? '참고 메모를 입력하세요'
                    : '할 일을 한 줄로 기록하세요 (Enter: 다음 줄, 여러 줄 붙여넣기 지원)'
              }
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={(e) => {
                isComposingRef.current = false;
                const val = e.currentTarget.value;
                setLocalText(val);
                onChangeText(item.id, val);
              }}
              onChange={(e) => {
                const val = e.target.value;
                setLocalText(val);
                if (!isComposingRef.current) {
                  onChangeText(item.id, val);
                }
              }}
              onBlur={(e) => {
                const val = e.currentTarget.value;
                if (val !== item.text) {
                  setLocalText(val);
                  onChangeText(item.id, val);
                }
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              className={`w-full resize-none bg-transparent border-0 outline-none text-[15px] leading-relaxed p-0 break-words ${
                isDone
                  ? 'line-through text-[var(--text-muted)]'
                  : 'text-[var(--text-main)]'
              } placeholder:text-[var(--text-subtle)]`}
            />
          </div>

          <div className="flex items-center gap-1 pt-0.5 shrink-0">
            {isDone && item.doneDate && (
              <span
                className="font-mono-num text-xs text-[var(--accent-sage)] font-medium px-1"
                title={`완료일: ${item.doneDate}`}
              >
                완료 {formatShortMonthDay(item.doneDate)}
              </span>
            )}

            <button
              type="button"
              onClick={() => onToggleStar(item.id)}
              title={item.star ? '중요 표시 해제' : '★ 중요 표시 (보고서 상단 정렬)'}
              className={`p-1 rounded transition-colors cursor-pointer ${
                item.star
                  ? 'text-[var(--accent-rose)]'
                  : 'text-[var(--text-subtle)] hover:text-[var(--accent-rose)]'
              }`}
            >
              <Star
                className="w-4 h-4"
                fill={item.star ? 'currentColor' : 'none'}
              />
            </button>

            <button
              type="button"
              onClick={() => onDeleteLine(item.id, Math.max(0, index - 1))}
              title="이 줄 삭제"
              className="p-1 rounded text-[var(--text-subtle)] hover:text-[var(--danger-red)] opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-7 text-xs">
          <div className="inline-flex items-center rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-0.5">
            <button
              type="button"
              onClick={() => onChangeKind(item.id, 'task')}
              className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer whitespace-nowrap ${
                currentKind === 'task'
                  ? 'bg-[var(--bg-sub)] text-[var(--text-main)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              할 일
            </button>
            <button
              type="button"
              onClick={() => onChangeKind(item.id, 'event')}
              className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer whitespace-nowrap ${
                currentKind === 'event'
                  ? 'bg-[var(--accent-rose-soft)] text-[var(--accent-rose)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              일정 ○
            </button>
            <button
              type="button"
              onClick={() => onChangeKind(item.id, 'note')}
              className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer whitespace-nowrap ${
                currentKind === 'note'
                  ? 'bg-[var(--bg-sub)] text-[var(--text-main)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              메모 –
            </button>
          </div>

          <div ref={taskContainerRef} className="relative flex-1 min-w-[160px] max-w-xs">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] focus-within:border-[var(--accent-rose)]">
              <Tag className="w-3 h-3 text-[var(--text-subtle)] shrink-0" />
              <input
                type="text"
                value={localTask}
                placeholder="과제명 태그 (클릭하여 선택·입력)"
                onFocus={() => setShowTaskDropdown(true)}
                onCompositionStart={() => {
                  isTaskComposingRef.current = true;
                }}
                onCompositionEnd={(e) => {
                  isTaskComposingRef.current = false;
                  const val = e.currentTarget.value;
                  setLocalTask(val);
                  onChangeTaskTag(item.id, val);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalTask(val);
                  setShowTaskDropdown(true);
                  if (!isTaskComposingRef.current) {
                    onChangeTaskTag(item.id, val);
                  }
                }}
                onBlur={(e) => {
                  const val = e.currentTarget.value;
                  if (val !== (item.task || '')) {
                    setLocalTask(val);
                    onChangeTaskTag(item.id, val);
                  }
                }}
                className="w-full bg-transparent border-0 outline-none text-xs text-[var(--text-main)] placeholder:text-[var(--text-subtle)]"
              />
              {localTask && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalTask('');
                    onChangeTaskTag(item.id, '');
                  }}
                  className="text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-main)] cursor-pointer"
                  title="과제명 지우기"
                >
                  ✕
                </button>
              )}
            </div>

            {showTaskDropdown && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-1 z-20 w-full max-h-44 overflow-y-auto rounded border border-[var(--border-strong)] bg-[var(--bg-card)] shadow-md py-1">
                <div className="px-2.5 py-1 text-[10px] text-[var(--text-subtle)] border-b border-[var(--border-color)]">
                  용역 과제 · 최근 사용 과제명
                </div>
                {filteredSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setLocalTask(sug);
                      onChangeTaskTag(item.id, sug);
                      setShowTaskDropdown(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-[var(--text-main)] hover:bg-[var(--bg-sub)] truncate cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export const DailyLogView: React.FC<DailyLogViewProps> = ({
  data,
  logs,
  projectNames,
  selectedDate,
  onSelectDate,
  onUpdateLogs,
  onRolloverToDate,
  onJumpToReport,
  showToast,
}) => {
  const today = getTodayYMD();
  const parsedSel = parseDateYMD(selectedDate);

  // 보기 전환: 데일리 | 위클리 | 먼슬리
  const [viewMode, setViewMode] = useState<LogViewMode>('daily');

  const [calYear, setCalYear] = useState(parsedSel.year);
  const [calMonth, setCalMonth] = useState(parsedSel.month);
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);

  // 위클리 빠른 추가 상태
  const [weeklyQuickInputs, setWeeklyQuickInputs] = useState<
    Record<string, string>
  >({});

  // 먼슬리 하단 "날짜 없는 이달 할 일" 입력 상태
  const [newMonthlyTaskText, setNewMonthlyTaskText] = useState('');
  const [newMonthlyTaskTag, setNewMonthlyTaskTag] = useState('');
  const [newMonthlyTaskStar, setNewMonthlyTaskStar] = useState(false);

  // 먼슬리 하단 "기간 모아보기" 상태
  const [summaryYear, setSummaryYear] = useState<number>(parsedSel.year);
  const [summaryPreset, setSummaryPreset] = useState<PeriodPreset>('q4');
  const [customStartDate, setCustomStartDate] = useState<string>(
    `${parsedSel.year}-10-01`
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    `${parsedSel.year}-12-31`
  );

  const inputRefs = useRef<Map<number, HTMLTextAreaElement | null>>(new Map());

  useEffect(() => {
    const { year, month } = parseDateYMD(selectedDate);
    setCalYear(year);
    setCalMonth(month);
  }, [selectedDate]);

  const weekBadge = useMemo(
    () => getDateWeekBadge(selectedDate),
    [selectedDate]
  );

  const dayLogs = useMemo(() => {
    return logs
      .filter((l) => l.date === selectedDate)
      .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  }, [logs, selectedDate]);

  useEffect(() => {
    const hasAny = logs.some((l) => l.date === selectedDate);
    if (!hasAny) {
      const now = Date.now();
      const newLine: LogItem = {
        id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
        date: selectedDate,
        month: selectedDate.slice(0, 7),
        bullet: 'task',
        star: false,
        task: '',
        text: '',
        pos: 1,
        createdAt: now,
        updatedAt: now,
      };
      onUpdateLogs((prev) => {
        if (prev.some((l) => l.date === selectedDate)) return prev;
        return [...prev, newLine];
      });
    }
  }, [selectedDate, logs, onUpdateLogs]);

  const taskSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const p of projectNames) {
      if (p.trim()) set.add(p.trim());
    }
    const sortedRecent = [...logs]
      .filter((l) => l.task && l.task.trim())
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    for (const l of sortedRecent) {
      set.add(l.task.trim());
    }
    return Array.from(set);
  }, [projectNames, logs]);

  const datesWithRecords = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      if (l.date && l.text && l.text.trim().length > 0) {
        set.add(l.date);
      }
    }
    return set;
  }, [logs]);

  const pastIncompleteCount = useMemo(() => {
    return logs.filter(
      (l) =>
        Boolean(l.date) &&
        l.date < selectedDate &&
        l.bullet === 'task' &&
        !l.doneDate &&
        l.text.trim().length > 0
    ).length;
  }, [logs, selectedDate]);

  const registerInputRef = useCallback(
    (index: number, el: HTMLTextAreaElement | null) => {
      if (el) {
        inputRefs.current.set(index, el);
      } else {
        inputRefs.current.delete(index);
      }
    },
    []
  );

  const handleMoveFocus = useCallback((targetIndex: number) => {
    const el = inputRefs.current.get(targetIndex);
    if (el) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, []);

  const handleChangeText = useCallback(
    (id: string, text: string) => {
      const now = Date.now();
      onUpdateLogs((prev) =>
        prev.map((l) => (l.id === id ? { ...l, text, updatedAt: now } : l))
      );
    },
    [onUpdateLogs]
  );

  const handleToggleDone = useCallback(
    (id: string, doneDateOverride?: string) => {
      const now = Date.now();
      onUpdateLogs((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const currentlyDone = l.bullet === 'done' || Boolean(l.doneDate);
          if (currentlyDone) {
            return {
              ...l,
              bullet: 'task',
              doneDate: undefined,
              updatedAt: now,
            };
          } else {
            return {
              ...l,
              bullet: 'done',
              doneDate: doneDateOverride || l.date || selectedDate || today,
              updatedAt: now,
            };
          }
        })
      );
    },
    [onUpdateLogs, selectedDate, today]
  );

  const handleToggleStar = useCallback(
    (id: string) => {
      const now = Date.now();
      onUpdateLogs((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, star: !l.star, updatedAt: now } : l
        )
      );
    },
    [onUpdateLogs]
  );

  const handleChangeKind = useCallback(
    (id: string, kind: 'task' | 'event' | 'note') => {
      const now = Date.now();
      onUpdateLogs((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const bullet: LogBulletType = kind;
          return {
            ...l,
            bullet,
            doneDate: undefined,
            updatedAt: now,
          };
        })
      );
    },
    [onUpdateLogs]
  );

  const handleChangeTaskTag = useCallback(
    (id: string, taskName: string) => {
      const now = Date.now();
      onUpdateLogs((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, task: taskName, updatedAt: now } : l
        )
      );
    },
    [onUpdateLogs]
  );

  // 현재 줄의 최신 텍스트를 확정하면서 동시에 다음 줄을 삽입 (한글 빠른 입력 후 Enter 시 마지막 음절 보호)
  const handleCommitAndInsertAfter = useCallback(
    (afterId: string, committedText: string, newLineInitialText = '') => {
      const now = Date.now();
      const newId = `log-${now}-${Math.random().toString(36).slice(2, 6)}`;

      onUpdateLogs((prev) => {
        const currentDayItems = prev
          .filter((l) => l.date === selectedDate)
          .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
          .map((l) =>
            l.id === afterId ? { ...l, text: committedText, updatedAt: now } : l
          );

        const targetIdx = currentDayItems.findIndex((l) => l.id === afterId);
        const refItem = currentDayItems[targetIdx];

        const newItem: LogItem = {
          id: newId,
          date: selectedDate,
          month: selectedDate.slice(0, 7),
          bullet: 'task',
          star: false,
          task: refItem?.task || '',
          text: newLineInitialText,
          pos: (targetIdx >= 0 ? targetIdx + 1 : currentDayItems.length) + 0.5,
          createdAt: now,
          updatedAt: now,
        };

        const mergedDay = [...currentDayItems];
        if (targetIdx >= 0) {
          mergedDay.splice(targetIdx + 1, 0, newItem);
        } else {
          mergedDay.push(newItem);
        }

        const reindexedDay = mergedDay.map((item, idx) => ({
          ...item,
          pos: idx + 1,
        }));

        const otherDays = prev.filter((l) => l.date !== selectedDate);
        return [...otherDays, ...reindexedDay];
      });

      setAutoFocusId(newId);
    },
    [onUpdateLogs, selectedDate]
  );

  const handlePasteMultiLines = useCallback(
    (targetId: string, currentText: string, lines: string[]) => {
      if (lines.length === 0) return;
      const now = Date.now();
      let lastCreatedId = targetId;

      onUpdateLogs((prev) => {
        const currentDayItems = prev
          .filter((l) => l.date === selectedDate)
          .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
        const targetIdx = currentDayItems.findIndex((l) => l.id === targetId);
        if (targetIdx < 0) return prev;

        const targetItem = currentDayItems[targetIdx];
        const firstLineText = currentText
          ? `${currentText} ${lines[0]}`
          : lines[0];

        const updatedFirst: LogItem = {
          ...targetItem,
          text: firstLineText,
          updatedAt: now,
        };

        const extraItems: LogItem[] = lines.slice(1).map((lineText, i) => {
          const id = `log-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`;
          lastCreatedId = id;
          return {
            id,
            date: selectedDate,
            month: selectedDate.slice(0, 7),
            bullet: 'task',
            star: false,
            task: targetItem.task || '',
            text: lineText,
            pos: targetIdx + 2 + i,
            createdAt: now + i,
            updatedAt: now + i,
          };
        });

        const nextDayItems = [...currentDayItems];
        nextDayItems.splice(targetIdx, 1, updatedFirst, ...extraItems);
        const reindexedDay = nextDayItems.map((it, idx) => ({
          ...it,
          pos: idx + 1,
        }));

        const otherDays = prev.filter((l) => l.date !== selectedDate);
        return [...otherDays, ...reindexedDay];
      });

      setAutoFocusId(lastCreatedId);
      showToast(`${lines.length}개의 줄로 나누어 붙여넣었습니다.`);
    },
    [onUpdateLogs, selectedDate, showToast]
  );

  const handleDeleteLine = useCallback(
    (id: string, focusIndex: number) => {
      const now = Date.now();
      onUpdateLogs((prev) => {
        const currentDayItems = prev
          .filter((l) => l.date === selectedDate)
          .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));

        if (currentDayItems.length <= 1) {
          return prev.map((l) =>
            l.id === id
              ? {
                  ...l,
                  text: '',
                  task: '',
                  star: false,
                  bullet: 'task',
                  doneDate: undefined,
                  from: undefined,
                  updatedAt: now,
                }
              : l
          );
        }

        return prev.filter((l) => l.id !== id);
      });

      setTimeout(() => {
        handleMoveFocus(focusIndex);
      }, 10);
    },
    [onUpdateLogs, selectedDate, handleMoveFocus]
  );

  // 달력 셀 계산 (작은 월 달력 & 먼슬리 큰 달력 공용)
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const cells: Array<{ day: number | null; dateStr: string }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, dateStr: '' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        dateStr: `${calYear}-${pad2(calMonth)}-${pad2(d)}`,
      });
    }
    return cells;
  }, [calYear, calMonth]);

  // 위클리 (월~일 7일) 데이터 계산
  const weeklyData = useMemo(() => {
    const monday = getMondayOfWeek(selectedDate);
    const days = Array.from({ length: 7 }, (_, idx) => {
      const dateStr = addDays(monday, idx);
      const items = logs
        .filter((l) => l.date === dateStr && l.text.trim().length > 0)
        .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
      return {
        dateStr,
        dayName: getDayOfWeekKo(dateStr),
        items,
      };
    });

    let totalActionable = 0;
    let doneActionable = 0;
    for (const d of days) {
      for (const it of d.items) {
        if (it.bullet !== 'note') {
          totalActionable++;
          if (it.bullet === 'done' || Boolean(it.doneDate)) {
            doneActionable++;
          }
        }
      }
    }

    const completionRate =
      totalActionable > 0
        ? Math.round((doneActionable / totalActionable) * 100)
        : 0;

    return {
      monday,
      sunday: addDays(monday, 6),
      days,
      totalActionable,
      doneActionable,
      completionRate,
    };
  }, [selectedDate, logs]);

  // 먼슬리: 날짜별 기록 맵
  const monthlyDayLogsMap = useMemo(() => {
    const map = new Map<string, LogItem[]>();
    const prefix = `${calYear}-${pad2(calMonth)}-`;
    for (const l of logs) {
      if (l.date && l.date.startsWith(prefix) && l.text.trim().length > 0) {
        const arr = map.get(l.date) || [];
        arr.push(l);
        map.set(l.date, arr);
      }
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
      map.set(k, arr);
    }
    return map;
  }, [logs, calYear, calMonth]);

  // 먼슬리 아래: "날짜 없는 이달 할 일" 목록 (date === '' && month === 'YYYY-MM')
  const currentMonthKey = `${calYear}-${pad2(calMonth)}`;
  const undatedMonthlyTasks = useMemo(() => {
    return logs
      .filter((l) => !l.date && l.month === currentMonthKey)
      .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  }, [logs, currentMonthKey]);

  const nextMonthInfo = useMemo(
    () => getNextYearMonth(calYear, calMonth),
    [calYear, calMonth]
  );

  // 먼슬리 아래: "기간 모아보기" 범위 계산
  const summaryPeriodBounds = useMemo(() => {
    const y = summaryYear;
    switch (summaryPreset) {
      case 'q1':
        return {
          start: `${y}-01-01`,
          end: `${y}-03-31`,
          label: `${y}년 1분기`,
        };
      case 'q2':
        return {
          start: `${y}-04-01`,
          end: `${y}-06-30`,
          label: `${y}년 2분기`,
        };
      case 'q3':
        return {
          start: `${y}-07-01`,
          end: `${y}-09-30`,
          label: `${y}년 3분기`,
        };
      case 'q4':
        return {
          start: `${y}-10-01`,
          end: `${y}-12-31`,
          label: `${y}년 4분기`,
        };
      case 'h1':
        return {
          start: `${y}-01-01`,
          end: `${y}-06-30`,
          label: `${y}년 상반기`,
        };
      case 'h2':
        return {
          start: `${y}-07-01`,
          end: `${y}-12-31`,
          label: `${y}년 하반기`,
        };
      case 'year':
        return {
          start: `${y}-01-01`,
          end: `${y}-12-31`,
          label: `${y}년 연간`,
        };
      case 'custom':
      default:
        return {
          start: customStartDate || `${y}-01-01`,
          end: customEndDate || `${y}-12-31`,
          label: `${customStartDate} ~ ${customEndDate}`,
        };
    }
  }, [summaryYear, summaryPreset, customStartDate, customEndDate]);

  const periodSummaryResult = useMemo(() => {
    return collectPeriodSummaryData(
      data,
      summaryPeriodBounds.start,
      summaryPeriodBounds.end,
      summaryPeriodBounds.label,
      today
    );
  }, [data, summaryPeriodBounds, today]);

  const completedCount = dayLogs.filter(
    (l) => (l.bullet === 'done' || Boolean(l.doneDate)) && l.text.trim()
  ).length;
  const todoCount = dayLogs.filter(
    (l) => l.bullet !== 'done' && !l.doneDate && l.text.trim()
  ).length;

  // 위클리 빠른 줄 추가 핸들러
  const handleAddWeeklyQuickItem = (dateStr: string) => {
    const text = (weeklyQuickInputs[dateStr] || '').trim();
    if (!text) return;
    const now = Date.now();
    onUpdateLogs((prev) => {
      const existing = prev.filter((l) => l.date === dateStr);
      const newItem: LogItem = {
        id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
        date: dateStr,
        month: dateStr.slice(0, 7),
        bullet: 'task',
        star: false,
        task: '',
        text,
        pos: existing.length + 1,
        createdAt: now,
        updatedAt: now,
      };
      return [...prev, newItem];
    });
    setWeeklyQuickInputs((prev) => ({ ...prev, [dateStr]: '' }));
  };

  // 날짜 없는 이달 할 일 추가 핸들러
  const handleAddUndatedMonthlyTask = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMonthlyTaskText.trim();
    if (!text) return;
    const now = Date.now();
    const newItem: LogItem = {
      id: `log-month-${now}-${Math.random().toString(36).slice(2, 6)}`,
      date: '',
      month: currentMonthKey,
      bullet: 'task',
      star: newMonthlyTaskStar,
      task: newMonthlyTaskTag.trim(),
      text,
      pos: undatedMonthlyTasks.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    onUpdateLogs((prev) => [...prev, newItem]);
    setNewMonthlyTaskText('');
    setNewMonthlyTaskStar(false);
    showToast(`${calMonth}월 할 일에 추가되었습니다 (${calMonth}월 월간보고 계획에 반영).`);
  };

  return (
    <div className="space-y-5">
      {/* 상단 보기 전환 바: [데일리 | 위클리 | 먼슬리] */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-[var(--border-color)] bg-[var(--bg-main)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`px-3.5 py-1.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'daily'
                ? 'bg-[var(--accent-rose)] text-white font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            데일리
          </button>
          <button
            type="button"
            onClick={() => setViewMode('weekly')}
            className={`px-3.5 py-1.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'weekly'
                ? 'bg-[var(--accent-rose)] text-white font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            위클리
          </button>
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`px-3.5 py-1.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'monthly'
                ? 'bg-[var(--accent-rose)] text-white font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            먼슬리
          </button>
        </div>

        <div className="text-xs text-[var(--text-muted)] font-mono-num">
          {viewMode === 'daily' && '하루 단위 밑줄 노트 기록'}
          {viewMode === 'weekly' && '월~일 7칸 주간 카드 및 완료율 점검'}
          {viewMode === 'monthly' && '월간 종합 달력 · 이달 할 일 · 기간 모아보기'}
        </div>
      </div>

      {/* ==================== 1. 데일리 보기 ==================== */}
      {viewMode === 'daily' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-8 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 sm:p-5 flex flex-col justify-between gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-serif-kr text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-main)] font-mono-num">
                      {parsedSel.year}. {pad2(parsedSel.month)}. {pad2(parsedSel.day)}.
                    </h2>
                    <span className="text-lg sm:text-xl font-serif-kr text-[var(--text-muted)]">
                      {getDayOfWeekKo(selectedDate)}요일
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                        weekBadge.isRestWeek
                          ? 'bg-[var(--warn-amber-soft)] text-[var(--warn-amber)]'
                          : 'bg-[var(--accent-sage-soft)] text-[var(--accent-sage)]'
                      }`}
                    >
                      {weekBadge.label}
                    </span>
                    {weekBadge.subLabel && (
                      <span className="text-xs text-[var(--text-muted)] font-mono-num">
                        · {weekBadge.subLabel} (제출 {formatShortMonthDay(weekBadge.reportSpec.submitDate)})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 font-mono-num">
                    기준 월요일: {weekBadge.reportSpec.baseMonday} · 보고 제출 마감: {weekBadge.reportSpec.submitDate} (수)
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectDate(addDays(selectedDate, -1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-xs font-medium text-[var(--text-main)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    전날
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectDate(today)}
                    className={`px-3 py-1.5 rounded border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      selectedDate === today
                        ? 'bg-[var(--accent-rose)] border-[var(--accent-rose)] text-white'
                        : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-sub)]'
                    }`}
                  >
                    오늘
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectDate(addDays(selectedDate, 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-xs font-medium text-[var(--text-main)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    다음날
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMiniCalendar((v) => !v)}
                    className="lg:hidden p-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] cursor-pointer"
                    title="달력 접기/펼치기"
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-3 font-mono-num">
                  <span>완료 {completedCount}건</span>
                  <span>·</span>
                  <span>할 일·일정·메모 {todoCount}건</span>
                </div>

                {pastIncompleteCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onRolloverToDate(selectedDate)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--accent-rose-soft)] text-[var(--accent-rose)] font-medium hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    지난 미완료 할 일 {pastIncompleteCount}건 이 날짜로 이월
                  </button>
                )}
              </div>
            </div>

            {/* 작은 월 달력 */}
            <div
              className={`lg:col-span-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3.5 ${
                showMiniCalendar ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-serif-kr text-sm font-bold text-[var(--text-main)] font-mono-num">
                  {calYear}년 {calMonth}월
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (calMonth === 1) {
                        setCalYear((y) => y - 1);
                        setCalMonth(12);
                      } else {
                        setCalMonth((m) => m - 1);
                      }
                    }}
                    className="p-1 rounded hover:bg-[var(--bg-sub)] text-[var(--text-muted)] cursor-pointer"
                    title="이전 달"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (calMonth === 12) {
                        setCalYear((y) => y + 1);
                        setCalMonth(1);
                      } else {
                        setCalMonth((m) => m + 1);
                      }
                    }}
                    className="p-1 rounded hover:bg-[var(--bg-sub)] text-[var(--text-muted)] cursor-pointer"
                    title="다음 달"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 text-center text-[11px] text-[var(--text-subtle)] mb-1">
                {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                  <div key={d} className="py-0.5">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5 text-center font-mono-num text-xs">
                {calendarDays.map((cell, idx) => {
                  if (!cell.day) {
                    return <div key={`empty-${idx}`} className="h-7" />;
                  }
                  const isSelected = cell.dateStr === selectedDate;
                  const isToday = cell.dateStr === today;
                  const hasDot = datesWithRecords.has(cell.dateStr);

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => onSelectDate(cell.dateStr)}
                      className={`relative h-7 rounded flex flex-col items-center justify-center transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent-rose)] text-white font-bold'
                          : isToday
                            ? 'bg-[var(--bg-sub)] text-[var(--accent-rose)] font-bold border border-[var(--accent-rose)]'
                            : 'text-[var(--text-main)] hover:bg-[var(--bg-sub)]'
                      }`}
                    >
                      <span className="leading-none">{cell.day}</span>
                      {hasDot && (
                        <span
                          className={`w-1 h-1 rounded-full mt-0.5 ${
                            isSelected ? 'bg-white' : 'bg-[var(--accent-sage)]'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[var(--bg-sub)] border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
                  데일리 밑줄 노트
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  · Enter 다음 줄 / Shift+Enter 줄바꿈 / 빈 줄 Backspace 삭제 / ↑↓ 이동
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const lastItem = dayLogs[dayLogs.length - 1];
                  handleCommitAndInsertAfter(
                    lastItem?.id || '',
                    lastItem?.text || ''
                  );
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--accent-rose)] hover:bg-[var(--accent-rose-hover)] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                새 줄 추가
              </button>
            </div>

            <div className="divide-y divide-[var(--border-color)] px-2 sm:px-4 py-1">
              {dayLogs.map((item, idx) => (
                <NoteRow
                  key={item.id}
                  item={item}
                  index={idx}
                  totalCount={dayLogs.length}
                  taskSuggestions={taskSuggestions}
                  autoFocusId={autoFocusId}
                  onClearAutoFocus={() => setAutoFocusId(null)}
                  onChangeText={handleChangeText}
                  onToggleDone={handleToggleDone}
                  onToggleStar={handleToggleStar}
                  onChangeKind={handleChangeKind}
                  onChangeTaskTag={handleChangeTaskTag}
                  onCommitAndInsertAfter={handleCommitAndInsertAfter}
                  onPasteMultiLines={handlePasteMultiLines}
                  onDeleteLine={handleDeleteLine}
                  onMoveFocus={handleMoveFocus}
                  registerInputRef={registerInputRef}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ==================== 2. 위클리 보기 ==================== */}
      {viewMode === 'weekly' && (
        <div className="space-y-4">
          {/* 위클리 상단: "2026년 10월 2주차", 주간 완료율 막대, 지난주·다음주 이동 */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-serif-kr text-xl sm:text-2xl font-bold text-[var(--text-main)]">
                    {weekBadge.isRestWeek
                      ? `${parseDateYMD(weeklyData.monday).year}년 ${weekBadge.label}`
                      : `${weekBadge.targetYear}년 ${weekBadge.targetMonth}월 ${weekBadge.targetWeek}주차`}
                  </h2>
                  {weekBadge.subLabel && (
                    <span className="px-2 py-0.5 rounded bg-[var(--warn-amber-soft)] text-[var(--warn-amber)] text-xs font-semibold">
                      {weekBadge.subLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] font-mono-num mt-1">
                  주간 범위: {weeklyData.monday} (월) ~ {weeklyData.sunday} (일) · 제출 마감일: {weekBadge.reportSpec.submitDate} (수)
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectDate(addDays(selectedDate, -7))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-xs font-medium text-[var(--text-main)] cursor-pointer whitespace-nowrap"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  지난주
                </button>
                <button
                  type="button"
                  onClick={() => onSelectDate(today)}
                  className="px-3 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-xs font-semibold text-[var(--text-main)] cursor-pointer whitespace-nowrap"
                >
                  이번주
                </button>
                <button
                  type="button"
                  onClick={() => onSelectDate(addDays(selectedDate, 7))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-xs font-medium text-[var(--text-main)] cursor-pointer whitespace-nowrap"
                >
                  다음주
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 주간 완료율 막대 */}
            <div className="pt-2 border-t border-[var(--border-color)] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] font-medium">
                  주간 완료율 (완료 {weeklyData.doneActionable}건 / 전체 {weeklyData.totalActionable}건)
                </span>
                <span className="font-mono-num font-bold text-[var(--accent-sage)]">
                  {weeklyData.completionRate}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[var(--bg-sub)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-sage)] transition-all duration-200"
                  style={{ width: `${weeklyData.completionRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* 월~일 7칸 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
            {weeklyData.days.map((dayObj) => {
              const isToday = dayObj.dateStr === today;
              const isSelected = dayObj.dateStr === selectedDate;
              const doneInDay = dayObj.items.filter(
                (i) => i.bullet === 'done' || Boolean(i.doneDate)
              ).length;

              return (
                <div
                  key={dayObj.dateStr}
                  className={`bg-[var(--bg-card)] rounded-lg border flex flex-col justify-between min-h-[230px] ${
                    isToday
                      ? 'border-[var(--accent-rose)]'
                      : isSelected
                        ? 'border-[var(--border-strong)]'
                        : 'border-[var(--border-color)]'
                  }`}
                >
                  <div>
                    {/* 요일 카드 헤더 */}
                    <div
                      onClick={() => {
                        onSelectDate(dayObj.dateStr);
                        setViewMode('daily');
                      }}
                      className={`px-3 py-2 border-b border-[var(--border-color)] flex items-center justify-between cursor-pointer ${
                        isToday ? 'bg-[var(--accent-rose-soft)]' : 'bg-[var(--bg-sub)]'
                      }`}
                      title="클릭하여 이 날의 데일리 노트로 이동"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-bold ${
                            dayObj.dayName === '일'
                              ? 'text-[var(--danger-red)]'
                              : 'text-[var(--text-main)]'
                          }`}
                        >
                          {dayObj.dayName}
                        </span>
                        <span className="font-mono-num text-xs text-[var(--text-muted)]">
                          {formatShortMonthDay(dayObj.dateStr)}
                        </span>
                      </div>
                      <span className="font-mono-num text-[11px] text-[var(--accent-sage)]">
                        {dayObj.items.length > 0
                          ? `${doneInDay}/${dayObj.items.length}`
                          : ''}
                      </span>
                    </div>

                    {/* 그날의 기록 목록 (체크 가능) */}
                    <div className="p-2.5 space-y-2">
                      {dayObj.items.length === 0 ? (
                        <p className="text-[11px] text-[var(--text-subtle)] py-4 text-center">
                          기록 없음
                        </p>
                      ) : (
                        dayObj.items.map((it) => {
                          const isDone =
                            it.bullet === 'done' || Boolean(it.doneDate);
                          return (
                            <div
                              key={it.id}
                              className="flex items-start gap-1.5 text-xs group"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleDone(it.id, dayObj.dateStr)
                                }
                                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                                  isDone
                                    ? 'bg-[var(--accent-sage)] border-[var(--accent-sage)] text-white'
                                    : 'bg-[var(--bg-card)] border-[var(--border-strong)] hover:border-[var(--accent-sage)]'
                                }`}
                                title={isDone ? '완료 해제' : '완료 체크'}
                              >
                                {isDone && (
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                )}
                              </button>
                              <div className="min-w-0 flex-1 leading-snug">
                                {it.task && (
                                  <span className="block text-[10px] text-[var(--accent-rose)] font-medium truncate">
                                    [{it.task}]
                                  </span>
                                )}
                                <span
                                  className={`break-words ${
                                    isDone
                                      ? 'line-through text-[var(--text-muted)]'
                                      : 'text-[var(--text-main)]'
                                  }`}
                                >
                                  {it.bullet === 'event' && !isDone && '○ '}
                                  {it.bullet === 'note' && !isDone && '– '}
                                  {it.star && '★ '}
                                  {it.text}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 카드 하단 빠른 추가 입력 */}
                  <div className="p-2 border-t border-[var(--border-color)] flex items-center gap-1">
                    <input
                      type="text"
                      value={weeklyQuickInputs[dayObj.dateStr] || ''}
                      onChange={(e) =>
                        setWeeklyQuickInputs((prev) => ({
                          ...prev,
                          [dayObj.dateStr]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (
                          e.nativeEvent.isComposing ||
                          e.keyCode === 229
                        ) {
                          return;
                        }
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddWeeklyQuickItem(dayObj.dateStr);
                        }
                      }}
                      placeholder="+ 할 일 입력"
                      className="w-full bg-transparent text-[11px] text-[var(--text-main)] placeholder:text-[var(--text-subtle)] outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== 3. 먼슬리 보기 ==================== */}
      {viewMode === 'monthly' && (
        <div className="space-y-5">
          {/* 먼슬리 상단: 월 이동 및 바로가기 */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-serif-kr text-xl sm:text-2xl font-bold text-[var(--text-main)] font-mono-num">
                {calYear}년 {calMonth}월
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                · 날짜 칸을 누르면 그 날 데일리 노트로 이동합니다
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (calMonth === 1) {
                    setCalYear((y) => y - 1);
                    setCalMonth(12);
                  } else {
                    setCalMonth((m) => m - 1);
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-xs font-medium text-[var(--text-main)] cursor-pointer whitespace-nowrap"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                이전 달
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = parseDateYMD(today);
                  setCalYear(t.year);
                  setCalMonth(t.month);
                }}
                className="px-3 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-xs font-semibold text-[var(--text-main)] cursor-pointer whitespace-nowrap"
              >
                이번 달
              </button>
              <button
                type="button"
                onClick={() => {
                  if (calMonth === 12) {
                    setCalYear((y) => y + 1);
                    setCalMonth(1);
                  } else {
                    setCalMonth((m) => m + 1);
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] hover:bg-[var(--bg-sub)] text-xs font-medium text-[var(--text-main)] cursor-pointer whitespace-nowrap"
              >
                다음 달
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 큰 달력 (날짜 칸마다 최대 4줄 요약: ✓ 완료, □ 할 일, ○ 일정, "완료/전체" 숫자, 넘치면 "+N개 더") */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 bg-[var(--bg-sub)] border-b border-[var(--border-color)] text-center text-xs font-semibold text-[var(--text-muted)]">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div
                  key={d}
                  className={`py-2 ${
                    i === 0 ? 'text-[var(--danger-red)]' : ''
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border-color)] border-t border-[var(--border-color)]">
              {calendarDays.map((cell, idx) => {
                if (!cell.day) {
                  return (
                    <div
                      key={`empty-month-${idx}`}
                      className="min-h-[96px] sm:min-h-[120px] bg-[var(--bg-main)]/50"
                    />
                  );
                }

                const dayItems = monthlyDayLogsMap.get(cell.dateStr) || [];
                const doneItemsCount = dayItems.filter(
                  (i) => i.bullet === 'done' || Boolean(i.doneDate)
                ).length;
                const visibleItems = dayItems.slice(0, 4);
                const overflowCount = Math.max(0, dayItems.length - 4);
                const isToday = cell.dateStr === today;
                const isSelected = cell.dateStr === selectedDate;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => {
                      onSelectDate(cell.dateStr);
                      setViewMode('daily');
                    }}
                    className={`min-h-[96px] sm:min-h-[120px] p-1.5 sm:p-2 text-left flex flex-col justify-between transition-colors cursor-pointer hover:bg-[var(--bg-sub)] ${
                      isToday
                        ? 'bg-[var(--accent-rose-soft)]/35'
                        : isSelected
                          ? 'bg-[var(--bg-sub)]'
                          : 'bg-[var(--bg-card)]'
                    }`}
                  >
                    <div className="w-full">
                      {/* 날짜 숫자 & 완료/전체 숫자 */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`font-mono-num text-xs font-bold ${
                            isToday
                              ? 'px-1.5 py-0.5 rounded bg-[var(--accent-rose)] text-white'
                              : 'text-[var(--text-main)]'
                          }`}
                        >
                          {cell.day}
                        </span>
                        {dayItems.length > 0 && (
                          <span className="font-mono-num text-[10px] text-[var(--accent-sage)] font-semibold">
                            {doneItemsCount}/{dayItems.length}
                          </span>
                        )}
                      </div>

                      {/* 최대 4줄 요약 (✓ 완료, □ 할 일, ○ 일정) */}
                      <div className="space-y-0.5">
                        {visibleItems.map((it) => {
                          const isDone =
                            it.bullet === 'done' || Boolean(it.doneDate);
                          const prefix = isDone
                            ? '✓'
                            : it.bullet === 'event'
                              ? '○'
                              : it.bullet === 'note'
                                ? '–'
                                : '□';
                          return (
                            <div
                              key={it.id}
                              className={`text-[10px] sm:text-[11px] leading-tight truncate ${
                                isDone
                                  ? 'text-[var(--accent-sage)] line-through'
                                  : it.bullet === 'event'
                                    ? 'text-[var(--accent-rose)] font-medium'
                                    : 'text-[var(--text-main)]'
                              }`}
                            >
                              <span className="mr-0.5">{prefix}</span>
                              {it.text}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {overflowCount > 0 && (
                      <div className="text-[10px] font-mono-num text-[var(--text-muted)] font-semibold pt-1">
                        +{overflowCount}개 더
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 먼슬리 아래 1: "날짜 없는 이달 할 일" 입력란 (월간보고 계획으로 모임) + 월간보고 바로가기 버튼 */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="font-serif-kr text-sm sm:text-base font-bold text-[var(--text-main)]">
                  날짜 없는 이달({calMonth}월) 할 일
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  특정 날짜가 정해지지 않은 {calMonth}월 중 추진할 업무를 적어두면{' '}
                  <strong>{calMonth}월 월간보고(1주차) 추진계획</strong>으로 자동 수집됩니다.
                </p>
              </div>

              {/* 월간보고 바로가기 버튼 2개 */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    onJumpToReport(
                      nextMonthInfo.year,
                      nextMonthInfo.month,
                      1
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[var(--accent-rose)] hover:bg-[var(--accent-rose-hover)] text-white font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>
                    → {nextMonthInfo.month}월 월간보고({calMonth}월 실적)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onJumpToReport(calYear, calMonth, 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-white font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>
                    → {calMonth}월 월간보고({calMonth}월 계획)
                  </span>
                </button>
              </div>
            </div>

            {/* 입력 폼 */}
            <form
              onSubmit={handleAddUndatedMonthlyTask}
              className="flex flex-wrap items-center gap-2 text-xs"
            >
              <input
                type="text"
                value={newMonthlyTaskTag}
                onChange={(e) => setNewMonthlyTaskTag(e.target.value)}
                list="monthly-task-suggestions"
                placeholder="과제명 태그 (선택)"
                className="w-44 px-2.5 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[var(--accent-rose)]"
              />
              <datalist id="monthly-task-suggestions">
                {taskSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>

              <input
                type="text"
                value={newMonthlyTaskText}
                onChange={(e) => setNewMonthlyTaskText(e.target.value)}
                placeholder={`날짜 없는 ${calMonth}월 할 일을 입력하고 Enter 또는 추가를 누르세요`}
                className="flex-1 min-w-[200px] px-3 py-2 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none focus:border-[var(--accent-rose)]"
              />

              <button
                type="button"
                onClick={() => setNewMonthlyTaskStar((v) => !v)}
                className={`px-2.5 py-2 rounded border flex items-center gap-1 cursor-pointer ${
                  newMonthlyTaskStar
                    ? 'bg-[var(--accent-rose-soft)] border-[var(--accent-rose)] text-[var(--accent-rose)] font-semibold'
                    : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-muted)]'
                }`}
              >
                <Star
                  className="w-3.5 h-3.5"
                  fill={newMonthlyTaskStar ? 'currentColor' : 'none'}
                />
                중요
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded bg-[var(--accent-rose)] hover:bg-[var(--accent-rose-hover)] text-white font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                이달 할 일 추가
              </button>
            </form>

            {/* 날짜 없는 이달 할 일 목록 */}
            <div className="divide-y divide-[var(--border-color)]">
              {undatedMonthlyTasks.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-3 text-center">
                  등록된 날짜 없는 {calMonth}월 할 일이 없습니다.
                </p>
              ) : (
                undatedMonthlyTasks.map((item) => {
                  const isDone =
                    item.bullet === 'done' || Boolean(item.doneDate);
                  return (
                    <div
                      key={item.id}
                      className="py-2 px-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleDone(item.id, today)}
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                            isDone
                              ? 'bg-[var(--accent-sage)] border-[var(--accent-sage)] text-white'
                              : 'bg-[var(--bg-card)] border-[var(--border-strong)]'
                          }`}
                        >
                          {isDone && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </button>
                        {item.task && (
                          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-sub)] text-[var(--accent-rose)] font-semibold shrink-0">
                            {item.task}
                          </span>
                        )}
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) =>
                            handleChangeText(item.id, e.target.value)
                          }
                          className={`w-full bg-transparent border-0 outline-none ${
                            isDone
                              ? 'line-through text-[var(--text-muted)]'
                              : 'text-[var(--text-main)]'
                          }`}
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleStar(item.id)}
                          className={`p-1 cursor-pointer ${
                            item.star
                              ? 'text-[var(--accent-rose)]'
                              : 'text-[var(--text-subtle)]'
                          }`}
                        >
                          <Star
                            className="w-3.5 h-3.5"
                            fill={item.star ? 'currentColor' : 'none'}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateLogs((prev) =>
                              prev.filter((l) => l.id !== item.id)
                            )
                          }
                          className="p-1 text-[var(--text-subtle)] hover:text-[var(--danger-red)] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 먼슬리 아래 2: "기간 모아보기" 카드 (1분기~4분기, 상·하반기, 연간, 직접지정) */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--accent-rose)]" />
                <div>
                  <h3 className="font-serif-kr text-sm sm:text-base font-bold text-[var(--text-main)]">
                    기간 모아보기 (분기·반기·연간·직접지정)
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    일정(○)은 오늘({today}) 기준으로 지난 것은 실적, 다가올 것은 계획으로 자동 분류됩니다.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      periodSummaryResult.plainText
                    );
                    showToast(
                      `${summaryPeriodBounds.label} 실적·계획 텍스트를 복사했습니다.`
                    );
                  } catch {
                    showToast('복사에 실패했습니다.');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[var(--accent-rose)] hover:bg-[var(--accent-rose-hover)] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                실적·계획 텍스트 복사
              </button>
            </div>

            {/* 연도 + [1분기 2분기 3분기 4분기 상반기 하반기 연간 직접지정] */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={summaryYear}
                onChange={(e) => setSummaryYear(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] font-mono-num font-semibold text-[var(--text-main)] outline-none"
              >
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap items-center gap-1 rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-1">
                {(
                  [
                    { id: 'q1', label: '1분기' },
                    { id: 'q2', label: '2분기' },
                    { id: 'q3', label: '3분기' },
                    { id: 'q4', label: '4분기' },
                    { id: 'h1', label: '상반기' },
                    { id: 'h2', label: '하반기' },
                    { id: 'year', label: '연간' },
                    { id: 'custom', label: '직접지정' },
                  ] as const
                ).map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setSummaryPreset(btn.id)}
                    className={`px-2.5 py-1 rounded-sm cursor-pointer whitespace-nowrap ${
                      summaryPreset === btn.id
                        ? 'bg-[var(--accent-rose)] text-white font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {summaryPreset === 'custom' && (
                <div className="flex items-center gap-1.5 font-mono-num">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)]"
                  />
                  <span>~</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)]"
                  />
                </div>
              )}
            </div>

            {/* 4대 통계: 실적 건수, 과제 수, 기록한 날 수, 계획 건수 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded border border-[var(--border-color)] bg-[var(--bg-main)]">
                <span className="text-xs text-[var(--text-muted)] block">
                  실적 건수
                </span>
                <span className="font-mono-num text-xl font-bold text-[var(--accent-sage)] mt-0.5 block">
                  {periodSummaryResult.perfCount}건
                </span>
              </div>
              <div className="p-3 rounded border border-[var(--border-color)] bg-[var(--bg-main)]">
                <span className="text-xs text-[var(--text-muted)] block">
                  과제 수
                </span>
                <span className="font-mono-num text-xl font-bold text-[var(--text-main)] mt-0.5 block">
                  {periodSummaryResult.taskCount}개
                </span>
              </div>
              <div className="p-3 rounded border border-[var(--border-color)] bg-[var(--bg-main)]">
                <span className="text-xs text-[var(--text-muted)] block">
                  기록한 날 수
                </span>
                <span className="font-mono-num text-xl font-bold text-[var(--text-main)] mt-0.5 block">
                  {periodSummaryResult.recordedDaysCount}일
                </span>
              </div>
              <div className="p-3 rounded border border-[var(--border-color)] bg-[var(--bg-main)]">
                <span className="text-xs text-[var(--text-muted)] block">
                  계획 건수
                </span>
                <span className="font-mono-num text-xl font-bold text-[var(--accent-rose)] mt-0.5 block">
                  {periodSummaryResult.planCount}건
                </span>
              </div>
            </div>

            {/* □ ① ㅇ 형식 실적·계획 생성 텍스트 */}
            <pre className="w-full max-h-[340px] overflow-y-auto p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] text-xs leading-relaxed text-[var(--text-main)] whitespace-pre-wrap font-sans">
              {periodSummaryResult.plainText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
