import { describe, expect, it, vi } from "vitest";

// Só a função pura: nada de banco, e-mail ou Efí.
vi.mock("../../database/DataSource", () => ({ default: {} }));
vi.mock("../../database/MkauthSource", () => ({ default: {} }));
vi.mock("../../controller/Email", () => ({ default: class {} }));
vi.mock("../BolixEfi", () => ({}));
vi.mock("../MensalidadesIsentos", () => ({}));

import { montar } from "../MensalidadesLembretes";

describe("montar (mensagem dos lembretes)", () => {
  it("troca as variáveis, sem diferenciar maiúscula", () => {
    const { texto } = montar("Olá %nome%, %NOME%!", { nome: "Ana" });
    expect(texto).toBe("Olá Ana, Ana!");
  });

  it("não trata nomes do Object.prototype como variável", () => {
    const m = montar("%toString% %constructor% %hasOwnProperty%", { nome: "Ana" });
    expect(m.texto).toBe("%toString% %constructor% %hasOwnProperty%");
    expect(m.html).toContain("%toString% %constructor%");
  });

  it("escapa HTML e só vira link o que começa com https://", () => {
    const { html } = montar("<b>%boleto%</b> %pix%", {
      boleto: "https://efi.com.br/x",
      pix: "000201br.gov.bcb.pix",
    });
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain('<a href="https://efi.com.br/x">');
    expect(html).not.toContain('href="000201');
  });

  it("vira link mesmo colado ao texto, e o link para no caractere escapado", () => {
    const { html } = montar("Boleto:%boleto%\nPagar: %boleto%.", {
      boleto: "https://efi.com.br/b?x=1&y=2",
    });
    expect(html).toContain(
      'Boleto:<a href="https://efi.com.br/b?x=1&amp;y=2">https://efi.com.br/b?x=1&amp;y=2</a>',
    );
    expect(html.match(/<a href=/g)?.length).toBe(2);
  });
});
