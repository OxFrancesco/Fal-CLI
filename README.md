# Fal CLI Generator

A terminal-based interface for generating images and videos using Fal.ai models.

## Setup

1.  **Install Dependencies**:
    ```bash
    bun install
    ```

2.  **Configure API Key**:
    Copy `.env.example` to `.env` and add your Fal.ai API key.
    ```bash
    cp .env.example .env
    # Edit .env and set FAL_KEY
    ```

## Usage

Run the CLI:
```bash
bun cli.ts
```

## Controls

-   **Tab / Shift+Tab**: Navigate between fields.
-   **Enter**: Select an option (in dropdowns) or Generate (in prompt).
-   **Ctrl+C**: Exit.

## Features

-   **Model Selection**: Choose from Flux, Recraft, Kling, Luma, Minimax.
-   **Aspect Ratio**: Square, Landscape, Portrait.
-   **Real-time Logs**: See generation progress in the console.
-   **Auto-Download**: Generated media is automatically saved to the current directory.
