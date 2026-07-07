import neo4j from "neo4j-driver"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Script lives in scripts/; the .env lives at the backend package root — resolve
// one level up so credentials load regardless of the invoking working directory.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") })

const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687"
const NEO4J_USER = process.env.NEO4J_USER || "neo4j"
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "password"

export const EMPTY = "{}"

export const rawStudents = [
  { name: "Moises Zuniga", email: "mz397@njit.edu", studentId: "50322807", passwordHash: "81bb6cbe1801461d47fc6cc5b9c38192a1f7798cfd6e45859df7b53cf9dd5dfb8", major: "Computer Science", graduationYear: 2028, clubs: "SHPE, HACCS", companies: EMPTY },
  { name: "Michael Minchala", email: "msm227@njit.edu", studentId: "54593401", passwordHash: "7cfd1fc0d615acb21bc89611dc7617e05f1d5c3413e818190cfa1f00db154cb2", major: "Biomedical engineering", graduationYear: 2026, clubs: "SHPE, BMES, TOMS, ALPHA, IEEE, OCCA", companies: "J&J, Case Medical" },
  { name: "Victor Jimenez", email: "vmj@njit.edu", studentId: "47507729", passwordHash: "ed6d3c89cff25dad30a100767de8340943fa6d2238918c7e7d6f3cb9c1f2eda4", major: "Computer Science", graduationYear: 2027, clubs: "SHPE", companies: "J&J" },
  { name: "Ricky Lopez Velazquez", email: "rl526@njit.edu", studentId: "52995228", passwordHash: "3ea9204e09e63ee9243e496a2e24287e89eece6d2cfeca62cea8205e0fe67eea", major: "Computer Engineering", graduationYear: 2028, clubs: "SHPE, IEEE", companies: EMPTY },
  { name: "Yahil Corcino", email: "yrc@njit.edu", studentId: "76721226", passwordHash: "332e62df096823e66ec7c56403a66abf8c6003646677496cf32a62bf096873e5", major: "Computer Engineering", graduationYear: 2027, clubs: "IEEE, SHPE", companies: EMPTY },
  { name: "Cristopher Mendez", email: "cm653@njit.edu", studentId: "63788019", passwordHash: "175d8d6f3883e71f893ffc8fe7d385bfb18b779a81cf7b87475c8d4f3683271d", major: "Mechanical Engineering", graduationYear: 2026, clubs: "SHPE", companies: "Pepsico, Terumo" },
  { name: "John Mondaruli", email: "jpm245@njit.edu", studentId: "75253996", passwordHash: "cf2f3ac301b07769bef34f344fa5322380b8f7edb693c43c5f2d3a030fb0d763", major: "Civil engineering", graduationYear: 2028, clubs: "ASCE, Munch Madness", companies: "Keller" },
  { name: "Ethan Orellana", email: "ego@njit.edu", studentId: "65290775", passwordHash: "555ed9e97b53b5915511badf75d2d149f55bf51c5d2130d7a55dd9797f53d59f", major: "Mechanical Engineering", graduationYear: 2029, clubs: "SHPE", companies: EMPTY },
  { name: "Michelle Mestanza", email: "mm3255@njit.edu", studentId: "36446842", passwordHash: "fd6906a5434cf52a828d01487de60e55c84435a18a4d8840fd6f0695454c4523", major: "Electrical Engineering 05", graduationYear: 2028, clubs: "SHPE", companies: "Exelon" },
  { name: "Jeremy Segura", email: "jhs59@njit.edu", studentId: "94825316", passwordHash: "e561545985d60522d811455ac5ea5ce90edef5afd001c3529567543989d6e521", major: "Mechanical Engineering", graduationYear: 2029, clubs: "SHPE", companies: EMPTY },
  { name: "Ryan Jimenez", email: "rrj@njit.edu", studentId: "50512940", passwordHash: "76af5a9283102e625652409ca62352b20e18aeef5e02c994e6aa5a7289102e68", major: "Electrical Engineer", graduationYear: 2029, clubs: "SHPE", companies: "Pepco" },
  { name: "Matthew Tujague", email: "mjt58@njit.edu", studentId: "78915642", passwordHash: "147fe5ec91e78c34e9e453ebf4f6edbc19ef4cb7e114d0e33476e5cc92e76c3f", major: "Computer Science", graduationYear: EMPTY, clubs: EMPTY, companies: EMPTY },
  { name: "Edison Mak", email: "em548@njit.edu", studentId: "25635043", passwordHash: "a288e69226a08ac962fa62acf20aee32a8a82a486afae4a47286e6122ba00ac8", major: "Computer Science", graduationYear: 2028, clubs: EMPTY, companies: EMPTY },
  { name: "Jossue Sarango", email: "js2823@njit.edu", studentId: "30593287", passwordHash: "82f32b0a126d2a3c273250e9d27823da9d65dab52f32d6e172fb2bba186d6a34", major: "Mechanical Engineering", graduationYear: 2028, clubs: "SHPE, Senate, Baja SAE, TEAM", companies: "PSEG, CHPRD" },
  { name: "Mitchell Rodriguez", email: "mar264@njit.edu", studentId: "44758815", passwordHash: "fb7575579af79b30799f50fbabf87de71affbbb6718fd2f31b7175d796f7db39", major: "Mechanical Engineering", graduationYear: 2026, clubs: "SHPE, NJIT Soccer Club", companies: EMPTY },
  { name: "Robert Aguirre", email: "rya5@njit.edu", studentId: "73605342", passwordHash: "ab2f90cbc612c3609c33031e9baf98bb4b1a63eb94138a16eb21909bcd12336f", major: "Mechnical Engineering", graduationYear: 2028, clubs: "SHPE, NJIT Soccer Club", companies: EMPTY },
  { name: "Dylan Acevedo", email: "daa228@njit.edu", studentId: "59716909", passwordHash: "264c7a16ad38f605f6866a34d6c672662a300688fe76e83c064e7ae6a038060f", major: "Civil engineering", graduationYear: 2029, clubs: "NJIT Soccer Club, SHPE, ASCE", companies: EMPTY },
  { name: "Ethan Bermudez", email: "eb386@njit.edu", studentId: "53977893", passwordHash: "dc2c421c0408b4e74e74c084fca44a5c8200a46546744f8c7c2e429c060824e5", major: "Electrical Engineering", graduationYear: 2028, clubs: "Njit Volleyball Club", companies: EMPTY },
  { name: "Andrew Montanez", email: "ajm339@njit.edu", studentId: "26158167", passwordHash: "5808d6446fd4f0cd521428503884dee4e1dc30465a04ae584809d6b46bd4d0c3", major: "Mechanical Engineering", graduationYear: 2028, clubs: "SHPE", companies: EMPTY },
  { name: "Omar Dandan", email: "obd2@njit.edu", studentId: "65936294", passwordHash: "caef645a8c26a220e022cb221a656c3a012e82abe8a2422a0ae964da8826d223", major: "Civil Engineering", graduationYear: 2027, clubs: "ASCE", companies: EMPTY },
  { name: "Evans Ibewuike", email: "eii5@njit.edu", studentId: "39614694", passwordHash: "98b6e37c9829b0f267ecde2de834ebfc122150716f6c522548bde38c9a2970f4", major: "Financial Technology", graduationYear: 2028, clubs: "AFSA, NSBE", companies: "All Care" },
  { name: "Diego Azcona", email: "da636@njit.edu", studentId: "98764413", passwordHash: "cbf3dfbbde55d3b15bc39cd19b78d75b505d733b53b31cd9bbf0df1bd65563b9", major: "Electrical Engineering", graduationYear: 2028, clubs: "SHPE, IEEE", companies: EMPTY },
  { name: "Rachell Rivera", email: "rr785@njit.edu", studentId: "68913228", passwordHash: "95a6b2e580b85dea367dcc3ce52bba750bb0cd663ebd433405a6b2e582b89de9", major: "Financial Technology", graduationYear: 2028, clubs: "ALPFA", companies: EMPTY },
  { name: "Mia Chiyoma", email: "mc2248@njit.edu", studentId: "11193712", passwordHash: "e4d4e38478e5dc96e73c39e9d458eb64f3edac1eeffcb8e104dde3a473e53c97", major: "Mechanical Engineering", graduationYear: 2028, clubs: "ASME, JSA", companies: EMPTY },
  { name: "Veer Ran", email: "vnr2@njit.edu", studentId: "30060299", passwordHash: "cb23c0fb884e63e14c734cca1baac83b0146a36a44f3c7c2db2dc06b834e63e0", major: "Civil Engineering", graduationYear: 2029, clubs: "ASCE, Art Club", companies: EMPTY },
  { name: "Victor Minetto", email: "vam48@", studentId: "27014470", passwordHash: "0b9257873691ebd153af701deb1f5f37b799ab535bbff915fb9657673d910bd6", major: "Civil Engineering", graduationYear: 2029, clubs: "ASCE", companies: EMPTY },
  { name: "Kattie Guerrero", email: "kg594@njit.edu", studentId: "10742291", passwordHash: "caab28f24fea02e724ca8d662a2a20d2cfe2726f2c6a096eeaa228d240ea12ef", major: "Biomedical Engineering", graduationYear: 2029, clubs: "SHPE", companies: EMPTY },
  { name: "Luis Duarte", email: "lvd@njit.edu", studentId: "52922143", passwordHash: "2c3eabf81b61fc7bafe05ee58cbca3c899696cf3a750d1edcc36abb81261ec7f", major: "Computer Science", graduationYear: 2027, clubs: "Shpe", companies: "J&J, Wells Fargo" },
  { name: "Alaina Branch Preudhomme", email: "acb69@njit.edu", studentId: "21419058", passwordHash: "71d6b17df8fbb918bdad3077e156b99d72f38996b57dbb7ff1d2b1bdf3fb1917", major: "Architecture", graduationYear: 2030, clubs: "SHPE", companies: EMPTY },
  { name: "Nathanael Nelson", email: "npn@njit.edu", studentId: "78072204", passwordHash: "ec91cf6cf70d245bcb34b7897c11c74c7905d4d9c36430816c95cf2cf80d4458", major: "Computer Science", graduationYear: 2027, clubs: "NSBE", companies: EMPTY },
  { name: "Alex Iglesias", email: "aci@njit.edu", studentId: "47544247", passwordHash: "ba180756f245da5e8b2e3c491a9b0f56704d5add833eb3412a1b0786f7458a56", major: "Civil Engineering", graduationYear: 2028, clubs: "SHPE, ASCE", companies: "Gilbane" },
  { name: "Pablo Leyva", email: "pl33@njit.edu", studentId: "42572023", passwordHash: "43a36a078660236e668f476c832f62d70c6873e06eafc36443a66ab789600365", major: "Applied Math", graduationYear: 2027, clubs: "SHPE", companies: "Apple, Angeles Ventures, Caterpillar, Rex AI" },
  { name: "Alejandro Perdomo", email: "dp996@njit.edu", studentId: "87125024", passwordHash: "5915510d7d5f715dd55dbfd3699b59ddf557f1d3dd5d34dbd910518d7d5fc153", major: "Computer Science", graduationYear: 2028, clubs: "SHPE, HACCS", companies: "Angeles Investors" },
  { name: "Shane Singh", email: "sls49@njit.edu", studentId: "58681945", passwordHash: "e64f68d264e2be0e6c9223e626c66052edea7e8364e2a1eee64068f261e28e02", major: "Mechanical Engineering", graduationYear: 2029, clubs: "SHPE", companies: EMPTY },
  { name: "Chidera Okafor", email: "cwo3@njit.edu", studentId: "41081220", passwordHash: "d769fe5342f41fa1f26381f8e7e8f683c4fcef21fa2305f0b762fe5342f4cfad", major: "Information Technology", graduationYear: 2028, clubs: "MMA Club, Christians On Campus, Ready@20, NSBE, AFSA, Intervarsity, Archery, Wightlifting, E-Sports", companies: EMPTY },
  { name: "Daniel Montoya", email: "dem6@njit.edu", studentId: "53963465", passwordHash: "1f75539f93d50fbfdfbfdb516ffc5b6f17dd2f3cd70f5459df7b53cf9dd5dfb8", major: "Computer Science", graduationYear: 2026, clubs: "HACCS, SHLA", companies: "ADP" },
  { name: "Luca de la Colina", email: "led27@njit.edu", studentId: "77048393", passwordHash: "b7c3f297233027897e07ec3ca74ffa37aa38f7017647633497c8f2f72a304786", major: "Electrical Engineering", graduationYear: 2028, clubs: "IEEE", companies: "Amazon" },
  { name: "Eric Maurizaca", email: "eam82@njit.edu", studentId: "40527801", passwordHash: "b93ce375132911f16fe5dd25c9b5ebc59621c17a67e55f2da934e3e51d2951f9", major: "Construction Management Technology", graduationYear: 2029, clubs: EMPTY, companies: EMPTY },
  { name: "Jerry Arguello", email: "jla44@njit.edu", studentId: "53376261", passwordHash: "7e84465e23c88e41caaeec4cee064edea9c0bec1c2de61444e8d46fe20c8ce4f", major: "Computer Science and", graduationYear: 2027, clubs: EMPTY, companies: EMPTY },
  { name: "Andrew Mathews", email: "apm73@njit.edu", studentId: "61175965", passwordHash: "8c68027488c4f4ad8eecc1c08ce70a840dccf425867c47c80c6102a48cc474a1", major: "Computer Science", graduationYear: 2027, clubs: "ACM, IGDA", companies: EMPTY },
  { name: "Aynesh Verma", email: "av742@njit.edu", studentId: "75145403", passwordHash: "a19c57613719615f5b41fd9db11e5f61b011e1d553017195319e57913619e157", major: "Computer Science", graduationYear: 2027, clubs: "ACM, GDG, CKI", companies: EMPTY },
  { name: "Janrex Panlilio", email: "jap328@njit.edu", studentId: "12505407", passwordHash: "e91851c5705ff157d5e5bbd3999f5935fd5701d5dd3533db191551357a5f715a", major: "Information Technology", graduationYear: 2027, clubs: "NICC, MMA Club, Weightlifting", companies: EMPTY },
  { name: "Ethan Ho", email: "ekh3@njit.edu", studentId: "43237787", passwordHash: "7c1227ecf225545cab043aa91c902f7c762dc4d3a374b3a1ec1c27bcfb25a45c", major: "Computer Science", graduationYear: 2026, clubs: "ACM, Nucleus Yearbook", companies: "Lumi-AI, WeRebel" },
  { name: "Joel Walker", email: "jmw62@njit.edu", studentId: "30615557", passwordHash: "7b505d3330532318d9ebf6df1bda5503b65b7393d1fb7ad73b5b5d933753e31e", major: "Computer Science", graduationYear: 2027, clubs: EMPTY, companies: EMPTY },
  { name: "Jianna Aguilar", email: "jla23@njit.edu", studentId: "16418832", passwordHash: "3163d2e18814e1afde21c090c1e0da910b1c0121d6114498e16fd211881431ae", major: "Information Systems", graduationYear: 2027, clubs: EMPTY, companies: "Beacon Converters" },
  { name: "David Bermudez", email: "db695@njit.edu", studentId: "46850183", passwordHash: "ac95817876074c588d203d038c198918fc0f8cd78530b70bbc9481c87207ac5a", major: "Cybersecurity", graduationYear: 2027, clubs: EMPTY, companies: EMPTY },
  { name: "Luis Acevedo Galvez", email: "laa55@njit.edu", studentId: "65742143", passwordHash: "a658dbfab5198e19d77a729506d4d39a3711fe9adffaf09d565edb5aba196e14", major: "Information Technology", graduationYear: 2027, clubs: "Esports", companies: EMPTY },
  { name: "Manpreet Hundal", email: "msh23@njit.edu", studentId: "54621861", passwordHash: "f60f5892ed9e1ec654d2ad1aa68d50a26c96ce405c222d12e60958f2e69e1ec6", major: "Information Technology", graduationYear: 2026, clubs: "NICC", companies: "Angelic Health, Hudson regional Hospital" },
  { name: "Shriya Sharma", email: "ss5379@njit.edu", studentId: "75050072", passwordHash: "7013c1847ccf485f4544b6436090c9f4fcc798d44d14314b1019c1f472cf3857", major: "Computer Science", graduationYear: 2026, clubs: EMPTY, companies: EMPTY },
  { name: "Kaylee Zepeda", email: "kgz2@njit.edu", studentId: "83904333", passwordHash: "2023f2c00878a0e1fe90c67490abfa808970f064f6d0467c0022f2a0017850e7", major: "Software and Data Engineering Technology", graduationYear: 2028, clubs: "SHPE", companies: EMPTY },
  { name: "Youganon Saikia", email: "ys659@njit.edu", studentId: "90560240", passwordHash: "15a1b27d8d38edef3685c4bce525badd0a305d673e4545b435a8b21d8a38cdee", major: "Computer Science", graduationYear: 2026, clubs: EMPTY, companies: EMPTY },
  { name: "Lakshita Madhavan", email: "lm66@njit.edu", studentId: "80585928", passwordHash: "b70fde47a4d0f7c852f76054d785d65724d817405ab7e25ce707de57a1d097ce", major: "Computer Science", graduationYear: 2027, clubs: "WiCS", companies: "Merck" },
  { name: "Avanish Kulkarni", email: "agk4@njit.edu", studentId: "39510401", passwordHash: "4ef2ed3a176f86bce14ad5636e7ee54a9967a637e90a5e6bbef7ed3a106f66b3", major: "Computer Science", graduationYear: 2026, clubs: EMPTY, companies: "Roblox" },
  { name: "Adam Nguyen", email: "aln22@njit.edu", studentId: "73104006", passwordHash: "0d591b05f4d5e59597fd31d12dd1135577ddf5109ffdbad9bd561b85f2d58590", major: "Computer Science", graduationYear: 2028, clubs: EMPTY, companies: "Esco Pharmacy" },
  { name: "Christopher Pachas", email: "cp576@njit.edu", studentId: "74300105", passwordHash: "3092a7a833a1a0d323e8792dd011afa8bda920572bc8f825b091a71835a140db", major: "Information Technology", graduationYear: 2028, clubs: EMPTY, companies: EMPTY },
  { name: "Oceanna George", email: "oeg@njit.edu", studentId: "82116901", passwordHash: "acdc2d40346b2c1c21f878efcc552570be63cc9e29a8f4e76cd92d60346b7c1c", major: "Information Technology", graduationYear: 2027, clubs: "IVCF, NSBE, NICC, CRU, Baking Club, WiCS,", companies: EMPTY },
  { name: "Xiomara Lazo", email: "xl54@njit.edu", studentId: "29615453", passwordHash: "9440ca00a848c40046f86bc484c0c2102c4084854e98efcce446ca40a9480407", major: "Architecture", graduationYear: 2030, clubs: EMPTY, companies: EMPTY },
]

