// How each city looks (v0.12, Navid 5 Nov: "every city its own landmark, weather and field"; more countries and
// cities will come). One row per city; a city without a row takes its country's look. The landmark is drawn into the
// city's own skyline band (src/art/bands/<city id>.webp, picked up by name), so a new city needs a row here and,
// if it has a landmark, a band.

import type { CountryCode } from './world';

/** snow: falling flakes, a white field that deepens through the day, ice around the crops (the Canadian winter);
 *  leaves: autumn leaves drifting down and piling up on the soil; clear: the plain field. */
export type Weather = 'snow' | 'leaves' | 'clear';

export interface CityLook {
  weather: Weather;
  /** What the skyline shows, for the docs and the art (the picture itself is the band). */
  landmark?: string;
}

const COUNTRY_LOOK: Record<CountryCode, CityLook> = {
  CA: { weather: 'snow' },
  US: { weather: 'clear' },
  BR: { weather: 'clear' },
  MA: { weather: 'clear' },
  FR: { weather: 'clear' },
  CN: { weather: 'clear' },
  JP: { weather: 'clear' },
};

const CITY_LOOK: Record<string, CityLook> = {
  ca_charlottetown: { weather: 'snow', landmark: 'the lighthouse on the red rocks' },
  // Navid, 3 Nov: "Gatineau autumn leaves"
  ca_gatineau: { weather: 'leaves', landmark: 'the Peace Tower across the Ottawa River' },
  ca_toronto: { weather: 'snow', landmark: 'the CN Tower' },
  ca_leamington: { weather: 'clear', landmark: 'the big tomato and the greenhouses' },
  ca_saskatoon: { weather: 'snow', landmark: 'a prairie grain elevator' },
  ca_kelowna: { weather: 'clear', landmark: 'Okanagan Lake, with Ogopogo' },
};

export function cityLook(cityId: string, country: CountryCode): CityLook {
  return CITY_LOOK[cityId] || COUNTRY_LOOK[country] || { weather: 'clear' };
}

/** City id -> weather, for the engine (window.__DBD_WX); cities not listed use their country's. */
export function weatherTable(): Record<string, Weather> {
  const out: Record<string, Weather> = {};
  for (const [id, l] of Object.entries(CITY_LOOK)) out[id] = l.weather;
  for (const [cc, l] of Object.entries(COUNTRY_LOOK)) out[cc] = l.weather;
  return out;
}
