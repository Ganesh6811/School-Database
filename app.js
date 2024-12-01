import express from "express";
import mysql from "mysql2/promise";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

// Connecting the Database
const dbUrl=`mysql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_DATABASE}`;
const db = mysql.createPool(dbUrl);

const createTableIfNotExists = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS students (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            address VARCHAR(255),
            latitude DOUBLE,
            longitude DOUBLE
        );
    `;

    try {
        const [result] = await db.query(createTableQuery);
        console.log("Table created or already exists:", result);
    } catch (err) {
        console.error("Error creating table:", err);
    }
};

createTableIfNotExists();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));


//Function To calculate the distance between the two locations
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const toRadians = (degree) => (degree * Math.PI) / 180;

    const R = 6371; 
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
};


// List Schools API using the users location
app.get("/listSchools", async (req, res) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
        return res.status(400).send({
            success: false,
            message: "Please provide both latitude and longitude",
        });
    }

    try {
        const [schools] = await db.query("SELECT * FROM students");
        const schoolsWithDistance = schools.map((school) => {
            const distance = calculateDistance(
                parseFloat(latitude),
                parseFloat(longitude),
                parseFloat(school.latitude),
                parseFloat(school.longitude)
            );
            return { ...school, distance: distance };
        });

        const sortedSchools = schoolsWithDistance.sort((a, b) => a.distance - b.distance);
        console.log("Sorted Schools are :", sortedSchools);
        res.status(200).send({
            success: true,
            message: "Schools fetched and sorted by proximity successfully",
            data: sortedSchools,
        });
    }
    catch (err) {
        console.error("Error fetching schools:", err);
        res.status(500).send({
            success: false,
            message: "Failed to fetch schools",
        });
    }
});


//Adding the school details
app.post("/addSchool", async (req, res) => {
    const { name, address, latitude, longitude } = req.body;
    if (!name || !address || !latitude || !longitude) {
        return res.status(400).send({
            success: false,
            message: "Please provide all fields",
        });
    }
    try {
        const [result] = await db.query(
            "INSERT INTO students (name, address, latitude, longitude) VALUES (?, ?, ?, ?)",
            [name, address, latitude, longitude]
        );
        res.status(200).send({
            success: true,
            message: "School details added successfully",
            result,
        });
    } 
    catch (err) {
        console.error("Error occurred while inserting the data:", err);
        res.status(500).send({
            success: false,
            message: "Inserting into the database failed",
        });
    }
});



// Start the server
app.listen(port, () => {
    console.log(`Server is running perfectly on ${port}`);
});
