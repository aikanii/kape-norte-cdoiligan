export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const WEEK_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** ["07:00", "22:00"] — closing times past midnight use 24h+ values, e.g. "27:00" = 3 AM. */
export type DayHours = [string, string] | null;
export type WeekHours = Partial<Record<DayKey, DayHours>>;

export type Shop = {
  id: string;
  slug: string;
  name: string;
  city: string;
  area: string;
  address: string;
  blurb: string;
  price_level: number;
  tags: string[];
  photo_path: string | null;
  google_photo_url: string | null;
  google_photo_attribution: string | null;
  lat: number;
  lng: number;
  hours: WeekHours;
};

const toMinutes = (value: string) => {
  const [h, m] = value.split(":");
  return Number(h) * 60 + Number(m ?? 0);
};

export function formatTime(value: string) {
  const total = toMinutes(value) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatRange(range: DayHours) {
  if (!range) return "Closed";
  return `${formatTime(range[0])} – ${formatTime(range[1])}`;
}

/** Current date/time in Manila (UTC+8), as day index and minutes since midnight. */
export function manilaNow(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayIndex = weekdayMap[get("weekday")] ?? 0;
  const hour = Number(get("hour")) % 24;
  const minutes = hour * 60 + Number(get("minute"));
  return { dayIndex, minutes };
}

export type OpenState = { open: boolean; label: string; range: DayHours };

export function openState(hours: WeekHours, now: Date = new Date()): OpenState {
  const { dayIndex, minutes } = manilaNow(now);
  const todayKey = DAY_KEYS[dayIndex]!;
  const yesterdayKey = DAY_KEYS[(dayIndex + 6) % 7]!;
  const today = hours[todayKey] ?? null;
  const yesterday = hours[yesterdayKey] ?? null;

  // A shop that closed after midnight is still open in the early hours.
  if (yesterday) {
    const close = toMinutes(yesterday[1]);
    if (close > 24 * 60 && minutes < close - 24 * 60) {
      return { open: true, label: `Open until ${formatTime(yesterday[1])}`, range: yesterday };
    }
  }

  if (!today) return { open: false, label: "Closed today", range: null };

  const start = toMinutes(today[0]);
  const end = toMinutes(today[1]);
  if (minutes < start) {
    return { open: false, label: `Opens ${formatTime(today[0])}`, range: today };
  }
  if (minutes < end) {
    return { open: true, label: `Open until ${formatTime(today[1])}`, range: today };
  }
  return { open: false, label: "Closed now", range: today };
}

export function defaultWeek(): Record<DayKey, DayHours> {
  return {
    mon: ["08:00", "20:00"],
    tue: ["08:00", "20:00"],
    wed: ["08:00", "20:00"],
    thu: ["08:00", "20:00"],
    fri: ["08:00", "20:00"],
    sat: ["08:00", "20:00"],
    sun: ["08:00", "20:00"],
  };
}
