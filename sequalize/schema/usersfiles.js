import { DataTypes } from 'sequelize';
import sequelize from '../config.js';
const UserFile = sequelize.define('UserFile', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    id_user: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    id_file: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    info: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        {
            unique: true,
            fields: ['id_user', 'id_file']
        }
    ]
});
export default UserFile;