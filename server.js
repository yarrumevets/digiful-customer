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

// Webhook mandatory for approval
app.post(
  "/webhooks/customer-data-request",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log(`Webhook hit: customer-data-request`);
    if (!verifyShopifyWebhook(req.body, req.headers)) {
      console.error(`Webhook not verified: `, req.body);
      return res.sendStatus(401);
    }
    return res.sendStatus(200);
  }
);
app.post(
  "/webhooks/customer-data-erasure",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log(`Webhook hit: customer-data-erasure`);
    if (!verifyShopifyWebhook(req.body, req.headers)) {
      console.error(`Webhook not verified: `, req.body);
      return res.sendStatus(401);
    }
    return res.sendStatus(200);
  }
);
app.post(
  "/webhooks/shop-data-erasure",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log(`Webhook hit: shop-data-erasure`);
    if (!verifyShopifyWebhook(req.body, req.headers)) {
      console.error(`Webhook not verified: `, req.body);
      return res.sendStatus(401);
    }
    return res.sendStatus(200);
  }
);

// @TODO: Move into email module, passing in all fields.
const composeEmailParams = (toEmail, publicOrderId) => {
  return {
    fromName: config.emailFromName,
    fromEmail: config.emailFromAddress,
    toEmail: toEmail,
    subject: `Your digital product is ready from ${config.emailFromName}`,
    bodyHtml: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              text-align: center;
            }
            h1 {
              font-size:24px;
              margin:0;
              padding:0;
            }
            p {
              font-size:16px;
            }
            img.banner {
              width:100%;
            }
          </style>
        </head>
        <body>
        <img class="banner" src="${config.emailBannerUrl}" />
          <h1>${config.emailTitle}</h1>
          <p><a href="${process.env.BASE_URL}/order/${publicOrderId}">Download your files here</a>.</p>
        </body>
      </html>
      `,
    bodyText: `${config.emailTitle}\n\nDownload here: ${process.env.BASE_URL}/order/${publicOrderId}`,
  };
};

// Webhook called by Shopify when an order is paid.
app.post(
  "/webhooks/orders-paid",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log(`\x1b[32m🎉 An order was placed! 🎉\x1b[0m`);
    const shopDomain = req.get("x-shopify-shop-domain");
    const rawBody = req.body;
    let body;

    if (!verifyShopifyWebhook(rawBody, req.headers)) {
      console.error(`Webhook not verified: `, req.body);
      return res.sendStatus(401);
    }
    res.sendStatus(200);

    console.log("Webhook request verified...");
    const publicOrderId = nanoid(24); // used in email links
    body = JSON.parse(rawBody.toString("utf-8"));

    // Grab the first line item to get the variant id. Use it to get the storeId, then merchant.
    const refVariantId = body.line_items[0].variant_id; // numeric value.
    const refVariant = await db.collection(VARIANTS_COLLECTION).findOne({
      shopifyVariantId: `gid://shopify/ProductVariant/${refVariantId}`,
    });
    const shopId = refVariant.shopId;

    console.log("Shop ID found: ", shopId, " ...");

    const orderInfo = {
      orderId: String(body.id),
      shopId: String(shopId),
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
    const emailParams = composeEmailParams(body.customer?.email, publicOrderId);
    sendEmail(emailParams);
  }
);

// Send a test email
app.get("/api/test-email/:emailTestCode", async (req, res) => {
  // @TODO: create basic email templating to speed up testing.
  const { emailTestCode } = req.params;
  if (emailTestCode !== process.env.EMAIL_TEST_CODE) {
    res.status(401).json({ error: "Unauthorized IP address" });
  }
  // Fake data
  const publicOrderId = "ABC123ABC123ABC123ABC123";
  const body = { customer: { email: process.env.TEST_TO_EMAIL } };
  const emailParams = composeEmailParams(body.customer?.email, publicOrderId);
  const emailResult = await sendEmail(emailParams);
  res.status(200).send({ success: true, emailResult });
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

app.get("/privacy", (req, res) => {
  res.sendFile(__dirname + "/public/privacy.html");
});

app.get("/tos", (req, res) => {
  res.sendFile(__dirname + "/public/tos.html");
});

app.get("/changelog", (req, res) => {
  res.sendFile(__dirname + "/public/changelog.html");
});

app.get("/faq", (req, res) => {
  res.sendFile(__dirname + "/public/faq.html");
});

app.get("/pricing", (req, res) => {
  res.sendFile(__dirname + "/public/pricing.html");
});

app.get("/tutorial", (req, res) => {
  res.sendFile(__dirname + "/public/tutorial.html");
});

// Basic server stuff:
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.get("/order/:publicOrderId", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "digitalorder.html"))
);
app.listen(SERVER_PORT, () => {
  console.log(`Server is running on port ${SERVER_PORT}`);
});
