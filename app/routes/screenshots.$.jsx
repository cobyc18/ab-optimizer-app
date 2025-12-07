import { readFile } from "fs/promises";
import { join } from "path";
import { json } from "@remix-run/node";

export async function loader({ params, request }) {
  const filename = params["*"];
  
  if (!filename) {
    return json({ error: "Filename required" }, { status: 400 });
  }

  try {
    const filePath = join(process.cwd(), "public", "screenshots", filename);
    const fileBuffer = await readFile(filePath);
    
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

