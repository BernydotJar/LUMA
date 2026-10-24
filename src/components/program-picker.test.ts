import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProgramPicker, type useProgramSelection } from "./program-picker";

type Selection = ReturnType<typeof useProgramSelection>;

function render(status: Selection["status"], overrides: Partial<Selection> = {}) {
  const selection: Selection = {
    uid: "qa-learner",
    status,
    courses: [],
    programId: null,
    choose: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  };
  return renderToStaticMarkup(createElement(ProgramPicker, { audience: "learner", selection }));
}

describe("first-client learner course picker accessibility", () => {
  it("does not insert entitled course UI in showcase", () => {
    expect(render("showcase")).toBe("");
  });

  it("shows a stable accessible control and only supplied enrolled courses", () => {
    const html = render("entitled", {
      courses: [
        { tenantId: "qa", programId: "live", title: "Mary — entrenamiento en vivo" },
        { tenantId: "qa", programId: "evergreen", title: "Mary — biblioteca evergreen" },
      ],
      programId: "evergreen",
    });
    expect(html).toContain('aria-label="Tus cursos"');
    expect(html).toContain('<label for="luma-program-learner">Programa asignado</label>');
    expect(html).toContain('value="evergreen" selected=""');
    expect(html).toContain('value="live"');
    expect(html).toContain("Actualizar cursos");
    expect(html).not.toContain('value="unauthorized"');
  });

  it("keeps the first-choice prompt and does not guess among two courses", () => {
    const html = render("entitled", {
      courses: [
        { tenantId: "qa", programId: "live", title: "Clases en vivo" },
        { tenantId: "qa", programId: "evergreen", title: "Curso autónomo" },
      ],
      programId: null,
    });
    expect(html).toContain('<option value="" disabled="" selected="">');
    expect(html).toContain("Selecciona tu programa");
  });

  it("offers retry on temporary failures and refreshing newly assigned courses", () => {
    expect(render("error")).toContain('role="alert"');
    expect(render("error")).toContain("Reintentar");
    expect(render("entitled")).toContain("Actualizar matrículas");
    expect(render("denied")).not.toContain('<select');
  });
});
