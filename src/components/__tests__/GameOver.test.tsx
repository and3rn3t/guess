// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameOver } from "@/components/GameOver";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...rest}>{children}</div>
    ),
  },
}));

vi.mock("@/components/ConfettiBurst", () => ({
  ConfettiBurst: () => null,
}));

describe("GameOver feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows feedback controls when feedback handler is provided", () => {
    render(
      <GameOver
        won
        exhausted={false}
        surrendered={false}
        character={null}
        onPlayAgain={vi.fn()}
        onSubmitFeedback={vi.fn()}
        answeredQuestions={[]}
      />,
    );

    expect(screen.getByText("How was this round?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Feedback" })).toBeDisabled();
  });

  it("submits selected rating and trimmed feedback text", async () => {
    const onSubmitFeedback = vi.fn(async () => {});
    const user = userEvent.setup();

    render(
      <GameOver
        won
        exhausted={false}
        surrendered={false}
        character={null}
        onPlayAgain={vi.fn()}
        onSubmitFeedback={onSubmitFeedback}
        answeredQuestions={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "4" }));
    await user.type(
      screen.getByPlaceholderText("Optional: what felt off or great?"),
      "  Great pacing and clues  ",
    );
    await user.click(screen.getByRole("button", { name: "Send Feedback" }));

    expect(onSubmitFeedback).toHaveBeenCalledWith(4, "Great pacing and clues");
    expect(await screen.findByText("Feedback saved. This helps tune question quality.")).toBeInTheDocument();
  });

  it("submits rating with undefined text when comment is blank", async () => {
    const onSubmitFeedback = vi.fn(async () => {});
    const user = userEvent.setup();

    render(
      <GameOver
        won={false}
        exhausted={false}
        surrendered={false}
        character={null}
        onPlayAgain={vi.fn()}
        onSubmitFeedback={onSubmitFeedback}
        answeredQuestions={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(screen.getByRole("button", { name: "Send Feedback" }));

    expect(onSubmitFeedback).toHaveBeenCalledWith(1, undefined);
  });
});