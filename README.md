# humanize-mcp

An MCP server that removes AI fingerprints from text. Works with Claude Code, Claude Desktop, Cursor, and any MCP-compatible client.

**No API keys. No external calls. Pure deterministic code.**

## The Problem

AI-generated text has tells. Em dashes everywhere. Words like "crucial" and "delve." Structures like "Not only X, but Y." Readers spot these patterns — and so do AI detectors.

Prompt-based rules ("don't use em dashes") fail because LLMs can't reliably follow negative constraints during generation. The model loads your instructions, then ignores them mid-sentence.

This MCP server takes a different approach: it runs **deterministic code on the output**, after the AI finishes writing. Regex replacements that can't be bypassed. The model doesn't get a choice.

## How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  AI writes   │────▶│  humanize tool    │────▶│  AI reads report  │
│  text        │     │  (regex cleanup   │     │  rewrites flagged │
└─────────────┘     │  + detection)     │     │  sentences        │
                     └──────────────────┘     └────────┬─────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │  humanize again   │
                                              │  (clean the fix)  │
                                              └──────────────────┘
```

The MCP server handles two things:
1. **Regex cleanup** — 30+ deterministic rules that fix mechanical AI patterns instantly
2. **Detection** — flags sentences with AI vocabulary and structural patterns

The intelligent rewriting? That's done by whatever LLM is already in your conversation. Claude Code, Claude Desktop, Cursor — they're right there. No need for a separate API call.

### Regex Cleanup (runs on every call)

| Category | Example | Becomes |
|----------|---------|---------|
| Em dashes | "results — especially" | "results. especially" |
| Curly quotes | \u201Csmart quotes\u201D | "smart quotes" |
| Banned phrases | "In order to" | "To" |
| Copula fixes | "serves as" | "is" |
| Contractions | "do not" | "don't" |
| Filler removal | "It is important to note that" | *(removed)* |

### Detection (returned as a report)

**AI Vocabulary (~40 words):**
`crucial`, `delve`, `landscape`, `pivotal`, `underscore`, `showcase`, `foster`, `leverage`, `navigate`, `testament`, `tapestry`, `interplay`, `intricate`, `robust`, `holistic`, `synergy`, `paradigm`, `transformative`, `nuanced`, `multifaceted`, `myriad`, and more.

**Structural Patterns (5 types):**
- "Not only X, but also Y"
- "It's not just X, it's Y"
- "What strikes me / What stands out"
- "The X isn't Y — it's Z"
- "The deeper issue" / "fundamentally"

**Rule-of-Three with Abstract Nouns:**
"innovation, inspiration, and growth" — flagged. "apples, oranges, and bananas" — not flagged.

## Tools

### `humanize`

Cleans text with regex rules, then reports any remaining AI patterns for you (or your LLM) to rewrite.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | string | *(required)* | The text to clean |
| `mode` | `"inline"` or `"multiline"` | `"inline"` | Use `"multiline"` for blog posts or text with line breaks |

**Output:** Cleaned text. If AI patterns remain, a list of flagged sentences with specific problems is appended.

### `check_ai_tells`

Reports what AI patterns exist in the text without changing anything.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | The text to analyze |

**Output:** Detection report — sentence count, flagged sentences, problem types.

## Install

### Claude Code

```bash
claude mcp add humanize-mcp -- npx -y humanize-mcp
```

### Claude Desktop / Cursor / Other MCP Clients

Add to your MCP config file:

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

Restart your client after adding the config. That's it — no API keys needed.

## Usage Examples

### Example 1: Write and clean in one shot

You: *"Write me a LinkedIn post about remote work, then humanize it"*

Claude writes the post, calls `humanize`. Em dashes get replaced, banned phrases removed, contractions enforced. If any sentences still have AI vocabulary, Claude sees the report and rewrites those sentences, then runs `humanize` again to clean the rewrite.

### Example 2: Check before publishing

You: *"Run check_ai_tells on this: [paste text]"*

Output:
```
## AI Tell Detection Report

