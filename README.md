# humanize-mcp

Make AI-generated text sound like a human wrote it.

An MCP tool that strips AI fingerprints from any text you write with Claude, Cursor, or other AI assistants. No API keys. No subscriptions. Install once, use everywhere.

## Before & After

| Before (AI-generated) | After (humanized) |
|---|---|
| This framework **serves as** a **crucial** tool for **navigating** complex challenges **—** enabling teams to **leverage** insights effectively. | This framework is a key tool for handling complex challenges. It helps teams use insights effectively. |
| **It is important to note that** the platform **does not** replace human judgment. | The platform doesn't replace human judgment. |
| The system **boasts** real-time monitoring **—** **showcasing** its ability to detect anomalies. | The system has real-time monitoring. It detects anomalies. |

The bolded words are what gets caught: em dashes, AI vocabulary ("crucial", "leverage", "navigate"), filler phrases, inflated verbs.

## Quick Start (2 minutes)

### If you use Claude Code

Run this in your terminal:

```bash
claude mcp add humanize-mcp -- npx -y humanize-mcp
```

Done. Now in any Claude Code conversation, say: *"Humanize this text"* or *"Check this for AI tells."*

### If you use Claude Desktop or Cursor

1. Open your MCP config file:
   - **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
   - **Cursor:** Settings > MCP Servers
2. Add this:

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

3. Restart the app.

**Requirements:** Node.js 18+ installed on your machine. That's it. No API keys, no accounts, no cost.

## What It Catches

### Instant fixes (applied automatically)

These get fixed every time, no questions asked:

**Em dashes and en dashes** — the #1 AI tell
> "results — especially important ones" becomes "results. especially important ones"

**Filler phrases** — removed entirely
> "It is important to note that", "Here's the thing", "Let's dive in", "Without further ado", "Needless to say" — all gone.

**Inflated verbs** — deflated to plain English
> "serves as" → "is" | "boasts" → "has" | "stands as" → "is"

**Wordy phrases** — simplified
> "In order to" → "To" | "Due to the fact that" → "Because" | "Has the ability to" → "Can"

**Missing contractions** — humans use contractions
> "do not" → "don't" | "cannot" �� "can't" | "it is" → "it's" (24 rules)

**Curly quotes** — straightened
> \u201CSmart quotes\u201D → "Straight quotes"

### Flagged for rewriting (reported back to you)

