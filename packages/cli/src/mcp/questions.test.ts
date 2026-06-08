import { expect, test } from "bun:test";
import { Questions } from "./questions";

test("isTool matches MCP and dynamic tool names", () => {
  expect(Questions.isTool("questions_v2")).toBe(true);
  expect(Questions.isTool("mcp__dddx__questions_v2")).toBe(true);
  expect(Questions.isTool("Read")).toBe(false);
});

test("normalize maps text-options to single choice", () => {
  const questions = Questions.normalize({
    title: "Kickoff",
    questions: [
      {
        id: "audience",
        kind: "text-options",
        title: "Who is the audience?",
        options: [
          { id: "eng", label: "Engineers" },
          { id: "pm", label: "Product" },
        ],
      },
    ],
  });
  expect(questions).toHaveLength(1);
  expect(questions[0]?.kind).toBe("single");
  expect(questions[0]?.options?.[0]?.label).toBe("Engineers");
});

test("coerce fills labels from id when agent omits label", () => {
  const q = Questions.coerce({
    kind: "single",
    title: "How are you feeling?",
    options: [{ id: "happy" }, { id: "sad" }, { id: "neutral" }],
  });
  expect(q?.options?.map((o) => o.label)).toEqual(["happy", "sad", "neutral"]);
});

test("coerce uses text input when there are no options", () => {
  const q = Questions.coerce({
    kind: "text-options",
    title: "Why?",
  });
  expect(q?.kind).toBe("text");
  expect(q?.placeholder).toBeTruthy();
});

test("never uses raw native single payload without coercion", () => {
  const questions = Questions.normalize({
    questions: [
      {
        kind: "single",
        title: "Pick one",
        options: [{ id: "a" }, { id: "b" }],
      },
    ],
  });
  expect(questions[0]?.options?.every((o) => o.label.length > 0)).toBe(true);
});
