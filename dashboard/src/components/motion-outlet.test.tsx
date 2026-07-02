import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import { MotionOutlet } from "./motion-outlet";

describe("MotionOutlet", () => {
  it("renders the matched child route inside the animated wrapper", () => {
    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <Routes>
          <Route element={<MotionOutlet />}>
            <Route path="overview" element={<div>Overview content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Overview content")).toBeInTheDocument();
  });
});
