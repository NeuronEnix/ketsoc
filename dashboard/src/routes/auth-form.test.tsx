import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { AuthForm } from "./auth-form";

describe("AuthForm", () => {
  it("renders email, password, and a submit button", () => {
    render(<AuthForm mode="login" onSubmit={() => {}} pending={false} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in" })
    ).toBeInTheDocument();
  });

  it("blocks submit and shows validation errors when empty", () => {
    const onSubmit = vi.fn();
    render(<AuthForm mode="signup" onSubmit={onSubmit} pending={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid email.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
  });

  it("submits valid credentials", () => {
    const onSubmit = vi.fn();
    render(<AuthForm mode="login" onSubmit={onSubmit} pending={false} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSubmit).toHaveBeenCalledWith({ email: "a@b.com", password: "pw" });
  });

  it("surfaces a server error message", () => {
    render(
      <AuthForm
        mode="login"
        onSubmit={() => {}}
        pending={false}
        error="Wrong email or password."
      />
    );
    expect(
      screen.getByText("Wrong email or password.")
    ).toBeInTheDocument();
  });
});
