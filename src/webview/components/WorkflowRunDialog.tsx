import React, { useEffect, useMemo, useState } from 'react';
import {
  useExecutionStore,
  type WorkflowInputItem,
  type WorkflowInputValue,
} from '../store/executionStore';
import { t } from '../i18n';

type InputValue = WorkflowInputValue;
type WebviewWindow = Window & { __vscode__?: { postMessage: (msg: unknown) => void } };

export function WorkflowRunDialog() {
  const {
    workflows,
    workflowRunDialogPath,
    workflowInputValues,
    workflowBranches,
    repository,
    closeWorkflowRunDialog,
    setWorkflowInputValue,
    setWorkflowInputValues,
    setWorkflowBranch,
  } = useExecutionStore();
  const workflow = workflows.find((item) => item.filePath === workflowRunDialogPath);
  const branchOptions = repository?.branches ?? [];
  const selectedBranch = workflow
    ? (workflowBranches[workflow.filePath] ??
      repository?.currentBranch ??
      branchOptions[0] ??
      'main')
    : 'main';

  const initialValues = useMemo(() => {
    const values: Record<string, InputValue> = {};
    const remembered = workflow ? workflowInputValues[workflow.filePath] : undefined;
    workflow?.inputs.forEach((input) => {
      if (remembered && Object.prototype.hasOwnProperty.call(remembered, input.name))
        values[input.name] = remembered[input.name];
      else if (input.default !== undefined) values[input.name] = input.default;
      else if (input.type === 'boolean') values[input.name] = false;
      else values[input.name] = '';
    });
    return values;
  }, [workflow, workflowInputValues]);

  const [values, setValues] = useState<Record<string, InputValue>>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  if (!workflowRunDialogPath || !workflow) return null;

  const setValue = (name: string, value: InputValue) => {
    setValues((current) => ({ ...current, [name]: value }));
    setWorkflowInputValue(workflow.filePath, name, value);
  };

  const missingRequired = workflow.inputs.some(
    (input) => input.required && String(values[input.name] ?? '').trim() === ''
  );

  const run = () => {
    if (missingRequired) return;
    setWorkflowInputValues(workflow.filePath, values);
    setWorkflowBranch(workflow.filePath, selectedBranch);
    (window as WebviewWindow).__vscode__?.postMessage({
      type: 'command:run',
      payload: {
        workflowPath: workflow.filePath,
        workflowInputs: values,
        workflowRef: selectedBranch,
      },
    });
    closeWorkflowRunDialog();
  };

  return (
    <div style={styles.backdrop} onMouseDown={closeWorkflowRunDialog}>
      <div style={styles.dialog} onMouseDown={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Run workflow</div>
            <div style={styles.subtitle}>
              {workflow.name} · {workflow.fileName}
            </div>
          </div>
          <button type="button" style={styles.closeButton} onClick={closeWorkflowRunDialog}>
            ×
          </button>
        </div>

        <div style={styles.branchBox}>
          <div style={styles.label}>Use workflow from</div>
          {branchOptions.length > 0 ? (
            <select
              style={styles.input}
              value={selectedBranch}
              onChange={(event) => setWorkflowBranch(workflow.filePath, event.target.value)}
            >
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          ) : (
            <input
              style={styles.input}
              value={selectedBranch}
              onChange={(event) => setWorkflowBranch(workflow.filePath, event.target.value)}
              placeholder="main"
            />
          )}
        </div>

        <div style={styles.inputs}>
          {workflow.inputs.map((input) => (
            <InputField
              key={input.name}
              input={input}
              value={values[input.name]}
              onChange={(value) => setValue(input.name, value)}
            />
          ))}
        </div>

        <div style={styles.footer}>
          <button type="button" style={styles.secondaryButton} onClick={closeWorkflowRunDialog}>
            {t('Cancel')}
          </button>
          <button
            type="button"
            style={{ ...styles.runButton, ...(missingRequired ? styles.runButtonDisabled : {}) }}
            disabled={missingRequired}
            onClick={run}
          >
            Run workflow
          </button>
        </div>
      </div>
    </div>
  );
}

function InputField({
  input,
  value,
  onChange,
}: {
  input: WorkflowInputItem;
  value: InputValue | undefined;
  onChange: (value: InputValue) => void;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>
        {input.description || input.name}
        {input.required && <span style={styles.required}> *</span>}
      </span>
      {input.type === 'choice' && input.options?.length ? (
        <select
          style={styles.input}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        >
          {!input.required && <option value="">{t('Select...')}</option>}
          {input.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : input.type === 'boolean' ? (
        <select
          style={styles.input}
          value={String(value ?? false)}
          onChange={(event) => onChange(event.target.value === 'true')}
        >
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      ) : (
        <input
          style={styles.input}
          type={input.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(event) =>
            onChange(input.type === 'number' ? Number(event.target.value) : event.target.value)
          }
          placeholder={input.name}
        />
      )}
      {input.description && <span style={styles.inputName}>{input.name}</span>}
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(1, 4, 9, 0.65)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: '74px 32px 32px',
  },
  dialog: {
    width: 360,
    maxHeight: 'calc(100vh - 110px)',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #30363d',
    borderRadius: 6,
    background: '#0d1117',
    color: '#e6edf3',
    boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    borderBottom: '1px solid #30363d',
  },
  title: { fontSize: 14, fontWeight: 700 },
  subtitle: { marginTop: 4, color: '#8b949e', fontSize: 12 },
  closeButton: {
    border: 'none',
    background: 'transparent',
    color: '#8b949e',
    fontSize: 22,
    cursor: 'pointer',
    lineHeight: 1,
  },
  branchBox: { padding: '14px 16px', borderBottom: '1px solid #30363d' },
  label: { marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#e6edf3' },
  inputs: { padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { color: '#e6edf3', fontSize: 12, fontWeight: 600, lineHeight: 1.45 },
  required: { color: '#f85149' },
  input: {
    width: '100%',
    padding: '7px 9px',
    border: '1px solid #30363d',
    borderRadius: 6,
    background: '#161b22',
    color: '#e6edf3',
    fontSize: 12,
  },
  inputName: { color: '#8b949e', fontSize: 11 },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 16,
    borderTop: '1px solid #30363d',
    background: '#010409',
  },
  secondaryButton: {
    padding: '7px 12px',
    border: '1px solid #30363d',
    borderRadius: 6,
    background: '#161b22',
    color: '#c9d1d9',
    cursor: 'pointer',
  },
  runButton: {
    padding: '7px 12px',
    border: '1px solid #238636',
    borderRadius: 6,
    background: '#238636',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  runButtonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
};
