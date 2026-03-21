import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { feature, mesh } from 'topojson-client';
import type { Opportunity } from '../types/opportunities';

const W = 975;
const H = 610;
const STATES_URL   = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const COUNTIES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

// FIPS → abbreviation
const STATE_ABBR: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
};

// Cities — tier 1 at ≥ 1, tier 2 at ≥ 2.5, tier 3 at ≥ 4.5, tier 4 at ≥ 7
interface City { name: string; lat: number; lng: number; tier: 1|2|3|4; }
const CITIES: City[] = [
  // ── Tier 1: Major metros ──
  { name:'New York',        lat:40.7128, lng:-74.0060,  tier:1 },
  { name:'Los Angeles',     lat:34.0522, lng:-118.2437, tier:1 },
  { name:'Chicago',         lat:41.8781, lng:-87.6298,  tier:1 },
  { name:'Houston',         lat:29.7604, lng:-95.3698,  tier:1 },
  { name:'Phoenix',         lat:33.4484, lng:-112.0740, tier:1 },
  { name:'Philadelphia',    lat:39.9526, lng:-75.1652,  tier:1 },
  { name:'San Antonio',     lat:29.4241, lng:-98.4936,  tier:1 },
  { name:'San Diego',       lat:32.7157, lng:-117.1611, tier:1 },
  { name:'Dallas',          lat:32.7767, lng:-96.7970,  tier:1 },
  { name:'San Jose',        lat:37.3382, lng:-121.8863, tier:1 },
  { name:'Austin',          lat:30.2672, lng:-97.7431,  tier:1 },
  { name:'Jacksonville',    lat:30.3322, lng:-81.6557,  tier:1 },
  { name:'Columbus',        lat:39.9612, lng:-82.9988,  tier:1 },
  { name:'Charlotte',       lat:35.2271, lng:-80.8431,  tier:1 },
  { name:'Indianapolis',    lat:39.7684, lng:-86.1581,  tier:1 },
  { name:'San Francisco',   lat:37.7749, lng:-122.4194, tier:1 },
  { name:'Seattle',         lat:47.6062, lng:-122.3321, tier:1 },
  { name:'Denver',          lat:39.7392, lng:-104.9903, tier:1 },
  { name:'Nashville',       lat:36.1627, lng:-86.7816,  tier:1 },
  { name:'Boston',          lat:42.3601, lng:-71.0589,  tier:1 },
  { name:'Las Vegas',       lat:36.1699, lng:-115.1398, tier:1 },
  { name:'Portland',        lat:45.5051, lng:-122.6750, tier:1 },
  { name:'Memphis',         lat:35.1495, lng:-90.0490,  tier:1 },
  { name:'Baltimore',       lat:39.2904, lng:-76.6122,  tier:1 },
  { name:'Atlanta',         lat:33.7490, lng:-84.3880,  tier:1 },
  { name:'Miami',           lat:25.7617, lng:-80.1918,  tier:1 },
  { name:'Minneapolis',     lat:44.9778, lng:-93.2650,  tier:1 },
  { name:'New Orleans',     lat:29.9511, lng:-90.0715,  tier:1 },
  { name:'Tampa',           lat:27.9506, lng:-82.4572,  tier:1 },
  { name:'St. Louis',       lat:38.6270, lng:-90.1994,  tier:1 },
  { name:'Pittsburgh',      lat:40.4406, lng:-79.9959,  tier:1 },
  { name:'Orlando',         lat:28.5383, lng:-81.3792,  tier:1 },
  { name:'Cincinnati',      lat:39.1031, lng:-84.5120,  tier:1 },
  { name:'Kansas City',     lat:39.0997, lng:-94.5786,  tier:1 },
  { name:'Cleveland',       lat:41.4993, lng:-81.6944,  tier:1 },
  { name:'Detroit',         lat:42.3314, lng:-83.0458,  tier:1 },
  { name:'Washington DC',   lat:38.9072, lng:-77.0369,  tier:1 },
  { name:'Sacramento',      lat:38.5816, lng:-121.4944, tier:1 },
  { name:'Raleigh',         lat:35.7796, lng:-78.6382,  tier:1 },
  { name:'Omaha',           lat:41.2565, lng:-95.9345,  tier:1 },
  // ── Tier 2: Large cities ──
  { name:'Newark',          lat:40.7357, lng:-74.1724,  tier:2 },
  { name:'Buffalo',         lat:42.8864, lng:-78.8784,  tier:2 },
  { name:'Rochester',       lat:43.1566, lng:-77.6088,  tier:2 },
  { name:'Albany',          lat:42.6526, lng:-73.7562,  tier:2 },
  { name:'Jersey City',     lat:40.7178, lng:-74.0431,  tier:2 },
  { name:'Richmond',        lat:37.5407, lng:-77.4360,  tier:2 },
  { name:'Hartford',        lat:41.7658, lng:-72.6851,  tier:2 },
  { name:'Providence',      lat:41.8240, lng:-71.4128,  tier:2 },
  { name:'Baton Rouge',     lat:30.4515, lng:-91.1871,  tier:2 },
  { name:'Birmingham',      lat:33.5186, lng:-86.8104,  tier:2 },
  { name:'Jackson MS',      lat:32.2988, lng:-90.1848,  tier:2 },
  { name:'Savannah',        lat:32.0809, lng:-81.0912,  tier:2 },
  { name:'Chattanooga',     lat:35.0456, lng:-85.3097,  tier:2 },
  { name:'Knoxville',       lat:35.9606, lng:-83.9207,  tier:2 },
  { name:'Salt Lake City',  lat:40.7608, lng:-111.8910, tier:2 },
  { name:'Boise',           lat:43.6150, lng:-116.2023, tier:2 },
  { name:'Spokane',         lat:47.6587, lng:-117.4260, tier:2 },
  { name:'Tacoma',          lat:47.2529, lng:-122.4443, tier:2 },
  { name:'Madison',         lat:43.0731, lng:-89.4012,  tier:2 },
  { name:'Milwaukee',       lat:43.0389, lng:-87.9065,  tier:2 },
  { name:'Grand Rapids',    lat:42.9634, lng:-85.6681,  tier:2 },
  { name:'Albuquerque',     lat:35.0853, lng:-106.6056, tier:2 },
  { name:'Tucson',          lat:32.2226, lng:-110.9747, tier:2 },
  { name:'Fresno',          lat:36.7378, lng:-119.7871, tier:2 },
  { name:'Colorado Springs',lat:38.8339, lng:-104.8214, tier:2 },
  { name:'Wichita',         lat:37.6872, lng:-97.3301,  tier:2 },
  { name:'Des Moines',      lat:41.5868, lng:-93.6250,  tier:2 },
  { name:'Little Rock',     lat:34.7465, lng:-92.2896,  tier:2 },
  { name:'Greensboro',      lat:36.0726, lng:-79.7920,  tier:2 },
  { name:'Durham',          lat:35.9940, lng:-78.8986,  tier:2 },
  { name:'Akron',           lat:41.0814, lng:-81.5190,  tier:2 },
  { name:'Toledo',          lat:41.6528, lng:-83.5379,  tier:2 },
  { name:'Lexington',       lat:38.0406, lng:-84.5037,  tier:2 },
  { name:'Louisville',      lat:38.2527, lng:-85.7585,  tier:2 },
  { name:'Oklahoma City',   lat:35.4676, lng:-97.5164,  tier:2 },
  { name:'El Paso',         lat:31.7619, lng:-106.4850, tier:2 },
  { name:'Honolulu',        lat:21.3069, lng:-157.8583, tier:2 },
  { name:'Anchorage',       lat:61.2181, lng:-149.9003, tier:2 },
  // ── Tier 3: Medium cities ──
  { name:'Yonkers',         lat:40.9312, lng:-73.8988,  tier:3 },
  { name:'Syracuse',        lat:43.0481, lng:-76.1474,  tier:3 },
  { name:'Paterson',        lat:40.9168, lng:-74.1719,  tier:3 },
  { name:'Elizabeth',       lat:40.6640, lng:-74.2107,  tier:3 },
  { name:'Trenton',         lat:40.2171, lng:-74.7429,  tier:3 },
  { name:'Camden',          lat:39.9259, lng:-75.1196,  tier:3 },
  { name:'Bridgeport',      lat:41.1670, lng:-73.2048,  tier:3 },
  { name:'New Haven',       lat:41.3082, lng:-72.9279,  tier:3 },
  { name:'Springfield MA',  lat:42.1015, lng:-72.5898,  tier:3 },
  { name:'Worcester',       lat:42.2626, lng:-71.8023,  tier:3 },
  { name:'Lowell',          lat:42.6334, lng:-71.3162,  tier:3 },
  { name:'Cambridge',       lat:42.3736, lng:-71.1097,  tier:3 },
  { name:'Fort Wayne',      lat:41.1306, lng:-85.1289,  tier:3 },
  { name:'Evansville',      lat:37.9716, lng:-87.5711,  tier:3 },
  { name:'South Bend',      lat:41.6764, lng:-86.2520,  tier:3 },
  { name:'Peoria',          lat:40.6936, lng:-89.5890,  tier:3 },
  { name:'Rockford',        lat:42.2711, lng:-89.0940,  tier:3 },
  { name:'Aurora IL',       lat:41.7606, lng:-88.3201,  tier:3 },
  { name:'Dayton',          lat:39.7589, lng:-84.1916,  tier:3 },
  { name:'Youngstown',      lat:41.0998, lng:-80.6495,  tier:3 },
  { name:'Flint',           lat:43.0125, lng:-83.6875,  tier:3 },
  { name:'Ann Arbor',       lat:42.2808, lng:-83.7430,  tier:3 },
  { name:'Fargo',           lat:46.8772, lng:-96.7898,  tier:3 },
  { name:'Sioux Falls',     lat:43.5446, lng:-96.7311,  tier:3 },
  { name:'Lincoln',         lat:40.8136, lng:-96.7026,  tier:3 },
  { name:'Lubbock',         lat:33.5779, lng:-101.8552, tier:3 },
  { name:'Corpus Christi',  lat:27.8006, lng:-97.3964,  tier:3 },
  { name:'Laredo',          lat:27.5306, lng:-99.4803,  tier:3 },
  { name:'Plano',           lat:33.0198, lng:-96.6989,  tier:3 },
  { name:'Irving',          lat:32.8140, lng:-96.9489,  tier:3 },
  { name:'Garland',         lat:32.9126, lng:-96.6389,  tier:3 },
  { name:'Chandler',        lat:33.3062, lng:-111.8413, tier:3 },
  { name:'Henderson NV',    lat:36.0395, lng:-114.9817, tier:3 },
  { name:'Aurora CO',       lat:39.7294, lng:-104.8319, tier:3 },
  { name:'Stockton',        lat:37.9577, lng:-121.2908, tier:3 },
  { name:'Bakersfield',     lat:35.3733, lng:-119.0187, tier:3 },
  { name:'Riverside',       lat:33.9533, lng:-117.3961, tier:3 },
  { name:'Anaheim',         lat:33.8366, lng:-117.9143, tier:3 },
  { name:'Long Beach',      lat:33.7701, lng:-118.1937, tier:3 },
  { name:'Oakland',         lat:37.8044, lng:-122.2712, tier:3 },
  { name:'Santa Ana',       lat:33.7455, lng:-117.8677, tier:3 },
  // ── Tier 4: Small cities — show at zoom ≥ 7 ──
  { name:'Menlo Park',      lat:37.4530, lng:-122.1817, tier:4 },
  { name:'Palo Alto',       lat:37.4419, lng:-122.1430, tier:4 },
  { name:'Mountain View',   lat:37.3861, lng:-122.0839, tier:4 },
  { name:'Sunnyvale',       lat:37.3688, lng:-122.0363, tier:4 },
  { name:'Santa Clara',     lat:37.3541, lng:-121.9552, tier:4 },
  { name:'Cupertino',       lat:37.3230, lng:-122.0322, tier:4 },
  { name:'Redwood City',    lat:37.4852, lng:-122.2364, tier:4 },
  { name:'Burbank',         lat:34.1808, lng:-118.3090, tier:4 },
  { name:'Glendale CA',     lat:34.1425, lng:-118.2551, tier:4 },
  { name:'Pasadena CA',     lat:34.1478, lng:-118.1445, tier:4 },
  { name:'Torrance',        lat:33.8358, lng:-118.3406, tier:4 },
  { name:'Inglewood',       lat:33.9617, lng:-118.3531, tier:4 },
  { name:'Compton',         lat:33.8958, lng:-118.2201, tier:4 },
  { name:'Pomona',          lat:34.0553, lng:-117.7500, tier:4 },
  { name:'Escondido',       lat:33.1192, lng:-117.0864, tier:4 },
  { name:'Chula Vista',     lat:32.6401, lng:-117.0842, tier:4 },
  { name:'National City',   lat:32.6778, lng:-117.0992, tier:4 },
  { name:'Daly City',       lat:37.6879, lng:-122.4702, tier:4 },
  { name:'Berkeley',        lat:37.8716, lng:-122.2727, tier:4 },
  { name:'Fremont',         lat:37.5483, lng:-121.9886, tier:4 },
  { name:'Hayward',         lat:37.6688, lng:-122.0808, tier:4 },
  { name:'San Leandro',     lat:37.7249, lng:-122.1561, tier:4 },
  { name:'Concord CA',      lat:37.9780, lng:-122.0311, tier:4 },
  { name:'Vallejo',         lat:38.1041, lng:-122.2566, tier:4 },
  { name:'Santa Rosa',      lat:38.4405, lng:-122.7144, tier:4 },
  { name:'Salinas',         lat:36.6777, lng:-121.6555, tier:4 },
  { name:'Modesto',         lat:37.6391, lng:-120.9969, tier:4 },
  { name:'Visalia',         lat:36.3302, lng:-119.2921, tier:4 },
  { name:'Eugene',          lat:44.0521, lng:-123.0868, tier:4 },
  { name:'Salem OR',        lat:44.9429, lng:-123.0351, tier:4 },
  { name:'Bellevue WA',     lat:47.6101, lng:-122.2015, tier:4 },
  { name:'Everett WA',      lat:47.9790, lng:-122.2021, tier:4 },
  { name:'Kent WA',         lat:47.3809, lng:-122.2348, tier:4 },
  { name:'Renton WA',       lat:47.4829, lng:-122.2171, tier:4 },
  { name:'Tempe',           lat:33.4255, lng:-111.9400, tier:4 },
  { name:'Mesa',            lat:33.4152, lng:-111.8315, tier:4 },
  { name:'Scottsdale',      lat:33.4942, lng:-111.9261, tier:4 },
  { name:'Gilbert AZ',      lat:33.3528, lng:-111.7890, tier:4 },
  { name:'Peoria AZ',       lat:33.5806, lng:-112.2374, tier:4 },
  { name:'Glendale AZ',     lat:33.5387, lng:-112.1860, tier:4 },
  { name:'Pueblo',          lat:38.2544, lng:-104.6091, tier:4 },
  { name:'Fort Collins',    lat:40.5853, lng:-105.0844, tier:4 },
  { name:'Thornton CO',     lat:39.8678, lng:-104.9719, tier:4 },
  { name:'Lakewood CO',     lat:39.7047, lng:-105.0814, tier:4 },
  { name:'Westminster CO',  lat:39.8367, lng:-105.0372, tier:4 },
  { name:'Provo',           lat:40.2338, lng:-111.6585, tier:4 },
  { name:'West Valley City',lat:40.6916, lng:-112.0010, tier:4 },
  { name:'Las Cruces',      lat:32.3199, lng:-106.7637, tier:4 },
  { name:'Overland Park',   lat:38.9822, lng:-94.6708,  tier:4 },
  { name:'Topeka',          lat:39.0558, lng:-95.6890,  tier:4 },
  { name:'Lawrence KS',     lat:38.9717, lng:-95.2353,  tier:4 },
  { name:'Columbia MO',     lat:38.9517, lng:-92.3341,  tier:4 },
  { name:'Springfield MO',  lat:37.2153, lng:-93.2982,  tier:4 },
  { name:'Independence MO', lat:39.0911, lng:-94.4155,  tier:4 },
  { name:'Joliet',          lat:41.5250, lng:-88.0817,  tier:4 },
  { name:'Naperville',      lat:41.7508, lng:-88.1535,  tier:4 },
  { name:'Elgin IL',        lat:42.0354, lng:-88.2826,  tier:4 },
  { name:'Waukegan',        lat:42.3636, lng:-87.8448,  tier:4 },
  { name:'Cicero IL',       lat:41.8456, lng:-87.7539,  tier:4 },
  { name:'Fort Wayne',      lat:41.1306, lng:-85.1289,  tier:4 },
  { name:'Evansville',      lat:37.9716, lng:-87.5711,  tier:4 },
  { name:'South Bend',      lat:41.6764, lng:-86.2520,  tier:4 },
  { name:'Peoria IL',       lat:40.6936, lng:-89.5890,  tier:4 },
  { name:'Rockford',        lat:42.2711, lng:-89.0940,  tier:4 },
  { name:'Madison WI',      lat:43.0731, lng:-89.4012,  tier:4 },
  { name:'Green Bay',       lat:44.5133, lng:-88.0133,  tier:4 },
  { name:'Kenosha',         lat:42.5847, lng:-87.8212,  tier:4 },
  { name:'Appleton',        lat:44.2619, lng:-88.4154,  tier:4 },
  { name:'Racine',          lat:42.7261, lng:-87.7829,  tier:4 },
  { name:'Flint',           lat:43.0125, lng:-83.6875,  tier:4 },
  { name:'Ann Arbor',       lat:42.2808, lng:-83.7430,  tier:4 },
  { name:'Sterling Heights',lat:42.5803, lng:-83.0302,  tier:4 },
  { name:'Warren MI',       lat:42.4775, lng:-83.0277,  tier:4 },
  { name:'Dearborn',        lat:42.3223, lng:-83.1763,  tier:4 },
  { name:'Livonia',         lat:42.3684, lng:-83.3527,  tier:4 },
  { name:'Westland',        lat:42.3242, lng:-83.4002,  tier:4 },
  { name:'Canton MI',       lat:42.3089, lng:-83.4822,  tier:4 },
  { name:'Troy MI',         lat:42.6064, lng:-83.1498,  tier:4 },
  { name:'Dayton',          lat:39.7589, lng:-84.1916,  tier:4 },
  { name:'Youngstown',      lat:41.0998, lng:-80.6495,  tier:4 },
  { name:'Parma OH',        lat:41.3845, lng:-81.7229,  tier:4 },
  { name:'Lorain',          lat:41.4528, lng:-82.1824,  tier:4 },
  { name:'Hamilton OH',     lat:39.3995, lng:-84.5613,  tier:4 },
  { name:'Allentown',       lat:40.6023, lng:-75.4714,  tier:4 },
  { name:'Erie PA',         lat:42.1292, lng:-80.0851,  tier:4 },
  { name:'Reading PA',      lat:40.3356, lng:-75.9269,  tier:4 },
  { name:'Scranton',        lat:41.4090, lng:-75.6624,  tier:4 },
  { name:'Bethlehem PA',    lat:40.6259, lng:-75.3705,  tier:4 },
  { name:'Lancaster PA',    lat:40.0379, lng:-76.3055,  tier:4 },
  { name:'Harrisburg',      lat:40.2732, lng:-76.8867,  tier:4 },
  { name:'York PA',         lat:39.9626, lng:-76.7277,  tier:4 },
  { name:'New Haven',       lat:41.3082, lng:-72.9279,  tier:4 },
  { name:'Bridgeport',      lat:41.1670, lng:-73.2048,  tier:4 },
  { name:'Stamford',        lat:41.0534, lng:-73.5387,  tier:4 },
  { name:'Waterbury',       lat:41.5582, lng:-73.0515,  tier:4 },
  { name:'Norwalk CT',      lat:41.1177, lng:-73.4082,  tier:4 },
  { name:'Worcester',       lat:42.2626, lng:-71.8023,  tier:4 },
  { name:'Springfield MA',  lat:42.1015, lng:-72.5898,  tier:4 },
  { name:'Cambridge MA',    lat:42.3736, lng:-71.1097,  tier:4 },
  { name:'Lowell',          lat:42.6334, lng:-71.3162,  tier:4 },
  { name:'Brockton',        lat:42.0834, lng:-71.0184,  tier:4 },
  { name:'Quincy MA',       lat:42.2529, lng:-71.0023,  tier:4 },
  { name:'Lynn',            lat:42.4668, lng:-70.9495,  tier:4 },
  { name:'New Bedford',     lat:41.6362, lng:-70.9342,  tier:4 },
  { name:'Fall River',      lat:41.7015, lng:-71.1550,  tier:4 },
  { name:'Pawtucket',       lat:41.8787, lng:-71.3826,  tier:4 },
  { name:'Cranston',        lat:41.7798, lng:-71.4373,  tier:4 },
  { name:'Trenton',         lat:40.2171, lng:-74.7429,  tier:4 },
  { name:'Camden NJ',       lat:39.9259, lng:-75.1196,  tier:4 },
  { name:'Paterson',        lat:40.9168, lng:-74.1719,  tier:4 },
  { name:'Elizabeth NJ',    lat:40.6640, lng:-74.2107,  tier:4 },
  { name:'Clifton',         lat:40.8584, lng:-74.1638,  tier:4 },
  { name:'Cherry Hill',     lat:39.9246, lng:-74.9960,  tier:4 },
  { name:'Wilmington DE',   lat:39.7459, lng:-75.5466,  tier:4 },
  { name:'Frederick MD',    lat:39.4143, lng:-77.4105,  tier:4 },
  { name:'Rockville MD',    lat:39.0840, lng:-77.1528,  tier:4 },
  { name:'Gaithersburg',    lat:39.1434, lng:-77.2014,  tier:4 },
  { name:'Alexandria VA',   lat:38.8048, lng:-77.0469,  tier:4 },
  { name:'Arlington VA',    lat:38.8816, lng:-77.0910,  tier:4 },
  { name:'Norfolk',         lat:36.8508, lng:-76.2859,  tier:4 },
  { name:'Virginia Beach',  lat:36.8529, lng:-75.9780,  tier:4 },
  { name:'Chesapeake VA',   lat:36.7682, lng:-76.2875,  tier:4 },
  { name:'Newport News',    lat:37.0871, lng:-76.4730,  tier:4 },
  { name:'Hampton VA',      lat:37.0299, lng:-76.3452,  tier:4 },
  { name:'Portsmouth VA',   lat:36.8354, lng:-76.2983,  tier:4 },
  { name:'Fayetteville NC', lat:35.0527, lng:-78.8784,  tier:4 },
  { name:'Cary NC',         lat:35.7915, lng:-78.7811,  tier:4 },
  { name:'Wilmington NC',   lat:34.2257, lng:-77.9447,  tier:4 },
  { name:'High Point',      lat:35.9557, lng:-80.0053,  tier:4 },
  { name:'Columbia SC',     lat:34.0007, lng:-81.0348,  tier:4 },
  { name:'North Charleston',lat:32.8546, lng:-79.9748,  tier:4 },
  { name:'Charleston SC',   lat:32.7765, lng:-79.9311,  tier:4 },
  { name:'Myrtle Beach',    lat:33.6891, lng:-78.8867,  tier:4 },
  { name:'Montgomery AL',   lat:32.3792, lng:-86.3077,  tier:4 },
  { name:'Huntsville AL',   lat:34.7304, lng:-86.5861,  tier:4 },
  { name:'Mobile AL',       lat:30.6954, lng:-88.0399,  tier:4 },
  { name:'Tuscaloosa',      lat:33.2098, lng:-87.5692,  tier:4 },
  { name:'Shreveport',      lat:32.5252, lng:-93.7502,  tier:4 },
  { name:'Lafayette LA',    lat:30.2241, lng:-92.0198,  tier:4 },
  { name:'Lake Charles',    lat:30.2266, lng:-93.2174,  tier:4 },
  { name:'Metairie',        lat:29.9946, lng:-90.1629,  tier:4 },
  { name:'Amarillo',        lat:35.2220, lng:-101.8313, tier:4 },
  { name:'Abilene TX',      lat:32.4487, lng:-99.7331,  tier:4 },
  { name:'Beaumont',        lat:30.0860, lng:-94.1018,  tier:4 },
  { name:'Waco',            lat:31.5493, lng:-97.1467,  tier:4 },
  { name:'Killeen',         lat:31.1171, lng:-97.7278,  tier:4 },
  { name:'McKinney TX',     lat:33.1972, lng:-96.6397,  tier:4 },
  { name:'Frisco TX',       lat:33.1507, lng:-96.8236,  tier:4 },
  { name:'Denton TX',       lat:33.2148, lng:-97.1331,  tier:4 },
  { name:'Fort Worth',      lat:32.7555, lng:-97.3308,  tier:4 },
  { name:'Grand Prairie',   lat:32.7460, lng:-96.9978,  tier:4 },
  { name:'Midland TX',      lat:31.9973, lng:-102.0779, tier:4 },
  { name:'Odessa TX',       lat:31.8457, lng:-102.3676, tier:4 },
  { name:'Pasadena TX',     lat:29.6911, lng:-95.2091,  tier:4 },
  { name:'Brownsville',     lat:25.9017, lng:-97.4975,  tier:4 },
  { name:'McAllen',         lat:26.2034, lng:-98.2300,  tier:4 },
];

