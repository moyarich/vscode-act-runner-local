import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TemplateEngine } from './templateEngine';

describe('TemplateEngine', () => {
  let root: string;
  let engine: TemplateEngine;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'template-engine-'));
    engine = new TemplateEngine();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lists workflow and script templates without mutating template content', () => {
    const workflows = engine.listWorkflowTemplates();
    const scripts = engine.listScriptTemplates();

    expect(workflows.length).toBeGreaterThan(0);
    expect(scripts.length).toBeGreaterThan(0);
    expect(workflows.some((t) => t.id === 'ci-nodejs')).toBe(true);
    expect(scripts.some((t) => t.id === 'bash-deploy')).toBe(true);
  });

  it('creates a workflow file in .github/workflows with the template content', async () => {
    const template = engine.listWorkflowTemplates().find((t) => t.id === 'ci-nodejs');
    expect(template).toBeDefined();

    const dest = await engine.applyWorkflowTemplate(template!, root);

    expect(dest).toBe(path.join(root, '.github', 'workflows', template!.fileName));
    expect(fs.readFileSync(dest, 'utf-8')).toBe(template!.content);
  });

  it('refuses to overwrite an existing workflow file', async () => {
    const template = engine.listWorkflowTemplates()[0];
    const dir = path.join(root, '.github', 'workflows');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, template.fileName), 'existing', 'utf-8');

    await expect(engine.applyWorkflowTemplate(template, root)).rejects.toThrow(
      `Arquivo já existe: ${template.fileName}`
    );
    expect(fs.readFileSync(path.join(dir, template.fileName), 'utf-8')).toBe('existing');
  });

  it('generates bash scripts and marks them executable', async () => {
    const template = engine.listScriptTemplates().find((t) => t.language === 'bash');
    expect(template).toBeDefined();

    const dest = await engine.generateScript(template!, root);
    const mode = fs.statSync(dest).mode & 0o777;

    expect(fs.readFileSync(dest, 'utf-8')).toBe(template!.content);
    expect(mode & 0o111).not.toBe(0);
  });

  it('generates non-bash scripts without requiring executable permissions', async () => {
    const template = engine.listScriptTemplates().find((t) => t.language === 'python');
    expect(template).toBeDefined();

    const dest = await engine.generateScript(template!, root);

    expect(dest).toBe(path.join(root, 'scripts', template!.fileName));
    expect(fs.readFileSync(dest, 'utf-8')).toBe(template!.content);
  });
});
