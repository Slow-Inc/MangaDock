import { describe, expect, test } from "bun:test";
import { modelDisplay } from "./modelDisplay";

describe("modelDisplay", () => {
  test("known family: short = brand, full = readable model name", () => {
    expect(modelDisplay("deepseek-v4.1-flash")).toEqual({
      short: "DeepSeek",
      full: "DeepSeek V4.1 Flash",
      title: "แปลโดย DeepSeek V4.1 Flash",
    });
    expect(modelDisplay("gemini-3-flash-preview")).toMatchObject({
      short: "Gemini",
      full: "Gemini 3 Flash Preview",
    });
    expect(modelDisplay("kimi-k3")).toMatchObject({ short: "Kimi", full: "Kimi K3" });
    expect(modelDisplay("glm-5.3-flash")).toMatchObject({ short: "GLM", full: "GLM 5.3 Flash" });
    expect(modelDisplay("gpt-4o-mini")).toMatchObject({ short: "GPT", full: "GPT 4o Mini" });
  });

  test("version glued to the brand token is kept attached", () => {
    expect(modelDisplay("qwen3.8-max")).toMatchObject({ short: "Qwen", full: "Qwen3.8 Max" });
  });

  test("strips a provider/path prefix (models/..., opencode-go/...)", () => {
    expect(modelDisplay("models/gemini-2.5-flash")).toMatchObject({
      short: "Gemini",
      full: "Gemini 2.5 Flash",
    });
    expect(modelDisplay("opencode-go/kimi-k3")).toMatchObject({ short: "Kimi", full: "Kimi K3" });
  });

  test("matching is case-insensitive", () => {
    expect(modelDisplay("DeepSeek-V4-Pro")).toMatchObject({ short: "DeepSeek", full: "DeepSeek V4 Pro" });
  });

  test("unknown family: first token capitalised, rest title-cased", () => {
    expect(modelDisplay("acme-turbo-2")).toEqual({
      short: "Acme",
      full: "Acme Turbo 2",
      title: "แปลโดย Acme Turbo 2",
    });
  });

  test("missing model (older cached translation) -> generic AI, never a guessed brand", () => {
    for (const none of [undefined, null, "", "   "]) {
      expect(modelDisplay(none)).toEqual({ short: "AI", full: "", title: "แปลโดย AI" });
    }
  });
});