// Neighborhoods — show at zoom ≥ 12
interface Hood { name: string; lat: number; lng: number; }
const HOODS: Hood[] = [
  // NYC boroughs / neighborhoods
  { name:'Manhattan',      lat:40.7831, lng:-73.9712 },
  { name:'Brooklyn',       lat:40.6782, lng:-73.9442 },
  { name:'Queens',         lat:40.7282, lng:-73.7949 },
  { name:'The Bronx',      lat:40.8448, lng:-73.8648 },
  { name:'Staten Island',  lat:40.5795, lng:-74.1502 },
  { name:'Harlem',         lat:40.8116, lng:-73.9465 },
  { name:'Midtown',        lat:40.7549, lng:-73.9840 },
  { name:'Lower East Side',lat:40.7150, lng:-73.9847 },
  { name:'Upper West Side',lat:40.7870, lng:-73.9754 },
  { name:'Upper East Side',lat:40.7736, lng:-73.9566 },
  { name:'Williamsburg',   lat:40.7081, lng:-73.9571 },
  { name:'Astoria',        lat:40.7721, lng:-73.9302 },
  { name:'Flushing',       lat:40.7675, lng:-73.8330 },
  { name:'Jamaica',        lat:40.6929, lng:-73.8057 },
  // LA neighborhoods
  { name:'Hollywood',      lat:34.0928, lng:-118.3287 },
  { name:'Beverly Hills',  lat:34.0736, lng:-118.4004 },
  { name:'Santa Monica',   lat:34.0195, lng:-118.4912 },
  { name:'Downtown LA',    lat:34.0407, lng:-118.2468 },
  { name:'Koreatown',      lat:34.0586, lng:-118.3006 },
  { name:'Compton',        lat:33.8958, lng:-118.2201 },
  { name:'Inglewood',      lat:33.9617, lng:-118.3531 },
  { name:'Burbank',        lat:34.1808, lng:-118.3090 },
  { name:'Pasadena',       lat:34.1478, lng:-118.1445 },
  { name:'Venice Beach',   lat:33.9850, lng:-118.4695 },
  // Chicago neighborhoods
  { name:'The Loop',       lat:41.8827, lng:-87.6278 },
  { name:'Lincoln Park',   lat:41.9214, lng:-87.6513 },
  { name:'Wicker Park',    lat:41.9088, lng:-87.6808 },
  { name:'Wrigleyville',   lat:41.9484, lng:-87.6553 },
  { name:'Hyde Park',      lat:41.7943, lng:-87.5907 },
  { name:'Pilsen',         lat:41.8559, lng:-87.6614 },
  { name:'Bucktown',       lat:41.9192, lng:-87.6775 },
  { name:'Andersonville',  lat:41.9802, lng:-87.6683 },
  // SF neighborhoods
  { name:'Mission',        lat:37.7599, lng:-122.4148 },
  { name:'SoMa',           lat:37.7785, lng:-122.3948 },
  { name:'Financial District',lat:37.7946,lng:-122.3999 },
  { name:'Castro',         lat:37.7609, lng:-122.4350 },
  { name:'Haight-Ashbury', lat:37.7693, lng:-122.4481 },
  { name:'Chinatown SF',   lat:37.7941, lng:-122.4078 },
  { name:'North Beach',    lat:37.8060, lng:-122.4103 },
  { name:'Fisherman\'s Wharf',lat:37.8080,lng:-122.4177},
  // Boston neighborhoods
  { name:'Back Bay',       lat:42.3503, lng:-71.0810 },
  { name:'South End',      lat:42.3399, lng:-71.0728 },
  { name:'Beacon Hill',    lat:42.3588, lng:-71.0707 },
  { name:'Fenway',         lat:42.3467, lng:-71.0972 },
  { name:'Allston',        lat:42.3540, lng:-71.1309 },
  { name:'Dorchester',     lat:42.3022, lng:-71.0600 },
  { name:'South Boston',   lat:42.3388, lng:-71.0430 },
  { name:'Cambridge MA',   lat:42.3736, lng:-71.1097 },
  // DC area
  { name:'Capitol Hill',   lat:38.8897, lng:-76.9874 },
  { name:'Georgetown',     lat:38.9076, lng:-77.0723 },
  { name:'Adams Morgan',   lat:38.9215, lng:-77.0418 },
  { name:'Dupont Circle',  lat:38.9096, lng:-77.0434 },
  { name:'U Street',       lat:38.9171, lng:-77.0287 },
  { name:'Pentagon City',  lat:38.8628, lng:-77.0600 },
  // Miami
  { name:'South Beach',    lat:25.7830, lng:-80.1310 },
  { name:'Wynwood',        lat:25.8010, lng:-80.1990 },
  { name:'Little Havana',  lat:25.7720, lng:-80.2280 },
  { name:'Brickell',       lat:25.7617, lng:-80.1918 },
  { name:'Coral Gables',   lat:25.7215, lng:-80.2684 },
  { name:'Coconut Grove',  lat:25.7269, lng:-80.2386 },
  // Seattle
  { name:'Capitol Hill',   lat:47.6253, lng:-122.3222 },
  { name:'Fremont',        lat:47.6516, lng:-122.3498 },
  { name:'Ballard',        lat:47.6688, lng:-122.3831 },
  { name:'Belltown',       lat:47.6148, lng:-122.3473 },
  { name:'Pioneer Square', lat:47.6009, lng:-122.3341 },
  // Houston
  { name:'Midtown Houston',lat:29.7374, lng:-95.3843 },
  { name:'Montrose',       lat:29.7452, lng:-95.3969 },
  { name:'The Heights',    lat:29.7971, lng:-95.3993 },
  { name:'Galleria',       lat:29.7400, lng:-95.4650 },
  { name:'Third Ward',     lat:29.7219, lng:-95.3600 },
  // Atlanta
  { name:'Midtown ATL',    lat:33.7816, lng:-84.3839 },
  { name:'Buckhead',       lat:33.8383, lng:-84.3776 },
  { name:'Old Fourth Ward',lat:33.7590, lng:-84.3570 },
  { name:'Decatur',        lat:33.7748, lng:-84.2963 },
  { name:'Little Five Pts',lat:33.7652, lng:-84.3470 },
];

