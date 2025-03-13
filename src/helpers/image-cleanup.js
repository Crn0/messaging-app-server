import path from "path";
import { readdir, unlink } from "fs/promises";

export default async function images(dirname) {
  const res = await readdir(path.join(dirname, "..", "temp", "images"));

  res.forEach(async (fileName) => {
    const filePath = `${path.join(dirname, "..", "temp", "images")}/${fileName}`;

    if (fileName === ".gitkeep") return;

    await unlink(filePath);
  });
}
