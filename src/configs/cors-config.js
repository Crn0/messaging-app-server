import { env } from "../constants/index.js";

const corsOptions = {
  origin: env.CORS_ORIGINS,
  methods: env.CORS_METHODS,
  credentials: true,
  optionsSuccessStatus: 200,
};

export default corsOptions;
