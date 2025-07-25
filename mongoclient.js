import { MongoClient } from "mongodb";

let client;
let mongoClientPromise;

const uri = process.env.MONGODB_URL; // should be mongodb://localhost:27017 on the main VM

client = new MongoClient(uri);
mongoClientPromise = client.connect();

export { mongoClientPromise };
