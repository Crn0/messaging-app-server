/**
 * TODO:
 * Allow an optional callback (e.g. onFinally) to run after the promise settles
 * for cleanup, logging, or other side effects.
 *
 * Example usage:
 * const { error, data } = await tryCatchAsync(() => fetchData(), () => console.log("done"));
 */

const tryCatchAsync = async (promise) => {
  const thing = typeof promise === "function" ? promise() : promise;

  try {
    const data = await thing;

    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
};

export default tryCatchAsync;
