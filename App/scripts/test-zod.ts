import { imageResourcesSchema } from '../shared/schemas.js';

const testUrls = [
  'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
];

testUrls.forEach(url => {
  const result = imageResourcesSchema.safeParse({ logoStatic: url });
  console.log(`URL: "${url.substring(0, 20)}..."`);
  if (!result.success) {
    console.log(`  Error:`, JSON.stringify(result.error.issues));
  } else {
    console.log(`  Success`);
  }
});
