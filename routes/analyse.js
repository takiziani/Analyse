import { Router } from "express";
import { User, File, UserFile } from "../sequalize/relation.js";
import verifyjwt from "../utils/jwt.js";
import multer from "multer";
import isalab from "../utils/isalab.js";
import fs from "fs";
import path from 'path';
import { Op } from "sequelize";
import { PDFDocument } from "pdf-lib";
import crypto from "crypto";
const router = Router();
router.use(verifyjwt);
router.use(isalab);
const storage = multer.diskStorage({
    destination: 'uploads',
    filename: function (req, file, cb) {
        // Generate a unique filename with the original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
});
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true); // Accept the file
        } else {
            cb(null, false); // Reject the file
            return cb(new Error('Only .pdf files are allowed!'));
        }
    }
});
// Function to encrypt data using AES
function encryptData(data, password) {
    const iv = crypto.randomBytes(16); // Initialization vector
    const key = crypto.createHash('sha256').update(password).digest(); // Generate key from password
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return { iv, encrypted };
}

router.post('/lab/upload', upload.single('file'), async (req, res) => {
    const userid = req.userid;
    const patientid = req.body.patientid;
    const file = req.file;
    const user = await User.findByPk(userid);
    if (!file || path.extname(file.originalname) !== '.pdf') {
        return res.status(400).send({ message: 'No file uploaded or the type of the file is not pdf' });
    }
    const patient = await User.findByPk(patientid);
    if (!patient) {
        return res.status(404).send({ message: 'Patient not found' });
    }
    const password = patient.password;
    try {
        // Read the original PDF
        const filePath = file.path;
        const existingPdfBytes = fs.readFileSync(filePath);

        // Encrypt the PDF bytes
        const { iv, encrypted } = encryptData(Buffer.from(existingPdfBytes), password);

        // Write the encrypted PDF to a file
        const encryptedFilePath = path.join('uploads', 'encrypted_' + file.filename);
        const encryptedPdf = Buffer.concat([iv, encrypted]);
        fs.writeFileSync(encryptedFilePath, encryptedPdf);

        // Save file information in the database
        const uploadedfile = await File.create({ filename: file.originalname, path: encryptedFilePath });
        await UserFile.create({ id_user: userid, id_file: uploadedfile.id_file, info: { patientid: patientid } });
        await UserFile.create({ id_user: patientid, id_file: uploadedfile.id_file, info: { labname: user.name } });

        // Clean up the original uploaded file
        fs.unlinkSync(filePath);

        return res.status(200).send({ message: 'File uploaded and encrypted' });
    } catch (error) {
        console.error('Error processing file:', error);
        return res.status(500).send({ message: 'Error processing file' });
    }
});
router.get('/lab/files', async (req, res) => {
    const userid = req.userid;
    const user = await User.findByPk(userid);
    const files = await user.getFiles();
    return res.status(200).send(files);
});
router.delete('/lab/delete/:id', async (req, res) => {
    const userid = req.userid;
    const id = req.params.id;
    const user = await User.findByPk(userid);
    const file = await File.findByPk(id);
    if (!file) {
        return res.status(404).send({ message: 'File not found' });
    }
    await user.removeFile(file);
    try {
        await fs.unlink(file.path); // Use the path from the file record to delete it
        await file.destroy();
        return res.status(200).send({ message: 'File deleted' });
    } catch (error) {
        console.error('Failed to delete file from filesystem:', error);
        return res.status(500).send({ message: 'Failed to delete file from filesystem' });
    }
});
// Function to decrypt data using AES
function decryptData(encrypted, password, iv) {
    const key = crypto.createHash('sha256').update(password).digest(); // Generate key from password
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
}

router.get('/lab/download/:id', async (req, res) => {
    const userid = req.userid;
    const id = req.params.id;
    const file = await File.findByPk(id);
    if (!file) {
        return res.status(404).send({ message: 'File not found' });
    }
    const userFile = await UserFile.findOne({
        where: {
            id_user: userid,
            id_file: id
        }
    });
    if (!userFile) {
        return res.status(403).send({ message: "You don't have access to this file" });
    }
    const patientid = userFile.info.patientid;
    const patient = await User.findByPk(patientid);
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
        res.download(decryptedFilePath, (err) => {
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
router.get("/lab/patients", async (req, res) => {
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
        },
        attributes: ['id_user', 'username', 'email', 'phonenumber']
    });
    return res.status(200).send(users);
});

export default router;