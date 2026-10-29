import React, { useState, useEffect, useRef } from 'react';
import { t } from '../i18n';

// Top-level tabs
type MainTab = 'secrets' | 'variables' | 'actrc';
// Sub-tabs inside Variables
type VarsSubTab = 'vars' | 'env';
// Internal file tab sent to extension host
type FileTab = 'secrets' | 'vars' | 'env' | 'actrc';
// Sidebar sections (for future expansion)
type SidebarSection = 'actions';
type Mode = 'list' | 'add' | 'edit';

interface EnvEntry {
  key: string;
  value: string;
}

interface TabConfig {
  label: string;
  sectionTitle: string;
  newBtnLabel: string;
  nameLabel: string;
  valueLabel: string | null;
  fileKindLabel: string;
  filePlaceholder: string;
  isSecret: boolean;
  description: string;
}

const FILE_TAB_CONFIGS: Record<FileTab, TabConfig> = {
  secrets: {
    label: 'env.secrets',
    sectionTitle: 'env.repoSecrets',
    newBtnLabel: 'env.newSecret',
    nameLabel: 'env.name',
    valueLabel: 'env.secret',
    fileKindLabel: 'secrets',
    filePlaceholder: '.secrets ou config/local.secrets',
    isSecret: true,
    description:
      'env.secretsDescription',
  },
  vars: {
    label: '.vars',
    sectionTitle: 'env.repoVariables',
    newBtnLabel: 'env.newRepoVariable',
    nameLabel: 'env.name',
    valueLabel: 'value',
    fileKindLabel: 'vars',
    filePlaceholder: '.vars ou my.variables',
    isSecret: false,
    description:
      'env.varsDescription',
  },
  env: {
    label: '.env',
    sectionTitle: 'env.variables',
    newBtnLabel: 'env.newVariable',
    nameLabel: 'env.name',
    valueLabel: 'value',
    fileKindLabel: 'env',
    filePlaceholder: '.env ou my.env',
    isSecret: false,
    description:
      'env.envDescription',
  },
  actrc: {
    label: 'env.actArgs',
    sectionTitle: 'env.actArguments',
    newBtnLabel: 'env.newArgument',
    nameLabel: 'env.argument',
    valueLabel: null,
    fileKindLabel: 'actrc',
    filePlaceholder: '.actrc',
    isSecret: false,
    description:
      'env.argsDescription',
  },
};

const SIDEBAR_ITEMS: { key: SidebarSection; label: string; icon: string }[] = [
  { key: 'actions', label: 'actions', icon: '⚡' },
];

