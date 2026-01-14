# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**grok-mcp** is a Model Context Protocol (MCP) server for integrating Grok (X/Twitter AI) with AI assistants.

## Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start MCP server in dev mode

# Quality checks (run ALL before claiming work is done!)
npm run lint         # ESLint
npm run type-check   # TypeScript checking (tsc --noEmit)
npm test             # Run all tests (Vitest)
npm run build        # Build for production

# Formatting
npm run format       # Format code with Prettier
npm run format:check # Check formatting

# Testing
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
