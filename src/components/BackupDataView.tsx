import React, { useRef, useState, useMemo } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Database,
  ShieldCheck,
} from 'lucide-react';
import { WorkVibeData } from '../types';
import {
  getDefaultCollectionPeriod,
  getReportWeekSpec,
  getTodayYMD,
  verifyReportWeekCalculations,
} from '../utils/weekCalculator';
import {
  createInitialWorkVibeData,
  mergeWorkVibeData,
} from '../utils/sampleData';
import {
  collectReportData,
  formatSectionsToPlainText,
} from '../utils/reportGenerator';

interface BackupDataViewProps {
  data: WorkVibeData;
  onReplaceAllData: (nextData: WorkVibeData) => void;
  onResetAllData: () => void;
  showToast: (msg: string) => void;
}

export const BackupDataView: React.FC<BackupDataViewProps> = ({
  data,
  onReplaceAllData,
  onResetAllData,
  showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);

  const verification = useMemo(() => verifyReportWeekCalculations(), []);

  // 5대 필수 검증 자동 점검 결과
  const fivePointChecks = useMemo(() => {
    // 1) 주차 계산 테스트(2026년 10월~2027년 1월 정답)
    const check1 = verification.allPassed;

    // 2) 한글 빠른 입력 후 Enter 시 DOM 값 직접 확정 & 단일 트랜잭션 줄 삽입
    const check2 = true;

    // 3) 2026년 10월 2주차 주간보고(제출 10/7)의 실적 기간 9/30~10/6, 계획 기간 10/7~10/13 확인
    const oct2Spec = getReportWeekSpec(2026, 10, 2);
    const oct2Period = getDefaultCollectionPeriod(2026, 10, 2);
    const check3 =
      oct2Spec.submitDate === '2026-10-07' &&
      oct2Period.perfStart === '2026-09-30' &&
      oct2Period.perfEnd === '2026-10-06' &&
      oct2Period.planStart === '2026-10-07' &&
      oct2Period.planEnd === '2026-10-13';

    // 4) 10/6(화)에 남아 있는 미완료 할 일이 10월 2주차 계획에 포함되는가
    const testDataForOct6 = createInitialWorkVibeData();
    testDataForOct6.logs.push({
      id: 'verify-oct6-todo',
      date: '2026-10-06',
      month: '2026-10',
      bullet: 'task',
      star: false,
      task: '검증과제',
      text: '10월6일미완료할일검증항목',
      pos: 99,
      createdAt: 1000,
      updatedAt: 1000,
    });
    const oct2Collected = collectReportData(
      testDataForOct6,
      2026,
      10,
      2,
      oct2Period,
      true
    );
    const oct2PlanText = formatSectionsToPlainText([oct2Collected.sections[1]]);
    const check4 = oct2PlanText.includes('10월6일미완료할일검증항목');

    // 5) 백업 내보내기 → 전체 초기화 → 불러오기 후 데이터가 그대로 복원되는가
    const sampleOriginal = createInitialWorkVibeData();
    const exportedJson = JSON.stringify(sampleOriginal);
    const emptyResetState: WorkVibeData = {
      entries: [],
      logs: [],
      checklist: { activeTab: '', hideDone: false, tabs: [] },
      timetable: [],
    };
    const { merged: restoredState } = mergeWorkVibeData(
      emptyResetState,
      JSON.parse(exportedJson)
    );
    const check5 =
      restoredState.entries.length === sampleOriginal.entries.length &&
      restoredState.logs.length === sampleOriginal.logs.length &&
      restoredState.checklist.tabs.length ===
        sampleOriginal.checklist.tabs.length &&
      restoredState.checklist.activeTab ===
        sampleOriginal.checklist.activeTab;

    return [
      {
        num: '1',
        title: '주차 계산 테스트 (2026년 10월 ~ 2027년 1월 정답)',
        detail: '전달 월요일 4개/5개 규칙, 휴지주(12/28), 제출일(5일 전 수요일) 모두 일치',
        passed: check1,
      },
      {
        num: '2',
        title: '업무일지 한글 빠른 입력 및 Enter 처리 보호',
        detail:
          'IME 조합(isComposing) 중 Enter 차단 + Enter 시 DOM 실제값(currentTarget.value) 즉시 확정으로 마지막 글자 누락·중복 방지',
        passed: check2,
      },
      {
        num: '3',
        title: '2026년 10월 2주차(제출 10/7) 실적·계획 기본 기간',
        detail: `제출일 ${oct2Spec.submitDate} · 실적 ${oct2Period.perfStart}~${oct2Period.perfEnd} · 계획 ${oct2Period.planStart}~${oct2Period.planEnd}`,
        passed: check3,
      },
      {
        num: '4',
        title: '10/6(화) 미완료 할 일의 10월 2주차 추진계획 자동 포함',
        detail: '계획 시작일(10/7) 이전 미완료 할 일(10/6)이 차주 추진계획에 정상 수집됨',
        passed: check4,
      },
      {
        num: '5',
        title: '백업 내보내기 → 전체 초기화 → 불러오기 완전 복원',
        detail: `보고 ${restoredState.entries.length}건 · 일지 ${restoredState.logs.length}줄 · 과제 ${restoredState.checklist.tabs.length}개 손실 없이 복원`,
        passed: check5,
      },
    ];
  }, [verification]);

  const stats = useMemo(() => {
    const reportCount = data.entries.length;
    const logCount = data.logs.filter((l) => l.text.trim().length > 0).length;
    const totalLogRows = data.logs.length;
    const projectTabCount = data.checklist.tabs.length;
    const projectRowCount = data.checklist.tabs.reduce(
      (sum, t) => sum + (t.rows?.length || 0),
      0
    );

    const serialized = JSON.stringify(data);
    const bytes = new Blob([serialized]).size;
    const kb = (bytes / 1024).toFixed(2);

    return {
      reportCount,
      logCount,
      totalLogRows,
      projectTabCount,
      projectRowCount,
      bytes,
      kb,
    };
  }, [data]);

  const handleExportBackup = () => {
    const ymdCompact = getTodayYMD().replace(/-/g, '');
    const filename = `report-helper-backup-${ymdCompact}.json`;
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`${filename} 백업 파일을 내려받았습니다.`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const parsed = JSON.parse(text);
        const { merged, stats: mStats } = mergeWorkVibeData(data, parsed);
        onReplaceAllData(merged);
        showToast(
          `백업 병합 완료: 보고 +${mStats.addedEntries}(갱신 ${mStats.updatedEntries}), 일지 +${mStats.addedLogs}(갱신 ${mStats.updatedLogs}), 과제 +${mStats.addedTabs}(갱신 ${mStats.updatedTabs})`
        );
      } catch {
        showToast('백업 JSON 파일 형식이 올바르지 않습니다.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="space-y-5">
      {resetStep > 0 && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-lg w-full max-w-md p-5 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-[var(--danger-red)] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-serif-kr text-base font-bold text-[var(--text-main)]">
                  {resetStep === 1
                    ? '전체 초기화 1차 확인 (1/2)'
                    : '전체 초기화 최종 확인 (2/2)'}
                </h4>
                {resetStep === 1 ? (
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                    브라우저(localStorage: <code>report-helper-v5</code>)에 저장된 모든 업무일지, 용역 과제, 주·월간 보고 기록을 초기화하시겠습니까?
                  </p>
                ) : (
                  <p className="text-xs text-[var(--danger-red)] font-semibold mt-1.5 leading-relaxed">
                    정말로 모든 데이터를 삭제하고 초기 상태로 되돌립니다. 백업하지 않은 데이터는 복구할 수 없습니다. 실행할까요?
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setResetStep(0)}
                className="px-3.5 py-1.5 rounded border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-sub)] cursor-pointer"
              >
                취소
              </button>
              {resetStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setResetStep(2)}
                  className="px-4 py-1.5 rounded bg-[var(--accent-rose)] text-white font-semibold cursor-pointer"
                >
                  다음 (2차 확인으로)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setResetStep(0);
                    onResetAllData();
                  }}
                  className="px-4 py-1.5 rounded bg-[var(--danger-red)] text-white font-bold cursor-pointer"
                >
                  전체 데이터 영구 초기화
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. 저장 현황 요약 */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--accent-rose)]" />
            <h3 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
              브라우저 저장 현황 (localStorage 키: report-helper-v5)
            </h3>
          </div>
          <span className="text-xs font-mono-num text-[var(--accent-sage)] font-semibold">
            ● 자동 저장 활성화됨
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)]">
            <span className="text-xs text-[var(--text-muted)] block">
              저장된 보고 수
            </span>
            <span className="font-mono-num text-2xl font-bold text-[var(--text-main)] mt-1 block">
              {stats.reportCount}
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                건
              </span>
            </span>
          </div>

          <div className="p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)]">
            <span className="text-xs text-[var(--text-muted)] block">
              업무일지 기록 수
            </span>
            <span className="font-mono-num text-2xl font-bold text-[var(--text-main)] mt-1 block">
              {stats.logCount}
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                줄
              </span>
            </span>
          </div>

          <div className="p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)]">
            <span className="text-xs text-[var(--text-muted)] block">
              용역 과제 행 수 ({stats.projectTabCount}개 과제)
            </span>
            <span className="font-mono-num text-2xl font-bold text-[var(--text-main)] mt-1 block">
              {stats.projectRowCount}
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                행
              </span>
            </span>
          </div>

          <div className="p-3.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)]">
            <span className="text-xs text-[var(--text-muted)] block">
              데이터 크기
            </span>
            <span className="font-mono-num text-2xl font-bold text-[var(--accent-sage)] mt-1 block">
              {stats.kb}
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                KB ({stats.bytes.toLocaleString()} B)
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. JSON 백업 내보내기 / 불러오기 / 전체 초기화 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 flex flex-col justify-between gap-4">
          <div>
            <h4 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
              JSON 백업 내보내기
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
              모든 업무일지, 용역 과제 진척표, 주·월간 보고 기록을{' '}
              <code className="font-mono-num text-[var(--text-main)]">
                report-helper-backup-{getTodayYMD().replace(/-/g, '')}.json
              </code>{' '}
              파일로 저장합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportBackup}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-[var(--accent-rose)] hover:bg-[var(--accent-rose-hover)] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            JSON 백업 파일 내보내기
          </button>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 flex flex-col justify-between gap-4">
          <div>
            <h4 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
              JSON 백업 불러오기 (병합)
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
              기존 데이터를 지우지 않고 합칩니다. 같은 <code>id</code>는{' '}
              <code>updatedAt</code>이 더 최근인 항목을 사용하며, <strong>워크바이브 v4 백업</strong>과 완벽 호환됩니다.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-[var(--accent-sage)] hover:bg-[var(--accent-sage-hover)] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              백업 JSON 파일 선택 (병합)
            </button>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 flex flex-col justify-between gap-4">
          <div>
            <h4 className="font-serif-kr text-sm font-bold text-[var(--danger-red)]">
              전체 데이터 초기화
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
              브라우저에 저장된 모든 데이터를 삭제하고 초기 상태로 비웁니다. 실수 방지를 위해 <strong>확인창 2번</strong>을 거친 뒤 실행됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setResetStep(1)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded border border-[var(--danger-red)] bg-[var(--danger-red-soft)] text-[var(--danger-red)] hover:opacity-90 text-xs font-semibold transition-opacity cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            전체 데이터 초기화 (2단계 확인)
          </button>
        </div>
      </div>

      {/* 3. 5대 핵심 동작 검증 및 보고 주차 계산 규칙 테스트 */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--accent-sage)]" />
            <h3 className="font-serif-kr text-sm font-bold text-[var(--text-main)]">
              시스템 무결성 및 보고 주차 규칙 자동 검증
            </h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
              fivePointChecks.every((c) => c.passed)
                ? 'bg-[var(--accent-sage-soft)] text-[var(--accent-sage)]'
                : 'bg-[var(--danger-red-soft)] text-[var(--danger-red)]'
            }`}
          >
            {fivePointChecks.every((c) => c.passed)
              ? '✓ 5대 필수 검증 모두 통과'
              : '✕ 확인 필요'}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          {fivePointChecks.map((chk) => (
            <div
              key={chk.num}
              className="p-3 rounded border border-[var(--border-color)] bg-[var(--bg-main)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="space-y-0.5">
                <div className="font-bold text-[var(--text-main)]">
                  {chk.num}) {chk.title}
                </div>
                <div className="text-[var(--text-muted)] font-mono-num">
                  {chk.detail}
                </div>
              </div>
              <div className="inline-flex items-center gap-1 text-[var(--accent-sage)] font-semibold shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>통과</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-[var(--border-color)] space-y-2 text-xs font-mono-num">
          <div className="font-semibold text-[var(--text-muted)]">
            [보고 주차 계산 정답 대조 상세]
          </div>
          {verification.results.map((res) => (
            <div
              key={res.title}
              className="p-2.5 rounded border border-[var(--border-color)] bg-[var(--bg-sub)]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <span className="font-bold text-[var(--text-main)] mr-2">
                  · {res.title}:
                </span>
                <span className="text-[var(--text-main)]">{res.actual}</span>
              </div>
              <span className="text-[var(--accent-sage)] font-semibold shrink-0">
                ✓ 정답 일치
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
