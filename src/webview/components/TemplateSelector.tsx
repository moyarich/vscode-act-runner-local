import React, { useState } from 'react';
import { t } from '../i18n';

/**
 * Seletor de templates de workflow CI/CD e scripts de automação.
 * Implementação completa: @frontend
 */

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'workflow' | 'script';
  language?: string;
}

const WORKFLOW_TEMPLATES: Template[] = [
  {
    id: 'ci-nodejs',
    name: 'CI — Node.js',
    description: 'Build, lint, and tests for Node.js projects',
    category: 'workflow',
  },
  {
    id: 'ci-python',
    name: 'CI — Python',
    description: 'Build and pytest tests for Python projects',
    category: 'workflow',
  },
  {
    id: 'cd-docker',
    name: 'CD — Docker',
    description: 'Build and push a Docker image to a registry',
    category: 'workflow',
  },
  {
    id: 'release-auto',
    name: 'Automated Release',
    description: 'Semantic release with an automated changelog',
    category: 'workflow',
  },
  {
    id: 'lint',
    name: 'Lint & Format',
    description: 'Code quality verification',
    category: 'workflow',
  },
];

const SCRIPT_TEMPLATES: Template[] = [
  {
    id: 'bash-deploy',
    name: 'Deploy Bash',
    description: 'Script de deploy genérico em Bash',
    category: 'script',
    language: 'bash',
  },
  {
    id: 'ps-azure',
    name: 'Azure PowerShell',
    description: 'Deploy Azure resources with PowerShell',
    category: 'script',
    language: 'powershell',
  },
  {
    id: 'python-api',
    name: 'Python API',
    description: 'Python integration script for REST APIs',
    category: 'script',
    language: 'python',
  },
  {
    id: 'bicep-appservice',
    name: 'Bicep App Service',
    description: 'Infrastructure as code for Azure App Service',
    category: 'script',
    language: 'bicep',
  },
];

export function TemplateSelector() {
  const [section, setSection] = useState<'workflow' | 'script'>('workflow');
  const [selected, setSelected] = useState<string | null>(null);

  const apply = (id: string) =>
    window.__vscode__?.postMessage({
      type: 'command:applyTemplate',
      payload: { templateId: id, category: section },
    });

  const templates = section === 'workflow' ? WORKFLOW_TEMPLATES : SCRIPT_TEMPLATES;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>{t('Templates')}</span>
        <div style={styles.toggle}>
          <button
            style={{ ...styles.btn, ...(section === 'workflow' ? styles.btnActive : {}) }}
            onClick={() => setSection('workflow')}
          >
            📋 {t('Workflows')}
          </button>
          <button
            style={{ ...styles.btn, ...(section === 'script' ? styles.btnActive : {}) }}
            onClick={() => setSection('script')}
          >
            📜 {t('Scripts')}
          </button>
        </div>
      </div>
      <div style={styles.grid}>
        {templates.map((template) => (
          <div
            key={template.id}
            style={{ ...styles.card, ...(selected === template.id ? styles.cardSelected : {}) }}
            onClick={() => setSelected(template.id)}
          >
            <div style={styles.cardName}>{template.name}</div>
            <div style={styles.cardDesc}>{template.description}</div>
            {template.language && <div style={styles.tag}>{template.language}</div>}
            {selected === template.id && (
              <button style={styles.applyBtn} onClick={() => apply(template.id)}>
                {t('Apply template')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 13,
    fontWeight: 600,
    color: '#F3F4F6',
  },
  toggle: { display: 'flex', gap: 4 },
  btn: {
    padding: '4px 10px',
    border: '1px solid #374151',
    borderRadius: 4,
    background: 'transparent',
    color: '#9CA3AF',
    cursor: 'pointer',
    fontSize: 12,
  },
  btnActive: { background: '#374151', color: '#F3F4F6', borderColor: '#6B7280' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  card: {
    padding: 14,
    border: '1px solid #374151',
    borderRadius: 6,
    background: '#1F2937',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardSelected: { borderColor: '#3B82F6', background: '#1E3A5F' },
  cardName: { fontWeight: 600, fontSize: 13, color: '#F3F4F6' },
  cardDesc: { fontSize: 12, color: '#9CA3AF', lineHeight: 1.4 },
  tag: {
    fontSize: 10,
    padding: '2px 6px',
    background: '#374151',
    borderRadius: 10,
    color: '#D1D5DB',
    alignSelf: 'flex-start',
  },
  applyBtn: {
    marginTop: 6,
    padding: '5px 10px',
    background: '#3B82F6',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    alignSelf: 'flex-start',
  },
};
