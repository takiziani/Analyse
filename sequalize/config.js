import { Sequelize } from "sequelize";
import dotenv from 'dotenv';
dotenv.config();
let sequelize;
if (process.env.NODE_ENV == 'production') {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // This line will fix potential certificate issues
            }
        }
    });
}
else {
    sequelize = new Sequelize({
        dialect: "postgres",
        host: "localhost",
        port: 5432,
        username: "postgres",
        password: "2003",
        database: "Analyse",
    });
}

export default sequelize;