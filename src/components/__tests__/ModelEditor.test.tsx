import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ModelEditor from "../ModelEditor";

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "provider.models": "Models",
        "provider.model_name_placeholder": "Model name",
        "provider.1m_context": "1M",
        "provider.add_model": "+ Add Model",
        "provider.delete_model": "Delete model",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("ModelEditor", () => {
  it("renders empty model list", () => {
    render(<ModelEditor models={[]} onChange={() => {}} />);
    expect(screen.getByText("+ Add Model")).toBeInTheDocument();
  });

  it("renders model rows", () => {
    const models = [
      { name: "gpt-4", supports1m: true },
      { name: "gpt-3.5", supports1m: false },
    ];
    render(<ModelEditor models={models} onChange={() => {}} />);
    expect(screen.getByDisplayValue("gpt-4")).toBeInTheDocument();
    expect(screen.getByDisplayValue("gpt-3.5")).toBeInTheDocument();
  });

  it("calls onChange when adding a model", () => {
    const onChange = vi.fn();
    render(<ModelEditor models={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("+ Add Model"));
    expect(onChange).toHaveBeenCalledWith([{ name: "", supports1m: false }]);
  });

  it("calls onChange when removing a model", () => {
    const onChange = vi.fn();
    const models = [{ name: "test-model", supports1m: true }];
    render(<ModelEditor models={models} onChange={onChange} />);
    const removeButton = screen.getByTitle("Delete model");
    fireEvent.click(removeButton);
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
