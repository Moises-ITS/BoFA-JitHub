export interface CountryInfo {
  country: string;
  flag:    string;
}

const CITY_COUNTRY: Record<string, CountryInfo> = {
  // ── United States ────────────────────────────────────────────────────────
  'New York':       { country: 'USA', flag: '🇺🇸' },
  'New York City':  { country: 'USA', flag: '🇺🇸' },
  'NYC':            { country: 'USA', flag: '🇺🇸' },
  'Newark':         { country: 'USA', flag: '🇺🇸' },
  'New Brunswick':  { country: 'USA', flag: '🇺🇸' },
  'San Francisco':  { country: 'USA', flag: '🇺🇸' },
  'Seattle':        { country: 'USA', flag: '🇺🇸' },
  'Chicago':        { country: 'USA', flag: '🇺🇸' },
  'Austin':         { country: 'USA', flag: '🇺🇸' },
  'Boston':         { country: 'USA', flag: '🇺🇸' },
  'Washington':     { country: 'USA', flag: '🇺🇸' },
  'Washington DC':  { country: 'USA', flag: '🇺🇸' },
  'DC':             { country: 'USA', flag: '🇺🇸' },
  'Los Angeles':    { country: 'USA', flag: '🇺🇸' },
  'Denver':         { country: 'USA', flag: '🇺🇸' },
  'Atlanta':        { country: 'USA', flag: '🇺🇸' },
  'Dallas':         { country: 'USA', flag: '🇺🇸' },
  'Houston':        { country: 'USA', flag: '🇺🇸' },
  'Phoenix':        { country: 'USA', flag: '🇺🇸' },
  'Philadelphia':   { country: 'USA', flag: '🇺🇸' },
  'San Diego':      { country: 'USA', flag: '🇺🇸' },
  'Miami':          { country: 'USA', flag: '🇺🇸' },
  'Minneapolis':    { country: 'USA', flag: '🇺🇸' },
  'Portland':       { country: 'USA', flag: '🇺🇸' },
  'Nashville':      { country: 'USA', flag: '🇺🇸' },
  'Charlotte':      { country: 'USA', flag: '🇺🇸' },
  'Indianapolis':   { country: 'USA', flag: '🇺🇸' },
  'Columbus':       { country: 'USA', flag: '🇺🇸' },
  'San Jose':       { country: 'USA', flag: '🇺🇸' },
  'Menlo Park':     { country: 'USA', flag: '🇺🇸' },
  'Redmond':        { country: 'USA', flag: '🇺🇸' },
  'Sunnyvale':      { country: 'USA', flag: '🇺🇸' },
  'Mountain View':  { country: 'USA', flag: '🇺🇸' },
  'Palo Alto':      { country: 'USA', flag: '🇺🇸' },
  'Cupertino':      { country: 'USA', flag: '🇺🇸' },
  'Pittsburgh':     { country: 'USA', flag: '🇺🇸' },
  'Detroit':        { country: 'USA', flag: '🇺🇸' },
  'Baltimore':      { country: 'USA', flag: '🇺🇸' },
  'Raleigh':        { country: 'USA', flag: '🇺🇸' },
  'Salt Lake City': { country: 'USA', flag: '🇺🇸' },
  'Kansas City':    { country: 'USA', flag: '🇺🇸' },
  'Tampa':          { country: 'USA', flag: '🇺🇸' },
  'Orlando':        { country: 'USA', flag: '🇺🇸' },
  'St. Louis':      { country: 'USA', flag: '🇺🇸' },
  'Sacramento':     { country: 'USA', flag: '🇺🇸' },
  'New Orleans':    { country: 'USA', flag: '🇺🇸' },
  'Richmond':       { country: 'USA', flag: '🇺🇸' },
  'Louisville':     { country: 'USA', flag: '🇺🇸' },
  'Oklahoma City':  { country: 'USA', flag: '🇺🇸' },
  'Tucson':         { country: 'USA', flag: '🇺🇸' },
  'Fresno':         { country: 'USA', flag: '🇺🇸' },
  'Virginia Beach': { country: 'USA', flag: '🇺🇸' },
  'Memphis':        { country: 'USA', flag: '🇺🇸' },
  'Las Vegas':      { country: 'USA', flag: '🇺🇸' },
  'Lansdowne':      { country: 'USA', flag: '🇺🇸' },
  'Bellevue':       { country: 'USA', flag: '🇺🇸' },
  'Cambridge':      { country: 'USA', flag: '🇺🇸' },
  'Ann Arbor':      { country: 'USA', flag: '🇺🇸' },
  'Boulder':        { country: 'USA', flag: '🇺🇸' },
  'Irvine':         { country: 'USA', flag: '🇺🇸' },
  'San Antonio':    { country: 'USA', flag: '🇺🇸' },
  'Jacksonville':   { country: 'USA', flag: '🇺🇸' },
  'Fort Worth':     { country: 'USA', flag: '🇺🇸' },
  'Arlington':      { country: 'USA', flag: '🇺🇸' },
  'Peoria':         { country: 'USA', flag: '🇺🇸' },
  'Bethesda':       { country: 'USA', flag: '🇺🇸' },

  // ── Canada ────────────────────────────────────────────────────────────────
  'Toronto':        { country: 'Canada', flag: '🇨🇦' },
  'Vancouver':      { country: 'Canada', flag: '🇨🇦' },
  'Montreal':       { country: 'Canada', flag: '🇨🇦' },
  'Ottawa':         { country: 'Canada', flag: '🇨🇦' },
  'Calgary':        { country: 'Canada', flag: '🇨🇦' },
  'Edmonton':       { country: 'Canada', flag: '🇨🇦' },
  'Waterloo':       { country: 'Canada', flag: '🇨🇦' },

  // ── United Kingdom ────────────────────────────────────────────────────────
  'London':         { country: 'UK', flag: '🇬🇧' },
  'Manchester':     { country: 'UK', flag: '🇬🇧' },
  'Edinburgh':      { country: 'UK', flag: '🇬🇧' },
  'Bristol':        { country: 'UK', flag: '🇬🇧' },
  'Birmingham':     { country: 'UK', flag: '🇬🇧' },
  'Cambridge UK':   { country: 'UK', flag: '🇬🇧' },
  'Oxford':         { country: 'UK', flag: '🇬🇧' },

  // ── Germany ───────────────────────────────────────────────────────────────
  'Berlin':         { country: 'Germany', flag: '🇩🇪' },
  'Munich':         { country: 'Germany', flag: '🇩🇪' },
  'Hamburg':        { country: 'Germany', flag: '🇩🇪' },
  'Frankfurt':      { country: 'Germany', flag: '🇩🇪' },

  // ── France ────────────────────────────────────────────────────────────────
  'Paris':          { country: 'France', flag: '🇫🇷' },
  'Lyon':           { country: 'France', flag: '🇫🇷' },

  // ── Netherlands ───────────────────────────────────────────────────────────
  'Amsterdam':      { country: 'Netherlands', flag: '🇳🇱' },
  'Rotterdam':      { country: 'Netherlands', flag: '🇳🇱' },
  'Eindhoven':      { country: 'Netherlands', flag: '🇳🇱' },

  // ── Belgium ───────────────────────────────────────────────────────────────
  'Brussels':       { country: 'Belgium', flag: '🇧🇪' },

  // ── Sweden ────────────────────────────────────────────────────────────────
  'Stockholm':      { country: 'Sweden', flag: '🇸🇪' },
  'Gothenburg':     { country: 'Sweden', flag: '🇸🇪' },
  'Malmo':          { country: 'Sweden', flag: '🇸🇪' },

  // ── Denmark ───────────────────────────────────────────────────────────────
  'Copenhagen':     { country: 'Denmark', flag: '🇩🇰' },

  // ── Norway ────────────────────────────────────────────────────────────────
  'Oslo':           { country: 'Norway', flag: '🇳🇴' },

  // ── Finland ───────────────────────────────────────────────────────────────
  'Helsinki':       { country: 'Finland', flag: '🇫🇮' },

  // ── Austria ───────────────────────────────────────────────────────────────
  'Vienna':         { country: 'Austria', flag: '🇦🇹' },

  // ── Switzerland ───────────────────────────────────────────────────────────
  'Zurich':         { country: 'Switzerland', flag: '🇨🇭' },
  'Geneva':         { country: 'Switzerland', flag: '🇨🇭' },

  // ── Ireland ───────────────────────────────────────────────────────────────
  'Dublin':         { country: 'Ireland', flag: '🇮🇪' },

  // ── Portugal ──────────────────────────────────────────────────────────────
  'Lisbon':         { country: 'Portugal', flag: '🇵🇹' },

  // ── Spain ─────────────────────────────────────────────────────────────────
  'Madrid':         { country: 'Spain', flag: '🇪🇸' },
  'Barcelona':      { country: 'Spain', flag: '🇪🇸' },

  // ── Italy ─────────────────────────────────────────────────────────────────
  'Rome':           { country: 'Italy', flag: '🇮🇹' },
  'Milan':          { country: 'Italy', flag: '🇮🇹' },

  // ── Poland ────────────────────────────────────────────────────────────────
  'Warsaw':         { country: 'Poland', flag: '🇵🇱' },
  'Krakow':         { country: 'Poland', flag: '🇵🇱' },
  'Wroclaw':        { country: 'Poland', flag: '🇵🇱' },

  // ── Czech Republic ────────────────────────────────────────────────────────
  'Prague':         { country: 'Czech Republic', flag: '🇨🇿' },

  // ── Hungary ───────────────────────────────────────────────────────────────
  'Budapest':       { country: 'Hungary', flag: '🇭🇺' },

  // ── Romania ───────────────────────────────────────────────────────────────
  'Bucharest':      { country: 'Romania', flag: '🇷🇴' },

  // ── Ukraine ───────────────────────────────────────────────────────────────
  'Kyiv':           { country: 'Ukraine', flag: '🇺🇦' },

  // ── Baltics ───────────────────────────────────────────────────────────────
  'Tallinn':        { country: 'Estonia', flag: '🇪🇪' },
  'Riga':           { country: 'Latvia', flag: '🇱🇻' },
  'Vilnius':        { country: 'Lithuania', flag: '🇱🇹' },

  // ── Japan ─────────────────────────────────────────────────────────────────
  'Tokyo':          { country: 'Japan', flag: '🇯🇵' },
  'Osaka':          { country: 'Japan', flag: '🇯🇵' },

  // ── South Korea ───────────────────────────────────────────────────────────
  'Seoul':          { country: 'South Korea', flag: '🇰🇷' },

  // ── China ─────────────────────────────────────────────────────────────────
  'Beijing':        { country: 'China', flag: '🇨🇳' },
  'Shanghai':       { country: 'China', flag: '🇨🇳' },
  'Shenzhen':       { country: 'China', flag: '🇨🇳' },

  // ── Hong Kong ─────────────────────────────────────────────────────────────
  'Hong Kong':      { country: 'Hong Kong', flag: '🇭🇰' },

  // ── Singapore ─────────────────────────────────────────────────────────────
  'Singapore':      { country: 'Singapore', flag: '🇸🇬' },

  // ── India ─────────────────────────────────────────────────────────────────
  'Bangalore':      { country: 'India', flag: '🇮🇳' },
  'Mumbai':         { country: 'India', flag: '🇮🇳' },
  'Delhi':          { country: 'India', flag: '🇮🇳' },
  'New Delhi':      { country: 'India', flag: '🇮🇳' },
  'Hyderabad':      { country: 'India', flag: '🇮🇳' },
  'Pune':           { country: 'India', flag: '🇮🇳' },
  'Chennai':        { country: 'India', flag: '🇮🇳' },

  // ── Other Asia ────────────────────────────────────────────────────────────
  'Taipei':         { country: 'Taiwan', flag: '🇹🇼' },
  'Kuala Lumpur':   { country: 'Malaysia', flag: '🇲🇾' },
  'Bangkok':        { country: 'Thailand', flag: '🇹🇭' },
  'Jakarta':        { country: 'Indonesia', flag: '🇮🇩' },
  'Manila':         { country: 'Philippines', flag: '🇵🇭' },
  'Ho Chi Minh':    { country: 'Vietnam', flag: '🇻🇳' },
  'Hanoi':          { country: 'Vietnam', flag: '🇻🇳' },
  'Karachi':        { country: 'Pakistan', flag: '🇵🇰' },
  'Islamabad':      { country: 'Pakistan', flag: '🇵🇰' },
  'Dhaka':          { country: 'Bangladesh', flag: '🇧🇩' },
  'Tel Aviv':       { country: 'Israel', flag: '🇮🇱' },
  'Dubai':          { country: 'UAE', flag: '🇦🇪' },
  'Abu Dhabi':      { country: 'UAE', flag: '🇦🇪' },
  'Riyadh':         { country: 'Saudi Arabia', flag: '🇸🇦' },
  'Istanbul':       { country: 'Turkey', flag: '🇹🇷' },
  'Ankara':         { country: 'Turkey', flag: '🇹🇷' },
  'Almaty':         { country: 'Kazakhstan', flag: '🇰🇿' },
  'Tashkent':       { country: 'Uzbekistan', flag: '🇺🇿' },

  // ── Australia / NZ ────────────────────────────────────────────────────────
  'Sydney':         { country: 'Australia', flag: '🇦🇺' },
  'Melbourne':      { country: 'Australia', flag: '🇦🇺' },
  'Brisbane':       { country: 'Australia', flag: '🇦🇺' },
  'Perth':          { country: 'Australia', flag: '🇦🇺' },
  'Adelaide':       { country: 'Australia', flag: '🇦🇺' },
  'Auckland':       { country: 'New Zealand', flag: '🇳🇿' },
  'Wellington':     { country: 'New Zealand', flag: '🇳🇿' },

  // ── Latin America ─────────────────────────────────────────────────────────
  'São Paulo':      { country: 'Brazil', flag: '🇧🇷' },
  'Sao Paulo':      { country: 'Brazil', flag: '🇧🇷' },
  'Rio de Janeiro': { country: 'Brazil', flag: '🇧🇷' },
  'Brasília':       { country: 'Brazil', flag: '🇧🇷' },
  'Buenos Aires':   { country: 'Argentina', flag: '🇦🇷' },
  'Santiago':       { country: 'Chile', flag: '🇨🇱' },
  'Bogotá':         { country: 'Colombia', flag: '🇨🇴' },
  'Bogota':         { country: 'Colombia', flag: '🇨🇴' },
  'Medellín':       { country: 'Colombia', flag: '🇨🇴' },
  'Medellin':       { country: 'Colombia', flag: '🇨🇴' },
  'Lima':           { country: 'Peru', flag: '🇵🇪' },
  'Mexico City':    { country: 'Mexico', flag: '🇲🇽' },
  'Monterrey':      { country: 'Mexico', flag: '🇲🇽' },
  'Guadalajara':    { country: 'Mexico', flag: '🇲🇽' },
  'Montevideo':     { country: 'Uruguay', flag: '🇺🇾' },
  'Quito':          { country: 'Ecuador', flag: '🇪🇨' },
  'Caracas':        { country: 'Venezuela', flag: '🇻🇪' },

  // ── Africa ────────────────────────────────────────────────────────────────
  'Nairobi':        { country: 'Kenya', flag: '🇰🇪' },
  'Lagos':          { country: 'Nigeria', flag: '🇳🇬' },
  'Accra':          { country: 'Ghana', flag: '🇬🇭' },
  'Cairo':          { country: 'Egypt', flag: '🇪🇬' },
  'Cape Town':      { country: 'South Africa', flag: '🇿🇦' },
  'Johannesburg':   { country: 'South Africa', flag: '🇿🇦' },
  'Addis Ababa':    { country: 'Ethiopia', flag: '🇪🇹' },
  'Casablanca':     { country: 'Morocco', flag: '🇲🇦' },
  'Tunis':          { country: 'Tunisia', flag: '🇹🇳' },
  'Kigali':         { country: 'Rwanda', flag: '🇷🇼' },
  'Dakar':          { country: 'Senegal', flag: '🇸🇳' },
  'Kampala':        { country: 'Uganda', flag: '🇺🇬' },
  'Dar es Salaam':  { country: 'Tanzania', flag: '🇹🇿' },
  'Abidjan':        { country: 'Ivory Coast', flag: '🇨🇮' },

  // ── Remote / Global ───────────────────────────────────────────────────────
  'Remote':         { country: 'Remote / Global', flag: '🌍' },
  'Worldwide':      { country: 'Remote / Global', flag: '🌍' },
  'Global':         { country: 'Remote / Global', flag: '🌍' },
  'Online':         { country: 'Remote / Global', flag: '🌍' },
  'Anywhere':       { country: 'Remote / Global', flag: '🌍' },
};

const FALLBACK: CountryInfo = { country: 'Other', flag: '🌐' };

export function getCountry(city: string): CountryInfo {
  if (!city) return FALLBACK;
  return CITY_COUNTRY[city] ?? CITY_COUNTRY[city.trim()] ?? FALLBACK;
}

/** Map of country name → flag emoji, derived from CITY_COUNTRY */
export const COUNTRY_FLAG: Record<string, string> = Object.fromEntries(
  Object.values(CITY_COUNTRY).map(({ country, flag }) => [country, flag]),
);
