import { describe, expect, it, vi, afterEach } from "vitest";
import type { SharePayload } from "./sharing";
import { decodeChallenge, encodeChallenge, generateShareText, buildShareUrl, parseUrlChallenge } from "./sharing";

const samplePayload: SharePayload = {
  characterId: "mario",
  characterName: "Mario",
  won: true,
  difficulty: "medium",
  questionCount: 5,
  steps: [
    { questionText: "Is a human?", attribute: "isHuman", answer: "yes" },
    {
      questionText: "From a video game?",
      attribute: "isVideoGame",
      answer: "yes",
    },
    { questionText: "Is female?", attribute: "isFemale", answer: "no" },
    { questionText: "Has powers?", attribute: "hasPowers", answer: "maybe" },
    { questionText: "Is a villain?", attribute: "isVillain", answer: "no" },
  ],
};

describe("encodeChallenge / decodeChallenge", () => {
  it("round-trips a payload correctly", () => {
    const encoded = encodeChallenge(samplePayload);
    const decoded = decodeChallenge(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.characterId).toBe("mario");
    expect(decoded!.characterName).toBe("Mario");
    expect(decoded!.won).toBe(true);
    expect(decoded!.difficulty).toBe("medium");
    expect(decoded!.questionCount).toBe(5);
    expect(decoded!.steps).toHaveLength(5);
    expect(decoded!.steps[0].answer).toBe("yes");
    expect(decoded!.steps[2].answer).toBe("no");
    expect(decoded!.steps[3].answer).toBe("maybe");
  });

  it("produces a URL-safe string (no +, /, =)", () => {
    const encoded = encodeChallenge(samplePayload);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns null for invalid input", () => {
    expect(decodeChallenge("not-valid-base64!!")).toBeNull();
    expect(decodeChallenge("")).toBeNull();
  });

  it("decodes all difficulty levels", () => {
    for (const diff of ["easy", "medium", "hard"] as const) {
      const encoded = encodeChallenge({ ...samplePayload, difficulty: diff });
      const decoded = decodeChallenge(encoded);
      expect(decoded!.difficulty).toBe(diff);
    }
  });

  it("handles a loss", () => {
    const encoded = encodeChallenge({ ...samplePayload, won: false });
    const decoded = decodeChallenge(encoded);
    expect(decoded!.won).toBe(false);
  });

  it("preserves attribute names through encode/decode", () => {
    const encoded = encodeChallenge(samplePayload);
    const decoded = decodeChallenge(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.steps[0].attribute).toBe("isHuman");
    expect(decoded!.steps[1].attribute).toBe("isVideoGame");
    expect(decoded!.steps[4].attribute).toBe("isVillain");
  });
});

describe("generateShareText", () => {
  it("includes character question count and emoji bar", () => {
    const text = generateShareText(samplePayload);
    expect(text).toContain("5 questions");
    expect(text).toContain("🟢");
    expect(text).toContain("🔴");
    expect(text).toContain("🟡");
    expect(text).toContain("Medium");
  });

  it('says "guessed it" for wins', () => {
    expect(generateShareText(samplePayload)).toContain("guessed it");
  });

  it('says "was stumped" for losses', () => {
    expect(generateShareText({ ...samplePayload, won: false })).toContain(
      "was stumped",
    );
  });
});

// --- question text reconstruction ---

describe("encodeChallenge / decodeChallenge – question text", () => {
  it("preserves question text as empty string (compact format strips it)", () => {
    const encoded = encodeChallenge(samplePayload);
    const decoded = decodeChallenge(encoded);
    // Compact format only stores attribute + answer initial — text is lost
    decoded!.steps.forEach((step) => {
      expect(step.questionText).toBe("");
    });
  });

  it("preserves attribute and answer even when question text is missing", () => {
    const payload: SharePayload = {
      ...samplePayload,
      steps: [{ questionText: "", attribute: "hasCape", answer: "yes" }],
    };
    const encoded = encodeChallenge(payload);
    const decoded = decodeChallenge(encoded);
    expect(decoded!.steps[0].attribute).toBe("hasCape");
    expect(decoded!.steps[0].answer).toBe("yes");
  });
});

