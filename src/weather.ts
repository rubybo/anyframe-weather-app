export type Place = {
  id: number;
  name: string;
  country: string;
  admin1: string;
  latitude: number;
  longitude: number;
  label: string;
};

export type CurrentView = {
  temperature: string;
  feels: string;
  humidity: string;
  wind: string;
  label: string;
  symbol: string;
  observed: string;
};

export type HourView = {
  key: string;
  time: string;
  temperature: string;
  label: string;
  symbol: string;
  rain: string;
};

export type DayView = {
  key: string;
  name: string;
  temperature: string;
  label: string;
  symbol: string;
  rain: string;
};

export type ForecastView = {
  current: CurrentView;
  hours: HourView[];
  days: DayView[];
};

type GeoResult = {
  id?: number;
  name?: string;
  country?: string;
  admin1?: string;
  latitude?: number;
  longitude?: number;
};

type ForecastPayload = {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
    precipitation_probability?: Array<number | null>;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: Array<number | null>;
  };
};

export function placeLabel(place: { name: string; admin1?: string; country?: string }): string {
  const parts = [place.name];
  if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1);
  if (place.country) parts.push(place.country);
  return parts.filter(Boolean).join(", ");
}

export async function geocode(name: string, signal?: AbortSignal): Promise<Place[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "ru");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Сервис поиска городов недоступен.");
  const body = (await response.json()) as { results?: GeoResult[] };
  const results = Array.isArray(body.results) ? body.results : [];
  const seen = new Set<string>();
  return results.flatMap((result) => {
    if (typeof result.latitude !== "number" || typeof result.longitude !== "number" || !result.name) return [];
    const place = {
      id: result.id ?? Number(`${result.latitude}${result.longitude}`.replace(/\D/g, "").slice(0, 12)),
      name: result.name,
      country: result.country ?? "",
      admin1: result.admin1 ?? "",
      latitude: result.latitude,
      longitude: result.longitude,
    };
    const label = placeLabel(place);
    if (seen.has(label)) return [];
    seen.add(label);
    return [{ ...place, label }];
  });
}

export async function forecastFor(latitude: number, longitude: number, signal?: AbortSignal): Promise<ForecastView> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m");
  url.searchParams.set("hourly", "temperature_2m,weather_code,precipitation_probability");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("wind_speed_unit", "ms");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Сервис прогноза недоступен.");
  const body = (await response.json()) as ForecastPayload;
  return toView(body);
}

function toView(body: ForecastPayload): ForecastView {
  const current = body.current;
  const hourly = body.hourly;
  const daily = body.daily;
  if (!current?.time || current.temperature_2m == null || !hourly?.time || !daily?.time) {
    throw new Error("Прогноз пришёл в неожиданном виде.");
  }
  const today = current.time.slice(0, 10);
  const tomorrow = shiftDate(today, 1);
  const stamp = current.time.slice(0, 13);
  const start = hourly.time.findIndex((time) => time.slice(0, 13) >= stamp);
  const from = start === -1 ? 0 : start;
  const hours = hourly.time.slice(from, from + 24).map((time, index) => {
    const at = from + index;
    const weather = condition(hourly.weather_code?.[at] ?? -1);
    return {
      key: time,
      time: time.slice(11, 16),
      temperature: degrees(hourly.temperature_2m?.[at] ?? 0),
      label: weather.label,
      symbol: weather.symbol,
      rain: percent(hourly.precipitation_probability?.[at] ?? null),
    };
  });
  const days = daily.time.map((time, index) => {
    const weather = condition(daily.weather_code?.[index] ?? -1);
    const min = degrees(daily.temperature_2m_min?.[index] ?? 0);
    const max = degrees(daily.temperature_2m_max?.[index] ?? 0);
    return {
      key: time,
      name: dayName(time, today, tomorrow),
      temperature: `${max} / ${min}`,
      label: weather.label,
      symbol: weather.symbol,
      rain: percent(daily.precipitation_probability_max?.[index] ?? null),
    };
  });
  const weather = condition(current.weather_code ?? -1);
  return {
    current: {
      temperature: degrees(current.temperature_2m),
      feels: degrees(current.apparent_temperature ?? current.temperature_2m),
      humidity: percent(current.relative_humidity_2m ?? null),
      wind: `${Math.round(current.wind_speed_10m ?? 0)} м/с`,
      label: weather.label,
      symbol: weather.symbol,
      observed: current.time.slice(11, 16),
    },
    hours,
    days,
  };
}

function condition(code: number): { label: string; symbol: string } {
  if (code === 0) return { label: "Ясно", symbol: "☀" };
  if (code === 1) return { label: "Преимущественно ясно", symbol: "☀" };
  if (code === 2) return { label: "Переменная облачность", symbol: "☁" };
  if (code === 3) return { label: "Пасмурно", symbol: "☁" };
  if (code === 45 || code === 48) return { label: "Туман", symbol: "≋" };
  if (code === 51 || code === 53 || code === 55) return { label: "Морось", symbol: "☂" };
  if (code === 56 || code === 57) return { label: "Ледяная морось", symbol: "☂" };
  if (code === 61 || code === 63 || code === 65) return { label: "Дождь", symbol: "☂" };
  if (code === 66 || code === 67) return { label: "Ледяной дождь", symbol: "☂" };
  if (code === 71 || code === 73 || code === 75) return { label: "Снег", symbol: "❄" };
  if (code === 77) return { label: "Снежные зёрна", symbol: "❄" };
  if (code === 80 || code === 81 || code === 82) return { label: "Ливень", symbol: "☂" };
  if (code === 85 || code === 86) return { label: "Снегопад", symbol: "❄" };
  if (code === 95) return { label: "Гроза", symbol: "⚡" };
  if (code === 96 || code === 99) return { label: "Гроза с градом", symbol: "⚡" };
  return { label: "Без описания", symbol: "•" };
}

function degrees(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}°`;
  return `${rounded}°`;
}

function percent(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

function shiftDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayName(isoDate: string, today: string, tomorrow: string): string {
  const day = isoDate.slice(0, 10);
  if (day === today) return "Сегодня";
  if (day === tomorrow) return "Завтра";
  const weekday = new Intl.DateTimeFormat("ru", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}
