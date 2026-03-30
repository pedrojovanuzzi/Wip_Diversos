export async function findOrCreate(
  repository: any,
  { where, defaults }: { where: any; defaults: any },
) {
  let entity = await repository.findOne({ where });
  if (entity) {
    return [entity, false];
  }
  const newEntity = repository.create({ ...where, ...defaults });
  await repository.save(newEntity);
  return [newEntity, true];
}

export function formatarData(data: any) {
  const date = new Date(data);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function limparEndereco(texto: string) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function limparNomeRua(texto: string) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
