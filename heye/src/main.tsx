import {createRoot} from "react-dom/client";
import Journal from "./Journal";
import {todayCN} from "./types";
createRoot(document.getElementById("root")!).render(<Journal initialDay={todayCN()}/>);
