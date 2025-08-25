/**
 * Profile Controller - Consolidated
 * 
 * Gerencia todas as operações de perfil de usuário
 * Migrado do server.js (linhas 1011-1240 e 426-537)
 * 
 * IMPORTANTE: Mantém 100% da lógica e validações existentes
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');

// Database
const db = require('../../database-postgresql');

// Utils
const logger = require('../utils/logger');
const { validateFilePath, createSafeError, securityLog } = require('../utils/security');

// ============================================================================
// CONFIGURAÇÃO DO MULTER PARA UPLOAD DE FOTOS
// ============================================================================

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

const uploadMiddleware = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB máximo
    },
    fileFilter: function (req, file, cb) {
        // Aceitar apenas imagens
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// ============================================================================
// FUNÇÕES DO CONTROLLER
// ============================================================================

/**
 * Get user profile
 * GET /api/users/profile
 * 
 * Mantém lógica do server.js linhas 1011-1059
 */
const getProfile = async (req, res) => {
    try {
        const user = await db.getAsync(`
            SELECT 
                id, email, name, profile_picture, phone, whatsapp, created_at,
                state, city, birth_date, education, work_status, first_time, concursos_count,
                difficulties, area_interest, level_desired, timeline_goal, study_hours, motivation_text,
                google_id, auth_provider, google_avatar
            FROM users 
            WHERE id = ?
        `, [req.user.id]);

        if (!user) {
            logger.warn('PROFILE_NOT_FOUND', { userId: req.user.id });
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        // Parse difficulties JSON string back to array
        let difficulties = [];
        if (user.difficulties) {
            try {
                difficulties = JSON.parse(user.difficulties);
            } catch (e) {
                logger.error('PARSE_DIFFICULTIES_ERROR', { 
                    userId: req.user.id, 
                    error: e.message 
                });
                difficulties = [];
            }
        }
        
        logger.info('PROFILE_FETCHED', { userId: req.user.id });
        
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            profile_picture: user.profile_picture,
            phone: user.phone,
            whatsapp: user.whatsapp,
            created_at: user.created_at,
            state: user.state,
            city: user.city,
            birth_date: user.birth_date,
            education: user.education,
            work_status: user.work_status,
            first_time: user.first_time,
            concursos_count: user.concursos_count,
            difficulties: difficulties,
            area_interest: user.area_interest,
            level_desired: user.level_desired,
            timeline_goal: user.timeline_goal,
            study_hours: user.study_hours,
            motivation_text: user.motivation_text,
            // Campos OAuth
            google_id: user.google_id,
            auth_provider: user.auth_provider,
            google_avatar: user.google_avatar
        });
    } catch (error) {
        logger.error('GET_PROFILE_ERROR', { 
            userId: req.user.id, 
            error: error.message 
        });
        return res.status(500).json({ 
            error: 'Erro ao carregar perfil do usuário.' 
        });
    }
};

/**
 * Update user profile
 * PATCH /api/users/profile
 * 
 * Mantém lógica do server.js linhas 1062-1240
 */
