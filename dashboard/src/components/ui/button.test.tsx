import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Button } from "./button";

describe("Button", () => {
  it("renders its children as a button", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: "Click me" })
    ).toBeInTheDocument();
  });

  it("applies the default (violet) variant by default", () => {
    render(<Button>Primary</Button>);
    expect(
      screen.getByRole("button", { name: "Primary" }).className
    ).toContain("bg-primary");
  });

  it("applies the destructive variant", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(
      screen.getByRole("button", { name: "Delete" }).className
    ).toContain("bg-destructive");
  });

  it("merges a custom className", () => {
    render(<Button className="w-full">Wide</Button>);
    expect(screen.getByRole("button", { name: "Wide" }).className).toContain(
      "w-full"
    );
  });
});
