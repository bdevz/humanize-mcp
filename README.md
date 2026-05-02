# humanize-mcp

An MCP server that removes AI fingerprints from text. Works with Claude Code, Claude Desktop, Cursor, and any MCP-compatible client.

## The Problem

AI-generated text has tells. Em dashes everywhere. Words like "crucial" and "delve." Structures like "Not only X, but Y." Readers spot these patterns — and so do AI detectors.

Prompt-based rules ("don't use em dashes") fail because LLMs can't reliably follow negative constraints during generation. The model loads your instructions, then ignores them mid-sentence.

This MCP server takes a different approach: it runs **deterministic code on the output**, after the AI finishes writing. Regex replacements that can't be bypassed. The model doesn't get a choice.

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  AI writes   │────▶│   Tier 1     │────▶│   Tier 2     │────▶ Clean text
│  text        │     │  (regex)     │     │  (surgical)  │
└─────────────┘     └──────────────┘     └──────────────┘
                     Always runs          Needs API key
                     30+ rules            Per-sentence AI fix
                     Instant              ~1s per flagged sentence
```

### Tier 1 — Deterministic Regex (always runs, no API key)

Runs 30+ find-and-replace rules on every character of the text:

| Category | Example | Becomes |
|----------|---------|---------|
| Em dashes | "results — especially" | "results. especially" |
| Curly quotes | "smart quotes" | "smart quotes" |
| Banned phrases | "In order to" | "To" |
| Copula fixes | "serves as" | "is" |
| Contractions | "do not" | "don't" |
| Filler removal | "It is important to note that" | *(removed)* |

This is code, not a suggestion. Every rule fires on every run.

### Tier 2 — Surgical AI Fix (needs `ANTHROPIC_API_KEY`)

Scans each sentence individually for deeper patterns:

**AI Vocabulary (~40 words):**
`crucial`, `delve`, `landscape`, `pivotal`, `underscore`, `showcase`, `foster`, `leverage`, `navigate`, `testament`, `tapestry`, `interplay`, `intricate`, `robust`, `holistic`, `synergy`, `paradigm`, `transformative`, `nuanced`, `multifaceted`, `myriad`, and more.

**Structural Patterns (5 types):**
- "Not only X, but also Y"
- "It's not just X, it's Y"
- "What strikes me / What stands out" (observation-announcement)
- "The X isn't Y — it's Z" (reframe)
- "The deeper issue" / "fundamentally" (persuasive authority)

**Rule-of-Three with Abstract Nouns:**
"innovation, inspiration, and growth" — flagged. "apples, oranges, and bananas" — not flagged.

When a sentence is flagged, only that sentence gets sent to a small Claude API call for rewriting. The rewrite then gets run through Tier 1 again, so even the fix gets cleaned.

## Tools

The server exposes two tools:

### `humanize`

Cleans AI tells from text.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | string | *(required)* | The text to clean |
| `mode` | `"inline"` or `"multiline"` | `"inline"` | Use `"multiline"` for blog posts or text with line breaks |

### `check_ai_tells`

Reports what AI patterns exist in the text without changing anything. Returns a detection report.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | The text to analyze |

## Install

### Claude Code

```bash
claude mcp add humanize-mcp -- npx -y humanize-mcp
```

For Tier 2 (with surgical AI fixes):

```bash
claude mcp add humanize-mcp -e ANTHROPIC_API_KEY=sk-ant-... -- npx -y humanize-mcp
```

### Claude Desktop / Cursor / Other MCP Clients

Add to your MCP config file:

**Tier 1 only (free, no API key):**

```json
{
  "mcpServers": {
    "humanize-mcp": {
      "command": "npx",
      "args": ["-y", "humanize-mcp"]
    }
  }
}
```

**Tier 1 + Tier 2 (needs API key):**

```json
{
  "mcpServers": {
    "humanize-mcp": {
      "command": "npx",
      "args": ["-y", "humanize-mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Restart your client after adding the config.

## Usage Examples

### Example 1: Clean a LinkedIn post

You: "Write me a LinkedIn post about remote work, then humanize it"

Claude writes the post, then calls the `humanize` tool. The output comes back with em dashes replaced, "crucial" swapped out, contractions enforced.

### Example 2: Check before publishing

You: "Run check_ai_tells on this blog post: [paste text]"

Output:
```
## AI Tell Detection Report

Sentences analyzed: 42
Sentences with Tier 2 problems: 3
Total problems found: 4
Tier 1 issues (regex-fixable): Yes

### Flagged Sentences

> This paradigm shift leverages cutting-edge AI to navigate complex challenges.
- AI vocabulary: paradigm, leverages, navigate

> Not only does it improve speed, but it also transforms accuracy.
- AI structural pattern detected

> The platform fosters innovation, collaboration, and growth.
- AI vocabulary: fosters
- Rule-of-three with abstract nouns
```

### Example 3: Clean a blog post (multiline)

You: "Humanize this in multiline mode: [paste text]"

Multiline mode preserves your intentional line breaks — blank lines stay blank, each paragraph gets cleaned independently.

### Example 4: Iterative workflow

1. Ask Claude to write something
2. Run `check_ai_tells` to see what's flagged
3. Decide if you care (1-2 flags on 50 sentences? Probably fine)
4. Run `humanize` if you want to auto-fix

## Architecture

```
humanize-mcp/
├── index.js          # MCP server — tool definitions + stdio transport
├── humanizer.js      # Core engine — all detection and fix logic
├── package.json
└── README.md
```

### index.js — MCP Server (53 lines)

Registers two tools (`humanize` and `check_ai_tells`) with the MCP SDK and connects via stdio transport. Thin wrapper — all logic lives in `humanizer.js`.

### humanizer.js — Core Engine (229 lines)

Four layers:

```
┌─────────────────────────────────────────────────┐
│  deAI(text)                                     │
│  Tier 1: 30+ regex rules                        │
│  Em dashes, curly quotes, banned phrases,       │
│  copula fixes, contractions, cleanup artifacts  │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  detectProblems(sentence)                       │
│  Tier 2 detection: AI vocab (~40 words),        │
│  5 structural patterns, rule-of-three           │
│  Returns array of problem descriptions          │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  fixSentence(sentence, problems, apiKey)        │
│  Sends ONE flagged sentence to Claude API       │
│  Small, focused prompt: "rewrite this sentence  │
│  to fix [specific problem]"                     │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  humanize(text, key) / humanizePost(text, key)  │
│  Full pipeline: deAI → split → detect →         │
│  fix flagged → deAI again on fixes              │
└─────────────────────────────────────────────────┘
```

### Data Flow

```
Input text
    │
    ▼
deAI() ─── Tier 1 regex cleanup (always)
    │
    ▼
splitSentences() ─── Break into individual sentences
    │
    ▼
detectProblems() ─── Check each sentence for Tier 2 patterns
    │
    ├── No problems → keep sentence as-is
    │
    └── Problems found → fixSentence() via Claude API
                              │
                              ▼
                         deAI() again ─── Clean the AI's fix too
    │
    ▼
Join sentences → final deAI() pass → Output
```

### Why This Architecture?

**Why not just prompt the AI to write better?**
LLMs can't reliably suppress patterns during generation. "Don't use em dashes" gets loaded into context, then ignored when the model predicts the next token. Deterministic post-processing is the only reliable approach.

**Why surgical per-sentence fixes instead of rewriting the whole text?**
Rewriting the whole text through an AI would re-introduce the same patterns. By isolating individual sentences and giving a tiny, focused prompt ("rewrite this one sentence to remove 'crucial'"), the model has a much smaller task and is less likely to introduce new tells. And `deAI()` runs on the fix too, as a safety net.

**Why two tiers?**
Tier 1 catches the obvious, mechanical patterns (em dashes, curly quotes, stock phrases). It's free, instant, and deterministic. Tier 2 catches subtler patterns (word choice, sentence structure) that need AI judgment to fix properly. Users who want the free version still get significant value.

## Requirements

- Node.js 18+
- For Tier 2: an Anthropic API key (`ANTHROPIC_API_KEY`)

## What Gets Detected

### Tier 1 — Deterministic (28 banned phrases, 6 copula fixes, 24 contraction rules)

**Banned phrases** — removed or simplified:
- "In order to" → "To"
- "Due to the fact that" → "Because"
- "Has the ability to" → "Can"
- "In the event that" → "If"
- "At this point in time" → "Now"
- "It is important to note that" → *(removed)*
- "Here's the thing" → *(removed)*
- "Let's dive in" → *(removed)*
- "Without further ado" → *(removed)*
- And 19 more

**Copula fixes** — deflated verbs:
- "serves as" → "is"
- "stands as" → "is"
- "acts as" → "is"
- "functions as" → "is"
- "boasts" → "has"
- "features" → "has"

**Contractions** — enforced everywhere:
- "do not" → "don't"
- "cannot" → "can't"
- "I am" → "I'm"
- "it is" → "it's"
- And 20 more

### Tier 2 — AI Pattern Detection

**~40 AI vocabulary words** including: crucial, delve, landscape, pivotal, underscore, showcase, foster, leverage, navigate, testament, tapestry, interplay, intricate, robust, holistic, synergy, paradigm, transformative, nuanced, multifaceted, myriad, vital, enduring, vibrant, profound, groundbreaking, nestled, renowned, elevate, empower, streamline, garnered, encompasses.

**5 structural patterns:** not-only-but, it's-not-just, observation-announcement, reframe, persuasive authority.

**Rule-of-three** with abstract nouns (innovation, inspiration, growth, excellence, etc.)

## License

MIT
