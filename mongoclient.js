import { MongoClient } from "mongodb";

let client;
let mongoClientPromise;

const uri = "mongodb://localhost:27017";

client = new MongoClient(uri);
mongoClientPromise = client.connect();

export { mongoClientPromise };
