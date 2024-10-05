import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from 'dotenv';
import cloudinary from 'cloudinary';
import multer from 'multer';
import { v2 as cloudinaryV2 } from 'cloudinary'; // Use the v2 syntax for better compatibility

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const port = 4000;

try {
    mongoose.connect(process.env.mongourl);
    console.log("Connected to database");
} catch (error) {
    console.log('Error connecting to database:', error);
}

// Configure Cloudinary
cloudinaryV2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up multer for file uploads
const storage = multer.memoryStorage(); // Use memory storage
const upload = multer({ storage: storage });

// Creating upload endpoint for images
app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: 0, message: 'No file uploaded' });
        }

        // Upload the image to Cloudinary
        cloudinaryV2.uploader.upload_stream((error, result) => {
            if (error) {
                return res.status(500).json({ success: 0, message: 'Image upload failed', error });
            }
            res.json({
                success: 1,
                image_url: result.secure_url, // Cloudinary returns the URL of the uploaded image
            });
        }).end(req.file.buffer); // Send the buffer from multer to Cloudinary
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: 0, message: 'Something went wrong' });
    }
});

//product schema
const ProductSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    price: {
        type: String,
        required: true
    },
    Available: {
        type: Boolean,
        required: false
    },
    desc: {
        type: String
    }
})
const Product = mongoose.model('Product', ProductSchema)

// User model
const User = mongoose.model('User', {
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    cartdata: {
        type: Object,
        default: {},
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

// Users signup endpoint
app.post("/signup", async (req, res) => {
    const check = await User.findOne({ email: req.body.email });
    if (check) {
        return res.status(201).json({ success: false, error: "Email already exists" });
    } else {
        let cart = {};
        for (let i = 0; i < 300; i++) {
            cart[i] = 0;
        }
        const user = new User({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            cartdata: cart,
        });
        await user.save();

        const data = {
            user: {
                id: user.id,
            },
        };
        const token = jwt.sign(data, process.env.SECRETKEY);
        res.status(200).json({ success: true, token });
    }
});

// User login endpoint
app.post("/login", async (req, res) => {
    try {
        let user = await User.findOne({ email: req.body.email });
        if (user) {
            const pword = req.body.password === user.password;
            if (pword) {
                const data = {
                    user: {
                        id: user.id,
                    },
                };
                const token = jwt.sign(data, process.env.SECRETKEY);
                res.send({ success: true, token });
            } else {
                return res.send({ message: "Invalid credentials password" });
            }
        } else {
            return res.send({ message: "Invalid credentials Email" });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
    }
});

// Additional routes (e.g., adding products, cart management, etc.)

app.post("/addproduct", async (req, res) => {
    try {
        let products = await Product.find({})
        let id;
        if (products.length > 0) {
            let last_product_array = products.slice(-1);
            let last_product = last_product_array[0];
            id = last_product.id + 1
        } else {
            id = 1
        }
        const product = new Product({
            name: req.body.name,
            price: req.body.price,
            category: req.body.category,
            image: req.body.image,
            id: id
        })
        console.log(req.body.image)
        await product.save();
        console.log("Saved");
        res.send({ success: true, product })
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
})

app.post("/delete", async (req, res) => {
    try {
        await Product.findOneAndDelete({ id: req.body.id });
        console.log("Product deleted");
        res.json({ success: true, message: "Product deleted", Product })
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" })
    }

})

//middleware
const fecthuser = (req, res, next) => {
    const token = req.headers["auth-token"]
    if (!token) {
        return res.status(401).json({ errors: "Error in token: unaunthenticatable token" })
    }
    else {
        try {
            let data = jwt.verify(token, process.env.SECRETKEY)
            req.user = data.user
            next()
        } catch (error) {
            return res.status(401).json({ errors: "Error in token: unaunthenticatable token" })
        }
    }
}

//additemtocart

app.post("/addtocart", fecthuser, async (req, res) => {
    try {
        console.log("added", req.body.ItemId);

        // Fetch user data
        let userdata = await User.findOne({ _id: req.user.id });

        // Ensure cartData is an object (or array) and initialize if necessary
        if (!userdata.cartData) {
            userdata.cartData = {};
        }

        // Check if the item exists in the cart, if not, initialize it with 1
        if (!userdata.cartData[req.body.ItemId]) {
            userdata.cartData[req.body.ItemId] = 1;
        } else {
            userdata.cartData[req.body.ItemId] += 1; // Increment the item count
        }

        // Update the user cartData
        await User.findOneAndUpdate(
            { _id: req.user.id },
            { cartData: userdata.cartData }
        );

        res.send("Added");
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});


//removeitemfromcart
app.post("/removefrom", fecthuser, async (req, res) => {
    let userdata = await User.findOne({ _id: req.body.userId })
    userdata.cartdata[req.body.Itemid] -= 1
    await User.findOneAndUpdate({ id: req.user.id }, { cartdata: userdata.cartdata })
    res.send("added")
})

//allproducts
app.get("/allproducts", async (req, res) => {
    try {
        let product = await Product.find({})
        res.send(product)
        console.log("All products fectched");
    } catch (error) {
        console.log(error)
    }

})

//newcollection
app.get("/newarrivals", async (req, res) => {
    try {
        let products = await Product.find({})
        let newarrivals = products.slice(1).slice(-4);
        res.send(newarrivals)
    } catch (error) {
        console.log(error);

    }
})

//popluar in nairobi
app.get("/popularinnairobi", async (req, res) => {
    try {
        const products = await Product.find({})
        let popular = products.slice(0, 4)
        res.send(popular)
    } catch (error) {
        console.log(error);

    }
})


app.listen(port, () => {
    console.log('App listening on port 4000');
});
