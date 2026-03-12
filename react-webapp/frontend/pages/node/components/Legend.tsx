import { NodeType } from "../types/graphNodes";
import { TYPE_COLOR } from "../constants/maps";

export default function Legend() {
  return (
    <div className="legend">
      <div className="legendTitle">Node Types</div>
      {(["student", "professor", "company", "club"] as NodeType[]).map(type => (
        <div key={type} className="legendItem">
          <div style={{
            width:        10,
            height:       10,
            flexShrink:   0,
            borderRadius: type === "company" ? 2 : "50%",
            background:   TYPE_COLOR[type],
          }} />
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </div>
      ))}
    </div>
  );
}
