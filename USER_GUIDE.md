# Act Visual Runner - User Guide

[English](USER_GUIDE.md) | [Português (Brasil)](USER_GUIDE-pt-br.md)

## Requirements

Before using the extension, confirm that you have:

1. **nektos/act** installed
2. **Docker** (or Rancher Desktop / OrbStack / Podman with a compatible Docker socket) running
3. A repository with workflows in `.github/workflows/*.yml`

## nektos/act Installation

To install `act`, follow the [official documentation](https://nektosact.com/installation/index.html).

## First Run

### 1. Open the panel

Click the **ACT Runner** icon in the VS Code Activity Bar.

### 2. Select the project

If the workspace contains multiple folders, use **Act: Select Project** to choose the correct repository.

### 3. Run a workflow

- In the **Workflow Explorer**, expand the workflow list.
- Select the desired workflow and click **Run**.
- Or use the Command Palette (`Ctrl+Shift+P`) and choose **Act: Run Workflow**.

The visual graph opens automatically and updates in real time.

## Execution Graph

The graph displays **jobs** as colored cards with their dependencies:

| Color        | Status                 |
| ------------ | ---------------------- |
| Gray         | Waiting                |
| Pulsing blue | Running                |
| Green        | Completed successfully |
| Red          | Failed                 |
| Yellow       | Skipped                |

- **Click a card** to expand its internal steps.
- **Drag** cards to reposition them on the canvas.
- **Connectors** show the dependency flow, with only essential edges.

## Configure Secrets and Variables

Create these files at the repository root:

**`.secrets`** - secrets passed to act:

```
GITHUB_TOKEN=ghp_...
SONAR_TOKEN=sqa_...
DOCKER_PASSWORD=...
```

**`.env`** - environment variables:

```
ENV=local
APP_URL=http://localhost:3000
```

**`.actrc`** - default act configuration:

```
--platform ubuntu-latest=catthehacker/ubuntu:act-latest
--secret-file .secrets
--env-file .env
```

Or use the UI: `Ctrl+Shift+P` -> **Act: Manage Environment Variables**.

> [!IMPORTANT]
> Never commit `.secrets`. Add it to `.gitignore`.

## Run a Specific Job

1. `Ctrl+Shift+P` -> **Act: Run Job**
2. Select the workflow and then the desired job.

## Validate a Workflow

`Ctrl+Shift+P` -> **Act: Validate Workflow**

This checks YAML syntax before execution. It is also available as **CodeLens** directly in workflow `.yml` files.

## Execution History

`Ctrl+Shift+P` -> **Act: View History**

Lists previous executions with status, duration, and rerun actions.

## Configure the `act` Path

If `act` is not on `PATH`:

1. Open Settings with `Ctrl+,` and search for `actRunner.actPath`.
2. Enter the full path, such as `/usr/local/bin/act` or `C:\tools\act.exe`.

Or use `Ctrl+Shift+P` -> **Act: Locate act Executable**.

## Common Problems

| Problem                                                   | Solution                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| `act: command not found`                                  | Configure `actRunner.actPath` or install act                  |
| `Cannot connect to Docker`                                | Start Docker Desktop / Rancher Desktop                        |
| `ERROR: image not found`                                  | Add `--pull=missing` to `.actrc`                              |
| Workflow does not appear in the explorer                  | Confirm that files exist in `.github/workflows/`              |
| `Connect Timeout Error` in actions calling the GitHub API | Add `github-token: ${{ github.token \|\| '' }}` to the action |
| Graph does not update                                     | Use **Act: Force Reset State** in the Command Palette         |

## Docker Desktop Alternatives

For corporate environments that cannot use Docker Desktop:

`Ctrl+Shift+P` -> **Act: Docker Alternatives Guide**

The guide covers Rancher Desktop, OrbStack, Podman Desktop, and Colima.
