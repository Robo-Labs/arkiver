import path from "node:path";
import fs from "node:fs";

export const reexportSchema = ({ manifestPath }: { manifestPath: string }) => {
  const content = `const manifest = require("${manifestPath}").default; module.exports = { ...manifest.manifest.schema };`;

  const schemaPath = path.join(process.cwd(), "__schema.ts");

  fs.writeFileSync(schemaPath, content);

  const deleteFile = () => {
    fs.rmSync(schemaPath);
  };

  return { deleteFile, schemaPath };
};
