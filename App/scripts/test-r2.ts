import { listFiles } from '../server/services/storage.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  try {
    console.log("Testing R2 Connection...");
    console.log("Listing files in bucket...");
    const files = await listFiles();
    console.log("Files:", files.length);
    if (files.length > 0) {
      console.log(files.slice(0, 5));
    }
    
    console.log("R2 Connection Successful!");
  } catch (error) {
    console.error("R2 Connection Failed:", error);
  }
}

run();
