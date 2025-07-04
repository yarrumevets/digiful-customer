import crypto from "crypto";
import { gqlClient, gqlClientPublic, gqlOrderQuery } from "./graphql.js";
import shopifyConfig from "./shopify.secret.js";
import { raw } from "express";

// Custom App:
const verifyShopifyOrder = async (orderId) => {
  const orderVerificationData = await gqlClient.request(gqlOrderQuery, {
    orderId: `gid://shopify/Order/${orderId}`,
  });
  console.log("Order Verification Data: ", orderVerificationData);
  return orderVerificationData.displayFinancialStatus === "PAID";
};
// Public (Partners) App:
const verifyShopifyOrderPublic = async (orderId, storeId) => {
  //@TODO: use the store id here to grab the admin api access token and pass it to the gql client
  // DO DB STUFF HERE . . .

  const orderVerificationData = await gqlClientPublic().request(gqlOrderQuery, {
    orderId: `gid://shopify/Order/${orderId}`,
  });
  console.log("Order Verification Data: ", orderVerificationData);
  return orderVerificationData.displayFinancialStatus === "PAID";
};

function verifyShopifyWebhook(rawBody, reqHeaders) {
  console.log("verifyShopifyWebhook - RAW Body: ", rawBody);
  console.log("verifyShopifyWebhook - Req headers: ", reqHeaders);

  const hmac = reqHeaders["x-shopify-hmac-sha256"];
  if (!hmac) {
    console.error("NO HMAC header.");
    return false;
  }
  const digest = crypto
    .createHmac("sha256", shopifyConfig.apiSecretKey)
    .update(rawBody)
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(hmac, "base64"),
    Buffer.from(digest, "base64")
  );
}

function verifyShopifyWebhookPartners(rawBody, reqHeaders) {
  console.log("verifyShopifyWebhook - RAW Body: ", rawBody);
  console.log("verifyShopifyWebhook - Req headers: ", reqHeaders);

  const hmac = reqHeaders["x-shopify-hmac-sha256"];
  if (!hmac) {
    console.error("NO HMAC header.");
    return false;
  }
  const digest = crypto
    .createHmac("sha256", shopifyConfig.digiful.clientSecret)
    .update(rawBody)
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(hmac, "base64"),
    Buffer.from(digest, "base64")
  );
}

export {
  verifyShopifyOrder,
  verifyShopifyWebhook,
  verifyShopifyWebhookPartners,
  verifyShopifyOrderPublic,
};
