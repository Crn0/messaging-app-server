import { join } from "path";
import { readdir, unlink } from "fs/promises";

const removeTempImages = async (dirname) => {
  const path = join(dirname, "..", "temp", "images");

  const dir = await readdir(path);

  await Promise.all(
    dir.map(async (fileName) => {
      const filePath = `${path}/${fileName}`;

      if (fileName === ".gitkeep") return;

      await unlink(filePath);
    })
  );
};

export default removeTempImages;
