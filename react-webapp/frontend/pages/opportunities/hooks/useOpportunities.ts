import { useState, useMemo, useEffect } from 'react';
import type {
  Opportunity,
  OpportunityType,
  TrackedApplication,
  ApplicationStatus,
  CreateOpportunityInput,
} from '../types/opportunities';
import { COUNTRY_FLAG, getCountry } from '../utils/getCountry';

const MOCK_OPPORTUNITIES: Opportunity[] = [
  { id:'opp-1',  type:'scholarship', title:'NJIT Merit Excellence Award',        org:'NJIT Financial Aid',           city:'Newark',        state:'NJ', lat:40.7357,  lng:-74.1724,  amount:'$8,000/yr',  deadline:'2026-04-15', tags:['GPA 3.5+','STEM','Undergraduate'],          description:'Merit-based scholarship for high-achieving STEM undergrads at NJIT.' },
  { id:'opp-2',  type:'internship',  title:'Software Engineer Intern',            org:'Google',                       city:'New York',      state:'NY', lat:40.7128,  lng:-74.0060,  stipend:'$7,500/mo', deadline:'2026-05-01', tags:['SWE','Python','Summer 2026'],                districtId:'computer-science', description:'Work on large-scale distributed systems on the Google Cloud team.' },
  { id:'opp-3',  type:'networking',  title:'Tech Career Summit',                  org:'NJIT Alumni Network',          city:'Newark',        state:'NJ', lat:40.7282,  lng:-74.1776,                       deadline:'2026-03-28', tags:['Networking','Career Fair','Alumni'],         description:'Connect with 200+ NJIT alumni working at top tech companies.' },
  { id:'opp-13', type:'internship',  title:'Front-End Engineer Intern',           org:'Bloomberg LP',                 city:'New York',      state:'NY', lat:40.7527,  lng:-73.9772,  stipend:'$7,000/mo', deadline:'2026-05-15', tags:['React','TypeScript','Finance'],              description:'Build real-time financial data dashboards used by traders globally.' },
  { id:'opp-14', type:'scholarship', title:'Jackie Robinson Foundation',          org:'Jackie Robinson Foundation',   city:'New York',      state:'NY', lat:40.7484,  lng:-73.9967,  amount:'$7,500/yr',  deadline:'2026-04-01', tags:['Leadership','Minority','Undergraduate'],    description:'Full scholarship for minority students demonstrating leadership.' },
  { id:'opp-15', type:'networking',  title:'FinTech Innovation Forum',            org:'NY FinTech Week',              city:'New York',      state:'NY', lat:40.7061,  lng:-74.0087,                       deadline:'2026-04-22', tags:['FinTech','Blockchain','Networking'],         description:'Connect with leaders transforming global financial services.' },
  { id:'opp-16', type:'internship',  title:'AI Research Intern',                  org:'Two Sigma',                    city:'New York',      state:'NY', lat:40.7211,  lng:-74.0063,  stipend:'$9,000/mo', deadline:'2026-04-28', tags:['ML','Quant','Python','Research'],            districtId:'computer-science', description:'Apply ML models to quantitative trading strategies.' },
  { id:'opp-17', type:'scholarship', title:'Rutgers STEM Diversity Award',        org:'Rutgers University',           city:'New Brunswick', state:'NJ', lat:40.4774,  lng:-74.4367,  amount:'$4,500/yr',  deadline:'2026-05-10', tags:['STEM','Diversity','NJ Resident'],           description:'Supporting underrepresented students at Rutgers School of Engineering.' },
  { id:'opp-8',  type:'internship',  title:'Cybersecurity Analyst Intern',        org:'Booz Allen Hamilton',          city:'Washington',    state:'DC', lat:38.9072,  lng:-77.0369,  stipend:'$5,500/mo', deadline:'2026-04-10', tags:['Cybersecurity','Clearance','Government'],   description:'Support federal clients with vulnerability assessments and incident response.' },
  { id:'opp-18', type:'networking',  title:'AFCEA NOVA Spring Conference',        org:'AFCEA',                        city:'Washington',    state:'DC', lat:38.8951,  lng:-77.0364,                       deadline:'2026-04-14', tags:['Defense','IT','Government'],                description:'Networking event for cyber and IT professionals supporting national security.' },
  { id:'opp-19', type:'scholarship', title:'Congressional Hispanic Caucus',       org:'CHCI',                         city:'Washington',    state:'DC', lat:38.8897,  lng:-76.9874,  amount:'$5,000',     deadline:'2026-04-15', tags:['Hispanic','Leadership','DC'],               description:'Full scholarship + internship placement for Hispanic students.' },
  { id:'opp-20', type:'internship',  title:'Policy Tech Fellow',                  org:'Georgetown University',        city:'Washington',    state:'DC', lat:38.9076,  lng:-77.0723,  stipend:'$3,500/mo', deadline:'2026-05-01', tags:['Policy','Tech','Graduate'],                 description:'Bridge technology and public policy at Georgetown Law.' },
  { id:'opp-21', type:'internship',  title:'Software Engineer Intern',            org:'Leidos',                       city:'Arlington',     state:'VA', lat:38.8816,  lng:-77.0910,  stipend:'$5,200/mo', deadline:'2026-04-30', tags:['Defense','Java','Clearance'],               description:'Develop mission-critical software systems for DoD contracts.' },
  { id:'opp-22', type:'scholarship', title:'SMART Scholarship',                   org:'Dept. of Defense',             city:'Arlington',     state:'VA', lat:38.8681,  lng:-77.0560,  amount:'$25,000/yr', deadline:'2026-12-01', tags:['STEM','DoD','Full Ride'],                   description:'Full-ride scholarship + guaranteed DoD employment after graduation.' },
  { id:'opp-23', type:'internship',  title:'Biotech Research Intern',             org:'Biogen',                       city:'Cambridge',     state:'MA', lat:42.3736,  lng:-71.1097,  stipend:'$5,000/mo', deadline:'2026-04-25', tags:['Biotech','Research','Life Sciences'],       districtId:'biological-science', description:'Support drug discovery pipelines at a world-leading biotech firm.' },
  { id:'opp-31', type:'internship',  title:'Mechanical Engineering Co-op',        org:'Caterpillar',                  city:'Peoria',        state:'IL', lat:40.6936,  lng:-89.5890,  stipend:'$4,200/mo', deadline:'2026-04-15', tags:['MechE','CAD','Manufacturing'],              districtId:'mechanical-industrial-engineering', description:'Hands-on product development experience with heavy equipment.' },
  { id:'opp-36', type:'internship',  title:'Data Analytics Intern',               org:'Target Corporation',           city:'Minneapolis',   state:'MN', lat:44.9778,  lng:-93.2650,  stipend:'$5,100/mo', deadline:'2026-04-18', tags:['Data','Retail','Python','SQL'],             districtId:'data-science', description:'Use data to drive product placement and supply chain decisions.' },
  { id:'opp-46', type:'internship',  title:'Hardware Engineer Intern',            org:'Apple',                        city:'Cupertino',     state:'CA', lat:37.3230,  lng:-122.0322, stipend:'$8,500/mo', deadline:'2026-04-25', tags:['Hardware','EE','SoC'],                      districtId:'electrical-computer-engineering', description:'Design and validate silicon for next-generation Apple devices.' },
  { id:'opp-5',  type:'internship',  title:'Data Science Intern',                 org:'Microsoft',                    city:'Seattle',       state:'WA', lat:47.6062,  lng:-122.3321, stipend:'$6,800/mo', deadline:'2026-04-20', tags:['Data Science','Azure','Python','ML'],       districtId:'data-science', description:'Work on AI/ML products and data pipelines within the Azure team.' },
  { id:'opp-rd-1',  type:'internship',  title:'Software Systems Research Assistant',      org:'NJIT Computer Science',            city:'Newark', state:'NJ', lat:40.7420, lng:-74.1780, stipend:'$3,800/mo', deadline:'2026-04-20', districtId:'computer-science', tags:['Distributed Systems','CS','Research'], description:'Support a faculty team benchmarking software systems for campus-scale applications.' },
  { id:'opp-rd-2',  type:'internship',  title:'Urban Analytics Fellow',                  org:'NJIT Data Science',                city:'Newark', state:'NJ', lat:40.7410, lng:-74.1772, stipend:'$3,500/mo', deadline:'2026-04-27', districtId:'data-science', tags:['Data Science','Python','Cities'], description:'Work on city datasets and forecasting tools for mobility and housing studies.' },
  { id:'opp-rd-3',  type:'networking',  title:'Digital Services Research Roundtable',    org:'NJIT Informatics',                 city:'Newark', state:'NJ', lat:40.7408, lng:-74.1766,                      deadline:'2026-04-19', districtId:'informatics', tags:['Informatics','Systems','Roundtable'], description:'Join researchers and alumni discussing digital transformation in higher education.' },
  { id:'opp-rd-4',  type:'internship',  title:'Embedded Sensing Research Intern',        org:'NJIT ECE',                         city:'Newark', state:'NJ', lat:40.7404, lng:-74.1759, stipend:'$4,200/mo', deadline:'2026-04-24', districtId:'electrical-computer-engineering', tags:['ECE','Embedded','Sensors'], description:'Prototype sensing workflows for intelligent hardware and robotics projects.' },
  { id:'opp-rd-5',  type:'internship',  title:'Advanced Materials Lab Intern',           org:'NJIT Chemical and Materials Eng.', city:'Newark', state:'NJ', lat:40.7399, lng:-74.1752, stipend:'$3,600/mo', deadline:'2026-04-30', districtId:'chemical-materials-engineering', tags:['Materials','ChemE','Lab'], description:'Characterize materials samples and document process changes for faculty experiments.' },
  { id:'opp-rd-6',  type:'internship',  title:'Resilient Infrastructure Assistant',      org:'NJIT Civil and Environmental Eng.', city:'Newark', state:'NJ', lat:40.7395, lng:-74.1747, stipend:'$3,700/mo', deadline:'2026-04-25', districtId:'civil-environmental-engineering', tags:['Civil','GIS','Infrastructure'], description:'Help build maps and reports for flood, traffic, and infrastructure resilience work.' },
  { id:'opp-rd-7',  type:'internship',  title:'Robotics Testbed Intern',                 org:'NJIT Mechanical and Industrial Eng.', city:'Newark', state:'NJ', lat:40.7390, lng:-74.1741, stipend:'$4,000/mo', deadline:'2026-04-28', districtId:'mechanical-industrial-engineering', tags:['Robotics','Manufacturing','MIE'], description:'Support testbed setup, validation, and data capture for robotics and automation research.' },
  { id:'opp-rd-8',  type:'internship',  title:'Wearable Health Prototyping Intern',      org:'NJIT Biomedical Engineering',      city:'Newark', state:'NJ', lat:40.7387, lng:-74.1736, stipend:'$3,900/mo', deadline:'2026-04-23', districtId:'biomedical-engineering', tags:['Biomedical','Wearables','Signals'], description:'Assist with prototyping and evaluation for student and faculty wearable-device studies.' },
  { id:'opp-rd-9',  type:'scholarship', title:'Applied Physics Research Grant',          org:'NJIT Physics',                     city:'Newark', state:'NJ', lat:40.7382, lng:-74.1730, amount:'$2,500',     deadline:'2026-04-18', districtId:'physics', tags:['Physics','Research','Grant'], description:'Mini-grant for students contributing to optics, simulation, or instrumentation research.' },
  { id:'opp-rd-10', type:'internship',  title:'Computational Modeling Assistant',        org:'NJIT Mathematical Sciences',       city:'Newark', state:'NJ', lat:40.7378, lng:-74.1724, stipend:'$3,400/mo', deadline:'2026-04-26', districtId:'mathematical-sciences', tags:['Math','Modeling','Statistics'], description:'Build reproducible notebooks and optimization examples for interdisciplinary modeling teams.' },
  { id:'opp-rd-11', type:'internship',  title:'Environmental Chemistry Support Intern',  org:'NJIT Chemistry and Env. Science',  city:'Newark', state:'NJ', lat:40.7375, lng:-74.1719, stipend:'$3,300/mo', deadline:'2026-04-29', districtId:'chemistry-environmental-science', tags:['Chemistry','Environment','Lab'], description:'Process analytical lab outputs and support environmental chemistry field sampling.' },
  { id:'opp-rd-12', type:'internship',  title:'Life Sciences Data Curator',              org:'NJIT Biological Science',          city:'Newark', state:'NJ', lat:40.7371, lng:-74.1713, stipend:'$3,200/mo', deadline:'2026-04-22', districtId:'biological-science', tags:['Biology','Data','Genomics'], description:'Curate biological datasets and sample metadata for faculty genomics and ecology studies.' },
  { id:'opp-rd-13', type:'networking',  title:'Design Futures Studio Open House',        org:'NJIT Architecture and Design',     city:'Newark', state:'NJ', lat:40.7366, lng:-74.1707,                      deadline:'2026-04-17', districtId:'architecture-design', tags:['Architecture','Design','Open House'], description:'Meet faculty and student researchers working on spatial, urban, and visual design futures.' },
  { id:'opp-rd-14', type:'internship',  title:'Technology Policy Research Assistant',    org:'NJIT Humanities and Social Sciences', city:'Newark', state:'NJ', lat:40.7362, lng:-74.1702, stipend:'$3,100/mo', deadline:'2026-04-21', districtId:'humanities-social-sciences', tags:['Policy','HSS','Writing'], description:'Prepare qualitative research briefs on technology, culture, and civic impact.' },
  { id:'opp-rd-15', type:'internship',  title:'Innovation Operations Analyst',           org:'NJIT Management',                  city:'Newark', state:'NJ', lat:40.7358, lng:-74.1697, stipend:'$3,450/mo', deadline:'2026-04-24', districtId:'management', tags:['Management','Operations','Analytics'], description:'Track metrics and support decision-making for innovation and entrepreneurship programs.' },
  { id:'opp-rd-16', type:'internship',  title:'Applied Prototyping Lab Assistant',       org:'NJIT Applied Engineering and Technology', city:'Newark', state:'NJ', lat:40.7354, lng:-74.1691, stipend:'$3,500/mo', deadline:'2026-04-28', districtId:'applied-engineering-technology', tags:['AET','Prototyping','Testing'], description:'Maintain fabrication workflows and assist with hands-on prototype validation.' },
];

