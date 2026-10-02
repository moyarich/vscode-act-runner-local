# Act/Run - GitHub Actions Visual locally - VS Code Extension

[![Visual Studio Marketplace Version](https://vsmarketplacebadges.dev/version/fean-developer.act-visual-runner.svg)](https://img.shields.io/visual-studio-marketplace/v/fean-developer.act-visual-runner?style=flat-square&label=Visual%20Studio%20Marketplace)
[![Release](https://img.shields.io/github/v/release/fean-developer/vscode-act-runner-local?style=flat-square&label=release)](https://flat.badgen.net/github/release/fean-developer/act-visual-runner)
[![License](https://img.shields.io/github/license/fean-developer/vscode-act-runner-local?style=flat-square)](LICENSE)

[English](README.md) | [Português (Brasil)](README-pt-br.md)

VS Code extension that runs GitHub Actions workflows locally using [nektos/act](https://github.com/nektos/act) and visualizes execution in real time through an interactive n8n-style graph.

![Extension preview](images/vscode-act-ext.gif)

### New Layout

- Integrated sidebar UI.
- Repository selection opens in the main editor column for a more spacious experience.

<img src="images/image-new-1.png" alt="Act Runner workflow view" width="1024">

### Summary

- View the same workflow summary produced by GitHub Actions.

<img src="images/image-summary.png" alt="Workflow summary" width="1024">

### Analytics

- Review analytics based on local execution history.

<img src="images/image-analytic.png" alt="Execution analytics" width="1024">

This extension makes testing GitHub Actions locally more productive by providing an intuitive visual interface with real-time execution feedback.

> [!IMPORTANT]
> This extension requires [nektos/act](https://github.com/nektos/act) to be installed.

## Requirements

- [nektos/act](https://github.com/nektos/act) installed and available on `PATH`, or configured through `actRunner.actPath`.
- Docker or a compatible alternative such as Podman, Rancher Desktop, or OrbStack.
- VS Code 1.85 or newer.

## Installation

1. Open the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/).
2. Search for **Act/Run - GitHub Actions Visual locally**.
3. Select the extension and click **Install**.

### Install from GitHub Releases

Download the `.vsix` asset from the [latest GitHub Release](https://github.com/fean-developer/vscode-act-runner-local/releases), then open the Extensions view, select `...` -> **Install from VSIX...**, and choose the downloaded file. From a terminal, use `code --install-extension act-visual-runner-<version>.vsix`.

See [the release process](docs/RELEASE_PROCESS.md) for maintainer instructions.

## Quick Start

1. Open a repository containing workflows in `.github/workflows/`.
2. Click the **ACT Runner** icon in the Activity Bar.
3. Select a workflow in the explorer and click **Run**.
4. The graph opens automatically and displays each job and step status in real time.

## Available Commands

| Command | Description |
|---|---|
| `Act: Run Workflow` | Run a complete workflow |
| `Act: Quick Run` | Run the default workflow without prompts |
| `Act: Run Job` | Run a specific job |
| `Act: Stop Execution` | Cancel the current execution |
| `Act: Validate Workflow` | Validate workflow YAML |
| `Act: View History` | View previous executions |
| `Act: Docker Alternatives Guide` | View free alternatives to Docker Desktop |

## Configuration

| Setting | Description | Default |
|---|---|---|
| `actRunner.actPath` | Path to the `act` executable | `act` (`PATH`) |
| `actRunner.defaultImage` | Default Docker image | `catthehacker/ubuntu:act-latest` |

Configure the extension through **Preferences -> Settings -> Act Visual Runner**.

## Configuration Files

Optionally, act can be configured using these configuration files:

- **`.actrc`** - default act flags.
- **`.secrets`** - secrets in `KEY=value` format.
- **`.env`** - environment variables.

See [the act configuration guide](docs/actrc.md) and [`.actrc.example`](.actrc.example) for a copyable local configuration.

## User Guide

See the [English user guide](USER_GUIDE.md) or the [Portuguese user guide](USER_GUIDE-pt-br.md) for detailed usage instructions.

## License

MIT
