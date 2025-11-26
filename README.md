# Fal CLI

A terminal UI for generating images and videos using [Fal.ai](https://fal.ai) models.

![Terminal UI](https://img.shields.io/badge/TUI-OpenTUI-blue)
![Models](https://img.shields.io/badge/Models-200+-green)

## Features

- **Fuzzy Search** - Search across 200+ text-to-image and text-to-video models
- **Real-time Progress** - See generation status and queue position
- **Auto-download** - Generated media saved automatically
- **Keyboard-driven** - Full TUI navigation without mouse

## Setup

```bash
# Install dependencies
bun install

# Configure API key
cp .env.example .env
# Edit .env and add your FAL_KEY from https://fal.ai/dashboard/keys
```

## Usage

```bash
bun cli.ts
```

## Navigation

| Key | Action |
|-----|--------|
| `TAB` | Next field |
| `SHIFT+TAB` | Previous field |
| `/` | Jump to search |
| `↑↓` or `j/k` | Navigate lists |
| `ENTER` | Select / Generate |
| `CTRL+C` | Quit |

## Workflow

1. **Search** - Type to fuzzy search models (e.g., "flux", "video", "kling")
2. **Select Model** - Browse with arrows, press Enter to select
3. **Choose Ratio** - Pick aspect ratio for output
4. **Enter Prompt** - Describe what you want to create
5. **Generate** - Press Enter to start generation

## Supported Models

Includes all Fal.ai text-to-image and text-to-video models:

- **Flux 2** - Latest from Black Forest Labs
- **FLUX.1 [dev/schnell/pro]** - Fast & high quality
- **Stable Diffusion 3** - SD3 Medium
- **Recraft V3** - Vector and raster
- **Kling 1.6** - Text to video
- **Veo 2** - Google's video model
- **Luma Dream Machine** - High quality video
- **Hunyuan Video** - Tencent's model
- And 200+ more...

## Output

Generated files are saved to the current directory:
```
output-2024-01-15T10-30-00-000Z.png
output-2024-01-15T10-35-00-000Z.mp4
```

## Troubleshooting

Check `fal-cli.log` for detailed logs if something fails.

## License

MIT
