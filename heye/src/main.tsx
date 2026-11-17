import { createRoot } from "react-dom/client";
import Journal from "./Journal";
import { todayCN } from "./types";
import { Recovery } from "./Recovery";
const token = new URLSearchParams(location.hash.slice(1)).get("reset");
if (token) history.replaceState(history.state,"",location.pathname + location.search);
createRoot(document.getElementById("root")!).render(
  token ? <main className="entryPage"><Recovery token={token}/></main> : <Journal initialDay={todayCN()} />,
);
