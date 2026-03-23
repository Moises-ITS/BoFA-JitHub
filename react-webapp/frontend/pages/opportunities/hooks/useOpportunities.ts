import { useState, useMemo, useEffect } from 'react';
import type {
  Opportunity,
  OpportunityType,
  TrackedApplication,
  ApplicationStatus,
  CreateOpportunityInput,
} from '../types/opportunities';

const MOCK_OPPORTUNITIES: Opportunity[] = [
  // ── New Jersey / New York ──────────────────────────────────────
  { id:'opp-1',  type:'scholarship', title:'NJIT Merit Excellence Award',        org:'NJIT Financial Aid',           city:'Newark',        state:'NJ', lat:40.7357,  lng:-74.1724,  amount:'$8,000/yr',  deadline:'2026-04-15', tags:['GPA 3.5+','STEM','Undergraduate'],          description:'Merit-based scholarship for high-achieving STEM undergrads at NJIT.' },
  { id:'opp-2',  type:'internship',  title:'Software Engineer Intern',            org:'Google',                       city:'New York',       state:'NY', lat:40.7128,  lng:-74.0060,  stipend:'$7,500/mo', deadline:'2026-05-01', tags:['SWE','Python','Summer 2026'],                description:'Work on large-scale distributed systems on the Google Cloud team.' },
  { id:'opp-3',  type:'networking',  title:'Tech Career Summit',                  org:'NJIT Alumni Network',          city:'Newark',        state:'NJ', lat:40.7282,  lng:-74.1776,                       deadline:'2026-03-28', tags:['Networking','Career Fair','Alumni'],         description:'Connect with 200+ NJIT alumni working at top tech companies.' },
  { id:'opp-13', type:'internship',  title:'Front-End Engineer Intern',           org:'Bloomberg LP',                 city:'New York',       state:'NY', lat:40.7527,  lng:-73.9772,  stipend:'$7,000/mo', deadline:'2026-05-15', tags:['React','TypeScript','Finance'],              description:'Build real-time financial data dashboards used by traders globally.' },
  { id:'opp-14', type:'scholarship', title:'Jackie Robinson Foundation',          org:'Jackie Robinson Foundation',   city:'New York',       state:'NY', lat:40.7484,  lng:-73.9967,  amount:'$7,500/yr',  deadline:'2026-04-01', tags:['Leadership','Minority','Undergraduate'],    description:'Full scholarship for minority students demonstrating leadership.' },
  { id:'opp-15', type:'networking',  title:'FinTech Innovation Forum',            org:'NY FinTech Week',              city:'New York',       state:'NY', lat:40.7061,  lng:-74.0087,                       deadline:'2026-04-22', tags:['FinTech','Blockchain','Networking'],         description:'Connect with leaders transforming global financial services.' },
  { id:'opp-16', type:'internship',  title:'AI Research Intern',                  org:'Two Sigma',                    city:'New York',       state:'NY', lat:40.7211,  lng:-74.0063,  stipend:'$9,000/mo', deadline:'2026-04-28', tags:['ML','Quant','Python','Research'],            description:'Apply ML models to quantitative trading strategies.' },
  { id:'opp-17', type:'scholarship', title:'Rutgers STEM Diversity Award',        org:'Rutgers University',           city:'New Brunswick',  state:'NJ', lat:40.4774,  lng:-74.4367,  amount:'$4,500/yr',  deadline:'2026-05-10', tags:['STEM','Diversity','NJ Resident'],           description:'Supporting underrepresented students at Rutgers School of Engineering.' },
  // ── Mid-Atlantic / DC ──────────────────────────────────────────
  { id:'opp-8',  type:'internship',  title:'Cybersecurity Analyst Intern',        org:'Booz Allen Hamilton',          city:'Washington',    state:'DC', lat:38.9072,  lng:-77.0369,  stipend:'$5,500/mo', deadline:'2026-04-10', tags:['Cybersecurity','Clearance','Government'],   description:'Support federal clients with vulnerability assessments and incident response.' },
  { id:'opp-18', type:'networking',  title:'AFCEA NOVA Spring Conference',        org:'AFCEA',                        city:'Washington',    state:'DC', lat:38.8951,  lng:-77.0364,                       deadline:'2026-04-14', tags:['Defense','IT','Government'],                description:'Networking event for cyber and IT professionals supporting national security.' },
  { id:'opp-19', type:'scholarship', title:'Congressional Hispanic Caucus',       org:'CHCI',                         city:'Washington',    state:'DC', lat:38.8897,  lng:-76.9874,  amount:'$5,000',     deadline:'2026-04-15', tags:['Hispanic','Leadership','DC'],               description:'Full scholarship + internship placement for Hispanic students.' },
  { id:'opp-20', type:'internship',  title:'Policy Tech Fellow',                  org:'Georgetown University',        city:'Washington',    state:'DC', lat:38.9076,  lng:-77.0723,  stipend:'$3,500/mo', deadline:'2026-05-01', tags:['Policy','Tech','Graduate'],                 description:'Bridge technology and public policy at Georgetown Law.' },
  { id:'opp-21', type:'internship',  title:'Software Engineer Intern',            org:'Leidos',                       city:'Arlington',     state:'VA', lat:38.8816,  lng:-77.0910,  stipend:'$5,200/mo', deadline:'2026-04-30', tags:['Defense','Java','Clearance'],               description:'Develop mission-critical software systems for DoD contracts.' },
  { id:'opp-22', type:'scholarship', title:'SMART Scholarship',                   org:'Dept. of Defense',             city:'Arlington',     state:'VA', lat:38.8681,  lng:-77.0560,  amount:'$25,000/yr', deadline:'2026-12-01', tags:['STEM','DoD','Full Ride'],                   description:'Full-ride scholarship + guaranteed DoD employment after graduation.' },
  // ── Boston / New England ───────────────────────────────────────
  { id:'opp-9',  type:'networking',  title:'IEEE ComSoc Spring Symposium',        org:'IEEE',                         city:'Boston',        state:'MA', lat:42.3601,  lng:-71.0589,                       deadline:'2026-04-18', tags:['IEEE','ECE','Research'],                    description:'Annual IEEE communications symposium open to student members.' },
  { id:'opp-23', type:'internship',  title:'Biotech Research Intern',             org:'Biogen',                       city:'Cambridge',     state:'MA', lat:42.3736,  lng:-71.1097,  stipend:'$5,000/mo', deadline:'2026-04-25', tags:['Biotech','Research','Life Sciences'],       description:'Support drug discovery pipelines at a world-leading biotech firm.' },
  { id:'opp-24', type:'scholarship', title:'MIT THINK Scholars Program',          org:'MIT',                          city:'Cambridge',     state:'MA', lat:42.3601,  lng:-71.0942,  amount:'$1,000',     deadline:'2026-01-15', tags:['Research','STEM','High School'],            description:'Funding and mentorship for exceptional STEM research projects.' },
  { id:'opp-25', type:'networking',  title:'Boston HubWeek Innovation Summit',   org:'HubWeek',                      city:'Boston',        state:'MA', lat:42.3467,  lng:-71.0972,                       deadline:'2026-06-10', tags:['Innovation','Startups','Boston'],           description:'Annual gathering of Boston\'s innovation, arts, and science communities.' },
  // ── Southeast ──────────────────────────────────────────────────
  { id:'opp-12', type:'networking',  title:'Women in Tech Summit',                org:'AnitaB.org',                   city:'Orlando',       state:'FL', lat:28.5383,  lng:-81.3792,                       deadline:'2026-05-20', tags:['Women in Tech','Grace Hopper','Diversity'], description:'The world\'s largest gathering of women technologists.' },
  { id:'opp-26', type:'internship',  title:'Cloud Platform Intern',               org:'Ultimate Kronos Group',        city:'Atlanta',       state:'GA', lat:33.7490,  lng:-84.3880,  stipend:'$4,800/mo', deadline:'2026-05-05', tags:['Cloud','HR Tech','Java'],                   description:'Build and scale cloud-native HR software platforms.' },
  { id:'opp-27', type:'scholarship', title:'Ron Brown Scholar Program',           org:'Ron Brown Scholar Fund',       city:'Charlotte',     state:'NC', lat:35.2271,  lng:-80.8431,  amount:'$10,000/yr', deadline:'2026-01-09', tags:['African American','Leadership','Merit'],    description:'Scholarship for African American students with leadership excellence.' },
  { id:'opp-28', type:'networking',  title:'Miami Tech & Innovation Week',        org:'Venture Miami',                city:'Miami',         state:'FL', lat:25.7617,  lng:-80.1918,                       deadline:'2026-06-15', tags:['LatAm Tech','Startups','Miami'],            description:'Connecting Miami\'s growing tech ecosystem with global investors.' },
  { id:'opp-29', type:'internship',  title:'Software Dev Intern',                 org:'Raytheon Technologies',        city:'Tampa',         state:'FL', lat:27.9506,  lng:-82.4572,  stipend:'$4,600/mo', deadline:'2026-04-20', tags:['Aerospace','C++','Defense'],                description:'Work on guidance and control software for aerospace systems.' },
  { id:'opp-30', type:'scholarship', title:'Gates Millennium Scholars',           org:'Gates Foundation',             city:'Nashville',     state:'TN', lat:36.1627,  lng:-86.7816,  amount:'Full Ride',  deadline:'2026-01-14', tags:['STEM','Minority','Full Ride'],              description:'Full cost-of-attendance scholarship for outstanding minority students.' },
  // ── Midwest ────────────────────────────────────────────────────
  { id:'opp-7',  type:'scholarship', title:'Hispanic Scholarship Fund',           org:'HSF',                          city:'Chicago',       state:'IL', lat:41.8781,  lng:-87.6298,  amount:'$5,000',     deadline:'2026-05-15', tags:['Hispanic/Latino','Undergraduate','Graduate'],description:'Supporting Hispanic American students achieving their higher education goals.' },
  { id:'opp-31', type:'internship',  title:'Mechanical Engineering Co-op',        org:'Caterpillar',                  city:'Peoria',        state:'IL', lat:40.6936,  lng:-89.5890,  stipend:'$4,200/mo', deadline:'2026-04-15', tags:['MechE','CAD','Manufacturing'],              description:'Hands-on product development experience with heavy equipment.' },
  { id:'opp-32', type:'networking',  title:'Big Ten Career Consortium Fair',      org:'Big Ten Alliance',             city:'Chicago',       state:'IL', lat:41.8827,  lng:-87.6278,                       deadline:'2026-03-30', tags:['Engineering','Career Fair','Big Ten'],      description:'Multi-university career fair featuring 200+ employers.' },
  { id:'opp-33', type:'internship',  title:'Embedded Systems Intern',             org:'Rockwell Automation',          city:'Milwaukee',     state:'WI', lat:43.0389,  lng:-87.9065,  stipend:'$4,500/mo', deadline:'2026-05-01', tags:['Embedded','C','PLC','Automation'],           description:'Design firmware for industrial automation controllers.' },
  { id:'opp-34', type:'scholarship', title:'Midwest STEM Scholars',               org:'Midwestern STEM Foundation',   city:'Columbus',      state:'OH', lat:39.9612,  lng:-82.9988,  amount:'$6,000',     deadline:'2026-04-01', tags:['STEM','Ohio','Undergraduate'],              description:'Funding for Ohio-based STEM undergraduates.' },
  { id:'opp-35', type:'networking',  title:'Detroit Auto Tech Summit',            org:'SAE International',            city:'Detroit',       state:'MI', lat:42.3314,  lng:-83.0458,                       deadline:'2026-04-29', tags:['Automotive','EV','Engineering'],            description:'Annual gathering of auto industry engineers and tech executives.' },
  { id:'opp-36', type:'internship',  title:'Data Analytics Intern',               org:'Target Corporation',           city:'Minneapolis',   state:'MN', lat:44.9778,  lng:-93.2650,  stipend:'$5,100/mo', deadline:'2026-04-18', tags:['Data','Retail','Python','SQL'],             description:'Use data to drive product placement and supply chain decisions.' },
  // ── Texas ──────────────────────────────────────────────────────
  { id:'opp-11', type:'scholarship', title:'NSBE Scholarship Program',            org:'NSBE',                         city:'Austin',        state:'TX', lat:30.2672,  lng:-97.7431,  amount:'$3,000',     deadline:'2026-06-01', tags:['NSBE','Engineering','HBCU'],                description:'Empowering Black engineering students with financial support and mentorship.' },
  { id:'opp-37', type:'internship',  title:'Network Engineering Intern',          org:'AT&T',                         city:'Dallas',        state:'TX', lat:32.7767,  lng:-96.7970,  stipend:'$5,400/mo', deadline:'2026-04-22', tags:['Networking','Telecom','5G'],                description:'Support 5G network design and deployment planning teams.' },
  { id:'opp-38', type:'networking',  title:'South by Southwest (SXSW) Edu',      org:'SXSW',                         city:'Austin',        state:'TX', lat:30.2649,  lng:-97.7341,                       deadline:'2026-03-07', tags:['EdTech','Startups','SXSW'],                 description:'Where education meets innovation — panels, pitches, and networking.' },
  { id:'opp-39', type:'internship',  title:'Petroleum Engineer Intern',           org:'ExxonMobil',                   city:'Houston',       state:'TX', lat:29.7604,  lng:-95.3698,  stipend:'$6,000/mo', deadline:'2026-05-01', tags:['Petroleum','ChemE','Energy'],               description:'Work on production optimization for offshore and onshore wells.' },
  { id:'opp-40', type:'scholarship', title:'Texas Excellence Award',              org:'Univ. of Texas System',        city:'Houston',       state:'TX', lat:29.7219,  lng:-95.3421,  amount:'$3,500',     deadline:'2026-04-30', tags:['Texas','STEM','Merit'],                     description:'Merit scholarship for outstanding STEM students in the Texas system.' },
  // ── Mountain West / Southwest ──────────────────────────────────
  { id:'opp-41', type:'internship',  title:'Aerospace Systems Intern',            org:'Lockheed Martin',              city:'Denver',        state:'CO', lat:39.7392,  lng:-104.9903, stipend:'$5,800/mo', deadline:'2026-04-12', tags:['Aerospace','Systems','MATLAB'],             description:'Systems engineering support for next-gen satellite programs.' },
  { id:'opp-42', type:'networking',  title:'Rocky Mountain Diversity Summit',     org:'Out in Science & Engineering', city:'Denver',        state:'CO', lat:39.7505,  lng:-104.9963,                       deadline:'2026-05-15', tags:['LGBTQ+','Diversity','Engineering'],          description:'Career and networking summit for LGBTQ+ STEM professionals.' },
  { id:'opp-43', type:'scholarship', title:'Navajo Nation STEM Scholarship',      org:'Navajo Nation',                city:'Albuquerque',   state:'NM', lat:35.0853,  lng:-106.6056, amount:'$4,000',     deadline:'2026-04-01', tags:['Native American','STEM','NM'],              description:'Funding for Navajo Nation citizens pursuing STEM degrees.' },
  { id:'opp-44', type:'internship',  title:'Semiconductor Process Intern',        org:'Intel',                        city:'Phoenix',       state:'AZ', lat:33.4484,  lng:-112.0740, stipend:'$5,600/mo', deadline:'2026-04-20', tags:['Semiconductor','ChemE','Manufacturing'],    description:'Support 3nm chip fabrication process engineering at Intel Fab 52.' },
  { id:'opp-45', type:'networking',  title:'Vegas Tech Startup Pitch Night',      org:'Vegas Tech Fund',              city:'Las Vegas',     state:'NV', lat:36.1699,  lng:-115.1398,                       deadline:'2026-05-01', tags:['Startups','VC','Pitch'],                    description:'Monthly startup pitch event connecting founders with Nevada investors.' },
  // ── California ─────────────────────────────────────────────────
  { id:'opp-4',  type:'scholarship', title:'Google Generation Scholarship',       org:'Google',                       city:'San Francisco',  state:'CA', lat:37.7749,  lng:-122.4194, amount:'$10,000',    deadline:'2026-04-30', tags:['Underrepresented','CS','Juniors'],          description:'Supporting students from underrepresented groups pursuing degrees in CS.' },
  { id:'opp-10', type:'internship',  title:'Product Management Intern',           org:'Meta',                         city:'Menlo Park',    state:'CA', lat:37.4530,  lng:-122.1817, stipend:'$8,000/mo', deadline:'2026-05-10', tags:['Product','MBA','UX'],                       description:'Drive product strategy and roadmap for consumer social experiences.' },
  { id:'opp-46', type:'internship',  title:'Hardware Engineer Intern',            org:'Apple',                        city:'Cupertino',     state:'CA', lat:37.3230,  lng:-122.0322, stipend:'$8,500/mo', deadline:'2026-04-25', tags:['Hardware','EE','SoC'],                      description:'Design and validate silicon for next-generation Apple devices.' },
  { id:'opp-47', type:'networking',  title:'Grace Hopper Celebration',            org:'AnitaB.org',                   city:'San Jose',      state:'CA', lat:37.3382,  lng:-121.8863,                       deadline:'2026-08-01', tags:['Women','CS','Conference'],                  description:'The world\'s largest gathering of women in computing — scholarships available.' },
  { id:'opp-48', type:'scholarship', title:'Silicon Valley STEM Award',           org:'SVForum',                      city:'San Jose',      state:'CA', lat:37.3541,  lng:-121.9552, amount:'$5,000',     deadline:'2026-05-01', tags:['STEM','Silicon Valley','Diversity'],         description:'Recognizing exceptional STEM students in Silicon Valley.' },
  { id:'opp-49', type:'internship',  title:'Autonomous Vehicle SW Intern',        org:'Waymo',                        city:'Mountain View', state:'CA', lat:37.3861,  lng:-122.0839, stipend:'$9,500/mo', deadline:'2026-05-15', tags:['AV','C++','ROS','ML'],                      description:'Develop perception and planning software for Waymo\'s robotaxi fleet.' },
  { id:'opp-50', type:'internship',  title:'Cloud Infrastructure Intern',         org:'Netflix',                      city:'Los Gatos',     state:'CA', lat:37.2358,  lng:-121.9624, stipend:'$8,200/mo', deadline:'2026-04-30', tags:['Cloud','AWS','Distributed Systems'],        description:'Improve the infrastructure that streams to 260M subscribers worldwide.' },
  { id:'opp-51', type:'networking',  title:'LA Tech Week Hackathon',              org:'LA Tech Week',                 city:'Los Angeles',   state:'CA', lat:34.0522,  lng:-118.2437,                       deadline:'2026-06-01', tags:['Hackathon','LA','Startups'],                description:'48-hour hackathon at the heart of LA\'s booming tech scene.' },
  { id:'opp-52', type:'scholarship', title:'California Community Foundation',     org:'CCF',                          city:'Los Angeles',   state:'CA', lat:34.0407,  lng:-118.2468, amount:'$6,000',     deadline:'2026-03-31', tags:['California','Underrepresented','College'],  description:'Scholarships for first-generation and low-income CA college students.' },
  // ── Pacific Northwest ──────────────────────────────────────────
  { id:'opp-5',  type:'internship',  title:'Data Science Intern',                 org:'Microsoft',                    city:'Seattle',       state:'WA', lat:47.6062,  lng:-122.3321, stipend:'$6,800/mo', deadline:'2026-04-20', tags:['Data Science','Azure','Python','ML'],       description:'Work on AI/ML products and data pipelines within the Azure team.' },
  { id:'opp-53', type:'internship',  title:'Robotics Software Intern',            org:'Amazon Robotics',              city:'Seattle',       state:'WA', lat:47.6205,  lng:-122.3493, stipend:'$7,200/mo', deadline:'2026-04-18', tags:['Robotics','Python','ROS'],                  description:'Program autonomous robots operating in Amazon\'s fulfillment centers.' },
  { id:'opp-54', type:'scholarship', title:'Boeing Engineering Scholarship',      org:'Boeing',                       city:'Renton',        state:'WA', lat:47.4829,  lng:-122.2171, amount:'$7,500',     deadline:'2026-04-01', tags:['Aerospace','Engineering','Boeing'],          description:'Funding for aerospace engineering students across the US.' },
  { id:'opp-55', type:'networking',  title:'Portland Tech Meetup Series',         org:'PDX Tech',                     city:'Portland',      state:'OR', lat:45.5051,  lng:-122.6750,                       deadline:'2026-05-10', tags:['Networking','Startups','PDX'],              description:'Monthly tech meetups across Portland\'s growing startup scene.' },
  // ── Alaska / Hawaii ────────────────────────────────────────────
  { id:'opp-56', type:'scholarship', title:'Pacific Islander STEM Award',         org:'APIASF',                       city:'Honolulu',      state:'HI', lat:21.3069,  lng:-157.8583, amount:'$5,000',     deadline:'2026-05-31', tags:['API','STEM','Hawaii'],                      description:'Empowering Asian Pacific Islander students in STEM fields.' },
  { id:'opp-57', type:'internship',  title:'Arctic Engineering Intern',           org:'Alaska Native Tribal Health',  city:'Anchorage',     state:'AK', lat:61.2181,  lng:-149.9003, stipend:'$4,000/mo', deadline:'2026-05-01', tags:['Civil','Arctic','Alaska'],                  description:'Infrastructure engineering in Alaska\'s unique arctic conditions.' },
];

