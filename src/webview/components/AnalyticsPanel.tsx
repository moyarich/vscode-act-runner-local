import React, { useMemo, useState } from 'react';
import { useExecutionStore } from '../store/executionStore';
import { t, formatNumber } from '../i18n';
import type { ExecutionRecord, JobResult } from '../../types/execution.types';

type Timeframe = '7' | '30' | '90' | 'all';

interface JobSample {
  workflowName: string;
  jobName: string;
  status: string;
  duration: number;
  startedAt: string;
}

interface DayBucket {
  label: string;
  success: number;
  failed: number;
  minutes: number;
}

export function AnalyticsPanel() {
  const history = useExecutionStore((s) => s.history);
  const [timeframe, setTimeframe] = useState<Timeframe>('30');
  const [workflow, setWorkflow] = useState('all');
  const [job, setJob] = useState('all');
  const [status, setStatus] = useState('all');

  const workflows = useMemo(
    () => unique(history.map((record) => record.workflowName).filter(Boolean)),
    [history]
  );
  const jobNames = useMemo(
    () =>
      unique(history.flatMap((record) => record.jobs.map((item) => item.jobName || item.jobId))),
    [history]
  );

  const records = useMemo(() => {
    const cutoff = getCutoff(timeframe);
    return history.filter((record) => {
      if (cutoff && new Date(record.startedAt).getTime() < cutoff) return false;
      if (workflow !== 'all' && record.workflowName !== workflow) return false;
      if (status !== 'all' && record.status !== status) return false;
      if (job !== 'all' && !record.jobs.some((item) => (item.jobName || item.jobId) === job))
        return false;
      return true;
    });
  }, [history, timeframe, workflow, job, status]);

  const jobSamples = useMemo(() => flattenJobs(records, job), [records, job]);
  const buckets = useMemo(() => buildBuckets(records, timeframe), [records, timeframe]);
  const metrics = useMemo(() => buildMetrics(records, jobSamples), [records, jobSamples]);
  const distribution = useMemo(() => buildDistribution(jobSamples), [jobSamples]);
  const slowestJobs = useMemo(() => buildSlowestJobs(jobSamples), [jobSamples]);

  const clearFilters = () => {
    setWorkflow('all');
    setJob('all');
    setStatus('all');
  };

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div style={styles.brand}>Act Visual Runner</div>
        <div style={styles.tabs}>
          <span style={styles.tabActive}>{t('nav.analytics')}</span>
        </div>
        <label style={styles.timeframe}>
          <span>{t('analytics.timeframe')}</span>
          <select
            value={timeframe}
            onChange={(event) => setTimeframe(event.target.value as Timeframe)}
            style={styles.select}
          >
            <option value="7">{t('analytics.7d')}</option>
            <option value="30">{t('analytics.30d')}</option>
            <option value="90">{t('analytics.90d')}</option>
            <option value="all">{t('analytics.allTime')}</option>
          </select>
        </label>
      </div>

      <div style={styles.filterbar}>
        <select
          value={workflow}
          onChange={(event) => setWorkflow(event.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">{t('workflow')}</option>
          {workflows.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={job}
          onChange={(event) => setJob(event.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">{t('job')}</option>
          {jobNames.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">{t('status')}</option>
          <option value="success">{t('status.success')}</option>
          <option value="failed">{t('status.failed')}</option>
          <option value="cancelled">{t('status.cancelled')}</option>
        </select>
        <button type="button" onClick={clearFilters} style={styles.clearBtn}>
          {t('analytics.clearFilters')}
        </button>
      </div>

      {history.length === 0 ? (
        <div style={styles.empty}>{t('analytics.empty')}</div>
      ) : (
        <div style={styles.content}>
          <section>
            <h2 style={styles.sectionTitle}>{t('analytics.overview')}</h2>
            <div style={styles.metricGrid}>
              <MetricCard
                label={t('analytics.metricDuration')}
                value={formatDuration(metrics.averageDuration)}
              />
              <MetricCard
                label={t('analytics.failureRate')}
                value={`${metrics.failureRate.toFixed(1)}%`}
                sub={t(
                  'analytics.failedOfTotal',
                  formatNumber(metrics.failedRuns),
                  formatNumber(metrics.totalRuns)
                )}
              />
              <MetricCard
                label={t('analytics.totalMinutes')}
                value={`${formatNumber(metrics.totalMinutes)} min`}
              />
              <MetricCard
                label={t('analytics.billableMinutes')}
                value={`${formatNumber(metrics.billableMinutes)} min`}
              />
              <MetricCard
                label={t('analytics.timeSaved')}
                value={`${formatNumber(metrics.estimatedSavedMinutes)} min`}
                sub={t('analytics.vsHosted')}
              />
              <MetricCard
                label={t('analytics.costSaved')}
                value={`$${metrics.estimatedCostSavings.toFixed(2)}`}
                sub={t('analytics.vsHosted')}
              />
            </div>
          </section>

          <section style={styles.chartGrid}>
            <ChartPanel
              title={t('analytics.builds')}
              buckets={buckets}
              mode="count"
              averageLabel={t(
                'analytics.averageJobs',
                formatNumber(Math.round(metrics.averageBuildsPerBucket))
              )}
            />
            <ChartPanel
              title={t('analytics.minutes')}
              buckets={buckets}
              mode="minutes"
              averageLabel={t(
                'analytics.averageMinutes',
                formatNumber(Math.round(metrics.averageMinutesPerBucket))
              )}
            />
          </section>

          <section style={styles.bottomGrid}>
            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>{t('analytics.duration')}</h2>
              <div style={styles.distributionList}>
                {distribution.map((item) => (
                  <div key={item.label} style={styles.distributionRow}>
                    <span style={styles.distributionLabel}>{item.label}</span>
                    <div style={styles.distributionTrack}>
                      <div style={{ ...styles.distributionFill, width: `${item.percent}%` }} />
                    </div>
                    <span style={styles.distributionCount}>{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>{t('analytics.slowest')}</h2>
              <div style={styles.slowestList}>
                {slowestJobs.length > 0 ? (
                  slowestJobs.map((item) => (
                    <div key={`${item.workflowName}-${item.jobName}`} style={styles.slowestItem}>
                      <div style={styles.slowestName}>
                        {item.workflowName}/{item.jobName}
                      </div>
                      <div style={styles.slowestSub}>{item.runs} runs</div>
                      <div style={styles.slowestDuration}>
                        {formatDuration(item.averageDuration)}
                      </div>
                      <div style={styles.slowestSubRight}>{t('analytics.avgDuration')}</div>
                    </div>
                  ))
                ) : (
                  <div style={styles.muted}>{t('analytics.noDuration')}</div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
      {sub && <div style={styles.metricSub}>{sub}</div>}
    </div>
  );
}

function ChartPanel({
  title,
  buckets,
  mode,
  averageLabel,
}: {
  title: string;
  buckets: DayBucket[];
  mode: 'count' | 'minutes';
  averageLabel: string;
}) {
  const max = Math.max(
    1,
    ...buckets.map((bucket) => (mode === 'count' ? bucket.success + bucket.failed : bucket.minutes))
  );
  const successTotal = buckets.reduce((sum, bucket) => sum + bucket.success, 0);
  const failedTotal = buckets.reduce((sum, bucket) => sum + bucket.failed, 0);
  const valueTotal =
    mode === 'count'
      ? successTotal
      : Math.round(buckets.reduce((sum, bucket) => sum + bucket.minutes, 0));

  return (
    <div style={styles.chartPanel}>
      <div style={styles.chartHeader}>
        <h2 style={styles.sectionTitle}>{title}</h2>
        <span style={styles.average}>{averageLabel}</span>
      </div>
      <div style={styles.chartBody}>
        <div style={styles.barChart}>
          {buckets.map((bucket) => {
            const total = mode === 'count' ? bucket.success + bucket.failed : bucket.minutes;
            const successHeight =
              total > 0
                ? Math.max(
                    2,
                    ((mode === 'count'
                      ? bucket.success
                      : Math.max(0, bucket.minutes - bucket.failed)) /
                      max) *
                      100
                  )
                : 1;
            const failedHeight =
              total > 0 ? Math.max(bucket.failed > 0 ? 2 : 0, (bucket.failed / max) * 100) : 0;
            return (
              <div
                key={bucket.label}
                title={`${bucket.label}: ${mode === 'count' ? total : `${Math.round(total)} min`}`}
                style={styles.barSlot}
              >
                <div style={{ ...styles.successBar, height: `${successHeight}%` }} />
                {bucket.failed > 0 && (
                  <div style={{ ...styles.failedBar, height: `${failedHeight}%` }} />
                )}
              </div>
            );
          })}
        </div>
        <div style={styles.successErrors}>
          <div style={styles.successErrorsTitle}>{t('analytics.outcomes')}</div>
          <div style={styles.successErrorsSub}>{t('analytics.byDay')}</div>
          <div style={styles.successNumber}>
            {formatNumber(valueTotal)}{' '}
            <span style={styles.successText}>{mode === 'count' ? 'successful' : 'minutes'}</span>
          </div>
          <div style={styles.failedNumber}>
            {failedTotal} <span style={styles.failedText}>{t('analytics.errored')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function flattenJobs(records: ExecutionRecord[], selectedJob: string): JobSample[] {
  return records.flatMap((record): JobSample[] => {
    if (record.jobs.length === 0) {
      return record.duration
        ? [
            {
              workflowName: record.workflowName,
              jobName: record.jobId ?? 'all jobs',
              status: record.status,
              duration: record.duration,
              startedAt: record.startedAt,
            },
          ]
        : [];
    }
    return record.jobs
      .filter((job) => selectedJob === 'all' || (job.jobName || job.jobId) === selectedJob)
      .map((job) => ({
        workflowName: record.workflowName,
        jobName: job.jobName || job.jobId,
        status: job.status,
        duration: getJobDuration(job, record),
        startedAt: job.startedAt ?? record.startedAt,
      }))
      .filter((job) => job.duration > 0);
  });
}

function getJobDuration(job: JobResult, record: ExecutionRecord): number {
  if (job.duration && job.duration > 0) return job.duration;
  if (job.startedAt && job.completedAt)
    return Math.max(0, new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime());
  if (record.jobs.length === 1 && record.duration) return record.duration;
  return 0;
}

function buildMetrics(records: ExecutionRecord[], jobs: JobSample[]) {
  const totalRuns = records.length;
  const failedRuns = records.filter((record) => record.status === 'failed').length;
  const totalMs =
    jobs.reduce((sum, job) => sum + job.duration, 0) ||
    records.reduce((sum, record) => sum + (record.duration ?? 0), 0);
  const totalMinutes = Math.round(totalMs / 60000);
  const averageDuration =
    jobs.length > 0 ? totalMs / jobs.length : totalRuns > 0 ? totalMs / totalRuns : 0;
  const failureRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;
  const estimatedSavedMinutes = Math.round(totalMinutes * 0.3);
  return {
    totalRuns,
    failedRuns,
    averageDuration,
    failureRate,
    totalMinutes,
    billableMinutes: totalMinutes,
    estimatedSavedMinutes,
    estimatedCostSavings: estimatedSavedMinutes * 0.008,
    averageBuildsPerBucket: totalRuns / Math.max(1, Math.min(30, totalRuns || 1)),
    averageMinutesPerBucket: totalMinutes / Math.max(1, Math.min(30, totalRuns || 1)),
  };
}

function buildBuckets(records: ExecutionRecord[], timeframe: Timeframe): DayBucket[] {
  const days = timeframe === 'all' ? 30 : Number(timeframe);
  const today = new Date();
  const buckets: DayBucket[] = Array.from({ length: Math.min(days, 30) }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (Math.min(days, 30) - 1 - index));
    return { label: `${date.getMonth() + 1}/${date.getDate()}`, success: 0, failed: 0, minutes: 0 };
  });
  const bucketMap = new Map(buckets.map((bucket) => [bucket.label, bucket]));
  records.forEach((record) => {
    const date = new Date(record.startedAt);
    const key = `${date.getMonth() + 1}/${date.getDate()}`;
    const bucket = bucketMap.get(key);
    if (!bucket) return;
    if (record.status === 'success') bucket.success += 1;
    if (record.status === 'failed') bucket.failed += 1;
    bucket.minutes += (record.duration ?? 0) / 60000;
  });
  return buckets;
}

function buildDistribution(jobs: JobSample[]) {
  const bins = [
    { label: '0-1m', min: 0, max: 60000, count: 0 },
    { label: '1-5m', min: 60000, max: 300000, count: 0 },
    { label: '5-10m', min: 300000, max: 600000, count: 0 },
    { label: '10-20m', min: 600000, max: 1200000, count: 0 },
    { label: '20-30m', min: 1200000, max: 1800000, count: 0 },
    { label: '30m+', min: 1800000, max: Number.POSITIVE_INFINITY, count: 0 },
  ];
  jobs.forEach((job) => {
    const bin = bins.find((item) => job.duration >= item.min && job.duration < item.max);
    if (bin) bin.count += 1;
  });
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  return bins.map((bin) => ({ ...bin, percent: (bin.count / max) * 100 }));
}

function buildSlowestJobs(jobs: JobSample[]) {
  const byName = new Map<
    string,
    { workflowName: string; jobName: string; total: number; runs: number }
  >();
  jobs.forEach((job) => {
    const key = `${job.workflowName}/${job.jobName}`;
    const current = byName.get(key) ?? {
      workflowName: job.workflowName,
      jobName: job.jobName,
      total: 0,
      runs: 0,
    };
    current.total += job.duration;
    current.runs += 1;
    byName.set(key, current);
  });
  return Array.from(byName.values())
    .map((item) => ({ ...item, averageDuration: item.total / item.runs }))
    .sort((a, b) => b.averageDuration - a.averageDuration)
    .slice(0, 5);
}

function getCutoff(timeframe: Timeframe): number | null {
  if (timeframe === 'all') return null;
  const date = new Date();
  date.setDate(date.getDate() - Number(timeframe));
  return date.getTime();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0s';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

const styles: Record<string, React.CSSProperties> = {
  page: { flex: 1, overflow: 'auto', background: '#0d1117', color: '#c9d1d9' },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    minHeight: 48,
    borderBottom: '1px solid #21262d',
    background: '#0d1117',
    padding: '0 20px',
  },
  brand: { color: '#e6edf3', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 16 },
  tabs: { display: 'flex', gap: 2, alignItems: 'stretch', height: 42 },
  tabActive: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    color: '#e6edf3',
    fontWeight: 600,
    borderBottom: '2px solid #f78166',
  },
  timeframe: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
    color: '#8b949e',
    fontSize: 12,
  },
  select: {
    background: '#0d1117',
    color: '#c9d1d9',
    border: '1px solid #30363d',
    borderRadius: 6,
    padding: '5px 28px 5px 10px',
    fontSize: 12,
  },
  filterbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    borderBottom: '1px solid #21262d',
    background: '#0d1117',
  },
  filterSelect: {
    background: '#0d1117',
    color: '#c9d1d9',
    border: '1px solid #30363d',
    borderRadius: 6,
    padding: '6px 28px 6px 10px',
    fontSize: 12,
  },
  clearBtn: {
    border: '1px solid #30363d',
    borderRadius: 6,
    background: '#161b22',
    color: '#c9d1d9',
    padding: '6px 10px',
    fontSize: 11,
    cursor: 'pointer',
  },
  content: { padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 24 },
  empty: { padding: 48, color: '#8b949e', textAlign: 'center' },
  sectionTitle: { margin: 0, marginBottom: 12, color: '#e6edf3', fontSize: 13, fontWeight: 700 },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(150px, 1fr))', gap: 12 },
  metricCard: {
    minHeight: 72,
    padding: '12px 14px',
    border: '1px solid #30363d',
    borderRadius: 6,
    background: '#161b22',
  },
  metricLabel: { color: '#8b949e', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' },
  metricValue: { marginTop: 6, color: '#e6edf3', fontSize: 18, fontWeight: 800 },
  metricSub: { marginTop: 2, color: '#6e7681', fontSize: 11 },
  chartGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 26,
    borderTop: '1px solid #21262d',
    paddingTop: 18,
  },
  chartPanel: { minWidth: 0 },
  chartHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  average: { color: '#c9d1d9', fontSize: 11 },
  chartBody: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) 190px',
    gap: 26,
    alignItems: 'center',
  },
  barChart: {
    display: 'flex',
    alignItems: 'end',
    gap: 5,
    height: 130,
    padding: '0 0 1px',
    borderBottom: '1px solid #30363d',
    background:
      'linear-gradient(to top, transparent 0, transparent 48%, #21262d 49%, transparent 50%)',
  },
  barSlot: {
    flex: 1,
    minWidth: 4,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'end',
    gap: 1,
  },
  successBar: { width: '100%', background: '#3fb950', borderRadius: '2px 2px 0 0', minHeight: 1 },
  failedBar: { width: '100%', background: '#f85149', minHeight: 0 },
  successErrors: { color: '#e6edf3' },
  successErrorsTitle: { fontSize: 16, fontWeight: 800 },
  successErrorsSub: { color: '#8b949e', fontSize: 12, marginBottom: 16 },
  successNumber: { color: '#e6edf3', fontSize: 30, fontWeight: 800, lineHeight: 1.2 },
  failedNumber: { color: '#e6edf3', fontSize: 30, fontWeight: 800, lineHeight: 1.2 },
  successText: { color: '#3fb950', fontSize: 12, fontWeight: 500 },
  failedText: { color: '#ff7b72', fontSize: 12, fontWeight: 500 },
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 0.9fr) minmax(360px, 1fr)',
    gap: 48,
    borderTop: '1px solid #21262d',
    paddingTop: 18,
  },
  panel: { minWidth: 0 },
  distributionList: { display: 'flex', flexDirection: 'column', gap: 10 },
  distributionRow: {
    display: 'grid',
    gridTemplateColumns: '52px 1fr 42px',
    gap: 10,
    alignItems: 'center',
  },
  distributionLabel: { color: '#8b949e', fontSize: 12 },
  distributionTrack: {
    height: 20,
    background: '#161b22',
    border: '1px solid #21262d',
    borderRadius: 3,
    overflow: 'hidden',
  },
  distributionFill: { height: '100%', background: '#58a6ff', borderRadius: 3 },
  distributionCount: { color: '#c9d1d9', fontSize: 12, textAlign: 'right' },
  slowestList: { display: 'flex', flexDirection: 'column', gap: 8 },
  slowestItem: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gridTemplateRows: 'auto auto',
    gap: '2px 12px',
    padding: '10px 12px',
    border: '1px solid #30363d',
    borderRadius: 6,
    background: '#161b22',
  },
  slowestName: {
    color: '#e6edf3',
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slowestSub: { color: '#8b949e', fontSize: 11 },
  slowestDuration: { color: '#e6edf3', fontWeight: 800, textAlign: 'right' },
  slowestSubRight: { color: '#8b949e', fontSize: 11, textAlign: 'right' },
  muted: { color: '#8b949e' },
};
