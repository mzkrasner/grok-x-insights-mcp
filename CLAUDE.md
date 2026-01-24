# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**grok-mcp** is a Model Context Protocol (MCP) server and CLI for real-time X/Twitter social intelligence powered by Grok's Agent Tools API.

**Default model:** `grok-4-1-fast`

## Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start MCP server in dev mode
npm run build        # Build for production

# Quality Assurance
npm run qa           # Full QA suite (format, lint, type-check, test, build)
npm run qa:quick     # Quick check (lint + type-check only)

# Individual checks
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run type-check   # TypeScript checking (tsc --noEmit)
npm run format       # Format code with Prettier
npm run format:check # Check formatting

# Testing
npm test             # Run all tests
npm run test:unit    # Unit tests only (mocked, fast)
npm run test:integration  # Integration tests (real API, requires GROK_API_KEY)
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

## Git Hooks

Pre-commit and pre-push hooks are installed via Husky.

**Pre-commit runs:**
- lint-staged (auto-format)
- ESLint
- TypeScript type-check
- Unit tests
- Secret detection

**Pre-push runs:**
- All pre-commit checks
- Full test suite
- Build verification
- Integration tests (requires `GROK_API_KEY`)

## CLI Usage

The `grok` CLI is available after `npm install && npm run build`:

```bash
grok search "topic"    # Search and analyze posts
grok analyze "topic"   # Deep analysis with custom aspects
grok trends            # Get trending topics
grok chat "message"    # Chat with Grok (optionally with --search)
```

Use `-f text` for human-readable output, default is JSON.

## Architecture

```
src/
├── index.ts          # MCP server entry point
├── cli.ts            # CLI entry point
├── grok-api.ts       # API client (uses /v1/responses with x_search tool)
├── schemas.ts        # Zod schemas for validation
├── config.ts         # Configuration and logging
└── __tests__/        # Test suite
```

The API client uses xAI's Agent Tools API (`/v1/responses`) with `tools: [{ type: 'x_search' }]` for live X/Twitter data.

## Environment

Requires `GROK_API_KEY` in `.env` file. Get your key at https://console.x.ai/
