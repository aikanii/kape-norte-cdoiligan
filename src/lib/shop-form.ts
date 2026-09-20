import { z } from "zod";
import { DAY_KEYS, DAY_LABELS, toMinutes } from "./hours";
import type { WeekHours } from "./hours";

const coordinate = (min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? Number(value) : value),
    z.number({ invalid_type_error: "Enter a valid coordinate" }).finite().min(min).max(max),
  );

export const shopSchema = z.object({
  name: z.string().trim().min(2, "Enter the shop name").max(100),
  city: z.enum(["Iligan City", "Cagayan de Oro City"]),
  area: z.string().trim().min(2, "Enter the barangay or area").max(80),
  address: z.string().trim().min(5, "Enter the street address").max(200),
  blurb: z.string().trim().max(400),
  lat: coordinate(-90, 90),
  lng: coordinate(-180, 180),
  price_level: z.coerce.number().int().min(1).max(4),
});

/** Normalize time-input values to the extended closing times used by the directory. */
export function normalizeHours(hours: WeekHours): WeekHours {
  return Object.fromEntries(
    DAY_KEYS.map((day) => {
      const range = hours[day];
      if (!range) return [day, null];
      const [start, end] = range;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([0-3]\d|4[0-7]):[0-5]\d$/.test(end)) {
        throw new Error(`Enter valid opening and closing times for ${DAY_LABELS[day]}`);
      }
      let close = toMinutes(end);
      if (close <= toMinutes(start)) close += 1440;
      if (close - toMinutes(start) > 1440)
        throw new Error(`${DAY_LABELS[day]} hours cannot exceed 24 hours`);
      return [
        day,
        [
          start,
          `${String(Math.floor(close / 60)).padStart(2, "0")}:${String(close % 60).padStart(2, "0")}`,
        ],
      ];
    }),
  );
}
