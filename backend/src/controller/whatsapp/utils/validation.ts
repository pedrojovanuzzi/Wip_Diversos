export function validarCPF(doc: any): boolean {
  doc = doc.replace(/[^\d]+/g, "");

  if (doc.length === 11) {
    let soma = 0,
      resto;
    if (/^(\d)\1+$/.test(doc)) return false;

    for (let i = 1; i <= 9; i++)
      soma += parseInt(doc.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(doc.substring(9, 10))) return false;

    soma = 0;
    for (let i = 1; i <= 10; i++)
      soma += parseInt(doc.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(doc.substring(10, 11))) return false;

    return true;
  } else if (doc.length === 14) {
    let tamanho = doc.length - 2;
    let numeros = doc.substring(0, tamanho);
    let digitos = doc.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    let multiplicador;

    if (/^(\d)\1+$/.test(doc)) return false;

    for (let i = tamanho; i >= 1; i--) {
      multiplicador = pos--;
      soma += parseInt(numeros.charAt(tamanho - i)) * multiplicador;
      if (pos < 2) pos = 9;
    }

    let resto = soma % 11;
    if (resto < 2) resto = 0;
    else resto = 11 - resto;

    if (resto !== parseInt(digitos.charAt(0))) return false;

    tamanho = tamanho + 1;
    numeros = doc.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
      multiplicador = pos--;
      soma += parseInt(numeros.charAt(tamanho - i)) * multiplicador;
      if (pos < 2) pos = 9;
    }

    resto = soma % 11;
    if (resto < 2) resto = 0;
    else resto = 11 - resto;

    if (resto !== parseInt(digitos.charAt(1))) return false;

    return true;
  } else {
    return false;
  }
}

export function validarRG(rg: any): boolean {
  rg = rg.replace(/[^\d]+/g, "");
  if (rg.length < 7 || rg.length > 14) return false;
  if (/^(\d)\1+$/.test(rg)) return false;
  return true;
}

export function verificaType(type: any): boolean {
  if (type == "text" || type == "interactive" || type == "button") {
    console.log("TYPE: " + type);
    return true;
  } else {
    console.log("TYPE: " + type);
    return false;
  }
}
