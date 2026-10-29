import React, { useMemo } from 'react';
import { useExecutionStore, type NodeStatus } from '../store/executionStore';
import { WorkflowGraph } from './WorkflowGraph';
import { RunSummaryHeader } from './RunSummaryHeader';
import { t } from '../i18n';

// ─── Parser Markdown leve (browser-safe, zero dependências) ──────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const allowedTags = new Set([
    'A',
    'B',
    'BLOCKQUOTE',
    'BR',
    'CODE',
    'DEL',
    'DETAILS',
    'DIV',
    'EM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HR',
    'I',
    'IMG',
    'KBD',
    'LI',
    'OL',
    'P',
    'PRE',
    'S',
    'SPAN',
    'STRONG',
    'SUB',
    'SUMMARY',
    'SUP',
    'TABLE',
    'TBODY',
    'TD',
    'TFOOT',
    'TH',
    'THEAD',
    'TR',
    'U',
    'UL',
  ]);
  const allowedAttrs = new Set([
    'align',
    'alt',
    'colspan',
    'height',
    'href',
    'rowspan',
    'src',
    'style',
    'title',
    'width',
  ]);
  const allowedCss = new Set([
    'color',
    'background',
    'background-color',
    'font-weight',
    'font-style',
    'text-align',
    'text-decoration',
  ]);

  const cleanNode = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const element = child as HTMLElement;
      if (!allowedTags.has(element.tagName)) {
        element.replaceWith(...Array.from(element.childNodes));
        return;
      }
      Array.from(element.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();
        if (name.startsWith('on') || !allowedAttrs.has(name)) {
          element.removeAttribute(attr.name);
          return;
        }
        if ((name === 'href' || name === 'src') && /^(?:javascript|data):/i.test(value)) {
          element.removeAttribute(attr.name);
          return;
        }
        if (name === 'style') {
          const safeStyle = value
            .split(';')
            .map((rule: string) => rule.trim())
            .filter((rule: string) => {
              const prop = rule.split(':')[0]?.trim().toLowerCase();
              return prop && allowedCss.has(prop) && !/url\s*\(/i.test(rule);
            })
            .join('; ');
          if (safeStyle) element.setAttribute('style', safeStyle);
          else element.removeAttribute('style');
        }
      });
      cleanNode(element);
    });
  };

  cleanNode(template.content);
  return template.innerHTML;
}

