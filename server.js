import express from "express";
import {
  getProductData,
  getOrderData,
  addOrder,
  addMerchant,
  getMerchantData,
} from "./db.js";
import { getS3ProductUrl } from "./s3.js";
import path from "path";
import { fileURLToPath } from "url";
import {
  verifyShopifyOrder,
  verifyShopifyWebhook,
  verifyShopifyWebhookPartners,
} from "./shopify.js";

const SERVER_PORT = 4199;
const app = express();
app.use(express.static("public"));

// Customer checkout webhooks:

// CUSTOM - Use this endpoint for custom apps
// @TODO: generate new curl command to register with this new path
app.post(
  "/webhooks/custom/orders-paid",
  express.raw({ type: "application/json" }),
  (req, res) => {
    console.log(`\x1b[32m🎉 Custom App Orders-Paid Webhook HIT! 🎉\x1b[0m`);
    const rawBody = req.body;
    let body;
    if (!verifyShopifyWebhook(rawBody, req.headers)) {
      console.error("Webhook not verified!");
      return res.sendStatus(200);
    }
    body = JSON.parse(rawBody.toString("utf-8"));
    const orderInfo = {
      orderId: String(body.id),
      orderNumber: String(body.order_number),
      customerId: String(body.customer.id),
      variantIds: body.line_items.map((item) => String(item.variant_id)),
    };
    addOrder(orderInfo);
    res.sendStatus(200);
  }
);

// PUBLIC - Use this endpoint for public (partners) apps
// @TODO: remove logging after tests.
app.post(
  "/webhooks/orders-paid",
  express.raw({ type: "application/json" }),
  (req, res) => {
    console.log(`\x1b[32m🎉 Public App Orders-Paid Webhook HIT! 🎉\x1b[0m`);
    const shopDomain = req.get("x-shopify-shop-domain");
    const rawBody = req.body;
    let body;
    if (!verifyShopifyWebhookPartners(rawBody, req.headers)) {
      console.error("Webhook not verified!");
      return res.sendStatus(200);
    }
    body = JSON.parse(rawBody.toString("utf-8"));
    console.log("BODY: ", body);
    const orderInfo = {
      orderId: String(body.id),
      orderNumber: String(body.order_number),
      customerId: String(body.customer?.id),
      customerEmail: body.customer?.email,
      shopDomain, // identify the shop
      variantIds: body.line_items.map((item) => String(item.variant_id)),
    };
    console.log("order info: ", orderInfo);
    console.log(`Saving order #${orderInfo.orderId}...`);
    addOrder(orderInfo);
    res.sendStatus(200);
  }
);

app.post(
  "/api/merchant",
  express.raw({ type: "application/json" }),
  (req, res) => {
    // look up existing merchant:

    // const merchantExists = getMerchantData()

    console.log(
      `------------------ \x1b[32m🎉 NEW MERCHANT INSTALL 🎉\x1b[0m ------------------`
    );

    console.log("req.body: ", req.body);

    res.status(200).send({ success: true });

    // const shopDomain = req.get("x-shopify-shop-domain");
    // const rawBody = req.body;
    // let body;
    // if (!verifyShopifyWebhookPartners(rawBody, req.headers)) {
    //   console.error("Webhook not verified!");
    //   return res.sendStatus(200);
    // }
    // body = JSON.parse(rawBody.toString("utf-8"));
    // console.log("BODY: ", body);
    // const orderInfo = {
    //   orderId: String(body.id),
    //   orderNumber: String(body.order_number),
    //   customerId: String(body.customer?.id),
    //   customerEmail: body.customer?.email,
    //   shopDomain, // identify the shop
    //   variantIds: body.line_items.map((item) => String(item.variant_id)),
    // };
    // console.log("order info: ", orderInfo);
    // console.log(`Saving order #${orderInfo.orderId}...`);
    // addOrder(orderInfo);
    // res.sendStatus(200);
  }
);

// Customer order file URLs lookup
app.get("/api/getsignedorderurls/:orderId", async (req, res) => {
  // @TODO add more than just the order id. too easy to guess.
  const urls = [];
  const orderId = req.params.orderId;
  const orderVerified = await verifyShopifyOrder(orderId);
  console.log("<> orderVerified: ", orderVerified);
  if (!orderVerified) {
    return res.status(404).send(`Order ${orderId} not found.`);
  }
  console.log("Looking up order id: ", orderId, " ...");
  const orderData = getOrderData();
  console.log("order data..", orderData);
  const order = orderData[orderId];
  if (!order) {
    return res.status(404).send("Order not found!");
  }
  // Iterate through order products to get s3 urls:
  for (const vId in order.variantIds) {
    const variantId = order.variantIds[vId];
    const productData = getProductData();

    console.log("productData: ", productData, " variantId: ", variantId);

    const filePath = productData[variantId].filePath;
    if (!filePath) {
      return res.status(500).send("System error: Cannot find file path.");
    }
    const digitalAssetUrl = await getS3ProductUrl(filePath);
    if (!filePath) {
      return res.status(500).send("System error: Cannot generate signed URL.");
    }
    urls.push(digitalAssetUrl);
  }
  res.status(200).json({ urls: urls });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.get("/order/:orderId", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "digitalorder.html"))
);

app.listen(SERVER_PORT, () => {
  console.log(`Server is running on port ${SERVER_PORT}`);
});

// @TODO: add SMS capabilities:

// SAMPLE CODE:

// import express from 'express';
// import { Shopify, ApiVersion } from '@shopify/shopify-api';

// Shopify.Context.initialize({
//   API_KEY: process.env.SHOPIFY_API_KEY,
//   API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
//   SCOPES: ['write_orders','write_customers','write_shopify_payments_payouts','write_sms'],
//   HOST_NAME: process.env.HOST.replace(/https?:\/\//, ''),
//   API_VERSION: ApiVersion.July25,
// });

// const app = express();
// app.use(express.json());

// app.post('/webhooks/orders/paid', async (req, res) => {
//   const shop = req.headers['x-shopify-shop-domain'];
//   const accessToken = /* load token for this shop from your DB */;
//   const order = req.body;

//   const graphqlClient = new Shopify.Clients.Graphql(shop, accessToken);
//   await graphqlClient.query({
//     data: `mutation {
//       smsMessageSend(recipient: "${order.phone}", body: "Your download link: ${process.env.DOWNLOAD_URL}")
//       { userErrors { field message } }
//     }`
//   });

//   res.status(200).send();
// });

// app.listen(3000);

// GPT URL: https://chatgpt.com/c/68662b93-0b10-8004-9a33-fa15a9aad2b9
