export interface FavCommand {
  id: string;
  iconColor?: string;
  bgColor?: string;
}

const STORAGE_KEY = 'dl-spotlight-favs';

export function loadFavs(): FavCommand[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveFavs(favs: FavCommand[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs.slice(0, 8)));
}

export function updateFav(id: string, props: Partial<FavCommand>) {
  const favs = loadFavs();
  const idx = favs.findIndex((f) => f.id === id);
  if (idx !== -1) Object.assign(favs[idx], props);
  saveFavs(favs);
}

export function toggleFav(id: string) {
  const favs = loadFavs();
  const idx = favs.findIndex((f) => f.id === id);
  if (idx === -1) {
    favs.push({ id });
  } else {
    favs.splice(idx, 1);
  }
  saveFavs(favs);
}