/** Converte inline markdown: **bold**, *italic*, `code`, [links](url), ~~del~~ */
function parseInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/** Parser Markdown → HTML para GitHub Step Summary (GFM subset) */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let inTable = false;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (inList) {
      result.push(`</${inList}>`);
      inList = null;
    }
  };
  const closeTable = () => {
    if (inTable) {
      result.push('</tbody></table>');
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        result.push(`<pre><code>${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`);
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        closeList();
        closeTable();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Table rows
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      // Separator row (---|---) — skip
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      if (!inTable) {
        closeList();
        result.push('<table><thead><tr>');
        cells.forEach((c) => result.push(`<th>${parseInline(escapeHtml(c))}</th>`));
        result.push('</tr></thead><tbody>');
        inTable = true;
      } else {
        result.push('<tr>');
        cells.forEach((c) => result.push(`<td>${parseInline(escapeHtml(c))}</td>`));
        result.push('</tr>');
      }
      continue;
    }
    closeTable();

    const trimmed = line.trimStart();

    // Empty line
    if (!trimmed) {
      closeList();
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      result.push(`<h${level}>${parseInline(escapeHtml(headingMatch[2]))}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      closeList();
      result.push('<hr/>');
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      closeList();
      result.push(`<blockquote><p>${parseInline(escapeHtml(trimmed.slice(2)))}</p></blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      if (inList !== 'ul') {
        closeList();
        result.push('<ul>');
        inList = 'ul';
      }
      result.push(`<li>${parseInline(escapeHtml(trimmed.replace(/^[-*+]\s+/, '')))}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      if (inList !== 'ol') {
        closeList();
        result.push('<ol>');
        inList = 'ol';
      }
      result.push(`<li>${parseInline(escapeHtml(olMatch[2]))}</li>`);
      continue;
    }

    // Paragraph
    closeList();
    if (/^<\/?[a-z][\s\S]*>/i.test(trimmed)) {
      result.push(sanitizeHtml(trimmed));
    } else {
      result.push(`<p>${parseInline(escapeHtml(trimmed))}</p>`);
    }
  }

  // Close remaining open elements
  if (inCodeBlock)
    result.push(`<pre><code>${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`);
  closeList();
  closeTable();

  return result.join('\n');
}

/**
 * Renderiza o GITHUB_STEP_SUMMARY em um card estilo GitHub Actions.
 * Renderiza um estado vazio quando ainda não há conteúdo — totalmente aditivo.
 */
export function SummaryPanel() {
  const { summaryContent, execution, nodes } = useExecutionStore();
  const jobs = nodes.filter((node) => node.type === 'job');
  const workflowFile = execution.workflowPath?.split('/').pop() ?? 'workflow.yml';
  const summaryTitle = getSummaryTitle(summaryContent) ?? 'Job summary';

  // Memoiza a conversão Markdown → HTML para evitar re-renders desnecessários
  const htmlContent = useMemo(() => {
    if (!summaryContent) return '';
    return markdownToHtml(summaryContent);
  }, [summaryContent]);

  return (
    <div className="summary-panel" style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarActive}>
          <span style={styles.sidebarIcon}>⌂</span>
          <span>{t('nav.summary')}</span>
        </div>
        <div style={styles.sidebarSection}>{t('Jobs')}</div>
        <div style={styles.sidebarJobs}>
          {jobs.length > 0 ? (
            jobs.map((job) => (
              <div key={job.id} style={styles.sidebarJob}>
                <StatusIcon status={job.status} />
                <span style={styles.sidebarJobLabel}>{job.label}</span>
              </div>
            ))
          ) : (
            <div style={styles.sidebarEmpty}>{t('job.empty')}</div>
          )}
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.headerFrame}>
          <RunSummaryHeader />
        </div>

        <section style={styles.workflowCard}>
          <div style={styles.workflowTitle}>{workflowFile}</div>
          <div style={styles.workflowSubtitle}>{t('summary.actEvent')}</div>
          <div style={styles.workflowGraphFrame}>
            <WorkflowGraph showHeader={false} />
          </div>
        </section>

        <section style={styles.summaryCard}>
          <header style={styles.summaryHeader}>
            <span>{summaryTitle}</span>
            <span style={styles.kebab}>•••</span>
          </header>
          {summaryContent ? (
            <div style={styles.body} dangerouslySetInnerHTML={{ __html: htmlContent }} />
          ) : (
            <div style={{ ...styles.body, ...styles.empty }}>{t('summary.empty')}</div>
          )}
        </section>
      </main>
      <style>{summaryStyles}</style>
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

function getSummaryTitle(markdown: string): string | null {
  const firstHeading = markdown.split('\n').find((line) => /^#{1,6}\s+/.test(line.trim()));
  if (!firstHeading) return null;
  return (
    firstHeading
      .replace(/^#{1,6}\s+/, '')
      .trim()
      .replace(/[🚀📋✅❌]/g, '')
      .trim() || null
  );
}

// ─── Inline styles (container) ───────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100%',
    display: 'grid',
    gridTemplateColumns: '260px minmax(0, 1fr)',
    gap: 24,
    padding: 16,
    background: '#0d1117',
    color: '#c9d1d9',
  },
  sidebar: {
    paddingTop: 0,
  },
  sidebarActive: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderRadius: 6,
    background: '#30363d',
    color: '#c9d1d9',
    fontSize: 15,
    fontWeight: 600,
  },
  sidebarIcon: {
    color: '#8b949e',
    fontSize: 18,
  },
  sidebarSection: {
    marginTop: 22,
    marginBottom: 12,
    padding: '0 16px',
    color: '#8b949e',
    fontSize: 13,
    fontWeight: 600,
  },
  sidebarJobs: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  sidebarJob: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 16px',
    minHeight: 24,
    color: '#c9d1d9',
  },
  sidebarJobLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sidebarEmpty: {
    padding: '0 16px',
    color: '#8b949e',
    fontSize: 13,
  },
  main: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  headerFrame: {
    border: '1px solid #30363d',
    borderRadius: 6,
    background: '#161b22',
    overflow: 'hidden',
  },
  workflowCard: {
    minHeight: 360,
    padding: 24,
    border: '1px solid #30363d',
    borderRadius: 6,
    background: '#161b22',
    overflow: 'hidden',
  },
  workflowTitle: {
    color: '#c9d1d9',
    fontSize: 18,
    fontWeight: 700,
  },
  workflowSubtitle: {
    color: '#8b949e',
    fontSize: 14,
    fontWeight: 600,
  },
  workflowGraphFrame: {
    display: 'flex',
    height: 260,
    marginTop: 28,
    borderRadius: 6,
    overflow: 'hidden',
  },
  summaryCard: {
    border: '1px solid #30363d',
    borderRadius: 6,
    background: '#161b22',
    overflow: 'hidden',
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #30363d',
    background: '#21262d',
    color: '#c9d1d9',
    fontSize: 16,
    fontWeight: 700,
  },
  kebab: {
    color: '#8b949e',
    letterSpacing: 2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    background: '#161b22',
    borderBottom: '1px solid #30363d',
    fontSize: 14,
    fontWeight: 600,
    color: '#e6edf3',
  },
  headerIcon: {
    fontSize: 16,
  },
  headerTitle: {
    letterSpacing: 0.3,
  },
  body: {
    padding: '24px',
    overflowY: 'auto' as const,
    color: '#e6edf3',
    fontSize: 16,
    lineHeight: 1.6,
  },
  empty: {
    color: '#8b949e',
    fontStyle: 'italic',
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

// ─── Estilos CSS para conteúdo Markdown renderizado (imitam GitHub) ──────────

const summaryStyles = `
/* Headings */
.summary-panel h1,
.summary-panel h2,
.summary-panel h3,
.summary-panel h4,
.summary-panel h5,
.summary-panel h6 {
  color: #e6edf3;
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
  line-height: 1.25;
  border-bottom: none;
}
.summary-panel h1 { font-size: 1.6em; border-bottom: 1px solid #30363d; padding-bottom: 6px; }
.summary-panel h2 { font-size: 1.35em; border-bottom: 1px solid #30363d; padding-bottom: 5px; }
.summary-panel h3 { font-size: 1.15em; }
.summary-panel h4 { font-size: 1em; }

/* Paragraphs & inline */
.summary-panel p { margin: 8px 0; }
.summary-panel strong { color: #f0f6fc; font-weight: 600; }
.summary-panel em { font-style: italic; }
.summary-panel code {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.9em;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  color: #e6edf3;
}
.summary-panel pre {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 12px 16px;
  overflow-x: auto;
  margin: 12px 0;
}
.summary-panel pre code {
  background: none;
  border: none;
  padding: 0;
}

/* Tables (estilo GitHub) */
.summary-panel table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}
.summary-panel th,
.summary-panel td {
  border: 1px solid #30363d;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
}
.summary-panel th {
  background: #161b22;
  color: #e6edf3;
  font-weight: 600;
}
.summary-panel tr:nth-child(even) {
  background: rgba(22, 27, 34, 0.5);
}
.summary-panel tr:hover {
  background: rgba(48, 54, 61, 0.4);
}

/* Lists */
.summary-panel ul,
.summary-panel ol {
  padding-left: 24px;
  margin: 8px 0;
}
.summary-panel li {
  margin: 4px 0;
}
.summary-panel li::marker {
  color: #8b949e;
}

/* Links */
.summary-panel a {
  color: #58a6ff;
  text-decoration: none;
}
.summary-panel a:hover {
  text-decoration: underline;
}

/* Blockquote */
.summary-panel blockquote {
  border-left: 3px solid #30363d;
  padding: 4px 16px;
  margin: 8px 0;
  color: #8b949e;
}

/* Horizontal rule */
.summary-panel hr {
  border: none;
  border-top: 1px solid #30363d;
  margin: 16px 0;
}

/* Images */
.summary-panel img {
  max-width: 100%;
  border-radius: 6px;
}

/* Task lists */
.summary-panel input[type="checkbox"] {
  margin-right: 6px;
}
`;
