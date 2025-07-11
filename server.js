import express from "express";
import { getS3ProductUrl, createS3Client } from "./s3.js";
import path from "path";
import { fileURLToPath } from "url";
import { verifyShopifyWebhook } from "./shopify.js";
import { mongoClientPromise } from "./mongoclient.js";
import "dotenv/config";
import { addOrder } from "./json.js";
import { nanoid } from "nanoid";
import { encrypt, decrypt, createLittleSlug } from "./encrypt.js";
import { sendEmail } from "./email.js";
import config from "./config.js";
import { gzipSync } from "zlib"; // gunzipSync

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

// Webhook called by Shopify when an order is paid.
app.post(
  "/webhooks/orders-paid",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log(`\x1b[32m🎉 An order was placed! 🎉\x1b[0m`);
    res.sendStatus(200);
    const shopDomain = req.get("x-shopify-shop-domain");
    const rawBody = req.body;
    let body;
    if (!verifyShopifyWebhook(rawBody, req.headers)) {
      console.error("Webhook not verified: ", rawBody);
      return res.sendStatus(200);
    }
    console.log("Webhook request verified...");
    const publicOrderId = nanoid(24); // used in email links
    body = JSON.parse(rawBody.toString("utf-8"));
    const orderInfo = {
      orderId: String(body.id),
      orderNumber: String(body.order_number),
      publicOrderId,
      customer: {
        customerId: String(body.customer?.id),
        customerEmail: encrypt(body.customer?.email),
      },
      financialStatus: body.financial_status,
      shopDomain, // identify the shop
      variantIds: body.line_items.map((item) => String(item.variant_id)),
      createdAt: new Date(),
    };
    // Save order.
    const insertOrderRes = await db
      .collection(ORDERS_COLLECTION)
      .insertOne(orderInfo);
    // Checkfor save success and backup to JSON on fail.
    if (insertOrderRes?.acknowledged) {
      console.log("New order saved to DB: ", insertOrderRes.insertedId);
    } else {
      console.error(
        "Error saving order. Saving to JSON backup. Order data: ",
        orderInfo
      );
      addOrder(orderInfo);
    }
    const emailParams = {
      fromName: config.emailFromName,
      fromEmail: config.emailFromAddress,
      toEmail: body.customer?.email,
      subject: `Your digital product is ready from ${config.emailFromName}`,
      bodyHtml: `<h1>Test Title</h1><p>Download here: </p><a href="${process.env.BASE_URL}/order/${publicOrderId}">DOWNLOAD</a>...`,
      bodyText: `Test Title\n\nDownload here: ${process.env.BASE_URL}/order/${publicOrderId}`,
    };

    sendEmail(emailParams);
  }
);

// Customer order file URL(s) lookup
app.get("/api/getsignedorderurls/:publicOrderId", async (req, res) => {
  const products = [];
  const publicOrderId = req.params.publicOrderId;
  console.log("Looking up order id: ", publicOrderId, " ...");
  // Get order data from DB.
  const orderData = await db
    .collection(ORDERS_COLLECTION)
    .findOne({ publicOrderId });
  if (!orderData) {
    return res.status(404).send({ error: "Order not found!" });
  }
  const merchantData = await db.collection(MERCHANTS_COLLECTION).findOne({});
  // S3
  console.log("~~~~~~ merchant data: ", merchantData);
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
    const variantData = await db
      .collection(VARIANTS_COLLECTION)
      .findOne({ shopifyVariantId: variantId });
    // Get product data
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
    `attachment; filename="${originalFilePath}"`
  );
  res.setHeader("Content-Type", "application/octet-stream");
  res.redirect(signedUrl);
});

// Basic server stuff:
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.get("/order/:publicOrderId", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "digitalorder.html"))
);
app.listen(SERVER_PORT, () => {
  console.log(`Server is running on port ${SERVER_PORT}`);
});
