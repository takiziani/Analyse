import { DataTypes } from 'sequelize';
import sequelize from '../config.js';
const UserFile = sequelize.define('UsersFiles', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_user: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    },
    id_file: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    },
    info: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, { timestamps: true, createdAt: 'created_at', updatedAt: false });
export default UserFile;