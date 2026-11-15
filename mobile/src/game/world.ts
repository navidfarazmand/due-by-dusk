// The world in play order: 7 countries, 28 towns (0.15, Navid 15 Nov: Canada 5, Japan 3, the others 4; one runaway each). Names and crops come from Gemini's v0.6.05 data;
// the order (route), the country trios and the short names are Claude's (rivals left the game in 0.15). Edit freely.

export interface CityDef {
  id: string;
  name: string;
  short: string;
  province: string;
  country: CountryCode;
  subTheme: string;
  /** Gemini's crop list for the city (the trio first). */
  crops: string[];
  desc: string;
}

export type CountryCode = 'CA' | 'US' | 'BR' | 'MA' | 'FR' | 'CN' | 'JP';

export interface CountryDef {
  code: CountryCode;
  name: string;
  /** The three signature characters, lead first. */
  trio: [string, string, string];
  trioNames: [string, string, string];
  blurb: string;
  cities: CityDef[];
}

export const COUNTRIES: CountryDef[] = [
  {
    code: 'CA',
    name: "Canada",
    trio: ["pei_russet","fiddlehead","saskaberry"],
    trioNames: ["Hoser Russet","Lumberjack Fiddlehead","Mountie Saskaberry"],
    blurb: "First snow, maple shacks and red-clay potatoes, from the Maritimes to the Okanagan.",
    cities: [
      {
        id: 'ca_charlottetown',
        name: "Charlottetown",
        short: "Charlottetown",
        province: "Prince Edward Island · 46.2°N, 63.1°W",
        country: 'CA',
        subTheme: "maritime",
        crops: ["pei_russet","fiddlehead","saskaberry","carrot","radish","potato","onion","pumpkin"],
        desc: "Iron-rich red-sandstone coastal farmland famous worldwide for toothless hockey-stick-tapping Hoser Russet potatoes!",
      },
      {
        id: 'ca_gatineau',
        name: "Gatineau & Outaouais",
        short: "Gatineau",
        province: "Quebec & NB · 45.4°N, 75.7°W",
        country: 'CA',
        subTheme: "maple",
        crops: ["fiddlehead","pei_russet","saskaberry","carrot","radish","cabbage","pumpkin","golden"],
        desc: "Rolling Laurentian & Maritime river valleys famed for coiled Lumberjack Fiddlehead ferns, Hoser Russets, and Mountie Saskaberries.",
      },
      {
        id: 'ca_toronto',
        name: "Toronto (Holland Marsh)",
        short: "Toronto",
        province: "Ontario · 43.7°N, 79.4°W",
        country: 'CA',
        subTheme: "marsh",
        crops: ["pei_russet","fiddlehead","saskaberry","carrot","radish","onion","cabbage","pumpkin","golden"],
        desc: "Rich black muck-soil kettle marsh north of Lake Ontario—home to Hoser Russet, Lumberjack Fiddlehead, Mountie Saskaberry, Gym-Bro Carrot & Runaway Radish.",
      },
      {
        id: 'ca_saskatoon',
        name: "Saskatoon",
        short: "Saskatoon",
        province: "Saskatchewan · 52.1°N, 106.7°W",
        country: 'CA',
        subTheme: "prairie",
        crops: ["saskaberry","pei_russet","fiddlehead","carrot","radish","golden","pumpkin","cabbage"],
        desc: "Vast golden prairie chernozem plains patrolled by polite Mountie Saskaberries, Hoser Russets, and Lumberjack Fiddleheads.",
      },
      {
        id: 'ca_kelowna',
        name: "Kelowna (Okanagan)",
        short: "Kelowna",
        province: "British Columbia · 49.9°N, 119.5°W",
        country: 'CA',
        subTheme: "mountain",
        crops: ["saskaberry","fiddlehead","pei_russet","carrot","radish","berry","onion","pumpkin"],
        desc: "Sun-drenched lake terraces nestled between pine-clad Interior mountains—renowned for Mountie Saskaberries and orchard produce.",
      },
    ],
  },
  {
    code: 'US',
    name: "United States",
    trio: ["habanero","sweetcorn","brisket_onion"],
    trioNames: ["Sheriff Habanero","Quarterback Sweetcorn","Smokey Brisket-Onion"],
    blurb: "Ranches, corn country and BBQ pits.",
    cities: [
      {
        id: 'us_austin',
        name: "Austin & Rio Grande",
        short: "Austin",
        province: "Texas · 30.3°N, 97.7°W",
        country: 'US',
        subTheme: "prairie",
        crops: ["habanero","sweetcorn","brisket_onion","carrot","radish","pumpkin","golden"],
        desc: "Sun-baked Texas ranchland & smokehouse pastures—home to Sheriff Habanero, Quarterback Sweetcorn, and Smokey Brisket-Onion!",
      },
      {
        id: 'us_desmoines',
        name: "Des Moines (Corn Belt)",
        short: "Des Moines",
        province: "Iowa · 41.6°N, 93.6°W",
        country: 'US',
        subTheme: "prairie",
        crops: ["sweetcorn","habanero","brisket_onion","carrot","radish","golden","pumpkin"],
        desc: "Heartland gridiron cornfields patrolled by blitzing Quarterback Sweetcorn, Sheriff Habanero, and Smokey Brisket-Onion.",
      },
      {
        id: 'us_circleville',
        name: "Circleville (Pumpkin Show)",
        short: "Circleville",
        province: "Ohio · 39.6°N, 82.9°W",
        country: 'US',
        subTheme: "prairie",
        crops: ["pumpkin","sweetcorn","habanero","carrot","radish","golden"],
        desc: "Ohio river-bottom fields where the whole town turns out every October for the Pumpkin Show, and Grandma Pumpkin judges the pies.",
      },
      {
        id: 'us_vidalia',
        name: "Vidalia & Savannah",
        short: "Vidalia",
        province: "Georgia · 32.2°N, 82.4°W",
        country: 'US',
        subTheme: "marsh",
        crops: ["brisket_onion","habanero","sweetcorn","carrot","radish","onion","pumpkin"],
        desc: "Sweet sandy coastal-plain soil famed for pitmaster Smokey Brisket-Onions, Sheriff Habanero, and Quarterback Sweetcorn.",
      },
    ],
  },
  {
    code: 'BR',
    name: "Brazil",
    trio: ["abacaxi","mandioca","guarana"],
    trioNames: ["Carnavale Abacaxi","Ginga Mandioca","Craque Guaraná"],
    blurb: "Tropical rain, red soil and the Amazon delta.",
    cities: [
      {
        id: 'br_belem',
        name: "Belém (Amazon Delta)",
        short: "Belém",
        province: "Pará · 1.5°S, 48.5°W",
        country: 'BR',
        subTheme: "amazon",
        crops: ["mandioca","guarana","abacaxi","carrot","radish","berry","golden","pumpkin"],
        desc: "Lush equatorial floodplain at the mouth of the Amazon—homeland of capoeira-kicking Ginga Mandioca and hyper-caffeinated Craque Guaraná.",
      },
      {
        id: 'br_petrolina',
        name: "Petrolina (São Francisco)",
        short: "Petrolina",
        province: "Pernambuco · 9.4°S, 40.5°W",
        country: 'BR',
        subTheme: "sertao",
        crops: ["abacaxi","mandioca","guarana","carrot","radish","golden","pumpkin","onion"],
        desc: "Irrigated oasis along the São Francisco River—home to samba-dancing Carnavale Abacaxi, capoeira Ginga Mandioca, and soccer star Craque Guaraná!",
      },
      {
        id: 'br_sinop',
        name: "Sinop (Cerrado)",
        short: "Sinop",
        province: "Mato Grosso · 11.9°S, 55.5°W",
        country: 'BR',
        subTheme: "cerrado",
        crops: ["guarana","mandioca","abacaxi","carrot","radish","golden","pumpkin","potato"],
        desc: "Endless red-earth savanna plateaus beneath dramatic flat-topped Chapada sandstone mesas.",
      },
      {
        id: 'br_bento',
        name: "Bento Gonçalves",
        short: "Bento Gonçalves",
        province: "Rio Grande do Sul · 29.2°S, 51.5°W",
        country: 'BR',
        subTheme: "gaucho",
        crops: ["abacaxi","mandioca","guarana","carrot","radish","berry","cabbage","pumpkin"],
        desc: "Steep basalt-canyon highlands in southern Brazil crowned with umbrella-shaped Araucaria pines and terraced valleys.",
      },
    ],
  },
  {
    code: 'MA',
    name: "Morocco",
    trio: ["chickpea","eggplant","olive"],
    trioNames: ["Hummus Chickpea","Zaalouk Eggplant","Beldi Green Olive"],
    blurb: "Oasis gardens and olive groves on the edge of the desert.",
    cities: [
      {
        id: 'ma_marrakech',
        name: "Marrakech & Ourika",
        short: "Marrakech",
        province: "Marrakech-Safi · 31.6°N, 8.0°W",
        country: 'MA',
        subTheme: "oasis",
        crops: ["chickpea","eggplant","olive","carrot","radish","pumpkin","golden"],
        desc: "Sun-drenched red-earth kasbah terraces at the foot of the snow-crowned High Atlas—home to Hummus Chickpea, Zaalouk Eggplant, and Beldi Green Olive!",
      },
      {
        id: 'ma_meknes',
        name: "Meknes & Volubilis",
        short: "Meknes",
        province: "Fès-Meknès · 33.9°N, 5.5°W",
        country: 'MA',
        subTheme: "oasis",
        crops: ["olive","chickpea","eggplant","carrot","radish","golden","pumpkin"],
        desc: "Ancient imperial olive groves and sun-warmed aubergine gardens patrolled by Beldi Green Olive, Zaalouk Eggplant, and Hummus Chickpea.",
      },
      {
        id: 'ma_larache',
        name: "Larache & Loukkos",
        short: "Larache",
        province: "Tanger-Tétouan · 35.2°N, 6.2°W",
        country: 'MA',
        subTheme: "oasis",
        crops: ["berry","olive","chickpea","carrot","radish","golden"],
        desc: "Atlantic breezes over the Loukkos berry fields, where the Briar-Berry Twins hide under the plastic tunnels.",
      },
      {
        id: 'ma_fes',
        name: "Fes & Sais Plain",
        short: "Fes",
        province: "Fès-Meknès · 34.0°N, 5.0°W",
        country: 'MA',
        subTheme: "oasis",
        crops: ["eggplant","chickpea","olive","carrot","radish","onion","pumpkin"],
        desc: "Fertile Sais Valley chickpea fields & lantern-lit medina orchards famed for Hummus Chickpea, Zaalouk Eggplant, and Beldi Green Olive.",
      },
    ],
  },
  {
    code: 'FR',
    name: "France",
    trio: ["lavender","echalote","artichaut"],
    trioNames: ["Diva Lavande","Monsieur Échalote","Chevalier Artichaut"],
    blurb: "Lavender hills, Loire castles and Breton fields.",
    cities: [
      {
        id: 'fr_avignon',
        name: "Avignon (Provence)",
        short: "Avignon",
        province: "Vaucluse · 43.9°N, 4.8°E",
        country: 'FR',
        subTheme: "provence",
        crops: ["lavender","echalote","artichaut","carrot","radish","onion","cabbage","pumpkin"],
        desc: "Sun-baked limestone plateaus framed by Mediterranean cypresses and Roman arches—home to Diva Lavande, Monsieur Échalote, and Chevalier Artichaut!",
      },
      {
        id: 'fr_beaune',
        name: "Beaune (Burgundy)",
        short: "Beaune",
        province: "Côte-d’Or · 47.0°N, 4.8°E",
        country: 'FR',
        subTheme: "burgundy",
        crops: ["echalote","lavender","artichaut","carrot","radish","berry","onion","potato"],
        desc: "Golden limestone slopes enclosed by ancient dry-stone walls (clos) and glazed-tile Burgundian manor roofs.",
      },
      {
        id: 'fr_tours',
        name: "Tours (Loire Valley)",
        short: "Tours",
        province: "Indre-et-Loire · 47.4°N, 0.7°E",
        country: 'FR',
        subTheme: "loire",
        crops: ["artichaut","echalote","lavender","carrot","radish","cabbage","berry","pumpkin"],
        desc: "The \"Garden of France\"—ornate white-tuffeau Renaissance château potagers patrolled by fencing Chevalier Artichaut and mime Monsieur Échalote.",
      },
      {
        id: 'fr_agen',
        name: "Agen (Garonne)",
        short: "Agen",
        province: "Nouvelle-Aquitaine · 44.2°N, 0.6°E",
        country: 'FR',
        subTheme: "gascogne",
        crops: ["artichaut","lavender","echalote","carrot","radish","golden","pumpkin","potato"],
        desc: "Fertile alluvial terraces along the Garonne River—homeland of Musketeer Chevalier Artichaut, Diva Lavande, and Monsieur Échalote.",
      },
    ],
  },
  {
    code: 'CN',
    name: "China",
    trio: ["bittermelon","bokchoy","lotusroot"],
    trioNames: ["Shaolin Bitter Melon","Sifu Bok Choy","Zen Lotus Root"],
    blurb: "Karst peaks, West Lake and the Sichuan basin.",
    cities: [
      {
        id: 'cn_guilin',
        name: "Guilin & Li River",
        short: "Guilin",
        province: "Guangxi · 25.3°N, 110.3°E",
        country: 'CN',
        subTheme: "karst",
        crops: ["bittermelon","bokchoy","lotusroot","carrot","radish","cabbage","onion","pumpkin","golden"],
        desc: "Emerald river terraces framed by misty limestone karst peaks and bamboo groves—home to Shaolin Bitter Melon, Sifu Bok Choy, and Zen Lotus Root!",
      },
      {
        id: 'cn_hangzhou',
        name: "Hangzhou & West Lake",
        short: "Hangzhou",
        province: "Zhejiang · 30.3°N, 120.2°E",
        country: 'CN',
        subTheme: "westlake",
        crops: ["lotusroot","bokchoy","bittermelon","carrot","radish","cabbage","golden","pumpkin"],
        desc: "Misty lotus ponds and Dragon Well tea hills patrolled by Zen Lotus Root, Sifu Bok Choy, and Shaolin Bitter Melon.",
      },
      {
        id: 'cn_wuhan',
        name: "Wuhan & the Yangtze",
        short: "Wuhan",
        province: "Hubei · 30.6°N, 114.3°E",
        country: 'CN',
        subTheme: "westlake",
        crops: ["cabbage","lotusroot","bokchoy","carrot","radish","golden"],
        desc: "Yangtze river flats famous for winter cabbages, where Lord Cabbage grows fat on river mud and steamed buns.",
      },
      {
        id: 'cn_chengdu',
        name: "Chengdu Basin",
        short: "Chengdu",
        province: "Sichuan · 30.6°N, 104.1°E",
        country: 'CN',
        subTheme: "sichuan",
        crops: ["bokchoy","bittermelon","lotusroot","carrot","radish","onion","cabbage","pumpkin"],
        desc: "Fertile \"Land of Abundance\" irrigated by ancient Dujiangyan channels—famed for Sifu Bok Choy, Shaolin Bitter Melon, and Zen Lotus Root.",
      },
    ],
  },
  {
    code: 'JP',
    name: "Japan",
    trio: ["daikon","kabocha","wasabi"],
    trioNames: ["Sensei Daikon","Rikishi Kabocha","Shinobi Wasabi"],
    blurb: "Rice terraces, snowy Hokkaido and a volcano finale.",
    cities: [
      {
        id: 'jp_sapporo',
        name: "Sapporo & Furano",
        short: "Sapporo",
        province: "Hokkaido · 43.1°N, 141.4°E",
        country: 'JP',
        subTheme: "hokkaido",
        crops: ["kabocha","daikon","wasabi","carrot","radish","golden","pumpkin","potato"],
        desc: "Wide northern volcanic plains in Hokkaido—renowned for sumo-sized Rikishi Kabocha winter squash, Sensei Daikon, and Shinobi Wasabi.",
      },
      {
        id: 'jp_shizuoka',
        name: "Shizuoka (Mt. Fuji)",
        short: "Shizuoka",
        province: "Chūbu · 35.0°N, 138.4°E",
        country: 'JP',
        subTheme: "fuji",
        crops: ["daikon","kabocha","wasabi","carrot","radish","cabbage","pumpkin","potato"],
        desc: "Emerald terraced slopes & cold mountain streams at the foot of Mount Fuji—home to Sensei Daikon, sumo Rikishi Kabocha, and stealthy Shinobi Wasabi!",
      },
      {
        id: 'jp_kagoshima',
        name: "Kagoshima (Sakurajima)",
        short: "Kagoshima",
        province: "Kyūshū · 31.6°N, 130.6°E",
        country: 'JP',
        subTheme: "sakurajima",
        crops: ["daikon","kabocha","wasabi","carrot","radish","golden","pumpkin","potato"],
        desc: "Mineral-rich black volcanic ash soil across the bay from smoking Sakurajima—dojo of Grandmaster Sensei Daikon and Rikishi Kabocha!",
      },
    ],
  },
];

/** Every city in play order (route index = position in this list). */
export const ROUTE: CityDef[] = COUNTRIES.flatMap(c => c.cities);

export function cityById(id: string): CityDef | undefined {
  return ROUTE.find(c => c.id === id);
}

export function countryOf(code: CountryCode): CountryDef {
  const c = COUNTRIES.find(x => x.code === code);
  if (!c) throw new Error('unknown country ' + code);
  return c;
}

export function routeIndex(id: string): number {
  return ROUTE.findIndex(c => c.id === id);
}

/** The last city of each country is its boss farm. */
export function isBossCity(id: string): boolean {
  const c = cityById(id);
  if (!c) return false;
  const list = countryOf(c.country).cities;
  return list[list.length - 1].id === id;
}
