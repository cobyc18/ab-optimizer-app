import { readFile } from "fs/promises";
import { join } from "path";
import { json } from "@remix-run/node";

export async function loader({ params, request }) {
  const filename = params["*"];
  
  if (!filename) {
    return json({ error: "Filename required" }, { status: 400 });
  }

  try {
    // Try app/assets first (for production), then fallback to public/screenshots
    const appAssetsPath = join(process.cwd(), "app", "assets", filename);
    const publicScreenshotsPath = join(process.cwd(), "public", "screenshots", filename);
    
    let filePath;
    let fileBuffer;
    
    try {
      fileBuffer = await readFile(appAssetsPath);
      filePath = appAssetsPath;
    } catch (appError) {
      try {
        fileBuffer = await readFile(publicScreenshotsPath);
        filePath = publicScreenshotsPath;
      } catch (publicError) {
        throw new Error(`File not found in app/assets or public/screenshots: ${filename}`);
      }
    }
    
    // Determine content type based on file extension
    const contentType = filename.endsWith(".png") 
      ? "image/png" 
      : filename.endsWith(".jpg") || filename.endsWith(".jpeg")
      ? "image/jpeg"
      : "application/octet-stream";

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving screenshot:", error);
    return json({ error: "File not found" }, { status: 404 });
  }
}

