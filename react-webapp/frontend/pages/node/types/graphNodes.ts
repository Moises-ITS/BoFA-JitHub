export interface NodeDetails {
  major?:      string;
  year?:       string;
  gpa?:        string;
  goal?:       string;
  company?:    string;
  role?:       string;
  year_grad?:  string;
  research?:   string;
  open_roles?: string;
  focus?:      string;
  members?:    string;
}

export type NodeType = "student" | "club" | "company" | "professor";

export interface GraphNode {
  id:      string;
  label:   string;
  type:    NodeType;
  details: NodeDetails;
  r?:  number;
  x?:  number;
  y?:  number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  rel:    string;
}
