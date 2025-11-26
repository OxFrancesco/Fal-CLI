import { fal } from "@fal-ai/client";
import * as fs from "fs";
import * as path from "path";

// Configure fal client with API key (Bun auto-loads .env)
if (process.env.FAL_KEY) {
    fal.config({ credentials: process.env.FAL_KEY });
}

export interface GenerationResult {
  url: string;
  contentType: string;
}

export async function generateMedia(
  modelId: string,
  prompt: string,
  aspectRatio: string,
  onLog: (log: string) => void
): Promise<GenerationResult | null> {
  try {
    onLog(`Starting generation with model: ${modelId}`);

    if (!process.env.FAL_KEY) {
      onLog("Error: FAL_KEY not set in .env");
      return null;
    }

    const inputArgs: any = {
      prompt,
    };

    // Handle parameter differences
    if (modelId.includes("flux") || modelId.includes("recraft")) {
      inputArgs.image_size = aspectRatio;
    } else {
      inputArgs.aspect_ratio = aspectRatio;
    }

    const result: any = await fal.subscribe(modelId, {
      input: inputArgs,
      logs: false, // Disable stdout logs to prevent TUI corruption
      onQueueUpdate: (update) => {
        if (update.status === "IN_QUEUE") {
          onLog(`In queue: ${update.queue_position}`);
        } else if (update.status === "IN_PROGRESS") {
          if (update.logs) {
            update.logs.map((log) => log.message).forEach(onLog);
          }
        }
      },
    });

    onLog("Generation complete!");

    // Handle different response structures
    const images = result.images || result.data?.images;
    const video = result.video || result.data?.video;

    if (images && images.length > 0) {
      return {
        url: images[0].url,
        contentType: images[0].content_type || "image/jpeg",
      };
    } else if (video) {
      return {
        url: video.url,
        contentType: video.content_type || "video/mp4",
      }
    }

    onLog(`Result structure unknown: ${JSON.stringify(result).substring(0, 100)}...`);
    return null;
  } catch (error: any) {
    onLog(`Error: ${error.message || JSON.stringify(error)}`);
    return null;
  }
}

export async function downloadMedia(url: string, extension: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `output-${timestamp}.${extension}`;
  const filepath = path.join(process.cwd(), filename);

  fs.writeFileSync(filepath, Buffer.from(buffer));
  return filepath;
}
