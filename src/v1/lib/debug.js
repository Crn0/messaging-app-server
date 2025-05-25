import Debug from "debug";
import { env } from "../../constants/index.js";

const createDebug = (nameSpace) => Debug(`app:${nameSpace}`);

const envMap = {
  prod: true,
  production: true,
  test: true,
};

if (envMap[env.NODE_ENV]) {
  Debug.disable();
} else {
  Debug.enable("app:*");
}

export default createDebug;
