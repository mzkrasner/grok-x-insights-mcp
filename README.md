# Grok X Insights — CLI & MCP Server

Real-time X/Twitter social intelligence for AI agents and developers — powered by Grok's live search capabilities.

Search posts, analyze sentiment, track trends, and understand what the world is talking about. Use the MCP server to give AI assistants like Claude Desktop and Cursor live X/Twitter awareness, or use the `grok` CLI directly — ideal for AI coding agents like Claude Code that can run shell commands on your behalf.

## Quick Start

```bash
npm install && npm run build
export GROK_API_KEY=your_key_here   # get one at https://console.x.ai/

# From your terminal (or let your AI agent run these for you)
grok search "artificial intelligence" -f text
grok trends --category technology
grok chat "What are people saying about OpenAI?" --search
```

## Features

- **Search & Analyze** — Query any topic and get structured analysis with themes, sentiment, and key observations
- **Deep Topic Analysis** — Customize what aspects to analyze (influencers, controversy, emerging trends, etc.)
- **Trend Detection** — Identify what's trending with volume metrics and sentiment breakdown
- **Grounded Chat** — Chat with Grok AI, optionally grounded in live X/Twitter data
- **Live Citations** — Every analysis includes source URLs from actual X/Twitter posts
- **CLI for Agents & Humans** — A `grok` command that AI coding agents (Claude Code, Copilot, etc.) can invoke on your behalf, or that you can run directly
- **MCP Server** — Plug into Claude Desktop, Cursor, or any MCP-compatible AI assistant
- **Claude Code Skill** — Built-in `/grok-insights` skill for seamless Claude Code integration
- **Reliable** — Automatic retry with exponential backoff for rate limits
- **Type-Safe** — Full TypeScript with Zod runtime validation

## Installation

```bash
npm install
npm run build
```

This installs the `grok` CLI and builds the MCP server.

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your Grok API key to `.env`:
```env
GROK_API_KEY=your_grok_api_key_here
```

Get your API key at: https://console.x.ai/

### Optional Configuration

```env
# Model to use (default: grok-4-1-fast)
GROK_MODEL=grok-4-1-fast

# Default search limit (default: 50)
DEFAULT_SEARCH_LIMIT=50

# Log level (default: info)
LOG_LEVEL=debug
```

## Command-Line Interface

The `grok` CLI gives AI agents and developers direct access to X/Twitter intelligence from the terminal.

### Search Posts

Analyze X/Twitter posts about any topic:

```bash
# Basic search
grok search "artificial intelligence"

# With options
grok search "climate change" --time-window 24hr --limit 30 --analysis sentiment

# Human-readable output
grok search "Tesla stock" -f text
```

**Options:**
- `-t, --time-window`: 15min, 1hr, 4hr, 24hr, 7d (default: 4hr)
- `-l, --limit`: Max posts 1-50 (default: 50)
- `-a, --analysis`: sentiment, themes, both (default: both)
- `-f, --format`: json or text (default: json)

### Analyze Topic

Deep analysis with custom aspects:

```bash
grok analyze "cryptocurrency" --aspects "sentiment,influencers,controversy,emerging trends"

grok analyze "electric vehicles" -a "market sentiment,key players" -t 7d -f text
```

**Options:**
- `-a, --aspects`: Comma-separated aspects to analyze
- `-t, --time-window`: Time window (default: 4hr)
- `-l, --limit`: Max posts (default: 50)

### Get Trends

Identify trending topics:

```bash
# All trends
grok trends

# Filter by category
grok trends --category technology
grok trends -c politics -f text
```

**Options:**
- `-c, --category`: technology, politics, sports, entertainment
- `-l, --limit`: Max posts to analyze (default: 50)

### Chat

General chat with Grok, optionally grounded in X/Twitter data:

```bash
# Simple chat
grok chat "What is quantum computing?"

# Chat with X/Twitter search enabled
grok chat "What are people saying about the new iPhone?" --search

# Adjust creativity
grok chat "Write a haiku about AI" --temperature 0.9 -f text
```