const updateProfile = async (req, res) => {
    // Validação já feita pelo middleware de rotas
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { 
        name, profile_picture, phone, whatsapp, state, city, birth_date, education,
        work_status, first_time, concursos_count, difficulties, area_interest, 
        level_desired, timeline_goal, study_hours, motivation_text
    } = req.body;

    logger.debug('UPDATE_PROFILE_REQUEST', { 
        userId: req.user.id,
        fields: Object.keys(req.body)
    });
    
    try {
        const updates = [];
        const values = [];
        
        // Basic profile fields
        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (profile_picture !== undefined) {
            updates.push('profile_picture = ?');
            values.push(profile_picture);
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            values.push(phone);
        }
        if (whatsapp !== undefined) {
            updates.push('whatsapp = ?');
            values.push(whatsapp);
        }
        
        // Extended profile fields
        if (state !== undefined) {
            updates.push('state = ?');
            values.push(state);
        }
        if (city !== undefined) {
            updates.push('city = ?');
            values.push(city);
        }
        if (birth_date !== undefined) {
            updates.push('birth_date = ?');
            values.push(birth_date);
        }
        if (education !== undefined) {
            updates.push('education = ?');
            values.push(education);
        }
        if (work_status !== undefined) {
            updates.push('work_status = ?');
            values.push(work_status);
        }
        if (first_time !== undefined) {
            updates.push('first_time = ?');
            values.push(first_time);
        }
        if (concursos_count !== undefined) {
            updates.push('concursos_count = ?');
            values.push(concursos_count);
        }
        if (difficulties !== undefined) {
            updates.push('difficulties = ?');
            // Ensure difficulties is always an array or null
            const difficultiesToStore = difficulties === null ? [] : 
                (Array.isArray(difficulties) ? difficulties : []);
            values.push(JSON.stringify(difficultiesToStore)); // Store as JSON string
        }
        if (area_interest !== undefined) {
            updates.push('area_interest = ?');
            values.push(area_interest);
        }
        if (level_desired !== undefined) {
            updates.push('level_desired = ?');
            values.push(level_desired);
        }
        if (timeline_goal !== undefined) {
            updates.push('timeline_goal = ?');
            values.push(timeline_goal);
        }
        if (study_hours !== undefined) {
            updates.push('study_hours = ?');
            values.push(study_hours);
        }
        if (motivation_text !== undefined) {
            updates.push('motivation_text = ?');
            values.push(motivation_text);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ 
                error: 'Nenhum campo para atualizar.' 
            });
        }
        
        // Adicionar ID do usuário no final
        values.push(req.user.id);
        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        
        await db.runAsync(sql, values);
        
        logger.info('PROFILE_UPDATED', { 
            userId: req.user.id,
            fieldsUpdated: updates.length
        });
        
        // Retornar dados atualizados com todos os campos
        const updatedUser = await db.getAsync(`
            SELECT 
                id, email, name, profile_picture, phone, whatsapp, created_at,
                state, city, birth_date, education, work_status, first_time, concursos_count,
                difficulties, area_interest, level_desired, timeline_goal, study_hours, motivation_text
            FROM users 
            WHERE id = ?
        `, [req.user.id]);
        
        // Parse difficulties back to array
        let userDifficulties = [];
        if (updatedUser.difficulties) {
            try {
                userDifficulties = JSON.parse(updatedUser.difficulties);
            } catch (e) {
                userDifficulties = [];
            }
        }
        
        res.json({
            message: 'Perfil atualizado com sucesso',
            profile: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                profile_picture: updatedUser.profile_picture,
                phone: updatedUser.phone,
                whatsapp: updatedUser.whatsapp,
                created_at: updatedUser.created_at,
                state: updatedUser.state,
                city: updatedUser.city,
                birth_date: updatedUser.birth_date,
                education: updatedUser.education,
                work_status: updatedUser.work_status,
                first_time: updatedUser.first_time,
                concursos_count: updatedUser.concursos_count,
                difficulties: userDifficulties,
                area_interest: updatedUser.area_interest,
                level_desired: updatedUser.level_desired,
                timeline_goal: updatedUser.timeline_goal,
                study_hours: updatedUser.study_hours,
                motivation_text: updatedUser.motivation_text
            }
        });
    } catch (error) {
        logger.error('UPDATE_PROFILE_ERROR', { 
            userId: req.user.id,
            error: error.message
        });
        return res.status(500).json({ 
            error: 'Erro ao atualizar perfil.' 
        });
    }
};

/**
 * Upload profile photo
 * POST /api/users/profile/photo
 * 
 * Mantém lógica do server.js linhas 426-537
 */
const uploadProfilePhoto = async (req, res) => {
    // O multer já processou o arquivo neste ponto
    if (!req.file) {
        return res.status(400).json({ 
            error: 'Nenhuma foto foi enviada.' 
        });
    }

    try {
        // Deletar foto anterior se existir
        const user = await db.getAsync(
            'SELECT profile_picture FROM users WHERE id = ?', 
            [req.user.id]
        );

        if (user && user.profile_picture) {
            const oldPhotoPath = path.join(__dirname, '../../', user.profile_picture);
            
            // Validar path antes de deletar (segurança)
            if (validateFilePath(oldPhotoPath, path.join(__dirname, '../../uploads'))) {
                fs.unlink(oldPhotoPath, (err) => {
                    if (err && err.code !== 'ENOENT') {
                        logger.error('DELETE_OLD_PHOTO_ERROR', { 
                            path: oldPhotoPath,
                            error: err.message
                        });
                    }
                });
            }
        }

        // Salvar caminho da nova foto
        const photoPath = `/uploads/${req.file.filename}`;
        await db.runAsync(
            'UPDATE users SET profile_picture = ? WHERE id = ?',
            [photoPath, req.user.id]
        );

        logger.info('PROFILE_PHOTO_UPLOADED', { 
            userId: req.user.id,
            filename: req.file.filename,
            size: req.file.size
        });

        res.json({
            message: 'Foto de perfil atualizada com sucesso!',
            profile_picture: photoPath
        });
    } catch (error) {
        logger.error('UPLOAD_PHOTO_ERROR', { 
            userId: req.user.id,
            error: error.message
        });
        
        // Deletar arquivo enviado em caso de erro
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) {
                    logger.error('DELETE_UPLOADED_FILE_ERROR', { 
                        path: req.file.path,
                        error: err.message
                    });
                }
            });
        }
        
        return res.status(500).json({ 
            error: 'Erro ao salvar foto de perfil.' 
        });
    }
};

