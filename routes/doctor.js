import { Router } from "express";
import { User, File, UserFile } from "../sequalize/relation.js";
import verifyjwt from "../utils/jwt.js";
import path from 'path';
import { Op } from "sequelize";
const router = Router();
router.use(verifyjwt);
function verifydoctor(req, res, next) {
    if (req.role !== 'doctor') {
        return res.status(403).send({ message: 'You are not a doctor' });
    }
    next();
}
router.get('/doctor/files', verifydoctor, async (req, res) => {
    const userid = req.userid;
    const user = await User.findByPk(userid);
    const files = await user.getFiles();
    return res.status(200).send(files);
});
router.get("/doctor/file/download/:id", verifydoctor, async (req, res) => {
    const userid = req.userid;
    const id = req.params.id;
    const file = await File.findByPk(id);
    if (!file) {
        return res.status(404).send({ message: 'File not found' });
    }
    const userfile = await UserFile.findOne({ where: { id_user: userid, id_file: id } });
    if (!userfile) {
        return res.status(403).send({ message: 'You are not allowed to download this file' });
    }
    res.download(file.path);
});
router.get("/doctor/file/view/:id", verifydoctor, async (req, res) => {
    const userid = req.userid;
    const fileid = req.params.id;
    const file = await File.findByPk(fileid);
    if (!file) {
        return res.status(404).send({ message: 'File not found' });
    }
    const userfile = await UserFile.findOne({ where: { id_user: userid, id_file: fileid } });
    if (!userfile) {
        return res.status(403).send({ message: 'You are not allowed to view this file' });
    }
    const absolutePath = path.resolve(file.path);
    res.sendFile(absolutePath);
});
router.get("/doctor/search/:userid", verifydoctor, async (req, res) => {
    const userid = req.userid;
    const searchid = req.params.userid;
    const user = await User.findByPk(userid);
    const files = await user.getFiles();
    const filesIds = files.map(file => file.id_file);
    const founduser = await UserFile.findAll({
        where: {
            id_file: {
                [Op.in]: filesIds
            },
            id_user: searchid
        }
    });
    if (founduser.length === 0) {
        return res.status(404).send({ message: 'User not found' });
    }
    return res.status(200).send(founduser);
});
router.get("/doctor/patients", verifydoctor, async (req, res) => {
    const userid = req.userid;
    const user = await User.findByPk(userid);
    const files = await user.getFiles();
    const filesIds = files.map(file => file.id_file);
    let usersids = await UserFile.findAll({
        where: {
            id_file: {
                [Op.in]: filesIds
            }
        }
    });
    usersids = usersids.map(userfile => userfile.id_user).filter(id => id !== userid);
    usersids = [...new Set(usersids)];
    const users = await User.findAll({
        where: {
            id_user: {
                [Op.in]: usersids
            }
        }
    });
    return res.status(200).send(users);
});
export default router;