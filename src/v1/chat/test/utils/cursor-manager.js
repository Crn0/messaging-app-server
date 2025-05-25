import { defaultErrorMap } from "zod";

const createCursorManager = () => {
  const map = { after: null, before: null };

  const getCursor = (direction) => {
    if (direction === "forward") return { after: map.after };
    if (direction === "backward") return { before: map.before };

    return null;
  };

  const setCursor = (direction, pagination) => {
    const params = new URLSearchParams(pagination.nextHref.split("?")[1]);
    if (direction === "backward") {
      map.before = params.get("before");
    } else {
      map.after = params.get("after");
    }
  };

  return Object.freeze({ getCursor, setCursor });
};

export default createCursorManager;
