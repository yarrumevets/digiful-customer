import fs from "fs";

// @TODO: replace with actual DB:
const productsFilePath = "./data/products.json";
const ordersFilePath = "./data/orders.json";
const merchantsFilePath = "./data/merchants.json";

let productData = {};
if (fs.existsSync(productsFilePath)) {
  productData = JSON.parse(fs.readFileSync(productsFilePath, "utf-8"));
} else {
  console.warn("Cannot find products file.");
}

let orderData = {};
if (fs.existsSync(ordersFilePath)) {
  orderData = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8"));
} else {
  console.warn("Cannot find orders file.");
}

let merchantData = {};
if (fs.existsSync(merchantsFilePath)) {
  orderData = JSON.parse(fs.readFileSync(merchantsFilePath, "utf-8"));
} else {
  console.warn("Cannot find merchants file.");
}

const addProduct = (product) => {
  try {
    productData[product.variantId] = product;
    fs.writeFileSync(productsFilePath, JSON.stringify(productData, null, 2));
  } catch (err) {
    console.error("Error adding product: ", err);
  }
};

const addOrder = (order) => {
  try {
    if (orderData[order.orderId]) {
      throw new Error("Order with this ID already exists.");
    }
    orderData[order.orderId] = order;
    fs.writeFileSync(ordersFilePath, JSON.stringify(orderData, null, 2));
  } catch (err) {
    console.error("Error adding order: ", err);
  }
};

const updateOrder = (orderId, updatedInfo) => {
  try {
    if (!orderData[orderId] || typeof orderData[orderId] !== "object") {
      throw new Error("This order does not exist. Nothing was updated.");
    }
    orderData[orderId] = { ...orderData[orderId], ...updatedInfo };
    fs.writeFileSync(ordersFilePath, JSON.stringify(orderData, null, 2));
  } catch (err) {
    console.error("Error updating order: ", err);
  }
};

const addMerchant = (merchantData) => {
  try {
    // @TODO: make sure merchant doesn't already exist! CHECK FOR RE-INSTALLS! How to deal with?
    fs.writeFileSync(merchantFilePath, JSON.stringify(merchantData, null, 2));
  } catch (err) {
    console.error("Error adding merchant: ", err);
  }
};

const getProductData = () => productData;
const getOrderData = () => orderData;
const getMerchantData = () => merchantData;

export {
  getProductData,
  getOrderData,
  addProduct,
  addOrder,
  updateOrder,
  addMerchant,
  getMerchantData,
};