export type FilterType = OpportunityType | 'all';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function useOpportunities() {
  const [filter,     setFilter]     = useState<FilterType>('all');
  const [tracked,    setTracked]    = useState<TrackedApplication[]>([]);
  const [activeId,   setActiveId]   = useState<string | null>(null);
  const [apiOpps,    setApiOpps]    = useState<Opportunity[]>([]);

  // Fetch scraped opportunities from the backend
  useEffect(() => {
    fetch(`${API}/api/opportunities?limit=300`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((rows: Opportunity[]) => setApiOpps(rows))
      .catch(() => { /* silently fall back to mock data only */ });
  }, []);

  // Merge: api data first (newer/richer), then mock data for any ids not already present
  const allOpportunities = useMemo<Opportunity[]>(() => {
    const apiIds = new Set(apiOpps.map(o => o.id));
    const mockOnly = MOCK_OPPORTUNITIES.filter(o => !apiIds.has(o.id));
    return [...apiOpps, ...mockOnly];
  }, [apiOpps]);

  const filtered = useMemo(() =>
    filter === 'all'
      ? allOpportunities
      : allOpportunities.filter(o => o.type === filter),
    [filter, allOpportunities],
  );

  const counts = useMemo(() => ({
    all:         allOpportunities.length,
    scholarship: allOpportunities.filter(o => o.type === 'scholarship').length,
    internship:  allOpportunities.filter(o => o.type === 'internship').length,
    networking:  allOpportunities.filter(o => o.type === 'networking').length,
  }), [allOpportunities]);

  function trackApplication(opportunityId: string, status: ApplicationStatus) {
    setTracked(prev => {
      const existing = prev.findIndex(t => t.opportunityId === opportunityId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], status };
        return next;
      }
      return [...prev, { opportunityId, status, appliedDate: new Date().toISOString() }];
    });
  }

  function getTracked(opportunityId: string): TrackedApplication | undefined {
    return tracked.find(t => t.opportunityId === opportunityId);
  }

  async function createOpportunity(input: CreateOpportunityInput, token: string) {
    const res = await fetch(`${API}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.error ?? 'Could not create opportunity');
    }

    const created = payload as Opportunity;
    setApiOpps(prev => [created, ...prev.filter((opp) => opp.id !== created.id)]);
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
  };
}
