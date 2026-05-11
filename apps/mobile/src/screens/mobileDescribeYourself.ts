import type { AnswerValue } from "../network/mobileGameApi";

export interface MobileDescribePrompt {
  key: string;
  prompt: string;
}

export interface MobileDescribeAnswer {
  promptKey: string;
  answer: AnswerValue;
}

export const MOBILE_DESCRIBE_PROMPTS: readonly MobileDescribePrompt[] = [
  { key: "leadership", prompt: "Do you naturally take the lead in group decisions?" },
  { key: "riskTaking", prompt: "Do you enjoy taking calculated risks?" },
  { key: "analytical", prompt: "Do you usually solve problems through analysis first?" },
  { key: "collaborative", prompt: "Do you prefer teamwork over solo execution?" },
  { key: "creative", prompt: "Do you often generate unconventional ideas?" },
  { key: "adaptable", prompt: "Do you quickly adapt when plans suddenly change?" },
  { key: "empathetic", prompt: "Do you strongly pick up on other people's emotions?" },
  { key: "competitive", prompt: "Do you enjoy direct competition?" },
] as const;

export function buildMobileDescribeArchetype(answers: MobileDescribeAnswer[]): string {
  const score = {
    strategic: 0,
    social: 0,
    explorer: 0,
    builder: 0,
  };

  for (const entry of answers) {
    let answerWeight = 0;
    if (entry.answer === "yes") {
      answerWeight = 2;
    } else if (entry.answer === "maybe") {
      answerWeight = 1;
    }

    switch (entry.promptKey) {
      case "leadership":
      case "analytical":
      case "competitive":
        score.strategic += answerWeight;
        break;
      case "empathetic":
      case "collaborative":
        score.social += answerWeight;
        break;
      case "riskTaking":
      case "adaptable":
        score.explorer += answerWeight;
        break;
      case "creative":
        score.builder += answerWeight;
        score.explorer += answerWeight;
        break;
      default:
        break;
    }
  }

  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[0] ?? "builder";

  if (top === "strategic") {
    return "Strategic Operator";
  }

  if (top === "social") {
    return "Empathic Connector";
  }

  if (top === "explorer") {
    return "Adaptive Explorer";
  }

  return "Creative Builder";
}
