# humanizer-mcp

MCP server that removes AI tells from text. Works with Claude Code and Claude Desktop.

## The problem

When Claude writes text, it leaves fingerprints: em dashes everywhere, words like "crucial" and "delve", parallel structures like "Not only X, but Y". Prompt-based rules and skills don't reliably fix this — the model loads the rules but still generates AI-sounding text.

This MCP server runs **actual code** on the output. Deterministic regex replacements that can't be bypassed.

## What it does

**Tier 1 (always runs, no API key needed):**
- 30+ deterministic regex replacements
- Em dashes and en dashes → periods
- Curly quotes → straight quotes
- Banned phrase removal ("In order to" → "To", "Due to the fact that" → "Because")
- Copula fixes ("serves as" → "is", "boasts" → "has")
- Contraction enforcement ("do not" → "don't", "cannot" → "can't")
- 20+ filler phrase removals

**Tier 2 (needs ANTHROPIC_API_KEY):**
- Detects ~40 AI vocabulary words per sentence
- Detects 5 structural patterns (not only/but, observation-announcements, reframe patterns)
- Detects rule-of-three with abstract nouns
- Surgically rewrites only flagged sentences via Claude API
- Runs deterministic cleanup again on the rewrite

## Install

Add to your Claude Code config. Run `claude mcp add` or manually edit your MCP config:

### Without API key (Tier 1 only — regex cleanup)

```json
{
  "humanizer": {
    "command": "npx",
    "args": ["-y", "humanizer-mcp"]
  }
}
```

### With API key (full pipeline — Tier 1 + Tier 2)

```json
{
  "humanizer": {
    "command": "npx",
    "args": ["-y", "humanizer-mcp"],
    "env": {
      "ANTHROPIC_API_KEY": "sk-ant-..."
    }
  }
}
```

Restart Claude Code after adding the config.

## Tools

### `humanize`

Cleans AI tells from text.

**Parameters:**
- `text` (string, required) — The text to humanize
- `mode` ("inline" | "multiline", default: "inline") — Use "multiline" for blog posts, newsletters, or any text with intentional line breaks

**Example usage in Claude:** "Humanize this blog post" or "Run the humanize tool on the text above"

### `check_ai_tells`

Analyzes text and reports what AI patterns were found, without changing anything.

**Parameters:**
- `text` (string, required) — The text to analyze

Returns a report showing which sentences are flagged, what problems were detected, and whether Tier 1 cleanup would change the text.

## Requirements

- Node.js 18+

## How it works

Unlike prompt-based skills that ask the AI to follow rules (which it often ignores), this server runs deterministic code:

1. **Tier 1:** Regex replacements run on every character of the text. Em dashes get replaced with periods. "Serves as" becomes "is". Every contraction gets enforced. This is code, not a suggestion.

2. **Tier 2:** Each sentence is scanned for known AI vocabulary and structural patterns. Only flagged sentences get sent to a small Claude call for rewriting. The rewrite then gets run through Tier 1 again, so even the fix gets cleaned.

The model can't "pretend" to apply these rules. The code runs after generation, on the actual output.
