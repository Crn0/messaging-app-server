import { join } from "path";

const attachment = {
  avatar: join(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "assets",
    "test_avatar.png"
  ),
  backgroundAvatar: join(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "assets",
    "test_background_avatar.jpg"
  ),
  catGif: join(import.meta.dirname, "..", "..", "..", "assets", "test_cat.gif"),
};

export default attachment;
