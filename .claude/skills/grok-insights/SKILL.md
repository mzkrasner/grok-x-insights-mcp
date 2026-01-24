---
name: grok-insights
description: Search and analyze X/Twitter posts using the local Grok CLI for real-time social intelligence, sentiment analysis, and trend detection
argument-hint: [query or topic]
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
---

# Grok X Insights (Local CLI)

Get real-time social intelligence from X/Twitter using the locally installed Grok CLI. This skill uses the CLI built from this repository.

## Arguments

$ARGUMENTS

- A search query or topic to analyze (e.g., "artificial intelligence", "climate change")
- If blank, will prompt for a topic

## Prerequisites

The CLI is installed globally when you run `npm install` in this repo. Verify it's available:

```bash
grok --version
```

Ensure `GROK_API_KEY` is set in your environment or `.env` file.

## Available Commands

### 1. Search Posts
Analyze X/Twitter posts about a topic with sentiment and themes.

```bash
grok search "QUERY" --time-window 4hr --limit 30 --analysis both -f text
```

Options:
- `--time-window` or `-t`: 15min, 1hr, 4hr, 24hr, 7d (default: 4hr)
- `--limit` or `-l`: Max posts to analyze, 1-50 (default: 50)
- `--analysis` or `-a`: sentiment, themes, both (default: both)
- `-f` or `--format`: Output format, json or text (default: json)

### 2. Analyze Topic
Deep analysis with custom aspects.

```bash
grok analyze "TOPIC" --aspects "sentiment,influencers,controversy" --time-window 24hr -f text
```

Options:
- `--aspects` or `-a`: Comma-separated aspects to analyze
- `--time-window` or `-t`: Time window for analysis
- `--limit` or `-l`: Max posts to analyze

### 3. Get Trends
Identify trending topics and discussions.

```bash
grok trends --category technology --limit 30 -f text
```

Options:
- `--category` or `-c`: technology, politics, sports, entertainment
- `--limit` or `-l`: Max posts to analyze for trends

### 4. Chat with Grok
General chat, optionally grounded in X/Twitter data.

```bash
grok chat "What are people saying about AI?" --search -f text
```

Options:
- `--search` or `-s`: Enable X/Twitter search
- `--search-limit` or `-l`: Max posts to search if search enabled
- `--temperature`: Response creativity 0.0-1.0 (default: 0.7)

## Process

### Step 1: Understand the request

Determine what kind of analysis the user wants:
- **Search**: Specific topic analysis with sentiment/themes
- **Analyze**: Deep dive with custom aspects
- **Trends**: What's trending right now
- **Chat**: General question, optionally with X data

### Step 2: Run the appropriate command

Based on $ARGUMENTS:

For a simple search:
```bash
grok search "$ARGUMENTS" --time-window 4hr -f text
```

For trend detection:
```bash
grok trends -f text
```

For a grounded chat question:
```bash
grok chat "$ARGUMENTS" --search -f text
```

### Step 3: Present findings

Summarize the results in a clear format:

**Summary:** Brief overview of what people are saying

**Key Themes:**
- Theme 1
- Theme 2

**Sentiment:** Overall positive/negative/neutral/mixed

**Notable Points:**
- Observation 1
- Observation 2

**Citations:** Include relevant X post URLs if available

## Development

To test CLI changes locally:

```bash
# Build the CLI
npm run build

# Test commands
node dist/cli.js search "test query" -f text
node dist/cli.js trends -f text
node dist/cli.js chat "Hello" -f text
```

## Example Usage

User: "What's the sentiment around Tesla stock?"
```bash
grok search "Tesla stock $TSLA" --analysis sentiment --time-window 24hr -f text
```

User: "What's trending in tech?"
```bash
grok trends --category technology -f text
```

User: "Analyze crypto with focus on sentiment and influencers"
```bash
grok analyze "cryptocurrency" --aspects "sentiment,key influencers,controversy" -f text
```
