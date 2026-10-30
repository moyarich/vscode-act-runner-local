import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/** UI text belongs in translation catalogs. Brand names, filenames, booleans
 * and Git reference examples are data, not localizable interface copy. */
const allowedValues = new Set([
  'Act Visual Runner',
  '⚙ act',
  '.secrets',
  '.gitignore',
  'true',
  'false',
  'main',
]);

describe('webview static UI text localization', () => {
  const dir = path.join(__dirname, 'components');

  it('does not introduce untranslated JSX text or literal accessibility labels', () => {
    const missing: string[] = [];
    const files = [...fs.readdirSync(dir).filter((name) => name.endsWith('.tsx')), 'App.tsx'];

    for (const file of files) {
      const location = file === 'App.tsx' ? path.join(__dirname, file) : path.join(dir, file);
      const source = fs.readFileSync(location, 'utf8');
      const tree = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      const verify = (value: string, node: ts.Node) => {
        const text = value.trim();
        if (!/[a-zA-Z]{3}/.test(text) || allowedValues.has(text)) return;
        const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
        missing.push(`${file}:${line}: ${JSON.stringify(text)}`);
      };
      const visit = (node: ts.Node): void => {
        if (ts.isJsxText(node)) verify(node.getText(tree), node);
        if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
          if (
            ts.isIdentifier(node.name) &&
            ['title', 'placeholder', 'aria-label', 'alt'].includes(node.name.text)
          ) {
            verify(node.initializer.text, node);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
    expect(missing).toEqual([]);
  });
});
