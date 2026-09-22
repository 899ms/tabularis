import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ShortcutsEditModal } from "../../../src/components/modals/ShortcutsEditModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("lucide-react", () => ({
  Keyboard: () => null,
  Loader2: () => null,
  X: () => null,
}));

describe("ShortcutsEditModal", () => {
  it("should not render while closed", () => {
    render(
      <ShortcutsEditModal
        isOpen={false}
        label="Open settings"
        current="⌘+,"
        isMac
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
