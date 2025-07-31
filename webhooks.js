import express from "express";
import { verifyShopifyWebhook } from "./shopify.js";
import { addOrder } from "./json.js";
import { nanoid } from "nanoid";
import { encrypt } from "./encrypt.js";
import { sendEmail } from "./email.js";

const WEBHOOKS_COLLECTION = process.env.WEBHOOKS_COLLECTION;

// @TODO: Create a queue for all webhooks. The queue should handle verification and return status 200.

// Generic webhook handler
const genericWebhookHandler = (webhookRoute, app) => {
  app.post(
    `/webhooks/${webhookRoute}`,
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const webhookVerified = verifyShopifyWebhook(req.body, req.headers);
      process.env.VERBOSE && console.log(`Webhook hit: ${webhookRoute}`);
      const insertWebhookReqResult = await db
        .collection(WEBHOOK_REQUESTS_COLLECTION)
        .insertOne({
          route: webhookRoute,
          body: req.body,
          createdAt: new Date(),
          verified: webhookVerified,
        });
      process.env.VERBOSE &&
        console.log(
          "Webhook verification: ",
          webhookVerified,
          " - mongodb insert response: ",
          insertWebhookReqResult
        );
      if (!webhookVerified) {
        console.error(`Webhook not verified: `, req.body);
        return res.sendStatus(401);
      }
      return res.sendStatus(200);
    }
  );
};

// Webhook called by Shopify when an order is paid.
const createWebhookOrdersPaid = (app) => {
  app.post(
    "/webhooks/orders-paid",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      console.log(`\x1b[32m🎉 An order was placed! 🎉\x1b[0m`);
      const shopDomain = req.get("x-shopify-shop-domain");
      const rawBody = req.body;
      let body;
      if (!verifyShopifyWebhook(rawBody, req.headers)) {
        console.error(`Webhook orders-paid not verified: `, req.body);
        return res.sendStatus(401);
      }
      res.sendStatus(200);
      console.log("Webhook orders-paid request verified...");
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
      const emailParams = composeEmailParams(
        body.customer?.email,
        publicOrderId
      );
      sendEmail(emailParams);
    }
  );
};

// Webhook called by Shopify when a subscription changes.
const createWehookSubscriptionsUpdate = (app) => {
  app.post(
    "/webhooks/app-subscriptions-update",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const shopDomain = req.get("x-shopify-shop-domain");
      console.log(`⚠️ A subscription for (${shopDomain}) was changed! ⚠️`); // sample from a subscription sign-up:
      const rawBody = req.body;
      let body;
      if (!verifyShopifyWebhook(rawBody, req.headers)) {
        console.error(
          `Webhook app-subscriptions-update not verified: `,
          req.body
        );
        return res.sendStatus(401);
      }
      res.sendStatus(200);
      console.log("Webhook app-subscriptions-update request verified...");
      body = JSON.parse(rawBody.toString("utf-8"));
      // Store data in DB:
      if (body.app_subscription) {
        // @TODO: determine if this is best indicator
      }
      console.log("WEBHOOK app-subscriptions-update BODY: ", body);
    }
  );
};

// Webhook called by Shopify merchant uninstalls the app
const createWebhookAppUninstalled = (app) => {
  app.post(
    "/webhooks/app-uninstalled",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      // @TODO: get sample data to put here . . . .
      const shopDomain = req.get("x-shopify-shop-domain");
      console.log(`⚠️ A merchant (${shopDomain}) uninstalled the app! ⚠️`);
      const rawBody = req.body;
      let body;
      if (!verifyShopifyWebhook(rawBody, req.headers)) {
        console.error(
          `Webhook app-subscriptions-update not verified: `,
          req.body
        );
        return res.sendStatus(401);
      }
      res.sendStatus(200);
      console.log("Webhook app-uninstalled request verified...");
      body = JSON.parse(rawBody.toString("utf-8"));
      console.log("WEBHOOK app-uninstalled BODY: ", body);
    }
  );
};

export {
  genericWebhookHandler,
  createWebhookAppUninstalled,
  createWebhookOrdersPaid,
  createWehookSubscriptionsUpdate,
};
