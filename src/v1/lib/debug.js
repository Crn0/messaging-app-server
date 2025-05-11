import Debug from "debug";
import { env } from "../../constants/index.js";

const createDebug = (nameSpace) => Debug(`app:${nameSpace}`);

if (env.NODE_ENV === "prod") {
  Debug.disable();
} else {
  Debug.enable("app:*");
}

export default createDebug;
