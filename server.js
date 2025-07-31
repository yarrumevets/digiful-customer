import "./loadenv.js";
import express from "express";
import { getS3ProductUrl, createS3Client } from "./s3.js";
import path from "path";
import { fileURLToPath } from "url";
import { mongoClientPromise } from "./mongoclient.js";
import { decrypt, createLittleSlug } from "./encrypt.js";
import { emailTest } from "./email.js";
import config from "./config.js";
import { gzipSync } from "zlib"; // gunzipSync
import {
  genericWebhookHandler,
  createWebhookAppUninstalled,
  createWebhookOrdersPaid,
  createWehookSubscriptionsUpdate,
} from "./webhooks.js";
// -------------------------------------------------------> Cutting down from 425 lines! <----------------
const msUrlTimeout = config.URL_EXPIRY_MINUTES * 60 * 1000;
const SERVER_PORT = process.env.SERVER_PORT;
const app = express();
app.use(express.static("public"));
const slugMap = {};
const S3_BUCKET = "" + process.env.S3_BUCKET;
const S3_ACCESS_KEY = "" + process.env.S3_ACCESS_KEY;
const S3_SECRET_ACCESS_KEY = "" + process.env.S3_SECRET_ACCESS_KEY;
const S3_REGION = "" + process.env.S3_REGION;
const DB_NAME = process.env.DB_NAME;
const ORDERS_COLLECTION = process.env.ORDERS_COLLECTION;
const PRODUCTS_COLLECTION = process.env.PRODUCTS_COLLECTION;
const VARIANTS_COLLECTION = process.env.VARIANTS_COLLECTION;
const MERCHANTS_COLLECTION = process.env.MERCHANTS_COLLECTION;
const LOGS_COLLECTION = process.env.LOGS_COLLECTION;
const mongoClient = await mongoClientPromise;
const db = mongoClient.db(DB_NAME);

// Setup Webhook Handlers.
["customer-data-request", "customer-data-erasure", "shop-data-erasure"].forEach(
  (webhookRoute) => {
    genericWebhookHandler(webhookRoute, app);
  }
);
createWebhookAppUninstalled(app);
createWebhookOrdersPaid(app);
createWehookSubscriptionsUpdate(app);

// Health check (Currently only used to get the VM ID)
app.get("/health", (req, res) => {
  res.json({ vmId: process.env.VM_ID });
});

// API:
// Send a test email
app.get("/api/test-email/:emailTestCode", async (req, res) => {
  const testEmailResult = await emailTest(req.params.emailTestCode);
  const statusCode = testEmailResult.success ? 200 : 401;
  res.status(statusCode).send(testEmailResult);
});

// Customer order file URL(s) lookup
app.get("/api/getsignedorderurls/:publicOrderId", async (req, res) => {
  console.log("api/getsignedorderurls....");
  console.log("REQ params: ", req.params);
  const products = [];
  const publicOrderId = req.params.publicOrderId;
  console.log("Looking up order by public order ID: ", publicOrderId, " ...");
  // Get order data from DB.
  const orderData = await db
    .collection(ORDERS_COLLECTION)
    .findOne({ publicOrderId });
  if (!orderData) {
    console.error("Order not found: ", publicOrderId, " - ", orderData);
    return res.status(404).send({ error: "Order not found!" });
  }
  console.log("***** orderdata: ", orderData);
  const merchantData = await db
    .collection(MERCHANTS_COLLECTION)
    .findOne({ shopId: orderData.shopId });
  console.log("merchant data: ", merchantData);
  console.log("order data: ", orderData);
  // S3
  let bucket, accessKey, secretAccessKey, region;
  if (merchantData.plan?.planName === "SelfHosting") {
    // @TODO: store plan data in DB for cross service sync.
    accessKey = merchantData.s3.s3AccessKeyId;
    secretAccessKey = decrypt(merchantData.s3.s3SecretAccessKey);
    bucket = merchantData.s3.s3BucketName;
    region = merchantData.s3.s3Region;
  } else {
    bucket = S3_BUCKET;
    accessKey = S3_ACCESS_KEY;
    secretAccessKey = S3_SECRET_ACCESS_KEY;
    region = S3_REGION;
  }
  if (!accessKey || !secretAccessKey || !bucket || !region) {
    res.status(404).json({ error: "Unable to connect to file storage." });
  }
  const s3Client = createS3Client(accessKey, secretAccessKey, region);
  // Iterate Products in the order
  for (const vIndex in orderData.variantIds) {
    const variantId = orderData.variantIds[vIndex].toString();
    // Get variant data
    const variantData = await db.collection(VARIANTS_COLLECTION).findOne({
      shopifyVariantId: `gid://shopify/ProductVariant/${variantId}`,
    });
    // Get product data
    console.log("vid: ", variantId, " --------- variant data: ", variantData);
    const productData = await db
      .collection(PRODUCTS_COLLECTION)
      .findOne({ shopifyProductId: variantData.shopifyProductId });
    // S3
    const filePath = variantData.file.name;
    const originalFilePath = variantData.file.originalName;
    if (!filePath) {
      return res.status(500).send("System error: Cannot find file path.");
    }
    const signedUrl = await getS3ProductUrl(s3Client, filePath, bucket);
    if (!signedUrl) {
      return res.status(500).send("System error: Cannot generate signed URL.");
    }
    const fvh = variantData.fileVersionHistory;
    const currentVersion = fvh.length;
    // Add the slug:signedUrl to in-memory map for the time specified in config.js.
    const littleSlug = createLittleSlug();
    slugMap[littleSlug] = { signedUrl, variantId, originalFilePath }; // @TODO: add merchantId and productId.
    setTimeout(() => {
      delete slugMap[littleSlug];
    }, msUrlTimeout);
    products.push({
      url: `/download/${littleSlug}`,
      title: productData.title,
      // price: variantData.price,
      filePath,
      size: fvh[currentVersion - 1].file.size, // bytes
      version: currentVersion,
      originalFilePath,
    });
  }
  res.status(200).json({ products: products });
});

// Use a code endpoint that doesn't expose the S3 URL directly.
app.get("/download/:code", async (req, res) => {
  const littleSlug = req.params.code;
  const fileInfo = slugMap[littleSlug];
  const signedUrl = fileInfo.signedUrl;
  const variantId = fileInfo.variantId;
  const originalFilePath = fileInfo.originalFilePath;
  // log download to db.
  db.collection(LOGS_COLLECTION).insertOne({
    event: "download",
    level: "info", // "error",
    service: "digiful-customer", // "digiful"
    variantId,
    littleSlug,
    signedUrlGzip: gzipSync(signedUrl).toString("base64"), // gunzipSync(Buffer.from(signedUrlGzip, 'base64')).toString();
    createdAt: new Date(),
    // ...@TODO add more relevant details: prod ID, merch ID, etc.
  });
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${originalFilePath}`
  );
  res.redirect(signedUrl);
});

// Build static page routes where routes have the same string as the html file name.
["privacy", "tos", "changelog", "faq", "pricing", "tutorial"].forEach(
  (pageRoute) => {
    app.get(`/${pageRoute}`, (req, res) => {
      res.sendFile(`${__dirname}/public/${pageRoute}.html`);
    });
  }
);

// Basic server stuff:
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.get("/order/:publicOrderId", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "digitalorder.html"))
);
app.listen(SERVER_PORT, () => {
  console.log(`Server is running on port ${SERVER_PORT}`);
});