const knownAcronyms = new Set([
  "ACM", "AFSA", "ALPFA", "ALPHA", "ASCE", "ASME", "BMES", "CHPRD", "CKI",
  "CRU", "GDG", "HACCS", "IEEE", "IGDA", "IT", "J&J", "JSA", "ME", "MMA",
  "MSA", "N-A", "NICC", "NJIT", "NSBE", "OCCA", "PSEG", "SAE", "SHLA",
  "SHPE", "TEAM", "TOMS", "WICS", "YWCC",
])

// Canonical display names for known club aliases.
const clubAliases = new Map([
  ["shpe", "SHPE"],
  ["society of hispanic professional engineers", "SHPE"],
  ["society of professional hispanic engineers", "SHPE"],
  ["society of hispanic professional engineer", "SHPE"],
  ["society of professional hispanic engineer", "SHPE"],
  ["association for computing machinery", "ACM"],
  ["women in computing society", "WiCS"],
  ["njit wics", "WiCS"],
  ["national society of black engineers", "NSBE"],
  ["intervarsity christian fellowship", "InterVarsity Christian Fellowship"],
  ["njit information and cybersecurity club", "NICC"],
])

const companyAliases = new Map([
  ["jnj", "J&J"],
  ["j and j", "J&J"],
  ["j&j", "J&J"],
  ["johnson and johnson", "J&J"],
  ["adp global product technology", "ADP"],
  ["adp global product and technology", "ADP"],
])

