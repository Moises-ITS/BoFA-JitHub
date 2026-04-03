export type OpportunityType = 'scholarship' | 'internship' | 'networking';

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
