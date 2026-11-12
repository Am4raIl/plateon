import photos from "./menu-photos.json";

const normalize = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const byName = new Map(photos.map((photo) => [normalize(photo.name), photo]));

export function menuPhoto(name: string, url: string | null) {
  // A restaurant's own image always takes priority. Only replace the old
  // generated demo illustrations or a missing image for a known menu item.
  if (url && !/^\/api\/v1\/imagens\/produtos\/[0-9a-f-]{36}\.svg$/i.test(url))
    return undefined;
  return byName.get(normalize(name));
}