const PIN_COLOR: Record<string, string> = {
  scholarship: '#22c55e',
  internship:  '#3b82f6',
  networking:  '#a78bfa',
};
const PIN_LABEL: Record<string, string> = {
  scholarship: '$',
  internship:  'W',
  networking:  'N',
};


interface Props {
  opportunities: Opportunity[];
  activeId: string | null;
  onPinClick: (opp: Opportunity, screenX: number, screenY: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas-based map — entire geography drawn to a <canvas> on every zoom frame.
// SVG overlay handles only the ~60 interactive pins.
// Zero React re-renders during smooth zoom/pan.
// ─────────────────────────────────────────────────────────────────────────────
export default function USMapSVG({ opportunities, activeId, onPinClick }: Props) {
  const svgRef      = useRef<SVGSVGElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const pinLayerRef = useRef<SVGGElement>(null);
  const zoomRef     = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const tRef        = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const badgeRef    = useRef<HTMLDivElement>(null);
  const pinPosRef   = useRef<Map<string, [number, number]>>(new Map());

  // All geo data in refs — never trigger re-renders
  const projRef        = useRef<d3.GeoProjection | null>(null);
  const stateFeatRef   = useRef<any[]>([]);
  const stateBorderRef = useRef<any>(null);
  const outerBorderRef = useRef<any>(null);
  const countyMeshRef  = useRef<any>(null);
  const stateLabRef    = useRef<{ abbr: string; x: number; y: number }[]>([]);

  // Only one piece of React state — signals that geo data finished loading
  const [ready, setReady] = useState(false);

  // ── Canvas draw — called directly from D3 zoom, no React ──────
  const draw = useCallback((t: d3.ZoomTransform) => {
    const canvas = canvasRef.current;
    const proj   = projRef.current;
    if (!canvas || !proj) return;

    const dpr  = window.devicePixelRatio || 1;
    const ctx  = canvas.getContext('2d')!;
    const k    = t.k;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#06091a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(t.x, t.y);
    ctx.scale(k, k);

    const path = d3.geoPath(proj, ctx);

    // State fills
    stateFeatRef.current.forEach((f, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#0b1a35' : '#0e2040';
      ctx.beginPath(); path(f); ctx.fill();
    });

    // County lines
    if (k >= 1.1 && countyMeshRef.current) {
      const a = Math.min(1, (k - 1.1) * 0.9);
      ctx.beginPath(); path(countyMeshRef.current);
      ctx.strokeStyle = '#3a7aba'; ctx.lineWidth = 0.7 / k;
      ctx.globalAlpha = a * 0.85; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // State borders — 3-pass neon glow
    if (stateBorderRef.current) {
      ctx.lineJoin = 'round';
      for (const [w, a] of [[8, 0.06], [4, 0.18], [1, 0.92]] as [number, number][]) {
        ctx.beginPath(); path(stateBorderRef.current);
        ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = w / k; ctx.globalAlpha = a; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Outer border — 3-pass neon glow
    if (outerBorderRef.current) {
      ctx.lineJoin = 'round';
      for (const [w, a] of [[10, 0.08], [5, 0.2], [2, 1.0]] as [number, number][]) {
        ctx.beginPath(); path(outerBorderRef.current);
        ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = w / k; ctx.globalAlpha = a; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // State labels (fade out at high zoom)
    if (k < 10 && stateLabRef.current.length) {
      const alpha = Math.max(0, 1 - (k - 4) / 6);
      if (alpha > 0.01) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#4a7fa5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `600 ${10 / k}px system-ui,sans-serif`;
        stateLabRef.current.forEach(({ abbr, x, y }) => ctx.fillText(abbr, x, y));
        ctx.globalAlpha = 1;
      }
    }

    // City dots + labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const city of CITIES) {
      const show = city.tier === 1 || (city.tier === 2 && k >= 2.2) ||
                   (city.tier === 3 && k >= 3.8) || (city.tier === 4 && k >= 6.0);
      if (!show) continue;
      const pt = proj([city.lng, city.lat]); if (!pt) continue;
      const [cx, cy] = pt;
      const r = city.tier === 1 ? 1.2 : city.tier === 2 ? 0.9 : 0.6;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = city.tier === 1 ? '#7dd3fc' : city.tier === 2 ? '#93c5fd' : '#bfdbfe';
      ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      const showLbl = (city.tier === 1 && k >= 1.5) || (city.tier === 2 && k >= 3) ||
                      (city.tier === 3 && k >= 5)   || (city.tier === 4 && k >= 8);
      if (showLbl) {
        const fs = (city.tier === 1 ? 7 : city.tier === 2 ? 6 : 5) / k;
        ctx.font = `${city.tier === 1 ? '700' : '500'} ${fs}px system-ui,sans-serif`;
        ctx.fillStyle = city.tier === 1 ? '#e2e8f0' : '#94a3b8';
        ctx.fillText(city.name, cx, cy - r - 1.5 / k);
      }
    }

    // Neighborhood labels
    if (k >= 14) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      for (const hood of HOODS) {
        const pt = proj([hood.lng, hood.lat]); if (!pt) continue;
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 0.5 / k, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8'; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
        ctx.font = `500 ${3.5 / k}px system-ui,sans-serif`;
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(hood.name, pt[0], pt[1] - 0.8 / k);
      }
    }

    ctx.restore();
  }, []);

  // ── Load geo data (runs once) ─────────────────────────────────
  useEffect(() => {
    const proj    = d3.geoAlbersUsa().scale(1300).translate([W / 2, H / 2]);
    const pathGen = d3.geoPath(proj);

    Promise.all([
      fetch(STATES_URL).then(r => r.json()),
      fetch(COUNTIES_URL).then(r => r.json()),
    ]).then(([st, co]) => {
      const states = feature(st, st.objects.states) as any;
      stateFeatRef.current   = states.features;
      stateBorderRef.current = mesh(st, st.objects.states, (a: any, b: any) => a !== b);
      outerBorderRef.current = mesh(st, st.objects.states, (a: any, b: any) => a === b);
      countyMeshRef.current  = mesh(co, co.objects.counties, (a: any, b: any) =>
        a !== b && ((a.id / 1000 | 0) === (b.id / 1000 | 0))
      );
      stateLabRef.current = states.features.map((f: any) => {
        const [x, y] = pathGen.centroid(f);
        return { abbr: STATE_ABBR[String(f.id).padStart(2, '0')] || '', x, y };
      }).filter((l: any) => l.abbr && !isNaN(l.x) && !isNaN(l.y));
      projRef.current = proj;
      setReady(true);
    }).catch(console.error);
  }, []);

  // ── Size canvas + attach zoom (after geo load) ────────────────
  useEffect(() => {
    if (!ready || !svgRef.current || !canvasRef.current) return;

    const dpr    = window.devicePixelRatio || 1;
    const canvas = canvasRef.current;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;

    // Initial draw
    draw(d3.zoomIdentity);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 500])
      .translateExtent([[0, 0], [W, H]])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const t = event.transform;
        tRef.current = t;

        // Draw map on canvas — fast, no React
        draw(t);

        // Reposition pins via direct DOM
        pinPosRef.current.forEach(([px, py], id) => {
          const el = document.getElementById(`pin-${id}`);
          if (el) el.setAttribute('transform',
            `translate(${t.x + px * t.k}, ${t.y + py * t.k})`);
        });

        // Update badge via direct DOM
        if (badgeRef.current) {
          badgeRef.current.textContent  = t.k > 1.1 ? `${t.k.toFixed(1)}×` : '';
          badgeRef.current.style.opacity = t.k > 1.1 ? '1' : '0';
        }
      });

    const svgEl = svgRef.current;
    d3.select(svgEl).call(zoom);
    zoomRef.current = zoom;

    const noScroll = (e: WheelEvent) => e.preventDefault();
    svgEl.addEventListener('wheel', noScroll, { passive: false });
    return () => {
      d3.select(svgEl).on('.zoom', null);
      svgEl.removeEventListener('wheel', noScroll);
    };
  }, [ready, draw]);

