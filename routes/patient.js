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
// Function to decrypt data using AES
function decryptData(encrypted, password, iv) {
    const key = crypto.createHash('sha256').update(password).digest(); // Generate key from password
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
}
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
    const patient = await User.findByPk(userid);
    if (!patient) {
        return res.status(404).send({ message: 'Patient not found' });
    }
    const password = patient.password;
    try {
        // Read the encrypted PDF file
        const encryptedPdfBytes = fs.readFileSync(file.path);
        const iv = encryptedPdfBytes.slice(0, 16);
        const encrypted = encryptedPdfBytes.slice(16);
        // Decrypt the encrypted PDF bytes
        const decryptedPdfBytes = decryptData(encrypted, password, iv);
        // Create a temporary decrypted file path
        const decryptedFilePath = path.join('uploads', 'decrypted_' + path.basename(file.path));
        // Write the decrypted PDF to a file
        fs.writeFileSync(decryptedFilePath, decryptedPdfBytes);
        // Send the decrypted PDF back to the user
        res.sendFile(decryptedFilePath, (err) => {
            if (err) {
                return res.status(500).send(err);
            }
            // Clean up the temporary decrypted file
            fs.unlinkSync(decryptedFilePath);
        });
    } catch (error) {
        console.error('Error processing file:', error);
        return res.status(500).send({ message: 'Error processing file' });
    }
});
export default router;