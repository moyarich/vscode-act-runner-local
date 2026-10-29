import React from 'react';
import { useExecutionStore, type NodeStatus } from '../store/executionStore';

export function RunSummaryHeader() {
  const { execution, nodes } = useExecutionStore();
  const jobs = nodes.filter((node) => node.type === 'job');
  const totalJobs = jobs.length;
  const successfulJobs = jobs.filter((job) => job.status === 'success').length;
  const status = toNodeStatus(execution.status);

  return (
    <section style={styles.card}>
      <div style={styles.identity}>
        <div style={styles.muted}>Triggered locally by act</div>
        <div style={styles.titleRow}>
          <StatusIcon status={status} />
          <span style={styles.title}>{execution.workflowName || 'Workflow run'}</span>
          {execution.executionId && <span style={styles.badge}>local</span>}
        </div>
      </div>
      <Metric label="Status" value={formatStatus(execution.status)} />
      <Metric label="Total duration" value={formatDuration(execution)} />
      <Metric label="Jobs" value={`${successfulJobs}/${totalJobs || 0}`} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

function StatusIcon({ status }: { status: NodeStatus }) {
  const colors: Record<NodeStatus, string> = {
    idle: '#8b949e',
    running: '#d29922',
    success: '#3fb950',
    failed: '#f85149',
    skipped: '#8b949e',
  };
  const icon: Record<NodeStatus, string> = {
    idle: '○',
    running: '●',
    success: '✓',
    failed: '✕',
    skipped: '⊘',
  };
  return (
    <span style={{ ...styles.statusIcon, color: colors[status], borderColor: colors[status] }}>
      {icon[status]}
    </span>
  );
}

function toNodeStatus(status: string): NodeStatus {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  if (status === 'running') return 'running';
  return 'idle';
}

function formatStatus(status: string): string {
  if (status === 'success') return 'Success';
  if (status === 'failed') return 'Failed';
  if (status === 'running') return 'Running';
  if (status === 'cancelled') return 'Cancelled';
  return 'Idle';
}

function formatDuration(execution: {
  startedAt: string | null;
  duration: number | null;
  status: string;
}): string {
  if (!execution.startedAt) return '-';
  const diff =
    execution.status === 'running' || execution.duration == null
      ? Math.max(0, Date.now() - new Date(execution.startedAt).getTime())
      : execution.duration;
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) repeat(4, minmax(110px, auto))',
    gap: 24,
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid #30363d',
    background: '#161b22',
    color: '#c9d1d9',
    flexShrink: 0,
  },
  identity: {
    minWidth: 0,
  },
  muted: {
    color: '#8b949e',
    fontSize: 13,
    marginBottom: 6,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  title: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#e6edf3',
    fontSize: 16,
    fontWeight: 700,
  },
  badge: {
    padding: '1px 7px',
    borderRadius: 10,
    background: '#0d419d',
    color: '#79c0ff',
    fontSize: 12,
    fontWeight: 500,
    flexShrink: 0,
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 90,
  },
  metricLabel: {
    color: '#8b949e',
    fontSize: 13,
  },
  metricValue: {
    color: '#c9d1d9',
    fontSize: 18,
    fontWeight: 700,
  },
  statusIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    border: '1px solid currentColor',
    borderRadius: '50%',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
};
