import * as fs from 'fs';
import * as path from 'path';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'ci' | 'cd' | 'release' | 'lint' | 'security';
  tags: string[];
  fileName: string;
  content: string;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  language: 'bash' | 'powershell' | 'python' | 'bicep';
  fileName: string;
  content: string;
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'ci-nodejs',
    name: 'CI Node.js',
    description: 'Build, teste e matrix de versões Node.js',
    category: 'ci',
    tags: ['node', 'npm', 'test'],
    fileName: 'ci-nodejs.yml',
    content: `name: CI Node.js
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: npm
      - name: Instalar dependências
        run: npm ci
      - name: Build
        run: npm run build
      - name: Testes
        run: npm test
`,
  },
  {
    id: 'ci-python',
    name: 'CI Python',
    description: 'Testes com pytest e matrix de versões Python',
    category: 'ci',
    tags: ['python', 'pytest'],
    fileName: 'ci-python.yml',
    content: `name: CI Python
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.10', '3.11', '3.12']
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python \${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: \${{ matrix.python-version }}
      - name: Instalar dependências
        run: pip install -r requirements.txt
      - name: Testes
        run: pytest
`,
  },
  {
    id: 'cd-docker',
    name: 'Deploy Docker',
    description: 'Build e push para GitHub Container Registry',
    category: 'cd',
    tags: ['docker', 'ghcr', 'deploy'],
    fileName: 'cd-docker.yml',
    content: `name: Build e Deploy Docker
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Login no Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - name: Build e Push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/\${{ github.repository }}:latest
`,
  },
  {
    id: 'release-auto',
    name: 'Release Automático',
    description: 'Cria release ao fazer push de tag v*',
    category: 'release',
    tags: ['release', 'tag'],
    fileName: 'release.yml',
    content: `name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - name: Criar Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
`,
  },
  {
    id: 'lint',
    name: 'Lint e Formatação',
    description: 'Valida código com ESLint e Prettier',
    category: 'lint',
    tags: ['eslint', 'prettier'],
    fileName: 'lint.yml',
    content: `name: Lint
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: ESLint
        run: npm run lint
      - name: Prettier
        run: npm run format:check
`,
  },
];

const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'bash-deploy',
    name: 'Deploy Bash',
    description: 'Script de deploy genérico para Linux/macOS',
    language: 'bash',
    fileName: 'deploy.sh',
    content: `#!/usr/bin/env bash
set -euo pipefail

APP_NAME="\${APP_NAME:-minha-app}"
ENV="\${DEPLOY_ENV:-staging}"

echo "🚀 Iniciando deploy de $APP_NAME para $ENV"

npm ci && npm run build
npm test

echo "✅ Deploy de $APP_NAME para $ENV concluído!"
`,
  },
  {
    id: 'ps-azure',
    name: 'Deploy Azure (PowerShell)',
    description: 'Script de deploy Azure com PowerShell',
    language: 'powershell',
    fileName: 'deploy-azure.ps1',
    content: `#Requires -Version 7.0
param(
  [Parameter(Mandatory=$true)][string]$AppName,
  [ValidateSet('dev','staging','prod')][string]$Environment = 'staging'
)
$ErrorActionPreference = 'Stop'
Write-Host "🚀 Deploy de $AppName para $Environment" -ForegroundColor Cyan
# az webapp deployment source config-zip --resource-group rg --name $AppName --src app.zip
Write-Host "✅ Concluído!" -ForegroundColor Green
`,
  },
  {
    id: 'python-api',
    name: 'Automação de API (Python)',
    description: 'Script Python para automação com APIs REST',
    language: 'python',
    fileName: 'automate.py',
    content: `#!/usr/bin/env python3
import os
import sys
import logging
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> int:
    api_url = os.environ.get("API_URL", "")
    api_token = os.environ.get("API_TOKEN", "")
    if not api_url or not api_token:
        logger.error("API_URL e API_TOKEN são obrigatórios")
        return 1
    headers = {"Authorization": f"Bearer {api_token}"}
    r = requests.get(f"{api_url}/health", headers=headers, timeout=30)
    r.raise_for_status()
    logger.info("✅ API OK: %s", r.json())
    return 0


if __name__ == "__main__":
    sys.exit(main())
`,
  },
  {
    id: 'bicep-appservice',
    name: 'App Service Azure (Bicep)',
    description: 'Infraestrutura Azure App Service como código',
    language: 'bicep',
    fileName: 'appservice.bicep',
    content: `@description('Nome da aplicação')
param appName string

@description('Ambiente de deploy')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

param location string = resourceGroup().location

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '\${appName}-plan-\${environment}'
  location: location
  sku: { name: environment == 'prod' ? 'P1v3' : 'B1' }
  properties: { reserved: true }
}

resource app 'Microsoft.Web/sites@2023-01-01' = {
  name: '\${appName}-\${environment}'
  location: location
  properties: {
    serverFarmId: plan.id
    siteConfig: { linuxFxVersion: 'NODE|20-lts' }
    httpsOnly: true
  }
}

output webAppUrl string = 'https://\${app.properties.defaultHostName}'
`,
  },
];

export class TemplateEngine {
  listWorkflowTemplates(): WorkflowTemplate[] {
    return WORKFLOW_TEMPLATES;
  }

  listScriptTemplates(): ScriptTemplate[] {
    return SCRIPT_TEMPLATES;
  }

  async applyWorkflowTemplate(template: WorkflowTemplate, workspaceRoot: string): Promise<string> {
    const dir = path.join(workspaceRoot, '.github', 'workflows');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, template.fileName);
    if (fs.existsSync(dest)) {
      throw new Error(
        `Arquivo já existe: ${template.fileName}. Remova-o antes de aplicar o template.`
      );
    }
    fs.writeFileSync(dest, template.content, 'utf-8');
    return dest;
  }

  async generateScript(template: ScriptTemplate, workspaceRoot: string): Promise<string> {
    const dir = path.join(workspaceRoot, 'scripts');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, template.fileName);
    fs.writeFileSync(dest, template.content, 'utf-8');
    if (template.language === 'bash') {
      fs.chmodSync(dest, 0o755);
    }
    return dest;
  }
}

export const templateEngine = new TemplateEngine();
