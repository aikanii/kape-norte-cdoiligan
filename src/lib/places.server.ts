const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.priceLevel",
  "places.regularOpeningHours",
  "places.editorialSummary",
  "places.types",
  "places.addressComponents",
  "places.photos.name",
  "places.photos.authorAttributions.displayName",
  "nextPageToken",
].join(",");

const SEARCH_TERMS = ["coffee shop", "cafe", "specialty coffee", "coffee roaster"];
const CITIES = [
  { label: "Iligan City", query: "Iligan City, Philippines", match: "Iligan" },
  { label: "Cagayan de Oro", query: "Cagayan de Oro City, Philippines", match: "Cagayan de Oro" },
];

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

type AddressComponent = { longText?: string; types?: string[] };
type Period = {
  open?: { day: number; hour: number; minute?: number };
  close?: { day: number; hour: number; minute?: number };
};
type PlacePhoto = {
  name?: string;
  authorAttributions?: Array<{ displayName?: string }>;
};
type Place = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  priceLevel?: string;
  types?: string[];
  editorialSummary?: { text?: string };
  addressComponents?: AddressComponent[];
  regularOpeningHours?: { periods?: Period[] };
  photos?: PlacePhoto[];
};

export type ShopUpsert = {
  place_id: string;
  slug: string;
  name: string;
  city: string;
  area: string;
  address: string;
  blurb: string;
  price_level: number;
  tags: string[];
  lat: number;
  lng: number;
  hours: Record<string, [string, string] | null>;
  google_photo_url: string | null;
  google_photo_attribution: string | null;
  google_photo_refreshed_at: string | null;
  status: "published";
};

async function resolvePhoto(photo: PlacePhoto) {
  if (!photo.name) return null;
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !connectionKey) throw new Error("Google Maps connection is not configured.");

  const params = new URLSearchParams({
    maxWidthPx: "960",
    maxHeightPx: "720",
    skipHttpRedirect: "true",
  });
  const response = await fetch(`${GATEWAY}/places/v1/${photo.name}/media?${params}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
    },
  });
  if (response.status === 404) return null;
  if (response.status === 403) {
    const body = await response.text();
    console.error(`Places photo denied [403]: ${body}`);
    throw new Error("Google Maps denied the photo request. Check the server key restrictions and Places API access.");
  }
  if (!response.ok) {
    const body = await response.text();
    console.error(`Places photo failed [${response.status}]: ${body}`);
    throw new Error(`Places photo failed [${response.status}].`);
  }
  const data = (await response.json()) as { photoUri?: string };
  return data.photoUri ?? null;
}

async function placePhoto(placeId: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !connectionKey) throw new Error("Google Maps connection is not configured.");
  const response = await fetch(`${GATEWAY}/places/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "X-Goog-FieldMask": "photos.name,photos.authorAttributions.displayName",
    },
  });
  if (response.status === 404) return null;
  if (response.status === 403) {
    const body = await response.text();
    console.error(`Place photo details denied [403]: ${body}`);
    throw new Error("Google Maps denied the photo request. Check the server key restrictions and Places API access.");
  }
  if (!response.ok) {
    const body = await response.text();
    console.error(`Place photo details failed [${response.status}]: ${body}`);
    return null;
  }
  const data = (await response.json()) as { photos?: PlacePhoto[] };
  const photo = data.photos?.[0];
  if (!photo) return null;
  const url = await resolvePhoto(photo);
  return {
    url,
    attribution:
      photo.authorAttributions
        ?.map((author) => author.displayName?.trim())
        .filter((name): name is string => Boolean(name))
        .join(", ") || null,
  };
}

