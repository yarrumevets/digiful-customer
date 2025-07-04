# 🛍️ shopifydd

- Shopify digital products fulfillment app

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Roadmap](#roadmap)
- [Installation](#installation)
- [Tech](#tech)
- [Setup](#setup)
- [Usage](#usage)
- [Resources](#resources)
- [TODO](#TODO)

## Introduction

- Shopify digital products fulfillment app

## Tech

- Simple vanilla JavaScript front-end &amp; back-end (Node/Express)
- Shopify API integration
- AWS S3 integration
- JSON file read/write in lieu of database integration
- GraphQL client

## Features

- Stores order information for a Shopify store
- Allows customers to link to the app and receive signed URLs to their digital products stored in AWS S3
- JSON files for storing and retrieving order and product information
- Shopify webhook verification with HMAC verification
- Simple config for easy white labeling (Page title).
- Configuration sample files for each of the gitignored files.

## Roadmap

In no particular order:

- Send more user-friendly information along with URLs: images, title, (SKU), etc.
- Get and store SKU with product info.
- Implement optional MongoDB integration for storing products, orders, and logs.
- Logging for: errors, duplicates orders, etc.
- Login/auth needed for admin page
- Front-end and API endpoints for adding/editing products
- Use products/create webhook to add products automatically from Shopify (check SKU for)
- User page - returning users can look up their files, see new versions, etc.
- Security features to deal with the bulk of bots, crawlers.

## Installation

Step-by-step instructions on how to get the development environment running.

```bash
git clone https://github.com/yarrumevets/shopifydd.git
cd shopifydd
yarn
```

## Setup

### 🔹 Config Files

- You'll need to rename all the files starting 'SAMPLE.~' and enter your own data and credentials:

- SAMPLE.aws.secret.js
- SAMPLE.shopify.secret.js
- SAMPLE.products.json
- SAMPLE.orders.json
- and, public/SAMPLE.config.js,
  ...to their respective names without 'SAMPLE'. Verify that these are all ignored by git!

### 🔹 Ngrok (optional)

- Install and run [Ngrok](https://ngrok.com) for the Shopify webhook:
  `ngrok http 4199`

### 🔹 Register webhook

- Set up shopify webhook with your ngrok/live url using this cURL command in your terminal:

```curl -v -X POST "https://<your-default-shop-url>.myshopify.com/admin/api/2023-04/webhooks.json" \
-H "X-Shopify-Access-Token: xxxxx_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" \
-H "Content-Type: application/json" \
-d '{
"webhook": {
"topic": "orders/paid",
"address": "https://<XXXX-###-###-###-###.ngrok-free.app>/webhooks/custom/orders-paid",
"format": "json"
}
}'
```

(Note: Don't use your custom Shopify subdomain or custom domain. Use your original default store URL)

### 🔹 Add a Digital Product

- Add a digital product to your Shopify store with a SKU containing the string "DIGI". (Ex: 0001-DIGI-BLUE)

### 🔹 Email Template (Liquid)

- Go to this page in Shopify: `https://admin.shopify.com/store/<YOUR_STORE_ID>/email_templates/order_confirmation/preview`

- Or navigate there from your Shopify store: Settings > Notifications > Customer Notifications > Order Confirmation
- Edit Code
  Add in this Liquid script block somewhere in the email body. It checks for products purchased that contain 'DIGI' in the SKU and adds them to a list of download links:

```

{% assign has_digi = false %}
{% for line_item in order.line_items %}
  {% if line_item.sku contains "DIGI" %}
    {% if has_digi == false %}
<div style="margin: 20px auto; border: 3px dashed #444; text-align: center; background-color: beige; color: #222; padding: 30px 5px; border-radius: 10px; max-width: 1200px;">
  <h3 style="margin-bottom: 0;">🤖 Your digital purchases 🤖</h3>
  <ul style="padding: 0; list-style: none;">
    {% assign has_digi = true %}
    {% endif %}
    <li>{{ line_item.title }}</li>
  {% endif %}
{% endfor %}
{% if has_digi %}
  </ul>
  <a href="https://<YOUR_URL>/order/{{ order.id | remove: 'gid://shopify/Order/' }}">📥 Click here to download your files!</a>
</div>
{% endif %}
```

(Note: You can change 'DIGI' to any keyword you like. Just make sure only/all SKUs for digital products contain the string)

### 🔹 AWS S3 Bucket

- Upload your digital asset to S3.
- Make sure the aws.secret.js file contains your credentials (bucket name, access keys, and region).
- Add a new product to products.json in the data folder following the sample format.
  The key for each product will be the variant ID, not the product ID, even for products without different variants.

## Usage

```bash
node server.js
```

Go to your Shop (set it to test mode) and make a purchase for a digital item. Be sure to enter your actual email in the email/phone number input field.
You can add multiple items and even include physical products. Only digital products (those with "DIGI" in their SKUs) will be linked.

Go to your email and click the link. `http://localhost:4199/order/<YOUR_ORDER_ID>`.

## Resources

HMAC docs: https://nodejs.org/api/crypto.html#class-hmac

## TODO

@TODO - Provide different instructions for public apps and custom apps
