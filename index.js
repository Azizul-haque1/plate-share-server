require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.apltpns.mongodb.net/?appName=Cluster0`;
// "mongodb+srv://<db_username>:<db_password>@cluster0.apltpns.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("food-db");
    const foodsCollection = db.collection("foods");
    const requestFoodCollection = db.collection("request-foods");

    app.get("/foods", async (req, res) => {
      const result = await foodsCollection.find().toArray();
      res.send(result);
    });

    app.get("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodsCollection.findOne(query);
      res.send(result);
    });

    // add food api
    app.post("/foods", async (req, res) => {
      const newFood = req.body;
      // console.log(newFood);
      const result = await foodsCollection.insertOne(newFood);
      res.send(result);
    });

    // update foods api
    app.patch("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: req.body,
      };
      const result = await foodsCollection.updateOne(query, update);
      res.send(result);
    });

    app.delete("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/featured-foods", async (req, res) => {
      const result = await foodsCollection
        .find()
        .sort({
          food_quantity: -1,
        })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // my donate food api
    app.get("/my-food", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.donator_email = email;
      }
      const result = await foodsCollection.find(query).toArray();
      res.send(result);
    });

    // food request api

    app.post("/food-request", async (req, res) => {
      const newRequestFood = req.body;
      const result = await requestFoodCollection.insertOne(newRequestFood);
      res.send(result);
    });

    app.get("/food-request", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.userEmail = email;

      }
      const result = await requestFoodCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Plate share server is availble");
});

app.listen(port, () => {
  console.log("Plate share server is running on port", port);
});
