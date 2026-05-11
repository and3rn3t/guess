import { describe, expect, it } from "vitest";
import { buildMobileDescribeArchetype } from "./mobileDescribeYourself";

describe("mobileDescribeYourself archetype", () => {
  it("classifies strategic-heavy answers", () => {
    const archetype = buildMobileDescribeArchetype([
      { promptKey: "leadership", answer: "yes" },
      { promptKey: "analytical", answer: "yes" },
      { promptKey: "competitive", answer: "yes" },
      { promptKey: "empathetic", answer: "no" },
      { promptKey: "riskTaking", answer: "maybe" },
    ]);

    expect(archetype).toBe("Strategic Operator");
  });

  it("classifies social-heavy answers", () => {
    const archetype = buildMobileDescribeArchetype([
      { promptKey: "empathetic", answer: "yes" },
      { promptKey: "collaborative", answer: "yes" },
      { promptKey: "leadership", answer: "no" },
      { promptKey: "analytical", answer: "no" },
      { promptKey: "creative", answer: "maybe" },
    ]);

    expect(archetype).toBe("Empathic Connector");
  });
});
