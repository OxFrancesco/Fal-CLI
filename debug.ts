import { fal } from "@fal-ai/client";
import { config } from "dotenv";

config();

async function testGeneration() {
    console.log("Checking FAL_KEY...");
    if (!process.env.FAL_KEY) {
        console.error("❌ FAL_KEY is missing in .env");
        return;
    }
    console.log("✅ FAL_KEY found");

    const model = "fal-ai/flux/dev";
    const prompt = "A cute cat";
    const image_size = "square_hd";

    console.log(`Starting generation test for ${model}...`);
    console.log(`Prompt: ${prompt}`);
    console.log(`Image Size: ${image_size}`);

    try {
        const result: any = await fal.subscribe(model, {
            input: {
                prompt,
                image_size,
            },
            logs: true,
            onQueueUpdate: (update) => {
                console.log("Queue update:", update.status);
                if (update.logs) {
                    update.logs.forEach(l => console.log("Remote log:", l.message));
                }
            },
        });

        console.log("Generation result:", JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error("❌ Generation failed:", error);
        if (error.body) {
            console.error("Error body:", error.body);
        }
    }
}

testGeneration();
