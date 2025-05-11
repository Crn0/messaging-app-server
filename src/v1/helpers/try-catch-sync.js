const tryCatchSync = (cb) => {
  try {
    const data = cb();

    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
};

export default tryCatchSync;
