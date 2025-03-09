import constants from "../constants/index.js";

const corsOptions = {
  origin: constants.env.CORS_ORIGINS,
  methods: constants.env.CORS_METHODS,
  optionsSuccessStatus: 200,
};

export default corsOptions;