  // ── Precompute pin positions when proj or opportunities change ─
  useEffect(() => {
    const proj = projRef.current;
    if (!proj) return;
    const m = new Map<string, [number, number]>();
    opportunities.forEach(o => {
      const pt = proj([o.lng, o.lat]);
      if (pt) m.set(o.id, [pt[0], pt[1]]);
    });
    pinPosRef.current = m;
    // Re-apply current transform to new pins
    const t = tRef.current;
    m.forEach(([px, py], id) => {
      const el = document.getElementById(`pin-${id}`);
      if (el) el.setAttribute('transform',
        `translate(${t.x + px * t.k}, ${t.y + py * t.k})`);
    });
  }, [ready, opportunities]);

  // ── Re-apply pin positions after React re-renders (activeId) ──
  useEffect(() => {
    const t = tRef.current;
    pinPosRef.current.forEach(([px, py], id) => {
      const el = document.getElementById(`pin-${id}`);
      if (el) el.setAttribute('transform',
        `translate(${t.x + px * t.k}, ${t.y + py * t.k})`);
    });
  }, [activeId]);

  const zoomBy = useCallback((f: number) => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, f);
  }, []);
  const zoomReset = useCallback(() => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().duration(350)
        .call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* Map canvas — fills container, drawn every zoom frame */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%', display: 'block',
      }} />

      {/* Loading overlay */}
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#334155', fontSize: 14, background: '#06091a',
        }}>Loading map…</div>
      )}

      {/* SVG overlay — ONLY pins, minimal element count */}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%', overflow: 'visible',
          pointerEvents: 'none',
        }}>
        {/* Transparent catch-all rect so wheel/drag events bubble to D3 zoom */}
        <rect width={W} height={H} fill="transparent" style={{ pointerEvents: 'all', cursor: 'grab' }} />
        <g ref={pinLayerRef}>
          {ready && opportunities.map(opp => {
            const pos = pinPosRef.current.get(opp.id);
            if (!pos) return null;
            const [px, py] = pos;
            const active   = opp.id === activeId;
            const color    = PIN_COLOR[opp.type];
            const r        = active ? 7.5 : 6;
            return (
              <g key={opp.id} id={`pin-${opp.id}`}
                transform={`translate(${px}, ${py})`}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                onClick={e => { e.stopPropagation(); onPinClick(opp, e.clientX, e.clientY); }}
              >
                {active && <circle cx={0} cy={-r - 4} r={r + 5} fill={color} opacity={0.18} />}
                <line x1={0} y1={0} x2={0} y2={-4} stroke={color} strokeWidth={2} strokeLinecap="round" />
                <circle cx={0} cy={-r - 4} r={r} fill={color} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
                <text x={0} y={-r - 4} textAnchor="middle" dominantBaseline="central"
                  fontSize={8} fontWeight="900" fill="white"
                  style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'inherit' }}>
                  {PIN_LABEL[opp.type]}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 14, right: 14,
        display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
      }}>
        {([
          { label: '+', title: 'Zoom in',    action: () => zoomBy(1.6)     },
          { label: '−', title: 'Zoom out',   action: () => zoomBy(1 / 1.6) },
          { label: '⌂', title: 'Reset zoom', action: zoomReset             },
        ] as const).map(({ label, title, action }) => (
          <button key={label} title={title} onClick={action} style={{
            width: 30, height: 30,
            background: 'rgba(18,21,31,0.92)', border: '1px solid #1e3a5f',
            borderRadius: 6, color: '#e2e8f0', fontSize: '1.05rem',
            fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(6px)', fontFamily: 'inherit',
          }}>{label}</button>
        ))}
      </div>

      {/* Zoom badge — DOM-updated, never causes React re-renders */}
      <div ref={badgeRef} style={{
        position: 'absolute', bottom: 14, left: 14, opacity: 0,
        background: 'rgba(6,9,26,0.85)', border: '1px solid #1e3a5f',
        borderRadius: 6, padding: '3px 8px', fontSize: '0.7rem',
        color: '#8a97b0', fontWeight: 600, zIndex: 10, transition: 'opacity 0.2s',
      }} />
    </div>
  );
}
