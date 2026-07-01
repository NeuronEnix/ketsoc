import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OnboardingScreen } from "./onboarding";

function renderScreen() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <OnboardingScreen />
    </QueryClientProvider>
  );
}

describe("OnboardingScreen", () => {
  it("prompts the user to create their organization", () => {
    renderScreen();
    expect(screen.getByText("Create your organization")).toBeInTheDocument();
    expect(screen.getByLabelText("Organization name")).toBeInTheDocument();
  });

  it("enables the button only once a name is entered", () => {
    renderScreen();
    const btn = screen.getByRole("button", { name: "Create organization" });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Acme Inc" },
    });
    expect(btn).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "   " },
    });
    expect(btn).toBeDisabled();
  });
});
