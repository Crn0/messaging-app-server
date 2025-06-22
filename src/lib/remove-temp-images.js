import fs from "fs/promises";

const removeTempImages = async (path) => {
  const dir = await fs.readdir(path);

  await Promise.all(
    dir.map(async (fileName) => {
      const filePath = `${path}/${fileName}`;

      if (fileName === ".gitkeep") return;

      await fs.unlink(filePath);
    })
  );
};

export default removeTempImages;