Sentences analyzed: 42
Sentences with AI patterns: 3
Total problems found: 4
Regex-fixable issues: Yes

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

You: *"Humanize this in multiline mode: [paste text]"*

Multiline mode preserves your intentional line breaks — blank lines stay blank, each paragraph gets cleaned independently.

### Example 4: The full workflow

1. Ask Claude to write something
2. Run `check_ai_tells` to see what's flagged
3. Decide if you care (1 flag on 50 sentences? Probably fine)
4. Run `humanize` to auto-fix regex issues + get a rewrite list
5. Claude rewrites the flagged sentences
6. Run `humanize` one more time to clean the rewrite

## Architecture

```
humanize-mcp/
├── index.js          # MCP server — tool definitions + stdio transport
├── humanizer.js      # Core engine — regex rules + detection logic
├── package.json
└── README.md
```

### index.js — MCP Server (~100 lines)

Registers two tools (`humanize` and `check_ai_tells`) with the MCP SDK. Connects via stdio transport. Thin wrapper — all logic lives in `humanizer.js`.

### humanizer.js — Core Engine (~140 lines)

Three layers, all deterministic:

```
┌─────────────────────────────────────────────────┐
│  deAI(text)                                     │
│  30+ regex rules: em dashes, curly quotes,      │
│  banned phrases, copula fixes, contractions,    │
│  artifact cleanup                               │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  splitSentences(text)                           │
│  Break text into individual sentences           │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  detectProblems(sentence)                       │
│  Per-sentence scan: ~40 AI vocab words,         │
│  5 structural patterns, rule-of-three           │
│  Returns array of problem descriptions          │
└─────────────────────────────────────────────────┘
```

### Data Flow

```
Input text
    │
    ▼
deAI() ─── Regex cleanup (em dashes, quotes, phrases, contractions)
    │
    ▼
splitSentences() ─── Break into individual sentences
    │
    ▼
detectProblems() ─── Flag AI vocabulary + structural patterns
    │
    ▼
Return cleaned text + detection report
    │
    ▼
LLM rewrites flagged sentences (already in your conversation)
    │
    ▼
humanize again ─── Clean the rewrite
```

### Why This Design?

**Why not just prompt the AI to write better?**
LLMs load your "don't use em dashes" rule into context, then ignore it when predicting the next token. Deterministic post-processing is the only reliable approach.

**Why not have the MCP server call an AI API for rewrites?**
The LLM is already in the conversation. Making the server call a separate API adds complexity (API keys, billing, latency) for no benefit. The server stays purely deterministic — no external dependencies, no keys, no cost.

**Why return a detection report instead of silently fixing everything?**
Transparency. You see exactly what was flagged and why. You decide if 1 "crucial" in 50 sentences matters. And the LLM in your conversation can make better rewriting decisions with the context of the full document than a blind per-sentence API call could.

## What Gets Detected

### Regex Rules (28 banned phrases, 6 copula fixes, 24 contraction rules)

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
- "boasts" → "has"
- "features" → "has"

**Contractions** — enforced everywhere:
- "do not" → "don't"
- "cannot" → "can't"
- "I am" → "I'm"
- "it is" → "it's"
- And 20 more

### AI Pattern Detection

**~40 vocabulary words** including: crucial, delve, landscape, pivotal, underscore, showcase, foster, leverage, navigate, testament, tapestry, interplay, intricate, robust, holistic, synergy, paradigm, transformative, nuanced, multifaceted, myriad, vital, enduring, vibrant, profound, groundbreaking, nestled, renowned, elevate, empower, streamline, garnered, encompasses.

**5 structural patterns:** not-only-but, it's-not-just, observation-announcement, reframe, persuasive authority.

**Rule-of-three** with abstract nouns (innovation, inspiration, growth, excellence, etc.)

## Requirements

- Node.js 18+

That's it. No API keys. No accounts. No external services.

## License

MIT