These are subtler patterns that need intelligent rewriting. The tool flags them, and Claude (or whatever AI you're chatting with) rewrites just those sentences:

**AI vocabulary (~40 words):**
crucial, delve, landscape, pivotal, underscore, showcase, foster, leverage, navigate, testament, tapestry, interplay, intricate, robust, holistic, synergy, paradigm, transformative, nuanced, multifaceted, myriad, vital, enduring, vibrant, profound, groundbreaking, nestled, renowned, elevate, empower, streamline, garnered, encompasses

**AI sentence structures:**
- "Not only X, but also Y"
- "It's not just X, it's Y"
- "What strikes me..." / "What stands out..."
- "The X isn't Y, it's Z" (the reframe)
- "The deeper issue" / "fundamentally" / "the heart of the matter"

**Rule-of-three with buzzwords:**
- "innovation, collaboration, and growth" — flagged
- "apples, oranges, and bananas" — not flagged (concrete nouns are fine)

## How to Use It

### Just say "humanize it"

After Claude writes anything, tell it:

> *"Humanize that"*

Claude calls the tool, gets back cleaned text + a report of anything still flagged, rewrites those sentences, and runs the tool again to clean the rewrite.

### Check text before publishing

Paste any text and ask:

> *"Run check_ai_tells on this: [your text]"*

You get a report like this:

```
AI Tell Detection Report

Sentences analyzed: 42
Sentences with AI patterns: 3
Total problems found: 4
Regex-fixable issues: Yes

Flagged Sentences:

> This paradigm shift leverages cutting-edge AI to navigate complex challenges.
- AI vocabulary: paradigm, leverages, navigate

> Not only does it improve speed, but it also transforms accuracy.
- AI structural pattern detected

> The platform fosters innovation, collaboration, and growth.
- AI vocabulary: fosters
- Rule-of-three with abstract nouns
```

### Clean a blog post or newsletter

For longer text with intentional line breaks:

> *"Humanize this in multiline mode: [your text]"*

Each paragraph gets cleaned independently. Your formatting stays intact.

### The recommended workflow

1. Have Claude write your draft
2. Say *"humanize it"* — fixes the obvious stuff, flags the rest
3. Claude rewrites flagged sentences automatically
4. Say *"humanize it again"* — catches anything the rewrite introduced
5. Review and publish

Most text only needs one pass. Two passes catches everything.

## Why This Works (And Why Prompt Rules Don't)

**The core problem:** When you tell an AI "don't use em dashes" or "avoid the word crucial," it loads that instruction into context, then ignores it mid-sentence. LLMs predict the next token based on patterns, and those patterns include em dashes and "crucial." Negative constraints during text generation are unreliable.

**The solution:** Run code on the output *after* the AI finishes writing. A find-and-replace that fires on every em dash isn't a suggestion — it's a guarantee. The AI doesn't get a say.

**Why the tool doesn't need its own AI API key:** The AI assistant you're already talking to (Claude, Cursor, etc.) does the intelligent rewriting. The tool just tells it which sentences to fix and why. No duplicate API calls, no extra billing, no keys to manage.

## Two Tools

| Tool | What it does | When to use it |
|------|-------------|----------------|
| `humanize` | Fixes regex patterns + reports remaining AI tells | After writing, before publishing |
| `check_ai_tells` | Reports AI patterns without changing anything | When you want to audit text without modifying it |

### humanize

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | string | *(required)* | The text to clean |
| `mode` | `"inline"` or `"multiline"` | `"inline"` | Use `"multiline"` for blog posts or text with line breaks |

### check_ai_tells

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | string | The text to analyze |

---

## Architecture (for developers)

```
humanize-mcp/
├── index.js          # MCP server — tool definitions, stdio transport
├── humanizer.js      # Core engine — regex rules + detection logic
├── package.json
└── README.md
```

### How the pieces fit together

```
┌───────��─────┐     ┌──────────────────┐     ┌───���──────────────┐
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

### index.js — MCP Server (~100 lines)

Registers two tools (`humanize` and `check_ai_tells`) using the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk). Communicates via stdio (standard input/output), which is how MCP clients like Claude Code talk to tool servers.

### humanizer.js — Core Engine (~140 lines)

Three pure functions, zero external dependencies:

```
deAI(text)              → Run 30+ regex replacements, return cleaned text
splitSentences(text)    → Break text on sentence boundaries
detectProblems(sentence)→ Check one sentence for AI vocab, structures, rule-of-three
```

### Data flow

```
Input text
    │
    ▼
deAI() ── regex cleanup (em dashes, quotes, phrases, contractions)
    │
    ▼
splitSentences() ── break into individual sentences
    │
    ▼
detectProblems() ── flag AI vocabulary + structural patterns per sentence
    │
    ▼
Return: cleaned text + detection report
    │
    ▼
Calling LLM rewrites flagged sentences (it's already in the conversation)
    │
    ▼
humanize() again ── clean the rewrite
```

### Design decisions

**Purely deterministic server.** The MCP server makes zero external API calls. It runs regex and pattern matching — that's it. The intelligent rewriting is done by whatever LLM is already in the conversation. This means no API keys, no billing, no latency from extra network calls.

**Per-sentence detection.** Each sentence is checked independently. This means the report tells you exactly which sentence has which problem, and the calling LLM can rewrite just those sentences without touching the rest of your text.

**Two-pass safety net.** After the LLM rewrites flagged sentences, running `humanize` again catches any AI patterns the rewrite introduced. The LLM's fix gets cleaned by the same deterministic rules.

## Full Detection Reference

### Regex rules (applied automatically)

| Category | Count | Examples |
|----------|-------|---------|
| Banned phrases | 21 | "In order to" → "To", "Due to the fact that" → "Because", "At the end of the day" → removed |
| Copula fixes | 6 | "serves as" → "is", "boasts" → "has", "features" → "has" |
| Contractions | 24 | "do not" → "don't", "cannot" → "can't", "I am" → "I'm" |
| Punctuation | 2 | Em/en dashes → periods, curly quotes → straight quotes |
| Cleanup | 4 | Double periods, double spaces, leading whitespace |

### AI vocabulary (flagged for rewriting)

`crucial` `delve` `landscape` `pivotal` `underscore` `showcase` `foster` `leverage` `navigate` `testament` `tapestry` `interplay` `intricate` `robust` `holistic` `synergy` `paradigm` `transformative` `nuanced` `multifaceted` `myriad` `vital` `enduring` `vibrant` `profound` `groundbreaking` `nestled` `renowned` `elevate` `empower` `streamline` `garnered` `encompasses` `intricacies` `showcasing` `fostering` `leveraging` `navigating` `elevating` `empowering` `streamlining` `encompassing`

### Structural patterns (flagged for rewriting)

| Pattern | Example |
|---------|---------|
| Not-only-but | "Not only does it save time, but it also improves quality" |
| Not-just-but | "It's not just a tool, it's a platform" |
| Observation-announcement | "What strikes me is...", "What stands out is..." |
| Reframe | "The problem isn't speed, it's accuracy" |
| Persuasive authority | "The deeper issue", "fundamentally", "the heart of the matter" |

### Rule-of-three

Flagged only when combined with abstract/buzzy nouns: innovation, inspiration, insights, growth, excellence, collaboration, transformation, empowerment, sustainability, resilience, agility, synergy, alignment, engagement, impact, momentum, opportunity, strategy, vision, leadership, success, efficiency, creativity, diversity, inclusion, accountability, transparency.

## License

MIT
