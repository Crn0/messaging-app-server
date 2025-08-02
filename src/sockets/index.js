import Debug from "debug";

import V1 from "../v1/sockets/index.js";

const debug = Debug("app:socket:registry");

const VERSIONS = { V1 };

export default (io, app) => {
  Object.entries(VERSIONS).forEach(([version, handlers]) => {
    Object.entries(handlers).forEach(([name, registerNamespace]) => {
      try {
        debug(`version: ${version} registering ${name}`);

        const namespace = registerNamespace(io);

        app.set(`namespace:${version}:${name}`, namespace);
      } catch (error) {
        debug(`version: ${version} error in ${name}:`, error);
      }
    });
  });
};
