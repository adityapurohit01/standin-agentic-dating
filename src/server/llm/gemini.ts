import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { LLMInterface, LLMTextOptions, LLMObjectOptions, LLMVisionOptions } from "./types";
import { calculateCost } from "./pricing";
import { getSqlite } from "../db";
import { MockLLM } from "./mock";
import crypto from "crypto";

export class GeminiLLM implements LLMInterface {
  private client: GoogleGenAI | null = null;
  private fallback: MockLLM;

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    this.fallback = new MockLLM();
    if (key) {
      try {
        this.client = new GoogleGenAI({ apiKey: key });
      } catch {
        this.client = null;
      }
    }
  }

  private logCall(options: {
    purpose: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    personId?: string;
    dateId?: string;
    durationMs: number;
  }) {
    const sqlite = getSqlite();
    const { costUsd, estimated } = calculateCost(options.model, options.tokensIn, options.tokensOut);
    sqlite.prepare(`
      INSERT INTO llm_calls (id, purpose, model, tokens_in, tokens_out, cost_usd, estimated, duration_ms, person_id, date_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      options.purpose,
      options.model,
      options.tokensIn,
      options.tokensOut,
      costUsd,
      estimated ? 1 : 0,
      options.durationMs,
      options.personId || null,
      options.dateId || null,
      Date.now()
    );
  }

  async text(options: LLMTextOptions): Promise<string> {
    const start = Date.now();
    const model = options.model || process.env.LLM_MODEL_FAST || "gemini-3.5-flash";

    if (!this.client) {
      return this.fallback.text(options);
    }

    try {
      const contents = options.messages.map((m) => `${m.role === "assistant" ? "model" : "user"}: ${m.content}`).join("\n\n");
      const prompt = options.system ? `System: ${options.system}\n\n${contents}` : contents;

      const response = await this.client.models.generateContent({
        model,
        contents: prompt,
      });

      const reply = response.text || "";
      const tokensIn = prompt.length / 4;
      const tokensOut = reply.length / 4;

      this.logCall({
        purpose: options.purpose,
        model,
        tokensIn: Math.round(tokensIn),
        tokensOut: Math.round(tokensOut),
        personId: options.personId,
        dateId: options.dateId,
        durationMs: Date.now() - start,
      });

      return reply;
    } catch {
      return this.fallback.text(options);
    }
  }

  async object<T extends z.ZodTypeAny>(options: LLMObjectOptions<T>): Promise<z.infer<T>> {
    const start = Date.now();
    const model = options.model || process.env.LLM_MODEL_STRONG || "gemini-3.5-flash";

    if (!this.client) {
      return this.fallback.object(options);
    }

    try {
      const prompt = `${options.system ? `System: ${options.system}\n\n` : ""}${options.prompt}\n\nReturn strictly valid JSON matching the requested schema. No markdown formatting, no code blocks, just raw JSON.`;

      const response = await this.client.models.generateContent({
        model,
        contents: prompt,
      });

      const rawText = response.text || "";
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      const validated = options.schema.parse(parsed);

      this.logCall({
        purpose: options.purpose,
        model,
        tokensIn: Math.round(prompt.length / 4),
        tokensOut: Math.round(rawText.length / 4),
        personId: options.personId,
        dateId: options.dateId,
        durationMs: Date.now() - start,
      });

      return validated;
    } catch {
      return this.fallback.object(options);
    }
  }

  async vision<T extends z.ZodTypeAny>(options: LLMVisionOptions<T>): Promise<z.infer<T>> {
    return this.fallback.vision(options);
  }
}
