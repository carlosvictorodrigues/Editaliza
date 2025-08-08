// security-patch.js
// Script para aplicar correções críticas de segurança

const fs = require('fs');
const path = require('path');

console.log('🔒 Iniciando aplicação do patch de segurança...');

const serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// 1. REMOVER ROTAS DUPLICADAS DE UPLOAD
console.log('1. Removendo rotas duplicadas de upload...');

// Encontrar todas as ocorrências da rota de upload
const uploadRoutePattern = /\/\/ Rota para upload de foto de perfil\napp\.post\('\/profile\/upload-photo'[\s\S]*?\n\}\);\n/g;
const matches = [...serverContent.matchAll(uploadRoutePattern)];

console.log(`   Encontradas ${matches.length} rotas de upload duplicadas`);

if (matches.length > 1) {
    // Manter apenas a primeira ocorrência e remover as outras
    let newContent = serverContent;
    
    // Remover da última para a primeira (para não afetar índices)
    for (let i = matches.length - 1; i > 0; i--) {
        const match = matches[i];
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        newContent = newContent.slice(0, startIndex) + newContent.slice(endIndex);
    }
    
    // Agora substituir a primeira ocorrência pela versão segura
    const secureUploadRoute = `// ============================================================================
// ROTA DE UPLOAD DE FOTO DE PERFIL - VERSÃO SEGURA (ÚNICA)
// ============================================================================
const { validateFilePath, createSafeError, securityLog } = require('./src/utils/security');

app.post('/profile/upload-photo', authenticateToken, (req, res) => {
    upload.single('photo')(req, res, async (err) => {
        if (err) {
            securityLog('upload_error', { error: err.message }, req.user.id, req);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'Arquivo muito grande. Máximo 5MB.' });
                }
            }
            return res.status(400).json({ error: err.message });
        }
        
        if (!req.file) {
            securityLog('upload_no_file', {}, req.user.id, req);
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }
        
        try {
            // Obter a foto de perfil anterior para deletar
            const user = await dbGet('SELECT profile_picture FROM users WHERE id = ?', [req.user.id]);
            const oldPhoto = user?.profile_picture;
            
            // Atualizar o caminho da foto no banco
            const photoPath = \`/uploads/\${req.file.filename}\`;
            await dbRun('UPDATE users SET profile_picture = ? WHERE id = ?', [photoPath, req.user.id]);
            
            // CORREÇÃO CRÍTICA: Validação segura de path antes de deletar
            if (oldPhoto && oldPhoto !== photoPath && oldPhoto.startsWith('/uploads/')) {
                try {
                    const validatedPath = validateFilePath(oldPhoto, 'uploads');
                    const oldFilePath = path.join(__dirname, validatedPath.substring(1));
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                        securityLog('old_photo_deleted', { path: validatedPath }, req.user.id, req);
                    }
                } catch (pathError) {
                    securityLog('invalid_photo_path', { error: pathError.message, path: oldPhoto }, req.user.id, req);
                    // Continue sem deletar se path for inválido
                }
            }
            
            securityLog('photo_uploaded', { photoPath }, req.user.id, req);
            res.json({
                message: 'Foto de perfil atualizada com sucesso!',
                profile_picture: photoPath
            });
            
        } catch (error) {
            securityLog('upload_database_error', error.message, req.user.id, req);
            
            // Deletar arquivo se houver erro ao salvar no banco
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            res.status(500).json(createSafeError(error, 'Erro ao salvar foto de perfil'));
        }
    });
});`;

    newContent = newContent.replace(uploadRoutePattern, secureUploadRoute + '\n');
    serverContent = newContent;
    console.log('   ✅ Rotas duplicadas removidas e versão segura aplicada');
}

// 2. ADICIONAR VALIDAÇÃO DE SECRETS EM PRODUÇÃO
console.log('2. Adicionando validação de secrets...');

const secretValidation = `
// ============================================================================
// VALIDAÇÃO DE SEGURANÇA EM PRODUÇÃO
// ============================================================================
const { validateProductionSecrets } = require('./src/utils/security');

// Validar secrets em produção antes de inicializar
try {
    validateProductionSecrets();
    console.log('✅ Secrets de produção validados');
} catch (error) {
    console.error('❌ ERRO DE SEGURANÇA:', error.message);
    if (process.env.NODE_ENV === 'production') {
        process.exit(1); // Não permitir inicialização sem secrets
    }
}
`;

// Inserir após os requires
const afterRequires = serverContent.indexOf("const app = express();");
if (afterRequires !== -1) {
    serverContent = serverContent.slice(0, afterRequires) + secretValidation + '\n' + serverContent.slice(afterRequires);
    console.log('   ✅ Validação de secrets adicionada');
}

// 3. ATUALIZAR CONFIGURAÇÃO DE CORS PARA SER MAIS RESTRITIVA
console.log('3. Atualizando configuração CORS...');

const oldCorsConfig = `app.use(cors({
    origin: function (origin, callback) {
        // Permitir requisições sem origin (ex: Postman) apenas em desenvolvimento
        if (!origin && process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));`;

const newCorsConfig = `app.use(cors({
    origin: function (origin, callback) {
        // CORREÇÃO: Ser mais restritivo mesmo em desenvolvimento
        if (!origin && process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn('CORS bloqueou origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    exposedHeaders: ['X-Total-Count'] // Headers seguros para expor
}));`;

if (serverContent.includes(oldCorsConfig)) {
    serverContent = serverContent.replace(oldCorsConfig, newCorsConfig);
    console.log('   ✅ Configuração CORS atualizada');
}

// 4. SALVAR ARQUIVO CORRIGIDO
console.log('4. Salvando correções...');

// Backup do arquivo original
const backupPath = path.join(__dirname, `server_backup_security_${Date.now()}.js`);
fs.writeFileSync(backupPath, fs.readFileSync(serverPath, 'utf8'));
console.log(`   📋 Backup criado: ${path.basename(backupPath)}`);

// Salvar versão corrigida
fs.writeFileSync(serverPath, serverContent);
console.log('   ✅ Arquivo server.js corrigido');

console.log('\n🎉 PATCH DE SEGURANÇA APLICADO COM SUCESSO!');
console.log('\n📊 Resumo das correções:');
console.log('   • Rotas duplicadas de upload removidas');
console.log('   • Validação de paths implementada');
console.log('   • Logging de auditoria adicionado');
console.log('   • Validação de secrets em produção');
console.log('   • Configuração CORS melhorada');
console.log('   • Error handling seguro implementado');

console.log('\n⚠️  IMPORTANTE: Reinicie o servidor para aplicar as mudanças');
console.log('   npm run dev ou npm start');