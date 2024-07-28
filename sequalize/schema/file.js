import { DataTypes } from 'sequelize';
import sequelize from '../config.js';
const File = sequelize.define('File', {
    id_file: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    path: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    filename: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});
export default File;