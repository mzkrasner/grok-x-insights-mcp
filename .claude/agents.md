# Agents

This document describes the AI-powered tools available in this repository.

## Grok X Insights

Real-time social intelligence from X/Twitter powered by Grok's live search capabilities.

### Available via MCP Server

When running as an MCP server (`npm run dev`), these tools are available to AI assistants:

| Tool | Description |
|------|-------------|
| `grok_search_posts` | Search and analyze X/Twitter posts with sentiment/themes |
| `grok_analyze_topic` | Deep analysis with customizable aspects |
| `grok_get_trends` | Identify trending topics and discussions |
| `grok_chat` | Chat with Grok AI, optionally grounded in X data |

### Available via CLI

The `grok` CLI provides direct terminal access:

```bash
grok search "query"     # Search posts
grok analyze "topic"    # Deep analysis
grok trends             # Get trends
grok chat "message"     # Chat with Grok
```

### Claude Code Skill

Use `/grok-insights` in Claude Code to access these capabilities:

```
/grok-insights What's trending in AI?
/grok-insights Tesla stock sentiment
```

## Configuration

All agents require a `GROK_API_KEY` environment variable. Get your key at https://console.x.ai/

Default model: `grok-4-1-fast`
