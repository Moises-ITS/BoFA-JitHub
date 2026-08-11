export type OpportunityType = 'scholarship' | 'internship' | 'networking';

// Canonical type → display icon map. Lives here (next to OpportunityType) so
// every surface that renders an opportunity — listing cards, the home page's
// spotlight card, the profile page — shows the SAME icon for the same type.
// Keyed by OpportunityType (not string) so adding a new type to the union
// forces this map to be updated too, at compile time.
export const OPPORTUNITY_TYPE_ICON: Record<OpportunityType, string> = {
  scholarship: '🎓',
  internship:  '💼',
  networking:  '🤝',
};

export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

export interface Opportunity {
  id:          string;
  type:        OpportunityType;
  title:       string;
  org:         string;
  city:        string;
  state:       string;
  lat:         number;
  lng:         number;
  // Optional mapping back to a Research District (ai, cyber, engineering, bio, data)
  districtId?: string;
  amount?:     string;
  stipend?:    string;
  deadline?:   string;
  tags:        string[];
  description: string;
  url?:        string;
  matchPct?:   number;
}

export interface CreateOpportunityInput {
  type: OpportunityType;
  title: string;
  org: string;
  city: string;
  state: string;
  amount?: string;
  stipend?: string;
  deadline?: string;
  tags: string[];
  description: string;
  url?: string;
}

export interface TrackedApplication {
  opportunityId: string;
  status:        ApplicationStatus;
  appliedDate?:  string;
  notes?:        string;
}