export function isEmpty(value) {
  return value == null || value === EMPTY || String(value).trim() === ""
}

export function cleanText(value) {
  if (isEmpty(value)) return null
  const trimmed = String(value).trim().replace(/\s+/g, " ")
  return trimmed || null
}

export function splitList(value) {
  const text = cleanText(value)
  if (!text) return []
  return text
    .split(/\s*,\s*/)
    .map((item) => item.trim())
    .filter((item) => item && item !== EMPTY)
}

export function splitClubList(value) {
  const base = splitList(value)
  const splitOnAmpersand = []

  for (const item of base) {
    if (item.includes(" & ")) {
      splitOnAmpersand.push(...item.split(/\s*&\s*/))
      continue
    }
    splitOnAmpersand.push(item)
  }

  const splitOnAnd = []
  for (const item of splitOnAmpersand) {
    // Preserve common long-form names from being split incorrectly.
    const lower = item.toLowerCase()
    if (
      lower.includes("association for computing machinery") ||
      lower.includes("circle k international") ||
      lower.includes("intervarsity christian fellowship")
    ) {
      splitOnAnd.push(item)
      continue
    }
    if (/\sand\s/i.test(item)) {
      splitOnAnd.push(...item.split(/\s+and\s+/i))
      continue
    }
    splitOnAnd.push(item)
  }

  return splitOnAnd.map((item) => item.trim()).filter(Boolean)
}

