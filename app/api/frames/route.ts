// app/api/frames/route.ts

import fs from "fs";
import path from "path";

const folders = ["frame1", "frame2", "frame3", "frame4"];

export async function GET() {
  try {
    const baseCandidates = [
      path.join(process.cwd(), "public", "images"),
      path.join(process.cwd(), "public", "image"),
    ];

    const basePath = baseCandidates.find((p) => fs.existsSync(p));

    if (!basePath) {
      return Response.json(
        { sequences: [], error: "Base images directory not found" },
        { status: 404 }
      );
    }

    const sequences = folders.map((folder) => {
      const dirPath = path.join(basePath, folder);

      if (!fs.existsSync(dirPath)) {
        return {
          folder,
          count: 0,
          files: [],
          error: "Folder not found",
        };
      }

      const files = fs.readdirSync(dirPath);

      const imageFiles = files
        .filter((file) =>
          /\.(webp|png|jpg|jpeg)$/i.test(file)
        )
        .sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        );

      return {
        folder,
        count: imageFiles.length,
        files: imageFiles,
      };
    });

    const totalFrames = sequences.reduce(
      (acc, seq) => acc + seq.count,
      0
    );

    return Response.json({
      totalFrames,
      sequences,
    });
  } catch (error: any) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}