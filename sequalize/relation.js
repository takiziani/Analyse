import User from "./schema/user.js";
import File from "./schema/file.js";
import UserFile from "./schema/usersfiles.js";
User.belongsToMany(File, { through: UserFile, foreignKey: 'id_user' });
File.belongsToMany(User, { through: UserFile, foreignKey: 'id_file' });
// Ensure UserFile is associated with File
UserFile.belongsTo(File, { foreignKey: 'id_file' });
UserFile.belongsTo(User, { foreignKey: 'id_user' });
export { User, File, UserFile };