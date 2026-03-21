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
  amount?:     string;
  stipend?:    string;
  deadline?:   string;
  matchPct:    number;
  tags:        string[];
  description: string;
}

export interface TrackedApplication {
  opportunityId: string;
  status:        ApplicationStatus;
  appliedDate?:  string;
  notes?:        string;
}
