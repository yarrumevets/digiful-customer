import "dotenv/config";
import crypto from "crypto";

// HMAC (Hash-based Message Authentication Code)
// Verifies data integrity and authenticity using a shared secret key and a hash function.
const verifyShopifyWebhook = (rawBody, reqHeaders) => {
  const hmac = reqHeaders["x-shopify-hmac-sha256"];
  if (!hmac) {
    console.error("NO HMAC header.");
    return false;
  }
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_HMAC_SECRET)
    .update(rawBody)
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(hmac, "base64"),
    Buffer.from(digest, "base64")
  );
};

export { verifyShopifyWebhook };
