import { describe, expect, it } from "vitest";
import { parseInstitutionalEmailList } from "./institutional-csv";

describe("institutional enrollment CSV parser", () => {
  it("accepts paste of one email per line and a single-column UTF-8 CSV", () => {
    expect(parseInstitutionalEmailList(" one@example.org\r\n two@example.org\n"))
      .toEqual(["one@example.org", "two@example.org"]);
    expect(parseInstitutionalEmailList("\uFEFFemail\r\nA@example.org\r\nB@example.org"))
      .toEqual(["A@example.org", "B@example.org"]);
  });
  it("extracts quoted multi-column CSV, TSV and semicolon-delimited formats", () => {
    expect(parseInstitutionalEmailList(
      'nombre,correo electrónico,detalle\r\n"Juan, Perez",juan@example.org,"Clase, lunes"\r\n"Sol",sol@example.org,"segunda"'
    )).toEqual(["juan@example.org", "sol@example.org"]);
    expect(parseInstitutionalEmailList("nombre\temail\tnota\nA\tfirst@example.org\tOK"))
      .toEqual(["first@example.org"]);
    expect(parseInstitutionalEmailList("nombre;correo_electronico\nMia;mia@example.org"))
      .toEqual(["mia@example.org"]);
  });
  it("rejects malformed quotes, non-email-column files and files over 100 participants", () => {
    for (const raw of [
      'name,email\n\"name,person@example.org',
      "name,age\nJuan,12",
      "one@example.org,two@example.org",
      "email\n" + Array.from({ length: 101 }, (_, i) => `user${i}@example.org`).join("\n"),
      "X".repeat(32769),
    ]) expect(() => parseInstitutionalEmailList(raw)).toThrow();
    expect(parseInstitutionalEmailList("")).toEqual([]);
  });
});