describe("decodeChallenge – edge cases", () => {
  it("maps unknown step value to 'unknown'", () => {
    // Encode with 'unknown' answer — should survive round-trip
    const payload: SharePayload = {
      ...samplePayload,
      steps: [{ questionText: "", attribute: "attr", answer: "unknown" }],
    };
    const decoded = decodeChallenge(encodeChallenge(payload));
    expect(decoded!.steps[0].answer).toBe("unknown");
  });

  it("returns null when difficulty letter is unrecognized", () => {
    // Manually craft a compact object with bad difficulty
    const compact = { c: "x", n: "X", w: 1, d: "z", q: 1, s: [] };
    const encoded = btoa(JSON.stringify(compact)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeChallenge(encoded)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const compact = { w: 1, d: "m", q: 1, s: [] }; // missing c and n
    const encoded = btoa(JSON.stringify(compact)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeChallenge(encoded)).toBeNull();
  });

  it("handles steps with missing v (answer) gracefully", () => {
    const compact = { c: "id", n: "Name", w: 1, d: "m", q: 1, s: [{ a: "attr" }] };
    const encoded = btoa(JSON.stringify(compact)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const decoded = decodeChallenge(encoded);
    expect(decoded!.steps[0].answer).toBe("unknown"); // empty v maps to 'unknown'
  });
});

describe("generateShareText – complete emoji coverage", () => {
  it("includes ⚪ for 'unknown' steps", () => {
    const payload: SharePayload = {
      ...samplePayload,
      steps: [{ questionText: "", attribute: "attr", answer: "unknown" }],
    };
    const text = generateShareText(payload);
    expect(text).toContain("⚪");
  });

  it("uses 🤔 emoji for losses", () => {
    const text = generateShareText({ ...samplePayload, won: false });
    expect(text).toContain("🤔");
  });
});

describe("buildShareUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds a URL with the #c= hash fragment", () => {
    vi.stubGlobal("window", { location: { origin: "https://example.com", pathname: "/" } });
    const url = buildShareUrl(samplePayload);
    expect(url).toMatch(/^https:\/\/example\.com\/#c=.+/);
    // The encoded portion after "#c=" should be URL-safe base64 (no +, no = padding)
    const encoded = url.split("#c=")[1];
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("=");
  });

  it("produces a URL that decodes back to the original payload", () => {
    vi.stubGlobal("window", { location: { origin: "https://example.com", pathname: "/" } });
    const url = buildShareUrl(samplePayload);
    const hash = new URL(url).hash.slice(3); // strip #c=
    const decoded = decodeChallenge(hash);
    expect(decoded!.characterId).toBe(samplePayload.characterId);
  });
});

describe("parseUrlChallenge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when hash does not start with #c=", () => {
    vi.stubGlobal("window", { location: { hash: "#other=abc" } });
    expect(parseUrlChallenge()).toBeNull();
  });

  it("returns null when hash is empty", () => {
    vi.stubGlobal("window", { location: { hash: "" } });
    expect(parseUrlChallenge()).toBeNull();
  });

  it("returns decoded payload when hash starts with #c=", () => {
    const encoded = encodeChallenge(samplePayload);
    vi.stubGlobal("window", { location: { hash: `#c=${encoded}` } });
    const result = parseUrlChallenge();
    expect(result).not.toBeNull();
    expect(result!.characterId).toBe("mario");
  });
});

// --- missing characters ---

describe("decodeChallenge – missing / unknown characters", () => {
  it("decodes a character id not in local database without error", () => {
    const payload: SharePayload = {
      ...samplePayload,
      characterId: "nonexistent-char",
      characterName: "Unknown Hero",
    };
    const encoded = encodeChallenge(payload);
    const decoded = decodeChallenge(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.characterId).toBe("nonexistent-char");
    expect(decoded!.characterName).toBe("Unknown Hero");
  });
});

// --- special characters in name ---

describe("encodeChallenge / decodeChallenge – special characters", () => {
  it("handles Latin1 special characters in character name", () => {
    const payload: SharePayload = {
      ...samplePayload,
      characterName: 'Mario & Luigi - "Super" Bros.',
    };
    const encoded = encodeChallenge(payload);
    const decoded = decodeChallenge(encoded);
    expect(decoded!.characterName).toBe('Mario & Luigi - "Super" Bros.');
  });

  it("throws on non-Latin1 characters (btoa limitation)", () => {
    const payload: SharePayload = {
      ...samplePayload,
      characterName: "\u{1F3AE} Player One",
    };
    expect(() => encodeChallenge(payload)).toThrow();
  });

  it("handles unicode in character id", () => {
    const payload: SharePayload = {
      ...samplePayload,
      characterId: "héro-ñ",
    };
    const encoded = encodeChallenge(payload);
    const decoded = decodeChallenge(encoded);
    expect(decoded!.characterId).toBe("héro-ñ");
  });
});
