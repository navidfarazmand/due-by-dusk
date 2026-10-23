// ============================================================================
// Due by Dusk · v0.5.01 — Geographical World & Country Atlas Data
// World Map -> Select Playable Country -> Geographically Positioned Cities -> Farm
// ============================================================================

export const GEOGRAPHY: any = {
  // Non-playable countries rendered on the World Map so the globe is a true geographical map
  lockedCountries: [
    { code: 'US', name: 'United States', labelX: 195, labelY: 185, path: 'M 115,140 L 245,140 L 265,162 L 248,208 L 222,218 L 195,212 L 175,228 L 155,205 L 112,192 Z' },
    { code: 'MX', name: 'Mexico', labelX: 175, labelY: 242, path: 'M 135,205 L 185,215 L 212,248 L 235,255 L 218,268 L 182,258 L 145,232 Z' },
    { code: 'AR', name: 'Argentina & Andes', labelX: 302, labelY: 415, path: 'M 278,335 L 315,345 L 325,388 L 305,465 L 282,458 L 272,385 Z' },
    { code: 'CO', name: 'Northern Andes', labelX: 268, labelY: 295, path: 'M 242,265 L 298,268 L 292,315 L 262,338 L 245,305 Z' },
    { code: 'GB', name: 'United Kingdom', labelX: 462, labelY: 112, path: 'M 465,102 L 478,105 L 482,126 L 464,128 L 458,115 Z' },
    { code: 'ES', name: 'Spain & Portugal', labelX: 462, labelY: 176, path: 'M 452,160 L 485,162 L 482,186 L 450,185 Z' },
    { code: 'DE', name: 'Central Europe', labelX: 528, labelY: 132, path: 'M 505,115 L 568,112 L 575,152 L 512,152 Z' },
    { code: 'IT', name: 'Italy', labelX: 522, labelY: 172, path: 'M 510,152 L 525,152 L 542,185 L 530,192 L 514,165 Z' },
    { code: 'NO', name: 'Scandinavia', labelX: 518, labelY: 75, path: 'M 495,52 L 548,48 L 555,95 L 525,102 L 498,88 Z' },
    { code: 'RU', name: 'Northern Eurasia', labelX: 685, labelY: 85, path: 'M 568,48 L 895,52 L 915,115 L 795,135 L 655,132 L 572,112 Z' },
    { code: 'EG', name: 'North Africa & Sahara', labelX: 515, labelY: 235, path: 'M 445,195 L 585,202 L 605,265 L 452,268 L 435,232 Z' },
    { code: 'ZA', name: 'Sub-Saharan Africa', labelX: 545, labelY: 345, path: 'M 485,268 L 605,268 L 615,325 L 565,418 L 525,418 L 495,335 Z' },
    { code: 'ME', name: 'Middle East', labelX: 615, labelY: 205, path: 'M 575,165 L 658,172 L 668,235 L 598,242 L 582,195 Z' },
    { code: 'IN', name: 'India', labelX: 705, labelY: 238, path: 'M 672,185 L 742,192 L 712,282 L 692,278 L 675,222 Z' },
    { code: 'CN', name: 'China & East Asia', labelX: 775, labelY: 182, path: 'M 685,132 L 828,135 L 838,205 L 785,235 L 725,212 L 682,175 Z' },
    { code: 'ID', name: 'Southeast Asia', labelX: 785, labelY: 285, path: 'M 748,242 L 835,255 L 845,312 L 758,308 Z' },
    { code: 'AU', name: 'Australia', labelX: 835, labelY: 392, path: 'M 775,348 L 882,345 L 895,412 L 845,438 L 772,415 Z' }
  ],

  // 4 Fully Playable Countries with World Map geometry + Detailed Country Map geometry + 5-6 Real Cities
  countries: {
    CA: {
      code: 'CA',
      name: 'Canada',
      subtitle: 'Boreal Shield, Great Lakes Marsh, Prairie Grain Belt & Maritime Red-Clay Coasts',
      flag: '🍁',
      envStyle: 'canada',
      worldLabelX: 185,
      worldLabelY: 98,
      // Recognizable World Map polygon for Canada (Pacific coast, Arctic, Hudson Bay indentation, Great Lakes peninsula, Maritimes)
      worldPath: 'M 95,72 L 122,62 L 165,58 L 205,62 L 225,78 L 208,98 L 215,118 L 232,126 L 245,105 L 268,96 L 298,112 L 318,128 L 302,142 L 282,146 L 252,156 L 235,142 L 115,140 L 102,122 L 96,95 Z M 228,48 L 278,46 L 295,68 L 265,82 L 235,68 Z M 332,32 L 395,28 L 412,58 L 378,88 L 342,76 Z',
      // Detailed Country Map (viewBox 0 0 800 520)
      countryOutline: 'M 92,165 L 118,95 L 225,85 L 335,92 L 395,112 L 425,148 L 398,195 L 405,255 L 445,278 L 462,312 L 482,312 L 488,268 L 525,215 L 548,162 L 615,175 L 678,248 L 705,305 L 665,335 L 615,368 L 655,375 L 692,402 L 668,422 L 628,405 L 598,418 L 562,452 L 522,478 L 498,485 L 508,452 L 482,425 L 445,412 L 142,412 L 112,372 L 102,295 L 86,225 Z M 74,345 L 96,355 L 102,398 L 82,392 Z M 265,42 L 365,38 L 385,74 L 285,78 Z M 445,35 L 575,45 L 612,128 L 545,142 L 465,98 Z M 708,325 L 758,318 L 768,368 L 718,372 Z',
      geographicFeatures: [
        { type: 'water', name: 'Hudson Bay', lx: 455, ly: 225, path: 'M 402,188 C 395,235 415,278 462,310 C 485,310 492,265 522,215 C 495,182 442,175 402,188 Z' },
        { type: 'water', name: 'Great Lakes', lx: 472, ly: 462, path: 'M 428,408 Q 468,395 498,425 Q 528,455 568,428 Q 538,478 492,482 Q 465,442 428,408 Z' },
        { type: 'river', name: 'St. Lawrence', lx: 625, ly: 355, path: 'M 565,428 Q 615,388 675,342' },
        { type: 'mountain', name: 'Rocky Mountains', lx: 155, ly: 255, path: 'M 128,145 L 158,245 L 188,395' }
      ],
      cities: [
        {
          id: 'ca_toronto',
          name: 'Toronto (Holland Marsh)',
          province: 'Ontario · 43.7°N, 79.4°W',
          x: 548, y: 446,
          mul: 1.0,
          rival: 'Reeve MacLeod',
          record: 165,
          buff: '+10% vegetable sell value across all farms',
          desc: 'Rich black muck-soil kettle marsh just north of Lake Ontario—famous for carrots, onions, and leafy greens.',
          subTheme: 'marsh',
          crops: ['carrot', 'onion', 'cabbage', 'radish', 'canola', 'pumpkin', 'potato', 'golden']
        },
        {
          id: 'ca_gatineau',
          name: 'Gatineau & Outaouais',
          province: 'Quebec · 45.4°N, 75.7°W',
          x: 588, y: 414,
          mul: 1.15,
          rival: 'Madame Tremblay',
          record: 240,
          buff: '+1.0 s of daylight on all farms',
          desc: 'Rolling Laurentian foothills & Ottawa River valley market gardens framed by sugar-maple bush.',
          subTheme: 'maple',
          crops: ['carrot', 'cabbage', 'canola', 'berry', 'pumpkin', 'radish', 'pei_russet', 'golden']
        },
        {
          id: 'ca_saskatoon',
          name: 'Saskatoon',
          province: 'Saskatchewan · 52.1°N, 106.7°W',
          x: 305, y: 358,
          mul: 1.35,
          rival: 'Foreman Kowalski',
          record: 380,
          buff: 'Canola & Golden Corn pay +20% more',
          desc: 'Vast golden prairie chernozem plains dominated by towering wooden grain elevators and bright yellow canola.',
          subTheme: 'prairie',
          crops: ['canola', 'carrot', 'cabbage', 'berry', 'radish', 'golden', 'pei_russet', 'pumpkin']
        },
        {
          id: 'ca_kelowna',
          name: 'Kelowna (Okanagan)',
          province: 'British Columbia · 49.9°N, 119.5°W',
          x: 175, y: 378,
          mul: 1.55,
          rival: 'Vintner Alistair',
          record: 520,
          buff: '+8% critical harvest chance on all farms',
          desc: 'Sun-drenched lake terraces nestled between pine-clad Interior mountains—renowned for berries and orchard produce.',
          subTheme: 'mountain',
          crops: ['berry', 'carrot', 'onion', 'canola', 'pumpkin', 'radish', 'golden', 'pei_russet']
        },
        {
          id: 'ca_charlottetown',
          name: 'Charlottetown',
          province: 'Prince Edward Island · 46.2°N, 63.1°W',
          x: 695, y: 392,
          mul: 1.75,
          rival: 'Captain Arsenault',
          record: 720,
          buff: 'Potatoes & Root crops take +25% bonus damage',
          desc: 'Iron-rich red-sandstone coastal farmland famous worldwide for PEI Russet potatoes.',
          subTheme: 'maritime',
          crops: ['pei_russet', 'carrot', 'cabbage', 'onion', 'canola', 'pumpkin', 'potato', 'radish']
        },
        {
          id: 'ca_leamington',
          name: 'Leamington (Essex)',
          province: 'Ontario South · 42.1°N, 82.6°W',
          x: 512, y: 472,
          mul: 1.95,
          rival: 'Baroness Vance',
          record: 980,
          buff: '+12% faster crop sprouting on all farms',
          desc: 'Canada’s warmest southern peninsula jutting into Lake Erie—lush market rows and high-yield harvests.',
          subTheme: 'marsh',
          crops: ['carrot', 'onion', 'berry', 'canola', 'pumpkin', 'golden', 'pei_russet', 'potato']
        }
      ]
    },

    BR: {
      code: 'BR',
      name: 'Brazil',
      subtitle: 'Irrigated São Francisco Fruit Valleys, Red-Earth Cerrado, Amazon Várzea & Southern Highlands',
      flag: '🌴',
      envStyle: 'brazil',
      worldLabelX: 325,
      worldLabelY: 325,
      worldPath: 'M 268,268 L 325,265 L 372,292 L 365,342 L 332,388 L 308,382 L 292,338 L 258,308 Z',
      countryOutline: 'M 195,125 L 335,75 L 485,95 L 665,168 L 685,235 L 595,335 L 515,412 L 435,482 L 375,455 L 365,365 L 255,315 L 145,235 Z',
      geographicFeatures: [
        { type: 'river', name: 'Amazon River (Rio Amazonas)', path: 'M 165,155 Q 325,148 485,112' },
        { type: 'river', name: 'São Francisco River', path: 'M 495,325 Q 525,235 635,205' },
        { type: 'mountain', name: 'Chapada Diamantina & Serra do Mar', path: 'M 565,245 L 535,345 L 465,415' }
      ],
      cities: [
        {
          id: 'br_petrolina',
          name: 'Petrolina (São Francisco)',
          province: 'Pernambuco · 9.4°S, 40.5°W',
          x: 588, y: 205,
          mul: 1.35,
          rival: 'Coronel Mendoza',
          record: 420,
          buff: 'Pérola Pineapples & Tropical crops pay +20% more',
          desc: 'Irrigated oasis along the São Francisco River—Brazil’s premier exporter of sweet Pérola pineapples and tropical fruit.',
          subTheme: 'sertao',
          crops: ['abacaxi', 'mandioca', 'golden', 'radish', 'berry', 'pumpkin', 'onion']
        },
        {
          id: 'br_ribeirao',
          name: 'Ribeirão Preto',
          province: 'São Paulo · 21.2°S, 47.8°W',
          x: 492, y: 358,
          mul: 1.65,
          rival: 'Dona Helena',
          record: 680,
          buff: '+12% wider scythe arc across all farms',
          desc: 'Fertile purple-red volcanic soil (Terra Roxa) on the Paulista plateau—rich in pineapples, maize, and cassava.',
          subTheme: 'terraroxa',
          crops: ['abacaxi', 'mandioca', 'golden', 'carrot', 'onion', 'pumpkin', 'potato']
        },
        {
          id: 'br_belem',
          name: 'Belém (Amazon Delta)',
          province: 'Pará · 1.5°S, 48.5°W',
          x: 478, y: 112,
          mul: 1.9,
          rival: 'Capitão Silva',
          record: 950,
          buff: 'Rain & Fertilizer spawn +35% more crops',
          desc: 'Lush equatorial floodplain at the mouth of the Amazon—home country of domesticated manioc (cassava) and tropical palms.',
          subTheme: 'amazon',
          crops: ['mandioca', 'abacaxi', 'berry', 'radish', 'golden', 'pumpkin']
        },
        {
          id: 'br_sinop',
          name: 'Sinop (Cerrado)',
          province: 'Mato Grosso · 11.9°S, 55.5°W',
          x: 368, y: 248,
          mul: 2.2,
          rival: 'Fazendeiro Braga',
          record: 1350,
          buff: '+15% faster swing rate on all farms',
          desc: 'Endless red-earth savanna plateaus beneath dramatic flat-topped Chapada sandstone mesas.',
          subTheme: 'cerrado',
          crops: ['golden', 'mandioca', 'abacaxi', 'pumpkin', 'carrot', 'radish', 'potato']
        },
        {
          id: 'br_bento',
          name: 'Bento Gonçalves',
          province: 'Rio Grande do Sul · 29.2°S, 51.5°W',
          x: 445, y: 448,
          mul: 2.5,
          rival: 'Barão Garibaldi',
          record: 1850,
          buff: 'Chain multipliers last +0.4s longer',
          desc: 'Steep basalt-canyon highlands in southern Brazil crowned with umbrella-shaped Araucaria pines and terraced valleys.',
          subTheme: 'gaucho',
          crops: ['berry', 'onion', 'mandioca', 'abacaxi', 'cabbage', 'pumpkin', 'potato']
        }
      ]
    },

    FR: {
      code: 'FR',
      name: 'France',
      subtitle: 'Provence Lavender Plateaus, Loire Château Potagers, Burgundy Clos & Brittany Coasts',
      flag: '⚜️',
      envStyle: 'france',
      worldLabelX: 488,
      worldLabelY: 146,
      worldPath: 'M 472,128 L 505,126 L 512,148 L 498,162 L 474,160 L 465,142 Z',
      countryOutline: 'M 285,82 L 455,68 L 625,135 L 605,255 L 645,355 L 595,435 L 455,448 L 385,468 L 245,425 L 265,285 L 125,195 L 155,145 L 265,148 Z',
      geographicFeatures: [
        { type: 'river', name: 'Loire River', path: 'M 215,225 Q 355,228 485,295' },
        { type: 'river', name: 'Rhône River', path: 'M 545,255 L 525,425' },
        { type: 'mountain', name: 'French Alps & Pyrenees', path: 'M 585,285 L 625,385 M 255,432 L 425,455' }
      ],
      cities: [
        {
          id: 'fr_avignon',
          name: 'Avignon (Provence)',
          province: 'Vaucluse · 43.9°N, 4.8°E',
          x: 525, y: 398,
          mul: 1.5,
          rival: 'Comtesse de Valois',
          record: 550,
          buff: 'Provence Lavender & Onions pay +25% more',
          desc: 'Sun-baked limestone plateaus framed by pencil-thin Mediterranean cypresses, Roman aqueduct arches, and fragrant lavender rows.',
          subTheme: 'provence',
          crops: ['lavender', 'onion', 'carrot', 'cabbage', 'berry', 'pumpkin', 'golden']
        },
        {
          id: 'fr_tours',
          name: 'Tours (Loire Valley)',
          province: 'Indre-et-Loire · 47.4°N, 0.7°E',
          x: 342, y: 232,
          mul: 1.8,
          rival: 'Marquis de Chenonceau',
          record: 880,
          buff: '+2 max crops on the field on all farms',
          desc: 'The "Garden of France"—ornate white-tuffeau Renaissance château kitchen gardens (potagers) bursting with heirlooms.',
          subTheme: 'loire',
          crops: ['cabbage', 'lavender', 'onion', 'berry', 'carrot', 'radish', 'pumpkin', 'potato']
        },
        {
          id: 'fr_beaune',
          name: 'Beaune (Burgundy)',
          province: 'Côte-d’Or · 47.0°N, 4.8°E',
          x: 508, y: 248,
          mul: 2.15,
          rival: 'intendant Moreau',
          record: 1280,
          buff: 'Lucky crops appear +2% more often',
          desc: 'Golden limestone slopes enclosed by ancient dry-stone walls (clos) and glazed-tile Burgundian manor roofs.',
          subTheme: 'burgundy',
          crops: ['berry', 'onion', 'lavender', 'cabbage', 'carrot', 'potato', 'pumpkin']
        },
        {
          id: 'fr_roscoff',
          name: 'Roscoff (Brittany)',
          province: 'Finistère · 48.7°N, 4.0°W',
          x: 158, y: 168,
          mul: 2.45,
          rival: 'Capitaine Le Gall',
          record: 1750,
          buff: 'Drama Onions & Cabbages have −20% HP',
          desc: 'Wind-swept Armorican granite coast warmed by the Gulf Stream—world-famous home of sweet pink Roscoff onions and cauliflower.',
          subTheme: 'brittany',
          crops: ['onion', 'cabbage', 'carrot', 'radish', 'potato', 'lavender', 'pumpkin']
        },
        {
          id: 'fr_agen',
          name: 'Agen (Garonne)',
          province: 'Nouvelle-Aquitaine · 44.2°N, 0.6°E',
          x: 345, y: 382,
          mul: 2.8,
          rival: 'Duc de Gascogne',
          record: 2400,
          buff: '+20% Charge Cleave shockwave damage',
          desc: 'Fertile alluvial terraces along the Garonne River—famous for plum orchards, sweet maize, and half-timbered bastide farms.',
          subTheme: 'gascogne',
          crops: ['berry', 'golden', 'lavender', 'onion', 'pumpkin', 'carrot', 'potato']
        }
      ]
    },

    JP: {
      code: 'JP',
      name: 'Japan',
      subtitle: 'Mount Fuji Foothills, Kyoto Heirloom Basins, Hokkaido Plains & Sakurajima Volcanic Loam',
      flag: '⛩️',
      envStyle: 'japan',
      worldLabelX: 868,
      worldLabelY: 168,
      worldPath: 'M 858,125 L 878,128 L 872,148 L 855,182 L 835,195 L 828,182 L 848,155 Z',
      countryOutline: 'M 535,55 L 675,68 L 655,148 L 545,155 Z M 515,175 L 575,185 L 565,285 L 505,355 L 395,382 L 285,388 L 265,352 L 385,315 L 475,245 Z M 315,392 L 378,388 L 372,425 L 312,422 Z M 205,398 L 275,398 L 262,478 L 198,468 Z',
      geographicFeatures: [
        { type: 'mountain', name: 'Mount Fuji (3,776m)', path: 'M 445,335 L 475,295 L 505,335' },
        { type: 'water', name: 'Seto Inland Sea', path: 'M 285,375 Q 345,372 385,385' }
      ],
      cities: [
        {
          id: 'jp_shizuoka',
          name: 'Shizuoka (Mt. Fuji)',
          province: 'Chūbu · 35.0°N, 138.4°E',
          x: 478, y: 342,
          mul: 1.8,
          rival: 'Master Takahashi',
          record: 820,
          buff: 'Giant White Daikon & Radishes pay +25% more',
          desc: 'Emerald terraced slopes at the foot of snow-crowned Mount Fuji—celebrated for crisp white daikon, green tea, and mountain streams.',
          subTheme: 'fuji',
          crops: ['daikon', 'radish', 'cabbage', 'carrot', 'pumpkin', 'berry', 'potato']
        },
        {
          id: 'jp_kyoto',
          name: 'Kyoto (Kamo Basin)',
          province: 'Kansai · 35.0°N, 135.8°E',
          x: 388, y: 348,
          mul: 2.15,
          rival: 'Lady Murasaki',
          record: 1350,
          buff: '+15% Harvest Rush duration on all farms',
          desc: 'Historic misty valley surrounded by towering bamboo groves and vermilion torii gates—famed for prized Kyo-yasai heirloom vegetables.',
          subTheme: 'kyoto',
          crops: ['daikon', 'onion', 'cabbage', 'radish', 'pumpkin', 'carrot', 'berry']
        },
        {
          id: 'jp_sapporo',
          name: 'Sapporo & Furano',
          province: 'Hokkaido · 43.1°N, 141.4°E',
          x: 592, y: 115,
          mul: 2.5,
          rival: 'Director Sato',
          record: 1950,
          buff: 'Pumpkins, Potatoes & Corn pay +20% more',
          desc: 'Wide northern volcanic plains in Hokkaido—Japan’s agricultural breadbasket for sweet corn, kabocha pumpkins, potatoes, and lavender.',
          subTheme: 'hokkaido',
          crops: ['pumpkin', 'potato', 'golden', 'lavender', 'daikon', 'onion', 'carrot']
        },
        {
          id: 'jp_aomori',
          name: 'Aomori (Tsugaru)',
          province: 'Tōhoku · 40.8°N, 140.7°E',
          x: 545, y: 196,
          mul: 2.85,
          rival: 'Elder Soma',
          record: 2650,
          buff: 'Frosty crops pay +$4 when cracked',
          desc: 'Crisp northern orchards and dark-loam fields beneath Mount Iwaki.',
          subTheme: 'tohoku',
          crops: ['daikon', 'radish', 'berry', 'cabbage', 'potato', 'pumpkin', 'carrot']
        },
        {
          id: 'jp_kagoshima',
          name: 'Kagoshima (Sakurajima)',
          province: 'Kyūshū · 31.6°N, 130.6°E',
          x: 235, y: 448,
          mul: 3.25,
          rival: 'Lord Shimazu (Arthur’s Partner)',
          record: 3600,
          buff: '+25% scythe damage across all farms',
          desc: 'Mineral-rich black volcanic ash soil across the bay from smoking Sakurajima—home of the world’s largest Sakurajima daikon radishes!',
          subTheme: 'sakurajima',
          crops: ['daikon', 'potato', 'pumpkin', 'radish', 'golden', 'onion', 'berry']
        }
      ]
    }
  }
};