export type FilterType = OpportunityType | 'all';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function useOpportunities(initialDistrict?: string | null) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [tracked, setTracked] = useState<TrackedApplication[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [apiOpps, setApiOpps] = useState<Opportunity[]>([]);
  const [districtFilter, setDistrictFilter] = useState<string | null>(initialDistrict ?? null);
  const [locationFilter, setLocationFilter] = useState<string>('all');

  useEffect(() => {
    fetch(`${API}/api/opportunities?limit=300`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((rows: Opportunity[]) => setApiOpps(rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDistrictFilter(initialDistrict ?? null);
  }, [initialDistrict]);

  const allOpportunities = useMemo<Opportunity[]>(() => {
    const apiIds = new Set(apiOpps.map((opportunity) => opportunity.id));
    const mockOnly = MOCK_OPPORTUNITIES.filter((opportunity) => !apiIds.has(opportunity.id));
    return [...apiOpps, ...mockOnly];
  }, [apiOpps]);

  const districtScoped = useMemo(() => {
    if (!districtFilter) return allOpportunities;
    const id = districtFilter.toLowerCase();
    return allOpportunities.filter((opportunity) =>
      (opportunity.districtId && opportunity.districtId.toLowerCase() === id) ||
      opportunity.tags.some((tag) => tag.toLowerCase() === id)
    );
  }, [allOpportunities, districtFilter]);

  const locationOptions = useMemo(() => {
    const allCountries = Array.from(new Set([
      ...Object.keys(COUNTRY_FLAG),
      ...districtScoped.map((opportunity) => getCountry(opportunity.city).country),
    ]));

    const sortedCountries = allCountries.sort((a, b) => {
      if (a === 'USA') return -1;
      if (b === 'USA') return 1;
      return a.localeCompare(b);
    });

    return ['all', ...sortedCountries];
  }, [districtScoped]);

  const locationScoped = useMemo(() => (
    locationFilter === 'all'
      ? districtScoped
      : districtScoped.filter(
          (opportunity) => getCountry(opportunity.city).country === locationFilter,
        )
  ), [districtScoped, locationFilter]);

  const filtered = useMemo(() => (
    filter === 'all'
      ? locationScoped
      : locationScoped.filter((opportunity) => opportunity.type === filter)
  ), [filter, locationScoped]);

  const counts = useMemo(() => ({
    all: locationScoped.length,
    scholarship: locationScoped.filter((opportunity) => opportunity.type === 'scholarship').length,
    internship: locationScoped.filter((opportunity) => opportunity.type === 'internship').length,
    networking: locationScoped.filter((opportunity) => opportunity.type === 'networking').length,
  }), [locationScoped]);

  function trackApplication(opportunityId: string, status: ApplicationStatus) {
    setTracked((previous) => {
      const existingIndex = previous.findIndex((item) => item.opportunityId === opportunityId);
      if (existingIndex >= 0) {
        const next = [...previous];
        next[existingIndex] = { ...next[existingIndex], status };
        return next;
      }
      return [...previous, { opportunityId, status, appliedDate: new Date().toISOString() }];
    });
  }

  function getTracked(opportunityId: string): TrackedApplication | undefined {
    return tracked.find((item) => item.opportunityId === opportunityId);
  }

  async function createOpportunity(input: CreateOpportunityInput, token: string) {
    const response = await fetch(`${API}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? 'Could not create opportunity');
    }

    const created = payload as Opportunity;
    setApiOpps((previous) => [created, ...previous.filter((opportunity) => opportunity.id !== created.id)]);
    return created;
  }

  return {
    filtered,
    counts,
    filter,
    setFilter,
    activeId,
    setActiveId,
    tracked,
    trackApplication,
    getTracked,
    createOpportunity,
    districtFilter,
    setDistrictFilter,
    locationFilter,
    setLocationFilter,
    locationOptions,
  };
}
