/**
 * SISTEMA DE BACKUP AUTOMÁTICO - EDITALIZA
 * Backup incremental e completo com compressão
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { securityLog } = require('./security');

const gzip = promisify(zlib.gzip);

/**
 * Classe para gerenciar backups automáticos
 */
class BackupManager {
    constructor(config = {}) {
        this.dbPath = config.dbPath || path.join(process.cwd(), 'db.sqlite');
        this.backupDir = config.backupDir || path.join(process.cwd(), 'backups');
        this.maxBackups = config.maxBackups || 30; // Manter 30 backups
        this.compressionEnabled = config.compression !== false;
        
        this.ensureBackupDirectory();
    }

    async ensureBackupDirectory() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
        } catch (error) {
            console.error('Erro ao criar diretório de backup:', error);
        }
    }

    /**
     * Gerar nome do arquivo de backup
     * @param {string} type - Tipo do backup (full, incremental)
     * @returns {string} - Nome do arquivo
     */
    generateBackupFileName(type = 'full') {
        const timestamp = new Date().toISOString()
            .replace(/:/g, '-')
            .replace(/\./g, '-');
        
        const extension = this.compressionEnabled ? '.gz' : '';
        return `${type}-backup-${timestamp}.sqlite${extension}`;
    }

    /**
     * Verificar se arquivo de banco existe e é acessível
     * @returns {Promise<boolean>}
     */
    async isDatabaseAccessible() {
        try {
            await fs.access(this.dbPath, fsSync.constants.R_OK);
            return true;
        } catch (error) {
            console.error('Banco de dados não está acessível:', error);
            return false;
        }
    }

    /**
     * Criar backup completo do banco
     * @returns {Promise<string>} - Caminho do arquivo de backup
     */
    async createFullBackup() {
        try {
            if (!(await this.isDatabaseAccessible())) {
                throw new Error('Banco de dados não está acessível para backup');
            }

            const backupFileName = this.generateBackupFileName('full');
            const backupPath = path.join(this.backupDir, backupFileName);

            // Ler arquivo do banco
            const dbData = await fs.readFile(this.dbPath);

            // Comprimir se habilitado
            let finalData = dbData;
            if (this.compressionEnabled) {
                finalData = await gzip(dbData);
            }

            // Escrever backup
            await fs.writeFile(backupPath, finalData);

            // Verificar integridade
            const stats = await fs.stat(backupPath);
            if (stats.size === 0) {
                throw new Error('Backup criado com tamanho zero');
            }

            console.log(`Backup completo criado: ${backupFileName} (${this.formatFileSize(stats.size)})`);
            
            securityLog('backup_created', {
                type: 'full',
                filename: backupFileName,
                size: stats.size,
                compressed: this.compressionEnabled
            });

            return backupPath;
        } catch (error) {
            console.error('Erro ao criar backup completo:', error);
            securityLog('backup_failed', {
                type: 'full',
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Restaurar backup
     * @param {string} backupPath - Caminho do arquivo de backup
     * @returns {Promise<void>}
     */
    async restoreBackup(backupPath) {
        try {
            // Verificar se arquivo de backup existe
            await fs.access(backupPath, fsSync.constants.R_OK);

            // Fazer backup do banco atual antes de restaurar
            const currentBackup = await this.createFullBackup();
            console.log(`Backup atual salvo em: ${currentBackup}`);

            // Ler dados do backup
            let backupData = await fs.readFile(backupPath);

            // Descomprimir se necessário
            if (this.compressionEnabled && backupPath.endsWith('.gz')) {
                const gunzip = promisify(zlib.gunzip);
                backupData = await gunzip(backupData);
            }

            // Restaurar banco
            await fs.writeFile(this.dbPath, backupData);

            console.log(`Banco restaurado de: ${path.basename(backupPath)}`);
            
            securityLog('backup_restored', {
                backupFile: path.basename(backupPath),
                restoredTo: this.dbPath
            });

        } catch (error) {
            console.error('Erro ao restaurar backup:', error);
            securityLog('backup_restore_failed', {
                backupFile: backupPath,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Listar backups disponíveis
     * @returns {Promise<Array>} - Lista de backups com metadados
     */
    async listBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = [];

            for (const file of files) {
                if (file.includes('backup') && file.endsWith('.sqlite') || file.endsWith('.sqlite.gz')) {
                    const filePath = path.join(this.backupDir, file);
                    const stats = await fs.stat(filePath);
                    
                    backups.push({
                        filename: file,
                        path: filePath,
                        size: stats.size,
                        created: stats.mtime,
                        compressed: file.endsWith('.gz'),
                        type: file.includes('full') ? 'full' : 'incremental'
                    });
                }
            }

            // Ordenar por data de criação (mais recente primeiro)
            return backups.sort((a, b) => b.created - a.created);
        } catch (error) {
            console.error('Erro ao listar backups:', error);
            return [];
        }
    }

    /**
     * Limpar backups antigos
     * @returns {Promise<void>}
     */
    async cleanupOldBackups() {
        try {
            const backups = await this.listBackups();
            
            if (backups.length <= this.maxBackups) {
                return; // Não há backups em excesso
            }

            // Remover backups mais antigos
            const backupsToRemove = backups.slice(this.maxBackups);
            
            for (const backup of backupsToRemove) {
                await fs.unlink(backup.path);
                console.log(`Backup removido: ${backup.filename}`);
            }

            securityLog('backup_cleanup', {
                removed: backupsToRemove.length,
                remaining: this.maxBackups
            });

        } catch (error) {
            console.error('Erro na limpeza de backups:', error);
        }
    }

    /**
     * Verificar integridade de um backup
     * @param {string} backupPath - Caminho do backup
     * @returns {Promise<boolean>} - Se o backup está íntegro
     */
    async verifyBackupIntegrity(backupPath) {
        try {
            const stats = await fs.stat(backupPath);
            
            // Verificar se arquivo não está vazio
            if (stats.size === 0) {
                return false;
            }

            // Se for comprimido, tentar descomprimir
            if (backupPath.endsWith('.gz')) {
                const data = await fs.readFile(backupPath);
                const gunzip = promisify(zlib.gunzip);
                await gunzip(data);
            }

            return true;
        } catch (error) {
            console.error('Erro na verificação de integridade:', error);
            return false;
        }
    }

    /**
     * Formatar tamanho de arquivo para exibição
     * @param {number} bytes - Tamanho em bytes
     * @returns {string} - Tamanho formatado
     */
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Agendar backup automático
     * @param {number} intervalHours - Intervalo em horas
     */
    scheduleAutoBackup(intervalHours = 6) {
        const intervalMs = intervalHours * 60 * 60 * 1000;

        // Fazer backup inicial
        this.createFullBackup().catch(error => {
            console.error('Erro no backup inicial:', error);
        });

        // Agendar backups periódicos
        setInterval(async () => {
            try {
                await this.createFullBackup();
                await this.cleanupOldBackups();
            } catch (error) {
                console.error('Erro no backup automático:', error);
            }
        }, intervalMs);

        console.log(`Backup automático agendado a cada ${intervalHours} horas`);
    }

    /**
     * Obter estatísticas dos backups
     * @returns {Promise<Object>} - Estatísticas
     */
    async getBackupStats() {
        try {
            const backups = await this.listBackups();
            
            const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
            const compressedCount = backups.filter(b => b.compressed).length;
            
            return {
                totalBackups: backups.length,
                totalSize: this.formatFileSize(totalSize),
                compressedBackups: compressedCount,
                oldestBackup: backups.length > 0 ? backups[backups.length - 1].created : null,
                newestBackup: backups.length > 0 ? backups[0].created : null
            };
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            return null;
        }
    }
}

module.exports = BackupManager;