**Options:**
- `-s, --search`: Enable X/Twitter search
- `-l, --search-limit`: Max posts to search (default: 50)
- `--temperature`: Creativity 0.0-1.0 (default: 0.7)

## Claude Code Skill

A `/grok-insights` skill is included so Claude Code can fetch X/Twitter intelligence for you on demand:

```
/grok-insights What's trending in AI?
/grok-insights Tesla stock sentiment
```

Install the skill globally or per-project:

```bash
# Global skill (all projects)
~/.claude/skills/grok-insights/SKILL.md

# Project skill (this repo only)
.claude/skills/grok-insights/SKILL.md
```

## MCP Server Integration

### Claude Desktop

Add to your Claude Desktop config:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "grok-x-insights": {
      "command": "node",
      "args": ["/absolute/path/to/grok-mcp/dist/index.js"],
      "env": {
        "GROK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|---|---|
| `grok_search_posts` | Search and analyze X/Twitter posts about any topic |
| `grok_analyze_topic` | Deep analysis with customizable aspects (influencers, controversy, etc.) |
| `grok_get_trends` | Identify trending topics with volume and sentiment breakdown |
| `grok_chat` | Chat with Grok AI, optionally grounded in live X data |

<details>
<summary>Full tool parameters</summary>

**grok_search_posts**
- `query` (required): The search query or topic
- `timeWindow`: "15min", "1hr", "4hr", "24hr", "7d" (default: "4hr")
- `limit`: 1-50 (default: 50)
- `analysisType`: "sentiment", "themes", "both" (default: "both")

**grok_analyze_topic**
- `topic` (required): The topic to analyze
- `aspects` (required): Array of aspects to analyze
- `timeWindow`: Time window (default: "4hr")
- `limit`: 1-50 (default: 50)

**grok_get_trends**
- `category`: "technology", "politics", "sports", "entertainment"
- `limit`: 1-50 (default: 50)

**grok_chat**
- `prompt` (required): Your message
- `enableSearch`: Enable X search (default: false)
- `searchLimit`: 1-50 (default: 50)
- `temperature`: 0.0-1.0 (default: 0.7)

</details>

## Architecture

```
grok-mcp/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── cli.ts            # CLI entry point
│   ├── grok-api.ts       # API client with retry logic
│   ├── schemas.ts        # Zod schemas for validation
│   ├── config.ts         # Configuration and logging
│   └── __tests__/        # Test suite
│       ├── grok-api.test.ts              # Unit tests
│       ├── grok-api.integration.test.ts  # Integration tests
│       └── test-utils.ts                 # Test utilities
├── .husky/               # Git hooks
│   ├── pre-commit        # Lint, type-check, unit tests
│   └── pre-push          # Full QA + integration tests
└── .claude/skills/       # Claude Code skill
```

## Development

### Commands

```bash
npm run dev           # Start MCP server in dev mode
npm run build         # Build TypeScript
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests (requires API key)
npm run qa            # Full QA suite (format, lint, type-check, test, build)
npm run qa:quick      # Quick check (lint + type-check)
```

### Git Hooks

Pre-commit runs:
- lint-staged (auto-format)
- ESLint
- TypeScript type-check
- Unit tests
- Secret detection

Pre-push runs:
- All pre-commit checks
- Full test suite
- Build verification
- Integration tests (requires `GROK_API_KEY`)

### Testing

```bash
# Unit tests (mocked, fast)
npm run test:unit

# Integration tests (real API, requires GROK_API_KEY)
npm run test:integration

# All tests
npm test

# With coverage
npm run test:coverage
```

## Error Handling

- **Rate Limiting**: Automatic retry with exponential backoff (2s, 4s, 6s)
- **Network Errors**: Retry on connection failures
- **Validation**: Zod schema validation with detailed error messages
- **API Errors**: Graceful handling with error details

## License

[MIT](LICENSE)
