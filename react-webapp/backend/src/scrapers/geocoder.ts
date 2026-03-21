// City name → [lat, lng] lookup for major US cities
const CITIES: Record<string, [number, number]> = {
  'New York':       [40.7128, -74.0060],
  'New York City':  [40.7128, -74.0060],
  'NYC':            [40.7128, -74.0060],
  'Newark':         [40.7357, -74.1724],
  'San Francisco':  [37.7749, -122.4194],
  'SF':             [37.7749, -122.4194],
  'Seattle':        [47.6062, -122.3321],
  'Chicago':        [41.8781, -87.6298],
  'Austin':         [30.2672, -97.7431],
  'Boston':         [42.3601, -71.0589],
  'Washington':     [38.9072, -77.0369],
  'Washington DC':  [38.9072, -77.0369],
  'DC':             [38.9072, -77.0369],
  'Los Angeles':    [34.0522, -118.2437],
  'LA':             [34.0522, -118.2437],
  'Denver':         [39.7392, -104.9903],
  'Atlanta':        [33.7490, -84.3880],
  'Dallas':         [32.7767, -96.7970],
  'Houston':        [29.7604, -95.3698],
  'Phoenix':        [33.4484, -112.0740],
  'Philadelphia':   [39.9526, -75.1652],
  'San Diego':      [32.7157, -117.1611],
  'Miami':          [25.7617, -80.1918],
  'Minneapolis':    [44.9778, -93.2650],
  'Portland':       [45.5231, -122.6765],
  'Nashville':      [36.1627, -86.7816],
  'Charlotte':      [35.2271, -80.8431],
  'Indianapolis':   [39.7684, -86.1581],
  'Columbus':       [39.9612, -82.9988],
  'San Jose':       [37.3382, -121.8863],
  'Menlo Park':     [37.4530, -122.1817],
  'Redmond':        [47.6740, -122.1215],
  'Sunnyvale':      [37.3688, -122.0363],
  'Mountain View':  [37.3861, -122.0839],
  'Palo Alto':      [37.4419, -122.1430],
  'Cupertino':      [37.3230, -122.0322],
  'Pittsburgh':     [40.4406, -79.9959],
  'Detroit':        [42.3314, -83.0458],
  'Baltimore':      [39.2904, -76.6122],
  'Raleigh':        [35.7796, -78.6382],
  'Salt Lake City': [40.7608, -111.8910],
  'Kansas City':    [39.0997, -94.5786],
  'Tampa':          [27.9506, -82.4572],
  'Orlando':        [28.5383, -81.3792],
  'St. Louis':      [38.6270, -90.1994],
  'Sacramento':     [38.5816, -121.4944],
  'New Orleans':    [29.9511, -90.0715],
  'Richmond':       [37.5407, -77.4360],
  'Louisville':     [38.2527, -85.7585],
  'Oklahoma City':  [35.4676, -97.5164],
  'Tucson':         [32.2226, -110.9747],
  'Fresno':         [36.7378, -119.7871],
  'Virginia Beach': [36.8529, -75.9780],
  'Memphis':        [35.1495, -90.0490],
  'Remote':         [39.5, -98.35],  // center of continental US for remote roles
};

export interface GeoResult {
  lat: number;
  lng: number;
  city: string;
  state: string;
}

/** Parse "City, ST" format and return coordinates */
export function geocode(locationStr: string): GeoResult | null {
  if (!locationStr) return null;

  // Try "City, ST" split
  const parts = locationStr.split(',').map(s => s.trim());
  const cityPart  = parts[0] || '';
  const statePart = parts[1] || '';

  // Direct lookup
  const coords = CITIES[cityPart] ?? CITIES[locationStr.trim()];
  if (coords) {
    return { lat: coords[0], lng: coords[1], city: cityPart, state: statePart };
  }

  // Partial match — try city name without state suffix
  for (const [key, val] of Object.entries(CITIES)) {
    if (cityPart.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(cityPart.toLowerCase())) {
      return { lat: val[0], lng: val[1], city: cityPart || key, state: statePart };
    }
  }

  return null;
}
