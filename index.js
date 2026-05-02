#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { deAI, humanize, humanizePost, detectProblems, splitSentences } from "./humanizer.js";

// Tier 1-only multiline cleanup (no API key needed)
function deAIPost(text) {
  return text.split('\n').map(line => line.trim() ? deAI(line) : '').join('\n');
}

const server = new McpServer({
  name: "humanizer",
  version: "1.0.0",
});

// Tool 1: humanize — clean AI tells from text
server.tool(
  "humanize",
  "Remove AI tells from text. Runs 30+ deterministic regex fixes (em dashes, curly quotes, banned phrases, copula fixes, contractions). If ANTHROPIC_API_KEY is configured, also detects AI vocabulary and structural patterns per-sentence and surgically rewrites flagged sentences. Use multiline mode for blog posts and newsletters.",
  {
    text: z.string().describe("The text to humanize"),
    mode: z.enum(["inline", "multiline"]).default("inline").describe("Use 'inline' for single paragraphs/comments. Use 'multiline' for blog posts, newsletters, or any text with intentional line breaks."),
  },
  async ({ text, mode }) => {
    const key = process.env.ANTHROPIC_API_KEY;

    let result;
    if (mode === "multiline") {
      result = key ? await humanizePost(text, key) : deAIPost(text);
    } else {
      result = key ? await humanize(text, key) : deAI(text);
    }

    const tier = key
      ? "Tier 1 (deterministic regex) + Tier 2 (AI pattern detection + surgical fix)"
      : "Tier 1 only (deterministic regex). Set ANTHROPIC_API_KEY env var for Tier 2 surgical fixes.";

    return {
      content: [
        { type: "text", text: `${result}\n\n---\nProcessed with: ${tier}` },
      ],
    };
  }
);

// Tool 2: check_ai_tells — detect AI patterns without fixing
server.tool(
  "check_ai_tells",
  "Analyze text for AI writing tells WITHOUT fixing them. Returns a detection report showing which sentences have problems and what kind. Useful for understanding what makes text sound AI-generated.",
  {
    text: z.string().describe("The text to analyze for AI tells"),
  },
  async ({ text }) => {
    const sentences = splitSentences(text);
    const report = [];
    let totalProblems = 0;

    for (const sentence of sentences) {
      const problems = detectProblems(sentence);
      if (problems.length > 0) {
        totalProblems += problems.length;
        report.push({ sentence, problems });
      }
    }

    // Check for Tier 1 issues
    const cleaned = deAI(text);
    const tier1Changed = cleaned !== text;

    let output = `## AI Tell Detection Report\n\n`;
    output += `**Sentences analyzed:** ${sentences.length}\n`;
    output += `**Sentences with Tier 2 problems:** ${report.length}\n`;
    output += `**Total problems found:** ${totalProblems}\n`;
    output += `**Tier 1 issues (regex-fixable):** ${tier1Changed ? "Yes" : "None detected"}\n\n`;

    if (report.length > 0) {
      output += `### Flagged Sentences\n\n`;
      for (const { sentence, problems } of report) {
        output += `> ${sentence}\n`;
        for (const p of problems) {
          output += `- ${p}\n`;
        }
        output += `\n`;
      }
    }

    if (tier1Changed) {
      output += `### Tier 1 Preview\n\n`;
      output += `Deterministic cleanup would change the text. Call the \`humanize\` tool to apply fixes.\n`;
    }

    if (report.length === 0 && !tier1Changed) {
      output += `No AI tells detected. The text looks human-written.\n`;
    }

    return {
      content: [{ type: "text", text: output }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
