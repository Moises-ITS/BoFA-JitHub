export type Step = 'profile' | 'scan' | 'feed';

export type OpportunityType =
  | 'research'
  | 'internship'
  | 'job'
  | 'club'
  | 'fellowship'
  | 'ta';

export interface UserProfile {
  name: string;
  major: string;
  year: string;
  gpa: string;
  interests: string[];
}

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  type: OpportunityType;
  matchScore: number;
  deadline?: string;
  tags: string[];
  description: string;
  location: string;
  applied: boolean;
  saved: boolean;
  postedDaysAgo: number;
}

export interface FilterState {
  types: Set<OpportunityType>;
  minMatch: number;
}

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  research:   'Research',
  internship: 'Internship',
  job:        'Full-time Job',
  club:       'Club / Org',
  fellowship: 'Fellowship',
  ta:         'TA / Grader',
};

export const INTEREST_OPTIONS = [
  'Machine Learning',
  'Web Development',
  'Cybersecurity',
  'Data Science',
  'Robotics',
  'Cloud Computing',
  'Mobile Dev',
  'Bioinformatics',
];

export const MAJOR_OPTIONS = [
  'Computer Science',
  'Computer Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Biomedical Engineering',
  'Information Technology',
  'Data Science',
  'Mathematics',
  'Physics',
  'Business',
];