export function titleCaseEntity(value) {
  const text = cleanText(value)
  if (!text) return null
  return text
    .split(" ")
    .map((word) => {
      const stripped = word.replace(/[^a-zA-Z0-9&@-]/g, "")
      if (knownAcronyms.has(stripped.toUpperCase())) {
        return word.replace(stripped, stripped.toUpperCase())
      }
      return word
        .split(/([-/@])/)
        .map((part) => {
          if (/^[-/@]$/.test(part) || !part) return part
          if (/^\d/.test(part)) return part
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        })
        .join("")
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

export function canonicalClubName(value) {
  const titled = titleCaseEntity(value)
  if (!titled) return null
  const key = titled.toLowerCase().replace(/\s+/g, " ").trim()
  return clubAliases.get(key) ?? titled
}

function stripYears(value) {
  return value
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\b\d{2}\b/g, " ")
    .replace(/\b\d{4}\s*-\s*\d{4}\b/g, " ")
}

function dropRoleNoise(value) {
  return value
    .replace(/\b\d+\s*x\b/gi, " ")
    .replace(/\b(?:summer|spring|fall|future|previously|none|yet|n-a)\b/gi, " ")
    .replace(/\b(?:intern|internship|engineer|analyst|operations|manufacturing|software|design|product|technology|development|quality assurance|capstone|project|board|public|utilities|hospital)\b/gi, " ")
    .replace(/\b(?:at|with)\b/gi, " ")
    .replace(/[()]/g, " ")
}

function canonicalCompanyAlias(value) {
  const key = value.toLowerCase().replace(/[^a-z0-9&\s]/g, " ").replace(/\s+/g, " ").trim()
  return companyAliases.get(key) ?? value
}

export function normalizeCompanyNames(rawCompanies) {
  const text = cleanText(rawCompanies)
  if (!text) return []
  if (/^(?:none|none yet|n-a)$/i.test(text)) return []

  const parts = text.split(/\s*[;,]\s*/).filter(Boolean)
  const candidates = []

  for (const raw of parts) {
    let item = raw
    if (item.includes("@")) {
      item = item.split("@").pop() ?? item
    } else if (/\bwith\b/i.test(item)) {
      item = item.split(/\bwith\b/i).pop() ?? item
    } else if (/\bat\b/i.test(item)) {
      item = item.split(/\bat\b/i).pop() ?? item
    }

    // Handle "Pepco - Exelon 2026" as two company candidates.
    const hyphenSplit = item.split(/\s+-\s+/)
    for (const segment of hyphenSplit) {
      const noYears = stripYears(segment)
      const deNoised = dropRoleNoise(noYears)
      const cleaned = cleanText(deNoised)
      if (!cleaned) continue
      const titled = titleCaseEntity(cleaned)
      if (!titled) continue
      const aliased = canonicalCompanyAlias(titled)
      // Keep only meaningful alphabetic labels after cleanup.
      if (!/[A-Za-z]/.test(aliased)) continue
      candidates.push(aliased)
    }
  }

  return [...new Set(candidates)]
}

export function slug(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function graduationYear(value) {
  if (isEmpty(value)) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

export function studentProperties(raw) {
  const props = { color: "blue", type: "student" }
  const fields = [
    ["name", cleanText(raw.name)],
    ["email", cleanText(raw.email)],
    ["studentId", cleanText(raw.studentId)],
    ["passwordHash", cleanText(raw.passwordHash)],
    ["major", cleanText(raw.major)],
    ["graduationYear", graduationYear(raw.graduationYear)],
  ]
  for (const [key, value] of fields) {
    if (value != null) props[key] = value
  }
  props.label = props.name ?? props.studentId
  props.id = props.studentId ? `student-${props.studentId}` : `student-${slug(props.label)}`
  return props
}

export function inferredInterests(major) {
  const text = cleanText(major)?.toLowerCase() ?? ""
  const interests = new Set()
  const add = (...items) => items.forEach((item) => interests.add(item))

  if (/\bcomputer\s*science\b|\bcomp\s*sci\b|\bcs\b/.test(text)) add("Software Engineering", "Programming")
  if (text.includes("electrical engineering") || text.includes("electrical engineer")) add("Hardware", "Electronics")
  if (text.includes("mechanical engineering") || /\bmech\b|\bmeche\b|\bme\b/.test(text)) add("Engineering", "Design")
  if (text.includes("biomedical engineering")) add("Biomedical", "Healthcare")
  if (text.includes("civil engineering") || text === "civil") add("Engineering", "Design")
  if (text.includes("information technology") || /\bit\b/.test(text)) add("Programming", "Cybersecurity")
  if (text.includes("cybersecurity")) add("Cybersecurity", "Security")
  if (text.includes("finance") || text.includes("financial technology")) add("Finance")
  if (text.includes("architecture")) add("Design", "Architecture")
  if (text.includes("applied math")) add("Mathematics")
  if (text.includes("construction management")) add("Engineering")

  return [...interests]
}

async function count(session, label) {
  const result = await session.run(`MATCH (n:${label}) RETURN count(n) AS total`)
  return result.records[0].get("total").toNumber()
}

async function relationshipCount(session) {
  const result = await session.run("MATCH ()-[r]->() RETURN count(r) AS total")
  return result.records[0].get("total").toNumber()
}

async function seed() {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD))
  const session = driver.session()

  try {
    await session.run("CREATE CONSTRAINT student_student_id_unique IF NOT EXISTS FOR (s:Student) REQUIRE s.studentId IS UNIQUE")
    await session.run("MATCH (n) DETACH DELETE n")
    await session.run("MATCH (p:Professor) DETACH DELETE p")

    for (const raw of rawStudents) {
      const student = studentProperties(raw)
      await session.run(
        `MERGE (s:Student {studentId: $studentId})
         SET s += $props`,
        { studentId: student.studentId, props: student }
      )

      const clubs = [...new Set(splitClubList(raw.clubs).map(canonicalClubName).filter(Boolean))]
      for (const club of clubs) {
        await session.run(
          `MERGE (c:Club {clubKey: $clubKey})
           ON CREATE SET c.id = $id
           SET c.name = $name, c.color = "green", c.label = $name, c.type = "club"
           WITH c
           MATCH (s:Student {studentId: $studentId})
           MERGE (s)-[:MEMBER_OF]->(c)`,
          {
            studentId: student.studentId,
            name: club,
            clubKey: slug(club),
            id: `club-${slug(club)}`,
          }
        )
      }

      const companies = normalizeCompanyNames(raw.companies)
      for (const company of companies) {
        await session.run(
          `MERGE (c:Company {name: $name})
           ON CREATE SET c.id = $id
           SET c.color = "orange", c.label = $name, c.type = "company"
           WITH c
           MATCH (s:Student {studentId: $studentId})
           MERGE (s)-[:WORKED_AT]->(c)`,
          { studentId: student.studentId, name: company, id: `company-${slug(company)}` }
        )
      }

      for (const interest of inferredInterests(raw.major)) {
        await session.run(
          `MERGE (i:Interest {name: $name})
           ON CREATE SET i.id = $id
           SET i.color = "yellow", i.label = $name, i.type = "interest"
           WITH i
           MATCH (s:Student {studentId: $studentId})
           MERGE (s)-[:INTERESTED_IN]->(i)`,
          { studentId: student.studentId, name: interest, id: `interest-${slug(interest)}` }
        )
      }
    }

    console.log("Neo4j seed complete.")
    console.log(`Total Student nodes created: ${await count(session, "Student")}`)
    console.log(`Total Club nodes created: ${await count(session, "Club")}`)
    console.log(`Total Company nodes created: ${await count(session, "Company")}`)
    console.log(`Total Interest nodes created: ${await count(session, "Interest")}`)
    console.log(`Total relationships created: ${await relationshipCount(session)}`)
  } finally {
    await session.close()
    await driver.close()
  }
}

seed().catch((error) => {
  console.error("Neo4j seed failed:", error)
  process.exitCode = 1
})
