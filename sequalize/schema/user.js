import { DataTypes } from 'sequelize';
import sequelize from '../config.js';

const User = sequelize.define('User', {
    id_user: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING, // Changed to DataTypes.STRING
        allowNull: true,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    name: {
        type: DataTypes.STRING, // Changed to DataTypes.STRING
        allowNull: false,
    },
    password: {
        type: DataTypes.STRING, // Changed to DataTypes.STRING
        allowNull: false,
    },
    refresh_token: {
        type: DataTypes.TEXT, // Changed to DataTypes.STRING
        allowNull: true,
    },
    role: {
        type: DataTypes.STRING, // Changed to DataTypes.STRING
        allowNull: false,
        defaultValue: 'patient',
    },
    phonenumber: {
        type: DataTypes.STRING, // Changed to DataTypes.STRING
        allowNull: true,
        unique: true,
        validate: {
            isNumeric: true,
            len: {
                args: [10, 10],
                msg: "Phone number must be 10 digits"
            }
        }
    }
},
    {
        timestamps: false,
        validate: {
            emailOrPhone() {
                if (!this.email && !this.phonenumber) {
                    throw new Error('Either email or phone number must be provided');
                }
            }
        }
    }
);

export default User;