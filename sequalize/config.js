import { Sequelize } from "sequelize";
import dotenv from 'dotenv';
dotenv.config();
let sequelize;
if (process.env.NODE_ENV !== 'production') {
    sequelize = new Sequelize({
        dialect: "postgres",
        host: "localhost",
        port: 5432,
        username: "postgres",
        password: "2003",
        database: "Analyse",
    });
}
else {
    sequelize = new Sequelize(process.env.DATABASE_URL);
}

export default sequelize;