/**
 * Delete profile photo
 * DELETE /api/users/profile/photo
 * 
 * Nova funcionalidade para remover foto de perfil
 */
const deleteProfilePhoto = async (req, res) => {
    try {
        const user = await db.getAsync(
            'SELECT profile_picture FROM users WHERE id = ?',
            [req.user.id]
        );

        if (!user || !user.profile_picture) {
            return res.status(404).json({ 
                error: 'Nenhuma foto de perfil para remover.' 
            });
        }

        // Deletar arquivo físico
        const photoPath = path.join(__dirname, '../../', user.profile_picture);
        
        if (validateFilePath(photoPath, path.join(__dirname, '../../uploads'))) {
            fs.unlink(photoPath, async (err) => {
                if (err && err.code !== 'ENOENT') {
                    logger.error('DELETE_PHOTO_FILE_ERROR', { 
                        path: photoPath,
                        error: err.message
                    });
                    return res.status(500).json({ 
                        error: 'Erro ao remover arquivo de foto.' 
                    });
                }

                // Limpar referência no banco
                await db.runAsync(
                    'UPDATE users SET profile_picture = NULL WHERE id = ?',
                    [req.user.id]
                );

                logger.info('PROFILE_PHOTO_DELETED', { 
                    userId: req.user.id,
                    path: user.profile_picture
                });

                res.json({ 
                    message: 'Foto de perfil removida com sucesso.' 
                });
            });
        } else {
            return res.status(400).json({ 
                error: 'Caminho de foto inválido.' 
            });
        }
    } catch (error) {
        logger.error('DELETE_PHOTO_ERROR', { 
            userId: req.user.id,
            error: error.message
        });
        return res.status(500).json({ 
            error: 'Erro ao remover foto de perfil.' 
        });
    }
};

/**
 * Validações para atualização de perfil
 * Exportadas para uso nas rotas
 */
const profileValidations = [
    // Basic profile validations
    body('name').optional()
        .isString().isLength({ min: 1, max: 100 })
        .withMessage('Nome deve ter entre 1 e 100 caracteres'),
    body('profile_picture').optional()
        .isString().isLength({ max: 500 })
        .withMessage('URL da foto muito longa'),
    body('phone').optional()
        .isString().isLength({ max: 20 })
        .withMessage('Telefone muito longo'),
    body('whatsapp').optional()
        .isString().isLength({ max: 20 })
        .withMessage('WhatsApp muito longo'),
    
    // Extended profile validations
    body('state').optional()
        .isString().isLength({ max: 2 })
        .withMessage('Estado deve ser a sigla com 2 caracteres'),
    body('city').optional()
        .isString().isLength({ max: 100 })
        .withMessage('Cidade muito longa'),
    body('birth_date').optional()
        .isISO8601()
        .withMessage('Data de nascimento inválida'),
    body('education').optional()
        .isString().isLength({ max: 50 })
        .withMessage('Escolaridade inválida'),
    body('work_status').optional()
        .isString().isLength({ max: 50 })
        .withMessage('Situação profissional inválida'),
    body('first_time').optional()
        .isString().isIn(['sim', 'nao'])
        .withMessage('Primeira vez deve ser sim ou nao'),
    body('concursos_count').optional()
        .isString()
        .withMessage('Contagem de concursos inválida'),
    body('difficulties').optional()
        .custom((value) => {
            let parsedValue = value;
            if (typeof value === 'string') {
                try {
                    parsedValue = JSON.parse(value);
                } catch (e) {
                    // Se não for um JSON válido, deixe como está
                }
            }
            if (parsedValue === null || parsedValue === undefined) return true;
            if (Array.isArray(parsedValue)) return true;
            throw new Error('Dificuldades deve ser um array');
        }),
    body('area_interest').optional()
        .isString().isLength({ max: 50 })
        .withMessage('Área de interesse inválida'),
    body('level_desired').optional()
        .isString().isLength({ max: 50 })
        .withMessage('Nível desejado inválido'),
    body('timeline_goal').optional()
        .isString().isLength({ max: 50 })
        .withMessage('Prazo inválido'),
    body('study_hours').optional()
        .isString().isLength({ max: 20 })
        .withMessage('Horas de estudo inválidas'),
    body('motivation_text').optional()
        .isString().isLength({ max: 1000 })
        .withMessage('Texto de motivação muito longo')
];

module.exports = {
    // Funções principais
    getProfile,
    updateProfile,
    uploadProfilePhoto,
    deleteProfilePhoto,
    
    // Middleware e validações
    uploadMiddleware,
    profileValidations
};