export async function fetchPlacePhotoCovers(placeIds: string[]) {
  const results: Array<{
    placeId: string;
    url: string;
    attribution: string | null;
    refreshedAt: string;
  }> = [];
  let cursor = 0;
  const boundedIds = Array.from(new Set(placeIds)).slice(0, 30);
  const workers = Array.from({ length: Math.min(5, boundedIds.length) }, async () => {
    while (cursor < boundedIds.length) {
      const placeId = boundedIds[cursor];
      cursor += 1;
      if (!placeId) continue;
      const photo = await placePhoto(placeId);
      if (photo?.url) {
        results.push({
          placeId,
          url: photo.url,
          attribution: photo.attribution,
          refreshedAt: new Date().toISOString(),
        });
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const pad = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

function toWeekHours(place: Place) {
  const week: Record<string, [string, string] | null> = {};
  for (const key of DAY_KEYS) week[key] = null;
  for (const period of place.regularOpeningHours?.periods ?? []) {
    const open = period.open;
    if (!open) continue;
    const key = DAY_KEYS[open.day % 7]!;
    if (!period.close) {
      week[key] = ["00:00", "24:00"];
      continue;
    }
    const start = open.hour * 60 + (open.minute ?? 0);
    let end = period.close.hour * 60 + (period.close.minute ?? 0);
    if (period.close.day !== open.day || end <= start) end += 24 * 60;
    week[key] = [pad(start), pad(end)];
  }
  return week;
}

function cityAndArea(place: Place) {
  let locality: string | undefined;
  let area: string | undefined;
  let route: string | undefined;
  for (const component of place.addressComponents ?? []) {
    const types = component.types ?? [];
    if (types.includes("locality")) locality = component.longText;
    if (
      !area &&
      (types.includes("sublocality_level_1") ||
        types.includes("sublocality") ||
        types.includes("neighborhood"))
    )
      area = component.longText;
    if (!route && types.includes("route")) route = component.longText;
  }
  const address = place.formattedAddress ?? "";
  const haystack = `${locality ?? ""} ${address}`;
  const needle = haystack.toLowerCase();
  const city = CITIES.find((c) => needle.includes(c.match.toLowerCase()))?.label;
  return { city, area: area ?? route };
}

async function searchText(query: string, pageToken?: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !connectionKey) throw new Error("Google Maps connection is not configured.");

  const response = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Places search failed [${response.status}]: ${body}`);
    throw new Error(`Places search failed [${response.status}]: ${body}`);
  }
  return (await response.json()) as { places?: Place[]; nextPageToken?: string };
}

/** Fetches every coffee shop Google knows about in Iligan City and Cagayan de Oro. */
export async function fetchCoffeeShops(): Promise<ShopUpsert[]> {
  const byPlaceId = new Map<string, Place>();

  for (const city of CITIES) {
    for (const term of SEARCH_TERMS) {
      let pageToken: string | undefined;
      for (let page = 0; page < 3; page += 1) {
        const result = await searchText(`${term} in ${city.query}`, pageToken);
        for (const place of result.places ?? []) byPlaceId.set(place.id, place);
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }
    }
  }

  const shops: ShopUpsert[] = [];
  const photoJobs: Array<{ shopIndex: number; photo: PlacePhoto }> = [];
  const usedSlugs = new Set<string>();

  for (const place of byPlaceId.values()) {
    const types = place.types ?? [];
    if (!types.includes("coffee_shop") && !types.includes("cafe")) continue;
    const { city, area } = cityAndArea(place);
    if (!city || !place.location) continue;

    const name = place.displayName?.text?.trim();
    if (!name) continue;

    const suffix = city === "Iligan City" ? "iligan" : "cdo";
    let slug = slugify(`${name}-${suffix}`) || slugify(`${place.id}`);
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${slug}-${n++}`;
    usedSlugs.add(slug);

    const tags = ["coffee"];
    if (types.includes("bakery")) tags.push("bakery");
    if (types.includes("restaurant") || types.includes("meal_takeaway")) tags.push("food");
    if (types.includes("book_store")) tags.push("books");

    shops.push({
      place_id: place.id,
      slug,
      name,
      city,
      area: area ?? city,
      address: place.formattedAddress ?? "",
      blurb: place.editorialSummary?.text ?? "",
      price_level: PRICE_LEVELS[place.priceLevel ?? ""] ?? 2,
      tags,
      lat: place.location.latitude,
      lng: place.location.longitude,
      hours: toWeekHours(place),
      google_photo_url: null,
      google_photo_attribution:
        place.photos?.[0]?.authorAttributions
          ?.map((author) => author.displayName?.trim())
          .filter((name): name is string => Boolean(name))
          .join(", ") || null,
      google_photo_refreshed_at: null,
      status: "published",
    });
    const photo = place.photos?.[0];
    if (photo?.name) photoJobs.push({ shopIndex: shops.length - 1, photo });
  }

  let cursor = 0;
  const workers = Array.from({ length: Math.min(5, photoJobs.length) }, async () => {
    while (cursor < photoJobs.length) {
      const job = photoJobs[cursor];
      cursor += 1;
      if (!job) continue;
      const url = await resolvePhoto(job.photo);
      shops[job.shopIndex]!.google_photo_url = url;
      shops[job.shopIndex]!.google_photo_refreshed_at = url ? new Date().toISOString() : null;
    }
  });
  await Promise.all(workers);

  return shops;
}
