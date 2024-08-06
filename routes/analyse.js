import { Router } from "express";
import { User, File, UserFile } from "../sequalize/relation.js";
import verifyjwt from "../utils/jwt.js";
import multer from "multer";
import isalab from "../utils/isalab.js";
import fs from "fs";
import path from 'path';
import { Op, where } from "sequelize";
import { PDFDocument } from "pdf-lib";
import crypto from "crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config();
const router = Router();
router.use(verifyjwt);
router.use(isalab);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
function destination() {
    if (process.env.NODE_ENV === 'production') {
        return process.env.UPLOADS_DIR || 'uploads';
    }
}
const storage = multer.memoryStorage();
/*const storage = multer.diskStorage({
    destination: destination(),
    filename: function (req, file, cb) {
        // Generate a unique filename with the original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
});*/
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
    if (patient.role != "patient") {
        return res.status(404).send({ message: 'Patient not found' });
    }
    const password = patient.password;
    try {
        // Encrypt the PDF bytes
        const { iv, encrypted } = encryptData(file.buffer, password);

        // Upload the encrypted PDF to Supabase Storage
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filePath = `uploads/encrypted_${uniqueSuffix}${path.extname(file.originalname)}`;
        const { data, error } = await supabase
            .storage
            .from('uploads')
            .upload(filePath, Buffer.concat([iv, encrypted]), {
                contentType: file.mimetype
            });

        if (error) {
            console.error('Error uploading file to Supabase:', error);
            throw error;
        }

        // Save file information in the database
        const uploadedfile = await File.create({ filename: file.originalname, path: filePath });
        await UserFile.create({ id_user: userid, id_file: uploadedfile.id_file, info: { sharedwith: patientid } });
        await UserFile.create({ id_user: patientid, id_file: uploadedfile.id_file, info: { sharedwby: userid } });
        return res.status(200).send({ message: 'File uploaded and encrypted' });
    } catch (error) {
        console.error('Error processing file:', error);
        return res.status(500).send({ message: 'Error processing file' });
    }
});

router.get('/lab/files', async (req, res) => {
    try {
        const userid = req.userid;
        const lab = await User.findByPk(userid);
        const labfiles = await UserFile.findAll({
            where: {
                id_user: userid,
            },
            attributes: ['id_file', 'info', 'created_at'],
        });
        const filesid = labfiles.map(labfile => labfile.id_file);
        const files = await File.findAll({
            where: {
                id_file: {
                    [Op.in]: filesid
                }
            },
            attributes: ['id_file', 'filename']
        });
        const patiientsids = labfiles.map(labfile => labfile.info.sharedwith);
        const patients = await User.findAll({
            where: {
                id_user: {
                    [Op.in]: patiientsids
                }
            },
            attributes: ['id_user', 'name']
        });
        const filesplus = files.map(file => {
            const labfile = labfiles.find(labfile => labfile.id_file === file.id_file);
            console.log(labfile);
            if (!labfile) {
                throw new Error('Labfile not found');
            }
            const patient = patients.find(patient => patient.id_user == labfile.info.sharedwith);
            if (!patient) {
                throw new Error('Patient not found');
            }
            if (!labfile) {
                throw new Error('Labfile not found');
            }
            return {
                id_file: file.id_file,
                filename: file.filename,
                patient: patient,
                created_at: labfile.created_at
            };
        });
        return res.status(200).send(filesplus);
    } catch (error) {
        console.error('Error getting files:', error);
        return res.status(500).send({ message: 'Error getting files' });
    }
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
        fs.unlinkSync(file.path); // Use the path from the file record to delete it
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
router.get("/lab/file/view/:id", async (req, res) => {
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