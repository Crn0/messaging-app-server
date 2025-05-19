const tryCatchAsync = async (
  promise,
  onFinally = () => {},
  debug = () => {}
) => {
  const thing = typeof promise === "function" ? promise() : promise;

  try {
    const data = await thing;

    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  } finally {
    await Promise.resolve(onFinally()).catch(debug);
  }
};

export default tryCatchAsync;
