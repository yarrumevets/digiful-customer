# 🛍️ digiful-customer

- Customer digital product fulfillment side of the Digiful Shopify app.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Roadmap](#roadmap)
- [Installation](#installation)
- [Tech](#tech)
- [Setup](#setup)
- [Usage](#usage)
- [Resources](#resources)

## Introduction

- Customer digital product fulfillment side of the [digiful Shopify app](https://github.com/yarrumevets/digiful).

## Tech

- Simple vanilla JavaScript front-end &amp; back-end (Node/Express)
- Shopify API integration
- AWS S3 integration
- MongoDB for storing merchant, product, order, and logging info
- GraphQL client
- Shopify webhook verification with HMAC verification

## Features

- Captures customer checkout for digital products purchased on Shopify stores that have installed the digiful app.
- Send an email/SMS to customers with a link to the download page for the digital products they purchased
- Verifies customers via a hash lookup for an oder and serverse up a file via a signed url to an S3 bucket
- Captures various stats that cannot be gathered in Shopify directly. (TBD)
- Verifies that the customer has downloaded the file.

## Roadmap

TBD

## Installation

Step-by-step instructions on how to get the development environment running.

```bash
git clone https://github.com/yarrumevets/digiful-customer.git
cd digiful-customer
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

(Note: aws.secret.js and shopify.secret.js will be gitignored once renamed.)

### 🔹 Ngrok (optional)

- Install and run [Ngrok](https://ngrok.com) for the Shopify webhook:
  `ngrok http 4199`

### 🔹 digiful admin

- Run the [digiful](https://github.com/yarrumevets/digiful) admin app locally and set it up as per the README.md instructions.

### 🔹 MongoDB

- Setup and start [mongodb](https://www.mongodb.com/docs/manual/installation/) to run in the background at the default port 27017

### 🔹 AWS S3

Setup an S3 bucket on AWS - [Getting started with Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/GetStartedWithS3.html)

### 🔹 Shopify

- Create a non-physical product and give it the tag 'digiful'.
- Install the digiful app on your store.
- Setup S3 credentions in the Shopify digiful admin.

## Usage

- Purchase a digital product (marked by the 'digiful' tag) on your dev store with digiful installed.
- Open the email sent from digiful.click for the order.
- Click the link to the customer download page.
- On the download page, click the download button.

## Resources

- 🔗 - [MongoDB](https://www.mongodb.com/docs/manual/installation/)
- 🔗 - [Getting started with Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/GetStartedWithS3.html)
- 🔗 - [HMAC docs](https://nodejs.org/api/crypto.html#class-hmac)