export function EnvEditor() {
  const [mainTab, setMainTab] = useState<MainTab>('secrets');
  const [varsSubTab, setVarsSubTab] = useState<VarsSubTab>('vars');
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>('actions');

  // Derived file tab based on navigation
  const fileTab: FileTab =
    mainTab === 'secrets' ? 'secrets' : mainTab === 'actrc' ? 'actrc' : varsSubTab;

  const [rows, setRows] = useState<EnvEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filePath, setFilePath] = useState<string>('');
  const [mode, setMode] = useState<Mode>('list');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [showFilePath, setShowFilePath] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    setRows([]);
    setMode('list');
    setEditIndex(null);
    window.__vscode__?.postMessage({ type: 'command:loadEnv', payload: { tab: fileTab } });

    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === 'state:snapshot' && msg.payload?.envData?.tab === fileTab) {
        const data = (msg.payload.envData.rows ?? []) as EnvEntry[];
        setRows(data.filter((r: EnvEntry) => r.key.trim() !== ''));
        setFilePath((msg.payload.envData.filePath as string) ?? '');
        setLoading(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fileTab]);

  useEffect(() => {
    if (mode === 'add' || mode === 'edit') {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [mode]);

  const configSource = FILE_TAB_CONFIGS[fileTab];
  const config = { ...configSource, label: t(configSource.label), sectionTitle: t(configSource.sectionTitle), newBtnLabel: t(configSource.newBtnLabel), nameLabel: t(configSource.nameLabel), valueLabel: configSource.valueLabel ? t(configSource.valueLabel) : null, description: t(configSource.description) };

  const saveAll = (newRows: EnvEntry[]) => {
    window.__vscode__?.postMessage({
      type: 'command:saveEnv',
      payload: { tab: fileTab, rows: newRows, filePath },
    });
  };

  const loadCurrentFile = () => {
    setLoading(true);
    window.__vscode__?.postMessage({
      type: 'command:loadEnv',
      payload: { tab: fileTab, filePath },
    });
  };

  const selectFile = () => {
    setLoading(true);
    window.__vscode__?.postMessage({ type: 'command:selectEnvFile', payload: { tab: fileTab } });
  };

  const openAdd = () => {
    setFormKey('');
    setFormValue('');
    setEditIndex(null);
    setMode('add');
  };

  const openEdit = (i: number) => {
    setFormKey(rows[i].key);
    setFormValue(rows[i].value);
    setEditIndex(i);
    setMode('edit');
  };

  const cancelForm = () => {
    setMode('list');
    setEditIndex(null);
    setFormKey('');
    setFormValue('');
  };

  const submitForm = () => {
    if (!formKey.trim()) return;
    let newRows: EnvEntry[];
    if (mode === 'add') {
      newRows = [...rows, { key: formKey.trim(), value: formValue }];
    } else if (mode === 'edit' && editIndex !== null) {
      newRows = rows.map((r, i) =>
        i === editIndex ? { key: formKey.trim(), value: formValue } : r
      );
    } else {
      return;
    }
    setRows(newRows);
    saveAll(newRows);
    cancelForm();
  };

  const deleteRow = (i: number) => {
    const newRows = rows.filter((_, idx) => idx !== i);
    setRows(newRows);
    saveAll(newRows);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submitForm();
    if (e.key === 'Escape') cancelForm();
  };

  return (
    <div style={s.root}>
      {/* ─── Left sidebar (GitHub Settings style) ─── */}
      <div style={s.sidebar}>
        <div style={s.sidebarGroup}>
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.key}
              style={{
                ...s.sidebarItem,
                ...(sidebarSection === item.key ? s.sidebarItemActive : {}),
              }}
              onClick={() => setSidebarSection(item.key)}
            >
              <span style={s.sidebarIcon}>{item.icon}</span>
              {t(item.label)}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div style={s.main}>
        {/* Page header */}
        <div style={s.pageHeader}>
          <h2 style={s.pageTitle}>{t('env.title')}</h2>
          <p style={s.pageDesc}>
            Secrets and variables allow you to manage reusable configuration data.{' '}
            <strong style={{ color: '#c9d1d9' }}>{t('secret.encrypted')}</strong> and are used for
            sensitive data. Variables are shown as plain text and are used for{' '}
            <strong style={{ color: '#c9d1d9' }}>{t('env.publicData')}</strong>. Anyone with
            collaborator access can use these secrets and variables for actions. They are not passed
            to workflows triggered by a pull request from a fork.
          </p>
        </div>

        {/* Top nav tabs: Secrets | Variables | Args do ACT */}
        <div style={s.navTabs}>
          {(
            [
              { key: 'secrets', label: 'env.secrets' },
              { key: 'variables', label: 'env.variablesTab' },
              { key: 'actrc', label: 'env.actArgs' },
            ] as { key: MainTab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              style={{ ...s.navTab, ...(mainTab === t.key ? s.navTabActive : {}) }}
              onClick={() => setMainTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={s.content}>
          {/* Variables sub-tabs (.vars | .env) */}
          {mainTab === 'variables' && (
            <div style={s.subTabs}>
              {(
                [
                  { key: 'vars', label: '.vars' },
                  { key: 'env', label: '.env' },
                ] as { key: VarsSubTab; label: string }[]
              ).map((t) => (
                <button
                  key={t.key}
                  style={{ ...s.subTab, ...(varsSubTab === t.key ? s.subTabActive : {}) }}
                  onClick={() => setVarsSubTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab description */}
          <p style={s.tabDesc}>{config.description}</p>

          {/* File path (collapsible) */}
          <div style={s.fileRow}>
            <button style={s.fileToggle} onClick={() => setShowFilePath((v) => !v)}>
              📄 {filePath || config.filePlaceholder}
              <span style={s.fileToggleArrow}>{showFilePath ? '▲' : '▼'}</span>
            </button>
            {showFilePath && (
              <div style={s.fileControls}>
                <input
                  style={s.fileInput}
                  value={filePath}
                  placeholder={config.filePlaceholder}
                  onChange={(e) => setFilePath(e.target.value)}
                />
                <button style={s.btnOutline} onClick={selectFile}>
                  Selecionar
                </button>
                <button style={s.btnOutline} onClick={loadCurrentFile}>
                  Carregar
                </button>
              </div>
            )}
          </div>

          {/* Add / Edit form */}
          {(mode === 'add' || mode === 'edit') && (
            <div style={s.formBox}>
              <div style={s.formHeader}>
                <h3 style={s.formTitle}>
                  {mode === 'add' ? config.newBtnLabel : `Update ${config.label.toLowerCase()}`}
                </h3>
              </div>
              <div style={s.formBody}>
                <div style={s.formField}>
                  <label style={s.formLabel}>{config.nameLabel} *</label>
                  <input
                    ref={nameInputRef}
                    style={s.formInput}
                    value={formKey}
                    placeholder={
                      mainTab === 'actrc'
                        ? '--flag ou -P ubuntu-latest=catthehacker/ubuntu:act-latest'
                        : 'e.g. MY_VARIABLE'
                    }
                    onChange={(e) => setFormKey(e.target.value)}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    autoCorrect="off"
                  />
                </div>
                {config.valueLabel !== null && (
                  <div style={s.formField}>
                    <label style={s.formLabel}>{config.valueLabel}</label>
                    <textarea
                      style={s.formTextarea}
                      value={formValue}
                      placeholder={config.isSecret ? 'Enter secret value' : 'Enter value'}
                      onChange={(e) => setFormValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') cancelForm();
                      }}
                      rows={3}
                      spellCheck={false}
                    />
                    {config.isSecret && (
                      <p style={s.formHint}>
                        ⚠️ {t('secret.warning')} <code style={s.code}>.secrets</code>{' '}
                        {t('common.isIn')} <code style={s.code}>.gitignore</code>.
                      </p>
                    )}
                  </div>
                )}
                <div style={s.formActions}>
                  <button
                    style={{ ...s.btnGreen, ...(!formKey.trim() ? s.btnDisabled : {}) }}
                    onClick={submitForm}
                    disabled={!formKey.trim()}
                  >
                    {mode === 'add'
                      ? `Add ${config.label.toLowerCase()}`
                      : `Update ${config.label.toLowerCase()}`}
                  </button>
                  <button style={s.btnOutline} onClick={cancelForm}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* List section */}
          {mode === 'list' && (
            <div style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionTitle}>{config.sectionTitle}</span>
                <button style={s.btnGreen} onClick={openAdd}>
                  {config.newBtnLabel}
                </button>
              </div>

              {loading ? (
                <div style={s.emptyBox}>
                  <span style={s.emptyText}>{t('loading')}</span>
                </div>
              ) : rows.length === 0 ? (
                <div style={s.emptyBox}>
                  <p style={s.emptyText}>
                    There are no {config.label.toLowerCase()} for this repository.
                  </p>
                  <button style={s.btnGreenSm} onClick={openAdd}>
                    {config.newBtnLabel}
                  </button>
                </div>
              ) : (
                <div style={s.table}>
                  <div style={s.tableHead}>
                    <div style={s.thName}>{t('nameSort')}</div>
                    {config.valueLabel !== null && <div style={s.thValue}>{t('value')}</div>}
                    <div style={s.thActions} />
                  </div>
                  {rows.map((row, i) => (
                    <div
                      key={i}
                      style={{ ...s.tableRow, ...(i === rows.length - 1 ? s.tableRowLast : {}) }}
                    >
                      <div style={s.tdName}>
                        {config.isSecret && <span style={s.lockIcon}>🔒</span>}
                        <span style={s.itemName}>{row.key}</span>
                      </div>
                      {config.valueLabel !== null && (
                        <div style={s.tdValue}>
                          {config.isSecret ? (
                            <span style={s.maskedValue}>••••••••••••••••</span>
                          ) : (
                            <span style={s.plainValue}>
                              {row.value || <span style={s.noValue}>—</span>}
                            </span>
                          )}
                        </div>
                      )}
                      <div style={s.tdActions}>
                        <button style={s.iconBtn} title={t('edit')} onClick={() => openEdit(i)}>
                          ✏️
                        </button>
                        <button
                          style={{ ...s.iconBtn, ...s.iconBtnDanger }}
                          title={t('delete')}
                          onClick={() => deleteRow(i)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Styles ─── */
const s: Record<string, React.CSSProperties> = {
  root: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    background: '#0d1117',
    color: '#c9d1d9',
    height: '100%',
  },

  /* ── Sidebar ── */
  sidebar: {
    width: 200,
    flexShrink: 0,
    borderRight: '1px solid #21262d',
    padding: '16px 0',
    background: '#0d1117',
    overflowY: 'auto',
  },
  sidebarGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '0 8px',
  },
  sidebarItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    color: '#c9d1d9',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 400,
    textAlign: 'left' as const,
    width: '100%',
  },
  sidebarItemActive: {
    background: '#1f6feb',
    color: '#ffffff',
    fontWeight: 600,
  },
  sidebarIcon: {
    fontSize: 14,
    flexShrink: 0,
  },

  /* ── Main ── */
  main: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  pageHeader: {
    padding: '20px 24px 16px 24px',
    borderBottom: '1px solid #21262d',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: '#e6edf3',
    margin: '0 0 8px 0',
  },
  pageDesc: {
    fontSize: 12,
    color: '#8b949e',
    margin: 0,
    lineHeight: 1.65,
    maxWidth: 750,
  },

  /* ── Nav tabs ── */
  navTabs: {
    display: 'flex',
    padding: '0 24px',
    borderBottom: '1px solid #21262d',
    background: '#0d1117',
  },
  navTab: {
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#8b949e',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: -1,
  },
  navTabActive: {
    color: '#e6edf3',
    borderBottomColor: '#f78166',
  },

  /* ── Sub-tabs (Variables) ── */
  subTabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 4,
  },
  subTab: {
    padding: '5px 14px',
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 20,
    color: '#8b949e',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },
  subTabActive: {
    background: '#1f6feb22',
    border: '1px solid #1f6feb',
    color: '#58a6ff',
    fontWeight: 600,
  },

  /* ── Content ── */
  content: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flex: 1,
  },
  tabDesc: {
    fontSize: 12,
    color: '#8b949e',
    margin: 0,
    lineHeight: 1.6,
  },

  /* ── File path ── */
  fileRow: { display: 'flex', flexDirection: 'column', gap: 8 },
  fileToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#8b949e',
    cursor: 'pointer',
    fontSize: 11,
    padding: '4px 10px',
    fontFamily: 'monospace',
  },
  fileToggleArrow: { fontSize: 9, marginLeft: 4 },
  fileControls: { display: 'flex', gap: 8, alignItems: 'center' },
  fileInput: {
    flex: 1,
    padding: '6px 10px',
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#c9d1d9',
    fontSize: 12,
    fontFamily: 'monospace',
    outline: 'none',
  },

  /* ── Form ── */
  formBox: {
    border: '1px solid #30363d',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#161b22',
  },
  formHeader: { padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#21262d' },
  formTitle: { margin: 0, fontSize: 14, fontWeight: 600, color: '#e6edf3' },
  formBody: { padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 },
  formField: { display: 'flex', flexDirection: 'column', gap: 6 },
  formLabel: { fontSize: 12, fontWeight: 600, color: '#c9d1d9' },
  formInput: {
    padding: '8px 12px',
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#c9d1d9',
    fontSize: 13,
    fontFamily: 'monospace',
    outline: 'none',
  },
  formTextarea: {
    padding: '8px 12px',
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#c9d1d9',
    fontSize: 13,
    fontFamily: 'monospace',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.5,
  },
  formHint: {
    margin: 0,
    fontSize: 11,
    color: '#d29922',
    background: '#1c1500',
    border: '1px solid #3d2b00',
    borderRadius: 4,
    padding: '6px 10px',
  },
  code: {
    fontFamily: 'monospace',
    background: '#21262d',
    padding: '1px 4px',
    borderRadius: 3,
    fontSize: 11,
  },
  formActions: { display: 'flex', gap: 8, paddingTop: 4 },

  /* ── Section / Table ── */
  section: { border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#161b22',
    borderBottom: '1px solid #21262d',
  },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#e6edf3' },
  table: { display: 'flex', flexDirection: 'column', background: '#0d1117' },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 88px',
    padding: '8px 16px',
    background: '#161b22',
    borderBottom: '1px solid #21262d',
    gap: 12,
  },
  thName: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6e7681',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  thValue: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6e7681',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  thActions: { width: 88 },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 88px',
    padding: '12px 16px',
    borderBottom: '1px solid #21262d',
    gap: 12,
    alignItems: 'center',
  },
  tableRowLast: { borderBottom: 'none' },
  tdName: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  lockIcon: { fontSize: 13, flexShrink: 0 },
  itemName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#58a6ff',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  tdValue: { minWidth: 0, overflow: 'hidden' },
  maskedValue: { fontSize: 12, color: '#6e7681', letterSpacing: 2 },
  plainValue: {
    fontSize: 12,
    color: '#8b949e',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    display: 'block',
  },
  noValue: { color: '#484f58' },
  tdActions: { display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '40px 20px',
    background: '#0d1117',
  },
  emptyText: { fontSize: 13, color: '#6e7681', margin: 0, textAlign: 'center' as const },

  /* ── Buttons ── */
  btnGreen: {
    padding: '6px 14px',
    background: '#238636',
    border: '1px solid rgba(240,246,252,0.1)',
    borderRadius: 6,
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },
  btnGreenSm: {
    padding: '5px 12px',
    background: '#238636',
    border: '1px solid rgba(240,246,252,0.1)',
    borderRadius: 6,
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  btnOutline: {
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#c9d1d9',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },
  iconBtn: {
    padding: '4px 8px',
    background: 'transparent',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#8b949e',
    cursor: 'pointer',
    fontSize: 13,
    lineHeight: '1',
  },
  iconBtnDanger: { color: '#f85149' },
};
