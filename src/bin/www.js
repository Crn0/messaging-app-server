import "dotenv/config";
import http from "http";
import path, { dirname } from "path";
import debugFunc from "debug";
import { fileURLToPath } from "url";
import app from "../app.js";
import constants from "../constants/index.js";
import cleanup from "../helpers/cleanups/index.js";

// eslint-disable-next-line no-underscore-dangle
const __dirname =
  import.meta.dirname || dirname(fileURLToPath(import.meta.url));
const dirnameArrays = path.resolve(__dirname, "..", "..").split(path.sep);
const debug = debugFunc(`${dirnameArrays[dirnameArrays.length - 1]}:server`);
const port = constants.env.PORT;

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? `Pipe ${port}` : `Port ${port}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening(server) {
  return () => {
    const addr = server.address();
    const bind =
      typeof addr === "string" ? `pipe ${addr}` : `port ${addr.port}`;
    debug(`Listening on ${bind}`);
  };
}

app.set("port", port);

const server = http.createServer(app);

server.listen(port);
server.on("error", onError);
server.on("listening", onListening(server));

process.stdin.resume();
/**
 *  remove the uploaded image when the server closed
 */
[
  `exit`,
  `SIGINT`,
  `SIGUSR1`,
  `SIGUSR2`,
  `uncaughtException`,
  `SIGTERM`,
].forEach((eventType) => {
  process.on(eventType, async () => {
    try {
      await cleanup.images(__dirname);
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
});
