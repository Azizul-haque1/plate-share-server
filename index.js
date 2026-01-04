require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 3000;
const bcrypt = require("bcryptjs");

app.use(
  cors({
    origin: [
      // "http://localhost:3000",
      "http://localhost:5173",
      "https://food-share-bay.vercel.app",
      "https://plate-share1.netlify.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  })
);
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
    // await client.connect();
    const db = client.db("food-db");
    const foodsCollection = db.collection("foods");
    const requestFoodCollection = db.collection("request-foods");
    const newFeaturedCollection = db.collection("new-featured-foods");
    const localUsers = db.collection("localUsers"); // email/password

    // ---------------------------------------------------///
    // Separate collections
    // const googleUsers = db.collection("googleUsers"); // Google login

    // Register route (local email/password)
    app.post("/register", async (req, res) => {
      const { name, email, password } = req.body;
      if (!name || !email || !password)
        return res.status(400).json({ message: "Missing fields" });
      const existing = await localUsers.findOne({ email });
      if (existing) return res.status(400).json({ message: "User exists" });

      const hash = await bcrypt.hash(password, 10);
      const result = await localUsers.insertOne({
        name,
        email,
        password: hash,
      });
      res.status(201).json({ message: "User created", result });
    });

    // Login route (local email/password)
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;
      const user = await localUsers.findOne({ email });
      if (!user)
        return res.status(401).json({ message: "Invalid credentials" });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid)
        return res.status(401).json({ message: "Invalid credentials" });
      res.json({ id: user._id, name: user.name, email: user.email });
    });

    app.get("/new-featured-available", async (req, res) => {
      const result = await newFeaturedCollection.find().toArray();
      res.send(result);
    });

    app.get("/new-featured-foods", async (req, res) => {
      // const query = { food_status: "Available" };
      const result = await newFeaturedCollection
        .find()
        .sort({
          food_quantity: -1,
        })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/new-foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await newFeaturedCollection.findOne(query);
      res.send(result);
    });

    app.post("/new-foods", async (req, res) => {
      const newFood = req.body;
      // console.log(newFood);
      const result = await newFeaturedCollection.insertOne(newFood);
      res.send(result);
    });

    app.get("/new-my-food", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.donator_email = email;
      }
      const result = await newFeaturedCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/new-my-food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await newFeaturedCollection.deleteOne(query);
      res.send(result);
    });

    // ----------------------------

    // app.get("/foods", async (req, res) => {
    //   const query = { food_status: "Available" };
    //   const result = await foodsCollection.find(query).toArray();
    //   res.send(result);
    // });

    app.get("/foods", async (req, res) => {
      try {
        const {
          search = "",
          location,
          status = "Available",
          sort,
          page = 1,
          limit = 12,
        } = req.query;

        const pageNum = Number(page);
        const limitNum = Number(limit);

        const foodsCollection = db.collection("foods");

        // Build match object dynamically
        const match = {};
        if (search) match.food_name = { $regex: search, $options: "i" };
        if (location) match.pickup_location = location;
        if (status) match.food_status = status;

        // Sorting
        let sortStage = { expire_date: 1 }; // default
        if (sort === "expire_desc") sortStage = { expire_date: -1 };
        if (sort === "quantity_desc") sortStage = { food_quantity: -1 };

        // Aggregation pipeline
        const pipeline = [
          { $match: match },
          { $sort: sortStage },
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
        ];

        // Fetch foods
        const foods = await foodsCollection.aggregate(pipeline).toArray();

        // Count total documents matching filters (for pagination)
        const total = await foodsCollection.countDocuments(match);

        res.json({
          foods,
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // donated api
    app.patch("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: { food_status: req.body.food_status },
      };
      const result = await foodsCollection.updateOne(query, update);
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
      const query = { food_status: "Available" };
      const result = await foodsCollection
        .find(query)
        .sort({
          food_quantity: -1,
        })
        .limit(8)
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

    // user requested data api

    app.get("/food-request", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.userEmail = email;
      }
      const result = await requestFoodCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/food-request/:id", async (req, res) => {
      const id = req.params.id;
      const query = { foodId: id };
      // if (email) {
      //   query.userEmail = email;
      // }
      const result = await requestFoodCollection.find(query).toArray();
      res.send(result);
    });

    // update request food api
    app.patch("/food-request/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: { status: req.body.status },
      };
      const result = await requestFoodCollection.updateOne(query, update);
      res.send(result);
    });

    // delete request food api

    app.delete("/food-request/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestFoodCollection.deleteOne(query);
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
