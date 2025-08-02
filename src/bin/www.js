import "dotenv/config";
import http from "http";
import Debug from "debug";
import { Server } from "socket.io";
import { env } from "../constants/index.js";
import initSocket from "../sockets/index.js";
import app from "../app.js";

const port = env.PORT;
const debug = env.NODE_ENV === "dev" ? Debug("app:server") : () => {};

const onError = (error) => {
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
};

const onListening = (server) => () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${addr.port}`;
  debug(`Listening on ${bind}`);
};

app.set("port", port);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGINS,
  },
});

initSocket(io, app);

app.set("io", io);

server.listen(port);
server.on("error", onError);
server.on("listening", onListening(server));
