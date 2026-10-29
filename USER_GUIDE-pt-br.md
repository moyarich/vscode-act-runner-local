# Act Visual Runner - Guia do usuário

[English](USER_GUIDE.md) | **Português (Brasil)**

## Requisitos

Antes de usar a extensão, confirme que você tem:

1. **nektos/act** instalado
2. **Docker** (ou Rancher Desktop / OrbStack / Podman com um socket Docker compatível) em execução
3. Um repositório com workflows em `.github/workflows/*.yml`

## Instalação do nektos/act

Para instalar o `act`, siga a [documentação oficial](https://nektosact.com/installation/index.html).

## Primeira execução

### 1. Abra o painel

Clique no ícone **ACT Runner** na barra de atividades do VS Code.

### 2. Selecione o projeto

Se o workspace tiver várias pastas, use **Act: Selecionar Projeto** para escolher o repositório correto.

### 3. Execute um workflow

- No **Workflow Explorer**, expanda a lista de workflows.
- Selecione o workflow desejado e clique em **Run**.
- Ou use a Command Palette (`Ctrl+Shift+P`) e escolha **Act: Run Workflow**.

O grafo visual abre automaticamente e é atualizado em tempo real.

## Grafo de execução

O grafo exibe os **jobs** como cards coloridos com suas dependências:

| Cor           | Status                |
| ------------- | --------------------- |
| Cinza         | Aguardando            |
| Azul pulsante | Em execução           |
| Verde         | Concluído com sucesso |
| Vermelho      | Falhou                |
| Amarelo       | Ignorado              |

- **Clique em um card** para expandir seus steps internos.
- **Arraste** os cards para reposicioná-los no canvas.
- **Conectores** mostram o fluxo de dependências, apenas com as arestas essenciais.

## Configure secrets e variáveis

Crie estes arquivos na raiz do repositório:

**`.secrets`** - secrets passados ao act:

```
GITHUB_TOKEN=ghp_...
SONAR_TOKEN=sqa_...
DOCKER_PASSWORD=...
```

**`.env`** - variáveis de ambiente:

```
ENV=local
APP_URL=http://localhost:3000
```

**`.actrc`** - configuração padrão do act:

```
--platform ubuntu-latest=catthehacker/ubuntu:act-latest
--secret-file .secrets
--env-file .env
```

Ou use a UI: `Ctrl+Shift+P` -> **Act: Gerenciar Variáveis de Ambiente**.

> [!IMPORTANT]
> Nunca versione `.secrets`. Adicione o arquivo ao `.gitignore`.

## Execute um job específico

1. `Ctrl+Shift+P` -> **Act: Executar Job**
2. Selecione o workflow e depois o job desejado.

## Valide um workflow

`Ctrl+Shift+P` -> **Act: Validar Workflow**

Isso verifica a sintaxe YAML antes da execução. A opção também está disponível como **CodeLens** diretamente nos arquivos `.yml` de workflow.

## Histórico de execuções

`Ctrl+Shift+P` -> **Act: Ver Histórico**

Lista execuções anteriores com status, duração e ações para reexecutar.

## Configure o caminho do `act`

Se o `act` não estiver no `PATH`:

1. Abra as configurações com `Ctrl+,` e pesquise por `actRunner.actPath`.
2. Informe o caminho completo, como `/usr/local/bin/act` ou `C:\tools\act.exe`.

Ou use `Ctrl+Shift+P` -> **Act: Localizar Executável do act**.

## Problemas comuns

| Problema                                                      | Solução                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| `act: command not found`                                      | Configure `actRunner.actPath` ou instale o act                |
| `Cannot connect to Docker`                                    | Inicie o Docker Desktop / Rancher Desktop                     |
| `ERROR: image not found`                                      | Adicione `--pull=missing` ao `.actrc`                         |
| O workflow não aparece no explorador                          | Confirme que existem arquivos em `.github/workflows/`         |
| `Connect Timeout Error` em actions que chamam a API do GitHub | Adicione `github-token: ${{ github.token \|\| '' }}` à action |
| O grafo não é atualizado                                      | Use **Act: Resetar Estado (forçar)** na Command Palette       |

## Alternativas ao Docker Desktop

Para ambientes corporativos que não podem usar o Docker Desktop:

`Ctrl+Shift+P` -> **Act: Guia Alternativas Docker**

O guia cobre Rancher Desktop, OrbStack, Podman Desktop e Colima.
