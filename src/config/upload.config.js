// src/config/upload.config.js - FASE 8 - Configuração de Upload de Arquivos

const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Configuração do Multer para upload de arquivos
 */
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Gerar nome único para o arquivo
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + ext);
    }
});

/**
 * Instância do Multer configurada
 */
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB máximo
    },
    fileFilter: function (req, file, cb) {
        // Verificar se o arquivo é uma imagem
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem são permitidos.'), false);
        }
    }
});

/**
 * Configurar middleware de upload
 * @param {Express} app - Instância do Express
 */
function configureUpload(app) {
    // Servir arquivos de upload estaticamente
    app.use('/uploads', require('express').static(path.join(__dirname, '../../uploads')));
}

module.exports = {
    upload,
    configureUpload
};
