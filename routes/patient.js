import { Router } from "express";
import { User, File, UserFile } from "../sequalize/relation.js";
import verifyjwt from "../utils/jwt.js";
import path from 'path';
const router = Router();
router.use(verifyjwt);
router.get('/patient/files', async (req, res) => {
    const userid = req.userid;
    const user = await User.findByPk(userid);
    const files = await user.getFiles();
    return res.status(200).send(files);
});
router.get("/patient/file/download/:id", async (req, res) => {
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
router.post("/patient/file/share", async (req, res) => {
    const userid = req.userid;
    const doctorid = req.body.doctorid;
    const fileid = req.body.fileid;
    const doctor = await User.findByPk(doctorid);
    if (!doctor || doctor.role !== 'doctor') {
        return res.status(404).send({ message: 'Doctor not found' });
    }
    const file = await File.findByPk(fileid);
    if (!file) {
        return res.status(404).send({ message: 'File not found' });
    }
    const userfile = await UserFile.findOne({ where: { id_user: userid, id_file: fileid } });
    if (!userfile) {
        return res.status(403).send({ message: 'You are not allowed to share this file' });
    }
    await doctor.addFile(file);
    res.status(200).send({ message: 'File shared with doctor' });
});
router.get("/patient/file/view/:id", async (req, res) => {
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
export default router;